import type { Express, Request, Response } from "express";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from "@simplewebauthn/server";
import { db, pool } from "../db.js";
import { adminPasskeys, users } from "#shared/schema.js";
import { requireAdmin } from "./_shared.js";
import { rateLimit, normalizeIpKey } from "../lib/rateLimit.js";
import { getClientIp } from "../lib/turnstile.js";
import { RP_NAME, resolveRelyingParty, type RelyingParty } from "../lib/auth/webauthnConfig.js";
import {
  hashSessionId,
  markSessionTrusted,
  sanitizeDeviceName,
  startAdminSession,
  type TrustedInfo,
} from "../lib/auth/trustedSession.js";

type ChallengeType = "register" | "login" | "reauth";
const CHALLENGE_TTL_MS = 5 * 60_000;

function b64uToBuf(value: string): Uint8Array {
  return new Uint8Array(Buffer.from(value, "base64url"));
}

function storeChallenge(req: Request, type: ChallengeType, challenge: string) {
  (req.session as any).webauthn = { type, challenge, exp: Date.now() + CHALLENGE_TTL_MS };
}

/** One-shot: a challenge can be verified against exactly once. */
function takeChallenge(req: Request, type: ChallengeType): string | null {
  const sess = req.session as any;
  const stored = sess?.webauthn;
  if (sess) delete sess.webauthn;
  if (!stored || stored.type !== type || typeof stored.challenge !== "string" || stored.exp < Date.now()) return null;
  return stored.challenge;
}

function getRp(req: Request, res: Response): RelyingParty | null {
  const rp = resolveRelyingParty(req.hostname, {
    production: process.env.NODE_ENV === "production",
    port: process.env.PORT,
  });
  if (!rp) res.status(400).json({ message: "Passkeys are not available on this host" });
  return rp;
}

function limited(req: Request, res: Response, bucket: string): boolean {
  const ip = normalizeIpKey(getClientIp(req) ?? "unknown");
  if (rateLimit(`${bucket}:${ip}`, { limit: 30, windowMs: 15 * 60_000 })) {
    res.status(429).json({ message: "Too many attempts. Try again later." });
    return true;
  }
  return false;
}

const deviceNameBody = z.object({ deviceName: z.string().max(80).optional() }).strict();
const registerVerifyBody = z.object({
  response: z.object({ id: z.string().min(1) }).passthrough(),
  deviceName: z.string().max(80).optional(),
});
const authVerifyBody = z.object({ response: z.object({ id: z.string().min(1) }).passthrough() });
const idParam = z.string().uuid();

function transportsOf(row: { transports: string[] | null }) {
  return (row.transports ?? []) as NonNullable<RegistrationResponseJSON["response"]["transports"]>;
}

function sessionPayload(u: { isAdmin: boolean | null; email: string | null; firstName: string | null; lastName: string | null }) {
  return { isAdmin: u.isAdmin || false, email: u.email, firstName: u.firstName, lastName: u.lastName };
}

async function currentUser(req: Request) {
  const [u] = await db.select().from(users).where(eq(users.id, (req.session as any).userId));
  return u;
}

