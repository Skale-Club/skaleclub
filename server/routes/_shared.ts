import type { Request, Response, NextFunction } from "express";
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
 * Check whether a cron request is authorized (Vercel cron header or Bearer token).
 */
export function isAuthorizedCronRequest(req: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization;
  const bearerToken =
    typeof authHeader === "string" && authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : null;
  const hasVercelCronHeader = typeof req.headers["x-vercel-cron"] === "string";

  if (cronSecret) {
    return bearerToken === cronSecret;
  }

  if (process.env.NODE_ENV !== "production") {
    return true;
  }

  return hasVercelCronHeader;
}
