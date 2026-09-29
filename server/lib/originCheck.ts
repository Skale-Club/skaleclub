import type { NextFunction, Request, Response } from "express";

const ALLOWED_ORIGINS = new Set([
  "https://skale.club",
  "https://www.skale.club",
  "https://skaleclub-stage.skale.club",
]);

// Routes that legitimately receive cross-origin or server-to-server writes.
const EXEMPT_PATH_RES = [
  /^\/api\/oauth(\/|$)/,
  /^\/mcp(\/|$)/,
  /^\/api\/blog\/telegram\/webhook(\/|$)/,
  /^\/api\/integrations\/[^/]+\/webhook(\/|$)/,
];

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function isLocalOrigin(origin: string): boolean {
  try {
    const { hostname } = new URL(origin);
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
  } catch {
    return false;
  }
}

function hasCronBearer(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.authorization;
  return Boolean(secret && auth && auth === `Bearer ${secret}`);
}

/**
 * CSRF defense-in-depth for the cookie-authenticated API: state-changing
 * requests must come from our own origin. Callers that send neither Origin
 * nor Sec-Fetch-Site (curl, server-to-server) pass through.
 */
export function originCheck(req: Request, res: Response, next: NextFunction) {
  if (SAFE_METHODS.has(req.method)) return next();
  if (!req.path.startsWith("/api/") && !req.path.startsWith("/mcp")) return next();
  if (EXEMPT_PATH_RES.some((re) => re.test(req.path))) return next();
  if (hasCronBearer(req)) return next();

  const origin = req.headers.origin;
  const fetchSite = req.headers["sec-fetch-site"];
  let allowed = true;

  if (typeof origin === "string" && origin) {
    const host = req.headers.host;
    let sameHost = false;
    try {
      sameHost = Boolean(host) && new URL(origin).host === host;
    } catch {
      sameHost = false;
    }
    allowed =
      sameHost ||
      ALLOWED_ORIGINS.has(origin) ||
      (process.env.NODE_ENV !== "production" && isLocalOrigin(origin));
  } else if (typeof fetchSite === "string" && fetchSite) {
    allowed = fetchSite === "same-origin" || fetchSite === "same-site" || fetchSite === "none";
  }

  if (!allowed) {
    return res.status(403).json({ message: "Cross-site request blocked" });
  }
  next();
}
