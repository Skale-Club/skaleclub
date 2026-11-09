import type { Request } from "express";
import { ALLOWED_ORIGINS, isLocalOrigin } from "../lib/originCheck.js";

/**
 * Sign-in endpoints trade a token for a session, so they require an explicit
 * Origin header that is this site (same host, a known site origin, or localhost
 * in development). A request with no Origin header is refused.
 */
export function isSameAuthOrigin(req: Request): boolean {
  const origin = req.get("origin");
  if (!origin) return false;
  try {
    if (new URL(origin).host === req.get("host")) return true;
  } catch {
    return false;
  }
  return ALLOWED_ORIGINS.has(origin) || (process.env.NODE_ENV !== "production" && isLocalOrigin(origin));
}
