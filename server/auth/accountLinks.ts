import type { Express, Request, Response } from "express";
import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "../db.js";
import { users } from "#shared/schema.js";
import { normalizeIpKey, rateLimit } from "../lib/rateLimit.js";
import { isAuthenticated } from "./session.js";
import { googleAuthConfig, verifyGoogleIdentity, type GoogleIdentity } from "./googleIdentity.js";
import {
  bindGoogleIdentities,
  googleAccountsOf,
  IdentityLinkedElsewhereError,
  unlinkGoogleAccounts,
} from "./googleIdentityStore.js";
import { isSameAuthOrigin } from "./sameOrigin.js";

// Settings > Sign-in: a signed-in person adds the way in they do not have yet (a
// phone or a Google account) to the account they are already in. Proving the new
// one here, inside the session, is what links the two. (Sign-in may bind a Google
// account to the one user whose email Google verified; see accountResolution.ts.)

async function currentUser(req: Request) {
  const [user] = await db.select().from(users).where(eq(users.id, (req.session as any).userId)).limit(1);
  return user ?? null;
}

async function linksOf(userId: string, phone: string | null) {
  return { phone, google: await googleAccountsOf(userId) };
}

function guard(req: Request, res: Response): boolean {
  if (!isSameAuthOrigin(req)) {
    res.status(403).json({ code: "origin_denied" });
    return false;
  }
  if (rateLimit(`account-links:${normalizeIpKey(req.ip)}`, { limit: 20, windowMs: 15 * 60_000 })) {
    res.status(429).json({ code: "rate_limited" });
    return false;
  }
  return true;
}

/** Verifies the posted token for a provider; answers the error itself and returns null on failure. */
async function verifiedToken(
  req: Request,
  res: Response,
  provider: GoogleIdentity["provider"],
): Promise<{ identity: GoogleIdentity; projectId: string } | null> {
  let config;
  try {
    config = googleAuthConfig();
  } catch {
    res.status(503).json({ code: "auth_unavailable" });
    return null;
  }
  if (!config.enabled) {
    res.status(503).json({ code: "auth_unavailable" });
    return null;
  }
  const token = req.body?.idToken;
  if (typeof token !== "string" || !token || token.length > 16_384) {
    res.status(400).json({ code: "invalid_token" });
    return null;
  }
  let identity: GoogleIdentity;
  try {
    identity = await verifyGoogleIdentity(token);
  } catch {
    res.status(401).json({ code: "invalid_token" });
    return null;
  }
  // A phone link needs a phone token and a Google link a Google token, never the other way round.
  if (identity.provider !== provider) {
    res.status(400).json({ code: "invalid_token" });
    return null;
  }
  return { identity, projectId: config.projectId! };
}

export function registerAccountLinkRoutes(app: Express) {
  app.get("/api/auth/links", isAuthenticated, async (req, res) => {
    try {
      const user = await currentUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });
      res.json(await linksOf(user.id, user.phone));
    } catch (error) {
      console.error("[account-links] read failed", error);
      res.status(500).json({ code: "generic" });
    }
  });

  // Body: { idToken } from a confirmed SMS code. Adds or replaces the user's phone.
  app.post("/api/auth/links/phone", isAuthenticated, async (req, res) => {
    try {
      if (!guard(req, res)) return;
      const proof = await verifiedToken(req, res, "phone");
      if (!proof) return;
      const user = await currentUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });
      const { identity, projectId } = proof;
      const phone = identity.phone!;
      const [owner] = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.phone, phone), ne(users.id, user.id)))
        .limit(1);
      if (owner) return res.status(409).json({ code: "identity_linked_elsewhere" });
      await bindGoogleIdentities([{ projectId, uid: identity.uid, provider: "phone" }], user.id);
      if (user.phone !== phone) {
        await db.transaction(async (tx) => {
          // The old number stops signing in: only the phone proven here does.
          await tx.execute(
            sql`DELETE FROM auth_google_identities WHERE user_id=${user.id} AND subject<>${identity.uid} AND (provider='phone' OR provider IS NULL)`,
          );
          await tx.update(users).set({ phone, updatedAt: new Date() }).where(eq(users.id, user.id));
        });
      }
      res.json(await linksOf(user.id, phone));
    } catch (error) {
      if (error instanceof IdentityLinkedElsewhereError || (error as { code?: string })?.code === "23505") {
        return res.status(409).json({ code: "identity_linked_elsewhere" });
      }
      console.error("[account-links] phone link failed", error);
      res.status(500).json({ code: "generic" });
    }
  });

  // Body: { idToken } from a Google popup.
  app.post("/api/auth/links/google", isAuthenticated, async (req, res) => {
    try {
      if (!guard(req, res)) return;
      const proof = await verifiedToken(req, res, "google.com");
      if (!proof) return;
      const user = await currentUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });
      const { identity, projectId } = proof;
      await bindGoogleIdentities(
        [{ projectId, uid: identity.uid, provider: "google.com", email: identity.email }],
        user.id,
      );
      res.json(await linksOf(user.id, user.phone));
    } catch (error) {
      if (error instanceof IdentityLinkedElsewhereError) return res.status(409).json({ code: "identity_linked_elsewhere" });
      console.error("[account-links] google link failed", error);
      res.status(500).json({ code: "generic" });
    }
  });

  app.delete("/api/auth/links/google", isAuthenticated, async (req, res) => {
    try {
      if (!guard(req, res)) return;
      const user = await currentUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });
      // Never leave an account with no way in.
      if (!user.phone) return res.status(409).json({ code: "last_method" });
      await unlinkGoogleAccounts(user.id);
      res.json(await linksOf(user.id, user.phone));
    } catch (error) {
      console.error("[account-links] unlink failed", error);
      res.status(500).json({ code: "generic" });
    }
  });
}
