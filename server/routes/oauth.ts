import crypto from "crypto";
import type { Express } from "express";
import { db } from "../db.js";
import { users } from "#shared/schema.js";
import { eq } from "drizzle-orm";
import { getSupabaseAdmin } from "../lib/supabase.js";
import { createApiToken, createOAuthCode, consumeOAuthCode } from "../lib/mcp-storage.js";

const BASE_URL = "https://skale.club";
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// ── redirect_uri allowlist ─────────────────────────────────────────────────
// Prevents a phished admin from being redirected (with a live auth code) to
// an attacker-controlled host. Configurable via MCP_OAUTH_ALLOWED_REDIRECT_HOSTS
// (comma-separated hostnames) so operators can adjust without a code change if
// the real Claude.ai connector ever uses a different callback host. When unset,
// falls back to a built-in list that keeps the live Claude.ai MCP connector
// working, plus localhost/127.0.0.1 for local development.
const DEFAULT_ALLOWED_REDIRECT_HOSTS = [
  "claude.ai",
  "claude.com",
  "www.claude.ai",
  "www.claude.com",
  "localhost",
  "127.0.0.1",
];

function getAllowedRedirectHosts(): { hosts: string[]; source: "env" | "default" } {
  const envValue = process.env.MCP_OAUTH_ALLOWED_REDIRECT_HOSTS;
  if (envValue && envValue.trim().length > 0) {
    const hosts = envValue
      .split(",")
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean);
    if (hosts.length > 0) return { hosts, source: "env" };
  }
  return { hosts: DEFAULT_ALLOWED_REDIRECT_HOSTS, source: "default" };
}

// Allows a redirect_uri only if its scheme is https: (or http: for
// localhost/127.0.0.1, to support local dev) and its host matches an allowed
// host exactly or is a subdomain of one.
function isRedirectUriAllowed(redirectUri: unknown, allowedHosts: string[]): boolean {
  if (typeof redirectUri !== "string" || !redirectUri) return false;

  let url: URL;
  try {
    url = new URL(redirectUri);
  } catch {
    return false;
  }

  const host = url.hostname.toLowerCase();
  const isLocalHost = host === "localhost" || host === "127.0.0.1";

  if (url.protocol !== "https:" && !(isLocalHost && url.protocol === "http:")) {
    return false;
  }

  return allowedHosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}

function warnRejectedRedirectUri(context: string, redirectUri: unknown, source: "env" | "default") {
  console.warn(
    `[oauth] ${context}: rejected redirect_uri ${JSON.stringify(redirectUri)} ` +
      `(allowlist source: ${source}). Adjust MCP_OAUTH_ALLOWED_REDIRECT_HOSTS if this is unexpected.`
  );
}