export function registerPasskeyRoutes(app: Express) {
  // ---------------------------------------------------------------------
  // Trusted devices
  // ---------------------------------------------------------------------
  app.post("/api/auth/trust-device", requireAdmin, (req: Request, res: Response) => {
    const parsed = deviceNameBody.safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ message: "Invalid device name" });
    const name = sanitizeDeviceName(parsed.data.deviceName, req.get("user-agent"));
    const trusted = markSessionTrusted(req, name);
    res.json({ trusted: true, name: trusted.name });
  });

  async function listTrustedSessions(userId: string) {
    const { rows } = await pool.query(
      `SELECT sid, (sess::jsonb)->'trusted' AS trusted, expire
         FROM sessions
        WHERE expire > now()
          AND (sess::jsonb)->>'userId' = $1
          AND (sess::jsonb)->'trusted' IS NOT NULL`,
      [userId],
    );
    return rows as Array<{ sid: string; trusted: TrustedInfo; expire: Date }>;
  }

  app.get("/api/auth/trusted-devices", requireAdmin, async (req: Request, res: Response) => {
    try {
      const rows = await listTrustedSessions((req.session as any).userId);
      const devices = rows
        .map((r) => ({
          id: hashSessionId(r.sid),
          name: r.trusted?.name || "Aparelho",
          createdAt: new Date(r.trusted?.createdAt ?? 0).toISOString(),
          lastSeen: new Date(r.trusted?.lastSeen ?? 0).toISOString(),
          expiresAt: new Date(r.expire).toISOString(),
          current: r.sid === req.sessionID,
        }))
        .sort((a, b) => b.lastSeen.localeCompare(a.lastSeen));
      res.json({ devices });
    } catch (err) {
      console.error("trusted-devices list error:", err);
      res.status(500).json({ message: "Failed to list devices" });
    }
  });

  app.delete("/api/auth/trusted-devices/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      // Only this user's own trusted sessions are ever candidates.
      const target = (await listTrustedSessions((req.session as any).userId)).find(
        (r) => hashSessionId(r.sid) === req.params.id,
      );
      if (!target) return res.status(404).json({ message: "Device not found" });
      await pool.query(`DELETE FROM sessions WHERE sid = $1`, [target.sid]);
      if (target.sid === req.sessionID) res.clearCookie("connect.sid");
      res.json({ success: true });
    } catch (err) {
      console.error("trusted-devices revoke error:", err);
      res.status(500).json({ message: "Failed to revoke device" });
    }
  });

  // ---------------------------------------------------------------------
  // Passkey registration (admin session required)
  // ---------------------------------------------------------------------
  app.post("/api/auth/passkeys/register/options", requireAdmin, async (req: Request, res: Response) => {
    try {
      const rp = getRp(req, res);
      if (!rp) return;
      const user = await currentUser(req);
      if (!user?.email) return res.status(401).json({ message: "Authentication required" });
      const existing = await db.select().from(adminPasskeys).where(eq(adminPasskeys.userId, user.id));
      const options = await generateRegistrationOptions({
        rpName: RP_NAME,
        rpID: rp.rpID,
        userName: user.email,
        userID: new TextEncoder().encode(user.id),
        attestationType: "none",
        excludeCredentials: existing.map((p) => ({ id: p.credentialId, transports: transportsOf(p) })),
        authenticatorSelection: { residentKey: "required", userVerification: "required" },
      });
      storeChallenge(req, "register", options.challenge);
      res.json(options);
    } catch (err) {
      console.error("passkey register options error:", err);
      res.status(500).json({ message: "Failed to start passkey registration" });
    }
  });

  app.post("/api/auth/passkeys/register/verify", requireAdmin, async (req: Request, res: Response) => {
    try {
      const rp = getRp(req, res);
      if (!rp) return;
      const body = registerVerifyBody.safeParse(req.body);
      if (!body.success) return res.status(400).json({ message: "Invalid request" });
      const challenge = takeChallenge(req, "register");
      if (!challenge) return res.status(400).json({ message: "Challenge expired. Try again." });
      const user = await currentUser(req);
      if (!user) return res.status(401).json({ message: "Authentication required" });

      const verification = await verifyRegistrationResponse({
        response: body.data.response as unknown as RegistrationResponseJSON,
        expectedChallenge: challenge,
        expectedOrigin: rp.origins,
        expectedRPID: rp.rpID,
        requireUserVerification: true,
      }).catch(() => null);
      if (!verification?.verified) return res.status(400).json({ message: "Passkey verification failed" });

      const { credential } = verification.registrationInfo;
      const name = sanitizeDeviceName(body.data.deviceName, req.get("user-agent"));
      try {
        const [row] = await db
          .insert(adminPasskeys)
          .values({
            userId: user.id,
            credentialId: credential.id,
            publicKey: Buffer.from(credential.publicKey).toString("base64url"),
            counter: credential.counter,
            transports: credential.transports ?? null,
            deviceName: name,
          })
          .returning();
        res.json({ id: row.id, deviceName: row.deviceName });
      } catch (err) {
        if ((err as { code?: string })?.code === "23505") {
          return res.status(409).json({ message: "This passkey is already registered" });
        }
        throw err;
      }
    } catch (err) {
      console.error("passkey register verify error:", err);
      res.status(500).json({ message: "Failed to register passkey" });
    }
  });

  // ---------------------------------------------------------------------
  // Passkey login (public, rate limited). Discoverable: no email needed.
  // ---------------------------------------------------------------------
  app.post("/api/auth/passkeys/login/options", async (req: Request, res: Response) => {
    try {
      if (limited(req, res, "passkey-login")) return;
      const rp = getRp(req, res);
      if (!rp || !req.session) return;
      const options = await generateAuthenticationOptions({ rpID: rp.rpID, userVerification: "required" });
      storeChallenge(req, "login", options.challenge);
      res.json(options);
    } catch (err) {
      console.error("passkey login options error:", err);
      res.status(500).json({ message: "Failed to start passkey login" });
    }
  });

  app.post("/api/auth/passkeys/login/verify", async (req: Request, res: Response) => {
    try {
      if (limited(req, res, "passkey-login")) return;
      const rp = getRp(req, res);
      if (!rp) return;
      const body = authVerifyBody.safeParse(req.body);
      if (!body.success) return res.status(400).json({ message: "Invalid request" });
      const challenge = takeChallenge(req, "login");
      if (!challenge) return res.status(400).json({ message: "Challenge expired. Try again." });
      const response = body.data.response as unknown as AuthenticationResponseJSON;

      const [passkey] = await db.select().from(adminPasskeys).where(eq(adminPasskeys.credentialId, response.id));
      if (!passkey) return res.status(401).json({ message: "Passkey not recognized" });
      const [user] = await db.select().from(users).where(eq(users.id, passkey.userId));
      if (!user?.isAdmin) return res.status(403).json({ message: "Admin access required" });

      // When the authenticator returns a userHandle it must be this user.
      const handle = response.response?.userHandle;
      if (handle && Buffer.from(handle, "base64url").toString("utf8") !== user.id) {
        return res.status(401).json({ message: "Passkey not recognized" });
      }

      const verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge: challenge,
        expectedOrigin: rp.origins,
        expectedRPID: rp.rpID,
        requireUserVerification: true,
        credential: {
          id: passkey.credentialId,
          publicKey: b64uToBuf(passkey.publicKey),
          counter: passkey.counter,
          transports: transportsOf(passkey),
        },
      }).catch(() => null); // includes counter regression (clone detection)
      if (!verification?.verified) return res.status(401).json({ message: "Passkey verification failed" });

      await db
        .update(adminPasskeys)
        .set({ counter: verification.authenticationInfo.newCounter, lastUsedAt: new Date() })
        .where(eq(adminPasskeys.id, passkey.id));

      await startAdminSession(req, user);
      markSessionTrusted(req, sanitizeDeviceName(passkey.deviceName, req.get("user-agent")));
      res.json({ ...sessionPayload(user), trusted: true });
    } catch (err) {
      console.error("passkey login verify error:", err);
      res.status(500).json({ message: "Passkey login failed" });
    }
  });

  // ---------------------------------------------------------------------
  // Re-auth for the app lock: current session + one of its own passkeys.
  // ---------------------------------------------------------------------
  app.post("/api/auth/passkeys/reauth/options", requireAdmin, async (req: Request, res: Response) => {
    try {
      if (limited(req, res, "passkey-reauth")) return;
      const rp = getRp(req, res);
      if (!rp) return;
      const mine = await db.select().from(adminPasskeys).where(eq(adminPasskeys.userId, (req.session as any).userId));
      if (mine.length === 0) return res.status(404).json({ message: "No passkey registered" });
      const options = await generateAuthenticationOptions({
        rpID: rp.rpID,
        userVerification: "required",
        allowCredentials: mine.map((p) => ({ id: p.credentialId, transports: transportsOf(p) })),
      });
      storeChallenge(req, "reauth", options.challenge);
      res.json(options);
    } catch (err) {
      console.error("passkey reauth options error:", err);
      res.status(500).json({ message: "Failed to start verification" });
    }
  });

  app.post("/api/auth/passkeys/reauth/verify", requireAdmin, async (req: Request, res: Response) => {
    try {
      if (limited(req, res, "passkey-reauth")) return;
      const rp = getRp(req, res);
      if (!rp) return;
      const body = authVerifyBody.safeParse(req.body);
      if (!body.success) return res.status(400).json({ message: "Invalid request" });
      const challenge = takeChallenge(req, "reauth");
      if (!challenge) return res.status(400).json({ message: "Challenge expired. Try again." });
      const response = body.data.response as unknown as AuthenticationResponseJSON;

      const [passkey] = await db
        .select()
        .from(adminPasskeys)
        .where(and(eq(adminPasskeys.credentialId, response.id), eq(adminPasskeys.userId, (req.session as any).userId)));
      if (!passkey) return res.status(401).json({ message: "Passkey not recognized" });

      const verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge: challenge,
        expectedOrigin: rp.origins,
        expectedRPID: rp.rpID,
        requireUserVerification: true,
        credential: {
          id: passkey.credentialId,
          publicKey: b64uToBuf(passkey.publicKey),
          counter: passkey.counter,
          transports: transportsOf(passkey),
        },
      }).catch(() => null);
      if (!verification?.verified) return res.status(401).json({ message: "Passkey verification failed" });

      await db
        .update(adminPasskeys)
        .set({ counter: verification.authenticationInfo.newCounter, lastUsedAt: new Date() })
        .where(eq(adminPasskeys.id, passkey.id));
      res.json({ ok: true });
    } catch (err) {
      console.error("passkey reauth verify error:", err);
      res.status(500).json({ message: "Verification failed" });
    }
  });

  // ---------------------------------------------------------------------
  // Manage own passkeys
  // ---------------------------------------------------------------------
  app.get("/api/auth/passkeys", requireAdmin, async (req: Request, res: Response) => {
    try {
      const rows = await db
        .select()
        .from(adminPasskeys)
        .where(eq(adminPasskeys.userId, (req.session as any).userId))
        .orderBy(desc(adminPasskeys.createdAt));
      res.json({
        passkeys: rows.map((p) => ({
          id: p.id,
          deviceName: p.deviceName || "Passkey",
          createdAt: p.createdAt.toISOString(),
          lastUsedAt: p.lastUsedAt ? p.lastUsedAt.toISOString() : null,
        })),
      });
    } catch (err) {
      console.error("passkeys list error:", err);
      res.status(500).json({ message: "Failed to list passkeys" });
    }
  });

  app.delete("/api/auth/passkeys/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const id = idParam.safeParse(req.params.id);
      if (!id.success) return res.status(400).json({ message: "Invalid id" });
      const deleted = await db
        .delete(adminPasskeys)
        .where(and(eq(adminPasskeys.id, id.data), eq(adminPasskeys.userId, (req.session as any).userId)))
        .returning({ id: adminPasskeys.id });
      if (deleted.length === 0) return res.status(404).json({ message: "Passkey not found" });
      res.json({ success: true });
    } catch (err) {
      console.error("passkey delete error:", err);
      res.status(500).json({ message: "Failed to delete passkey" });
    }
  });
}
