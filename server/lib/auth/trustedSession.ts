import crypto from "crypto";
import type { NextFunction, Request, Response } from "express";

/** Trusted ("remembered phone") sessions live 180 days, renewed on use. */
export const TRUSTED_SESSION_TTL_MS = 180 * 24 * 60 * 60 * 1000;
/** Renewing rewrites the session row, so do it at most once a day. */
export const TRUSTED_RENEW_INTERVAL_MS = 24 * 60 * 60 * 1000;

export interface TrustedInfo {
  name: string;
  createdAt: number;
  lastSeen: number;
}

export function sanitizeDeviceName(input: unknown, userAgent?: string): string {
  if (typeof input === "string") {
    const cleaned = input.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 80);
    if (cleaned) return cleaned;
  }
  return deviceNameFromUserAgent(userAgent);
}

export function deviceNameFromUserAgent(ua?: string): string {
  const s = ua || "";
  const os = /iPhone/i.test(s)
    ? "iPhone"
    : /iPad/i.test(s)
      ? "iPad"
      : /Android/i.test(s)
        ? "Android"
        : /Windows/i.test(s)
          ? "Windows"
          : /Mac OS X|Macintosh/i.test(s)
            ? "Mac"
            : /Linux/i.test(s)
              ? "Linux"
              : "Aparelho";
  const browser = /Edg\//.test(s)
    ? "Edge"
    : /OPR\/|Opera/.test(s)
      ? "Opera"
      : /Firefox|FxiOS/.test(s)
        ? "Firefox"
        : /Chrome|CriOS/.test(s)
          ? "Chrome"
          : /Safari/.test(s)
            ? "Safari"
            : "";
  return (browser ? `${os} ${browser}` : os).slice(0, 80);
}

/** True when a trusted session was last renewed more than a day ago. */
export function shouldRenewTrusted(trusted: Pick<TrustedInfo, "lastSeen"> | undefined, now = Date.now()): boolean {
  if (!trusted || typeof trusted.lastSeen !== "number") return false;
  return now - trusted.lastSeen >= TRUSTED_RENEW_INTERVAL_MS;
}

/**
 * Marks the session trusted and stretches its cookie. connect-pg-simple derives
 * the `sessions.expire` column from `cookie.expires` (set by the maxAge setter)
 * whenever it is present, so the row lives as long as the cookie.
 */
export function markSessionTrusted(req: Request, name: string, now = Date.now()): TrustedInfo {
  const sess = req.session as any;
  const previous = sess.trusted as TrustedInfo | undefined;
  const trusted: TrustedInfo = { name, createdAt: previous?.createdAt ?? now, lastSeen: now };
  sess.trusted = trusted;
  sess.cookie.maxAge = TRUSTED_SESSION_TTL_MS;
  return trusted;
}

/** Rolling renewal for trusted sessions, without writing to the store on every request. */
export function trustedSessionRenewal(req: Request, _res: Response, next: NextFunction) {
  const sess = req.session as any;
  if (sess?.userId && sess.trusted && shouldRenewTrusted(sess.trusted)) {
    sess.trusted.lastSeen = Date.now();
    sess.cookie.maxAge = TRUSTED_SESSION_TTL_MS;
  }
  next();
}

/** Opaque, non-reversible id for a session id (never expose the real sid). */
export function hashSessionId(sid: string): string {
  return crypto.createHash("sha256").update(sid).digest("hex").slice(0, 24);
}

export interface SessionUser {
  id: string;
  email: string | null;
  isAdmin: boolean | null;
  firstName: string | null;
  lastName: string | null;
}

/** Fresh session id on every login (prevents session fixation) + user info. */
export async function startAdminSession(req: Request, user: SessionUser): Promise<void> {
  await new Promise<void>((resolve, reject) =>
    req.session.regenerate((err) => (err ? reject(err) : resolve())),
  );
  const sess = req.session as any;
  sess.userId = user.id;
  sess.email = user.email;
  sess.isAdmin = user.isAdmin;
  sess.firstName = user.firstName;
  sess.lastName = user.lastName;
}
