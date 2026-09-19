import crypto from "crypto";
import { db } from "../db.js";
import { apiTokens, mcpAuditLogs } from "#shared/schema.js";
import { eq, desc, and, inArray, isNotNull, isNull, lt, sql } from "drizzle-orm";

const TOKEN_PREFIX_LEN = 12; // chars shown in UI (e.g. "mcp_sk_a1b2c3")

// Lifetime of a newly issued MCP token. A leaked bearer token stops working on
// its own instead of staying valid forever. Rows with a NULL `expiresAt` (every
// token issued before this existed) are treated as non-expiring so live clients
// are not cut off.
export const TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000;

// Nothing in the deploy applies migrations (the Dockerfile only builds and
// starts the server; `npm run db:push` is a manual step), so a column this
// module selects must be able to add itself, the way `ensureCompanySettingsSchema`
// does in storage.ts. Idempotent, runs once per process, retried on failure.
const mcpSchemaPatches = [
  sql`ALTER TABLE "api_tokens" ADD COLUMN IF NOT EXISTS "expires_at" timestamptz`,
  sql`CREATE INDEX IF NOT EXISTS "idx_oauth_codes_expires_at" ON "oauth_codes" ("expires_at")`,
];
let mcpSchemaReady: Promise<void> | null = null;
export function ensureMcpSchema(): Promise<void> {
  if (!mcpSchemaReady) {
    mcpSchemaReady = (async () => {
      for (const statement of mcpSchemaPatches) await db.execute(statement);
    })().catch((err) => {
      mcpSchemaReady = null;
      throw err;
    });
  }
  return mcpSchemaReady;
}

// Expired rows are swept opportunistically when a token is issued or validated,
// throttled so a busy MCP endpoint does not run the sweep on every request.
const CLEANUP_MIN_INTERVAL_MS = 10 * 60_000;
let lastCleanupAt = 0;

function tokenExpiry(): Date {
  return new Date(Date.now() + TOKEN_TTL_MS);
}

export function isApiTokenExpired(token: Pick<ApiToken, "expiresAt">): boolean {
  return token.expiresAt !== null && token.expiresAt.getTime() <= Date.now();
}

/**
 * Delete what can no longer be used:
 *  - API tokens minted for an authorization code that expired unconsumed (the
 *    raw token was never handed to anyone; deleting cascades the code row),
 *  - remaining expired authorization codes, which hold a plaintext bearer token
 *    until they are consumed,
 *  - and deactivate API tokens past their expiry.
 */
export async function cleanupExpiredTokens(): Promise<void> {
  await ensureMcpSchema();
  const now = new Date();

  const abandoned = await db
    .select({ tokenId: oauthCodes.tokenId })
    .from(oauthCodes)
    .where(and(isNull(oauthCodes.usedAt), isNotNull(oauthCodes.tokenId), lt(oauthCodes.expiresAt, now)));

  const abandonedTokenIds = abandoned
    .map((row) => row.tokenId)
    .filter((id): id is string => id !== null);

  if (abandonedTokenIds.length > 0) {
    await db.delete(apiTokens).where(inArray(apiTokens.id, abandonedTokenIds));
  }

  await db.delete(oauthCodes).where(lt(oauthCodes.expiresAt, now));

  await db
    .update(apiTokens)
    .set({ isActive: false })
    .where(and(eq(apiTokens.isActive, true), lt(apiTokens.expiresAt, now)));
}

/** Fire-and-forget, throttled version of {@link cleanupExpiredTokens}. */
function sweepExpiredTokens(): void {
  const now = Date.now();
  if (now - lastCleanupAt < CLEANUP_MIN_INTERVAL_MS) return;
  lastCleanupAt = now;
  cleanupExpiredTokens().catch((err) => {
    console.error("[mcp-storage] Failed to clean up expired tokens:", err);
  });
}

function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export function generateRawToken(): string {
  return "mcp_sk_" + crypto.randomBytes(24).toString("hex");
}

