import type { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { db } from "../db.js";
import { users } from "#shared/schema.js";
import { eq } from "drizzle-orm";

/**
 * Admin authentication middleware.
 * Ensures session has a user id AND that user is marked as admin.
 */
export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const sess = req.session as any;
  if (!sess?.userId) {
    return res.status(401).json({ message: "Authentication required" });
  }
  try {
    const [dbUser] = await db.select().from(users).where(eq(users.id, sess.userId));
    if (!dbUser?.isAdmin) {
      return res.status(403).json({ message: "Admin access required" });
    }
    next();
  } catch (error) {
    return res.status(500).json({ message: "Failed to verify admin status" });
  }
}

/**
 * Set cache headers for public endpoints with short-lived CDN caching.
 */
export function setPublicCache(res: Response, seconds: number) {
  res.set("Cache-Control", `public, max-age=0, s-maxage=${seconds}, stale-while-revalidate=${seconds * 12}`);
}

/**
 * Check whether a cron request is authorized via a constant-time Bearer token
 * comparison against CRON_SECRET. In production, an unset CRON_SECRET denies
 * all requests — the `x-vercel-cron` header is client-supplied and therefore
 * spoofable, so it is never trusted as an auth mechanism.
 */
export function isAuthorizedCronRequest(req: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization;
  const bearerToken =
    typeof authHeader === "string" && authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : null;

  if (cronSecret) {
    if (!bearerToken) {
      return false;
    }
    const expected = Buffer.from(cronSecret);
    const actual = Buffer.from(bearerToken);
    if (expected.length !== actual.length) {
      return false;
    }
    return crypto.timingSafeEqual(expected, actual);
  }

  if (process.env.NODE_ENV !== "production") {
    return true;
  }

  return false;
}