export function registerOAuthRoutes(app: Express) {
  // ── CORS preflight ────────────────────────────────────────────────────────
  app.options("/.well-known/oauth-authorization-server", (_req, res) => {
    res.set(CORS_HEADERS).status(204).end();
  });
  app.options("/.well-known/oauth-protected-resource", (_req, res) => {
    res.set(CORS_HEADERS).status(204).end();
  });
  app.options("/api/oauth/token", (_req, res) => {
    res.set(CORS_HEADERS).status(204).end();
  });
  app.options("/api/oauth/register", (_req, res) => {
    res.set(CORS_HEADERS).status(204).end();
  });

  // ── Protected Resource Metadata (RFC 9728) ────────────────────────────────
  // Required by MCP spec: tells the client which auth servers protect this resource.
  app.get("/.well-known/oauth-protected-resource", (_req, res) => {
    res.set(CORS_HEADERS).json({
      resource: `${BASE_URL}/mcp`,
      authorization_servers: [BASE_URL],
      bearer_methods_supported: ["header"],
      scopes_supported: ["mcp"],
    });
  });

  // ── OAuth server metadata (RFC 8414) ──────────────────────────────────────
  app.get("/.well-known/oauth-authorization-server", (_req, res) => {
    res.set(CORS_HEADERS).json({
      issuer: BASE_URL,
      authorization_endpoint: `${BASE_URL}/oauth/authorize`,
      token_endpoint: `${BASE_URL}/api/oauth/token`,
      registration_endpoint: `${BASE_URL}/api/oauth/register`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
      scopes_supported: ["mcp"],
    });
  });

  // ── Dynamic client registration (RFC 7591) ────────────────────────────────
  // Claude.ai may call this before the authorization flow.
  app.post("/api/oauth/register", (req, res) => {
    const rawRedirectUris = req.body?.redirect_uris;
    const redirectUris: unknown[] = Array.isArray(rawRedirectUris)
      ? rawRedirectUris
      : rawRedirectUris !== undefined && rawRedirectUris !== null
        ? [rawRedirectUris]
        : [];

    const { hosts: allowedHosts, source } = getAllowedRedirectHosts();
    for (const uri of redirectUris) {
      if (!isRedirectUriAllowed(uri, allowedHosts)) {
        warnRejectedRedirectUri("register", uri, source);
        return res.set(CORS_HEADERS).status(400).json({ error: "invalid_redirect_uri" });
      }
    }

    const clientId = "claude-" + crypto.randomBytes(8).toString("hex");
    res.set(CORS_HEADERS).status(201).json({
      client_id: clientId,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      redirect_uris: req.body?.redirect_uris ?? [],
      grant_types: ["authorization_code"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    });
  });

  // ── Authorization endpoint (POST — called by our React page) ─────────────
  // Body: { accessToken, client_id, redirect_uri, state, code_challenge,
  //         code_challenge_method, scope, response_type }
  app.post("/api/oauth/authorize", async (req, res) => {
    const {
      accessToken,
      client_id,
      redirect_uri,
      state,
      code_challenge,
      code_challenge_method = "S256",
      scope,
      response_type,
    } = req.body ?? {};

    if (!accessToken) return res.status(400).json({ message: "accessToken required" });
    if (!redirect_uri) return res.status(400).json({ message: "redirect_uri required" });
    if (!code_challenge) return res.status(400).json({ message: "code_challenge required" });
    if (response_type !== "code") return res.status(400).json({ message: "response_type must be code" });
    if (code_challenge_method !== "S256") return res.status(400).json({ message: "Only S256 supported" });

    // Reject disallowed redirect_uri hosts before minting any code/token.
    const { hosts: allowedRedirectHosts, source: redirectHostsSource } = getAllowedRedirectHosts();
    if (!isRedirectUriAllowed(redirect_uri, allowedRedirectHosts)) {
      warnRejectedRedirectUri("authorize", redirect_uri, redirectHostsSource);
      return res.status(400).json({ error: "invalid_redirect_uri" });
    }

    // Validate Supabase access token
    const supabase = getSupabaseAdmin();
    const { data: { user: supabaseUser }, error } = await supabase.auth.getUser(accessToken);
    if (error || !supabaseUser) return res.status(401).json({ message: "Invalid access token" });

    // Check admin status
    const [dbUser] = await db.select().from(users).where(eq(users.id, supabaseUser.id));
    if (!dbUser?.isAdmin) return res.status(403).json({ message: "Admin access required" });

    // Create API token for this OAuth session
    const tokenName = `Claude OAuth – ${new Date().toLocaleDateString("pt-BR")}`;
    const { token, rawToken } = await createApiToken(tokenName);

    // Create short-lived authorization code (10 min)
    const code = crypto.randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await createOAuthCode({
      code,
      clientId: client_id,
      redirectUri: redirect_uri,
      codeChallenge: code_challenge,
      codeChallengeMethod: code_challenge_method,
      scope,
      tokenId: token.id,
      rawToken,
      expiresAt,
    });

    const redirectTo = `${redirect_uri}?code=${encodeURIComponent(code)}${state ? `&state=${encodeURIComponent(state)}` : ""}`;
    return res.json({ redirect_to: redirectTo });
  });

  // ── Token endpoint ─────────────────────────────────────────────────────────
  app.post("/api/oauth/token", async (req, res) => {
    res.set(CORS_HEADERS);

    const { grant_type, code, code_verifier, redirect_uri } = req.body ?? {};

    if (grant_type !== "authorization_code") {
      return res.status(400).json({ error: "unsupported_grant_type" });
    }
    if (!code || !code_verifier || !redirect_uri) {
      return res.status(400).json({ error: "invalid_request", error_description: "code, code_verifier, and redirect_uri are required" });
    }

    const row = await consumeOAuthCode(code, code_verifier, redirect_uri);
    if (!row) {
      return res.status(400).json({ error: "invalid_grant", error_description: "Code invalid, expired, or already used" });
    }

    return res.json({
      access_token: row.rawToken,
      token_type: "Bearer",
      scope: row.scope ?? "mcp",
    });
  });
}
