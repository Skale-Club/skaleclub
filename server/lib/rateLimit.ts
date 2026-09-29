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

/**
 * Normalise a client IP into a rate-limit key: IPv4-mapped IPv6 collapses to
 * the IPv4 address, and IPv6 addresses collapse to their /64 prefix so a
 * single host with a whole /64 cannot mint unlimited keys.
 */
export function normalizeIpKey(ip: string | undefined | null): string {
  if (!ip) return "unknown";
  let value = ip.trim().toLowerCase();
  const mapped = value.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return mapped[1];
  if (!value.includes(":")) return value;
  value = value.replace(/%.*$/, "");
  let groups: string[];
  if (value.includes("::")) {
    const [head, tail] = value.split("::");
    const h = head ? head.split(":") : [];
    const t = tail ? tail.split(":") : [];
    groups = [...h, ...Array(Math.max(0, 8 - h.length - t.length)).fill("0"), ...t];
  } else {
    groups = value.split(":");
  }
  if (groups.length !== 8) return value;
  return groups.slice(0, 4).map((g) => g.replace(/^0+(?=.)/, "")).join(":") + "::/64";
}

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
  /** Respond 204 with no body instead of 429 (for navigator.sendBeacon callers). */
  silentNoContent?: boolean;
}

/**
 * Express middleware factory wrapping {@link rateLimit}. Keys by client IP
 * (`getClientIp` in `./turnstile.js`, which resolves `req.ip` through the
 * configured trust-proxy depth) unless a custom `keyFn` is supplied. Responds with
 * `429 { message }` when the limit is exceeded, otherwise calls `next()`.
 */
let middlewareSeq = 0;

export function rateLimitMiddleware(opts: RateLimitMiddlewareOptions): RequestHandler {
  const { limit, windowMs, keyFn, message, silentNoContent } = opts;
  // Scope each middleware instance so two endpoints never share one bucket.
  const scope = `mw${++middlewareSeq}:`;

  return (req: Request, res: Response, next: NextFunction) => {
    const key = scope + (keyFn ? keyFn(req) : normalizeIpKey(getClientIp(req)));

    if (rateLimit(key, { limit, windowMs })) {
      if (silentNoContent) {
        res.status(204).end();
        return;
      }
      res.status(429).json({ message: message ?? "Too many requests. Please try again later." });
      return;
    }

    next();
  };
}

/**
 * Limits for public analytics counters: a per-IP backstop plus a per-IP and
 * resource-id bucket, so one busy page never starves another. Rate-limited
 * calls get 204 (these endpoints are fire-and-forget beacons).
 */
export function publicCounterLimits(resourceId: (req: Request) => string): RequestHandler[] {
  return [
    rateLimitMiddleware({
      limit: 1000,
      windowMs: 10 * 60_000,
      silentNoContent: true,
      keyFn: (req) => normalizeIpKey(getClientIp(req)),
    }),
    rateLimitMiddleware({
      limit: 300,
      windowMs: 10 * 60_000,
      silentNoContent: true,
      keyFn: (req) => `${normalizeIpKey(getClientIp(req))}:${resourceId(req)}`,
    }),
  ];
}
