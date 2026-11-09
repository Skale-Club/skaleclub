import type { Express, Request } from "express";
import { eq, sql } from "drizzle-orm";
import { db } from "../db.js";
import { users } from "#shared/schema.js";
import { normalizeIpKey, rateLimit } from "../lib/rateLimit.js";
import { googleAuthConfig, verifyGoogleIdentity } from "./googleIdentity.js";
import { bindGoogleIdentities, IdentityLinkedElsewhereError, userIdForGoogleIdentity, type IdentityBinding } from "./googleIdentityStore.js";
import { resolveAccount } from "./accountResolution.js";
import { isSameAuthOrigin } from "./sameOrigin.js";

function newSession(req: Request) {
  return new Promise<void>((resolve, reject) => req.session.regenerate((error) => (error ? reject(error) : resolve())));
}

const lookups = {
  userIdForIdentity: userIdForGoogleIdentity,
  userById: async (id: string) => (await db.select().from(users).where(eq(users.id, id)).limit(1))[0] ?? null,
  userByPhone: async (phone: string) => (await db.select().from(users).where(eq(users.phone, phone)).limit(1))[0] ?? null,
  usersByEmail: (email: string, limit: number) =>
    db.select().from(users).where(sql`lower(${users.email}) = lower(${email})`).limit(limit),
};

/**
 * Phone and Google are two separate ways in. Each finds the user it is bound to;
 * a Google account whose email Google verified also opens the one user with that
 * email. This app is invite-only: an identity that resolves to no admin user gets
 * 403 not_invited and no session. Linking the two methods to one user happens inside
 * the app, in Settings (server/auth/accountLinks.ts).
 */
export function registerGoogleLoginRoutes(app: Express) {
  app.get("/api/auth/config", (_req, res) => {
    res.set("Cache-Control", "no-store");
    try {
      const config = googleAuthConfig();
      if (!config.enabled) return res.json({ enabled: false });
      res.json({
        enabled: true,
        projectId: config.projectId,
        apiKey: config.apiKey,
        authDomain: config.authDomain,
        googleClientId: config.googleClientId,
      });
    } catch {
      console.error("[google-login] configuration is incomplete");
      res.json({ enabled: false });
    }
  });

  app.post("/api/auth/identity", async (req, res) => {
    try {
      if (!isSameAuthOrigin(req)) return res.status(403).json({ code: "origin_denied" });
      if (rateLimit(`google-login:${normalizeIpKey(req.ip)}`, { limit: 30, windowMs: 15 * 60_000 })) {
        return res.status(429).json({ code: "rate_limited" });
      }
      let config;
      try {
        config = googleAuthConfig();
      } catch {
        return res.status(503).json({ code: "auth_unavailable" });
      }
      if (!config.enabled) return res.status(503).json({ code: "auth_unavailable" });
      const token = req.body?.idToken;
      if (typeof token !== "string" || !token || token.length > 16_384) return res.status(400).json({ code: "invalid_token" });
      let identity;
      try {
        identity = await verifyGoogleIdentity(token);
      } catch (error) {
        // The reason only (expired, wrong audience, unreachable keys), never the token.
        console.warn("[google-login] token rejected:", error instanceof Error ? `${error.name}: ${error.message}` : String(error));
        return res.status(401).json({ code: "invalid_token" });
      }
      const binding: IdentityBinding = {
        projectId: config.projectId!,
        uid: identity.uid,
        provider: identity.provider,
        email: identity.email,
      };
      const user = await resolveAccount(lookups, binding, identity.phone);
      // Invite-only: no row, or a row that is not an admin, gets no session.
      if (!user || !user.isAdmin) return res.status(403).json({ code: "not_invited" });
      await bindGoogleIdentities([binding], user.id);
      await db.update(users).set({ lastSeenAt: new Date() }).where(eq(users.id, user.id));
      // A fresh session id on every sign-in: reusing the pre-login session lets a
      // cookie planted before authentication become an admin session after it.
      await newSession(req);
      const sess = req.session as any;
      sess.userId = user.id;
      sess.email = user.email;
      sess.isAdmin = user.isAdmin;
      sess.firstName = user.firstName;
      sess.lastName = user.lastName;
      res.json({ isAdmin: true, email: user.email, firstName: user.firstName, lastName: user.lastName });
    } catch (error) {
      if (error instanceof IdentityLinkedElsewhereError) return res.status(409).json({ code: "identity_linked_elsewhere" });
      console.error("[google-login] account/session provisioning failed", error instanceof Error ? error.message : "");
      res.status(500).json({ code: "auth_unavailable" });
    }
  });
}