export async function createApiToken(name: string): Promise<{ token: ApiToken; rawToken: string }> {
  await ensureMcpSchema();
  const raw = generateRawToken();
  const hash = hashToken(raw);
  const prefix = raw.slice(0, TOKEN_PREFIX_LEN);

  const [token] = await db
    .insert(apiTokens)
    .values({ name, tokenHash: hash, tokenPrefix: prefix, expiresAt: tokenExpiry() })
    .returning();

  sweepExpiredTokens();
  return { token, rawToken: raw };
}

export async function listApiTokens() {
  await ensureMcpSchema();
  return db.select().from(apiTokens).orderBy(desc(apiTokens.createdAt));
}

export async function getApiTokenByRaw(raw: string) {
  await ensureMcpSchema();
  const hash = hashToken(raw);
  const [token] = await db
    .select()
    .from(apiTokens)
    .where(eq(apiTokens.tokenHash, hash));

  sweepExpiredTokens();

  if (!token) return null;
  if (isApiTokenExpired(token)) return null;
  return token;
}

export async function rotateApiToken(id: string): Promise<{ token: ApiToken; rawToken: string }> {
  await ensureMcpSchema();
  const raw = generateRawToken();
  const hash = hashToken(raw);
  const prefix = raw.slice(0, TOKEN_PREFIX_LEN);

  const [token] = await db
    .update(apiTokens)
    .set({ tokenHash: hash, tokenPrefix: prefix, rotatedAt: new Date(), lastUsedAt: null, expiresAt: tokenExpiry() })
    .where(eq(apiTokens.id, id))
    .returning();

  return { token, rawToken: raw };
}

export async function deactivateApiToken(id: string) {
  await ensureMcpSchema();
  await db.update(apiTokens).set({ isActive: false }).where(eq(apiTokens.id, id));
}

export async function deleteApiToken(id: string) {
  await ensureMcpSchema();
  await db.delete(apiTokens).where(eq(apiTokens.id, id));
}

export async function touchApiToken(id: string) {
  await ensureMcpSchema();
  await db.update(apiTokens).set({ lastUsedAt: new Date() }).where(eq(apiTokens.id, id));
}

export async function createAuditLog(entry: {
  tokenId:     string;
  tokenPrefix: string;
  toolName:    string;
  targetType?: string;
  targetId?:   string;
  action:      string;
  result:      "success" | "error";
  errorMessage?: string;
  ipAddress?:  string;
}) {
  await db.insert(mcpAuditLogs).values(entry);
}

export async function listAuditLogs(limit = 100) {
  return db
    .select()
    .from(mcpAuditLogs)
    .orderBy(desc(mcpAuditLogs.createdAt))
    .limit(limit);
}

// ── OAuth helpers ─────────────────────────────────────────────────────────────

export async function createOAuthCode(params: {
  code:                string;
  clientId?:           string;
  redirectUri:         string;
  codeChallenge:       string;
  codeChallengeMethod: string;
  scope?:              string;
  tokenId:             string;
  rawToken:            string;
  expiresAt:           Date;
}) {
  await ensureMcpSchema();
  const [row] = await db.insert(oauthCodes).values(params).returning();
  return row;
}

export async function consumeOAuthCode(code: string, codeVerifier: string, redirectUri: string) {
  await ensureMcpSchema();
  const [row] = await db.select().from(oauthCodes).where(eq(oauthCodes.code, code));
  if (!row) return null;
  if (row.usedAt) return null;
  if (new Date() > row.expiresAt) return null;
  if (row.redirectUri !== redirectUri) return null;

  // PKCE: SHA-256(codeVerifier) base64url must match stored codeChallenge.
  // Constant-time compare to avoid leaking the challenge via timing.
  const verifierHash = crypto
    .createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");
  const a = Buffer.from(verifierHash);
  const b = Buffer.from(row.codeChallenge ?? "");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  await db.update(oauthCodes).set({ usedAt: new Date(), rawToken: null }).where(eq(oauthCodes.id, row.id));
  return row;
}

// Re-export type for consumers
import type { ApiToken } from "#shared/schema.js";
import { oauthCodes } from "#shared/schema.js";
export type { ApiToken };
