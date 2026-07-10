import type { NextFunction, Request, RequestHandler, Response } from "express";
import { getClientIp } from "./turnstile.js";

/**
 * Minimal, dependency-free in-memory rate limiter for public endpoints that
 * call paid/expensive backends (AI providers, transcription, etc).
 *
 * CAVEAT: state lives in a plain in-process Map, so limits are enforced
 * per-instance, not globally. On a single long-running server this behaves
 * like a real throttle; if this process is ever horizontally scaled or run
 * on a serverless platform that spins up fresh instances per request, each
 * instance tracks its own counters independently (a client could get
 * `limit * instanceCount` requests through). That's an accepted trade-off
 * here — the goal is to bound memory and slow down abuse on warm instances
 * without adding Redis or another dependency.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

// Periodically sweep expired buckets so `buckets` can't grow without bound as
// distinct keys (e.g. client IPs) come and go. Unref'd so the timer never
// keeps the process alive by itself.
const PURGE_INTERVAL_MS = 5 * 60_000;
const purgeTimer: ReturnType<typeof setInterval> = setInterval(() => {
  const now = Date.now();
  // Array.from(...) rather than iterating the Map directly: tsconfig has no
  // `target`/`downlevelIteration`, so `for..of` over a Map hits TS2802.
  for (const [key, bucket] of Array.from(buckets.entries())) {
    if (now > bucket.resetAt) buckets.delete(key);
  }
}, PURGE_INTERVAL_MS);
purgeTimer.unref?.();

export interface RateLimitOptions {
  /** Max requests allowed per window. */
  limit: number;
  /** Window size in milliseconds. */
  windowMs: number;
}

/**
 * Fixed-window rate limiter keyed by an arbitrary string (e.g. client IP).
 * Returns `true` when the key has exceeded `limit` requests within the
 * current `windowMs` window — i.e. `true` means "reject this request".
 */
export function rateLimit(key: string, opts: RateLimitOptions): boolean {
  const { limit, windowMs } = opts;
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }

  bucket.count += 1;
  return bucket.count > limit;
}

export interface RateLimitMiddlewareOptions extends RateLimitOptions {
  /** Derive the bucket key from the request. Defaults to the client IP. */
  keyFn?: (req: Request) => string;
  /** Custom JSON message body on 429. */
  message?: string;
}

/**
 * Express middleware factory wrapping {@link rateLimit}. Keys by client IP
 * (same first-hop `x-forwarded-for` / `req.ip` logic as `getClientIp` in
 * `./turnstile.js`) unless a custom `keyFn` is supplied. Responds with
 * `429 { message }` when the limit is exceeded, otherwise calls `next()`.
 */
export function rateLimitMiddleware(opts: RateLimitMiddlewareOptions): RequestHandler {
  const { limit, windowMs, keyFn, message } = opts;

  return (req: Request, res: Response, next: NextFunction) => {
    const key = keyFn ? keyFn(req) : getClientIp(req) ?? "unknown";

    if (rateLimit(key, { limit, windowMs })) {
      res.status(429).json({ message: message ?? "Too many requests. Please try again later." });
      return;
    }

    next();
  };
}
