/**
 * attribution.ts — Pure browser-side utilities for marketing attribution.
 *
 * This module is React-free and can be imported from any context: hooks, page
 * components, Navbar onClick handlers, booking CTAs, etc.
 *
 * Relationship to useAttribution:
 *   - `useAttribution` (client/src/hooks/use-attribution.ts) owns the reactive
 *     React lifecycle (mount + Wouter navigation) and calls helpers from here.
 *   - Non-hook callers (Navbar, booking flow) import `fireConversionEvent` or
 *     `getStoredVisitorId` directly without needing a React hook.
 *
 * Three outbound endpoints:
 *   POST /api/attribution/session    — upserted via postSessionPing
 *   POST /api/attribution/conversion — fired via fireConversionEvent
 *   POST /api/analytics/hit          — fired via reportAttributionPageView
 *
 * All network calls are fire-and-forget (sendBeacon + fetch keepalive fallback).
 * No errors are thrown or surfaced to callers.
 */

// ─── Constants ────────────────────────────────────────────────────────────────

/** Single source of truth for the localStorage anonymous visitor key (D-04). */
export const MVP_VID_KEY = 'mvp_vid';

export function isAttributionIgnoredPath(path: string | undefined | null): boolean {
  return typeof path === 'string' && path.startsWith('/admin');
}

// Classification lookup tables — exported so tests and maintenance can verify them.
export const SEARCH_HOSTS = ['google', 'bing', 'yahoo', 'duckduckgo', 'baidu', 'yandex'] as const;
export const SOCIAL_HOSTS = [
  'facebook.com',
  'instagram.com',
  'youtube.com',
  'tiktok.com',
  'linkedin.com',
  'twitter.com',
  'x.com',
  'pinterest.com',
] as const;

// ─── Types ────────────────────────────────────────────────────────────────────

export type SourceChannel =
  | 'Direct'
  | 'Organic Search'
  | 'Social Media'
  | 'Paid Ads'
  | 'Email'
  | 'Referral'
  | 'Unknown';

// ─── Visitor ID ───────────────────────────────────────────────────────────────

/**
 * Returns the stored visitor ID from localStorage, or null if unavailable.
 * Safe in SSR (window === undefined) and Safari private mode (storage throws).
 */
export function getStoredVisitorId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(MVP_VID_KEY);
  } catch {
    return null;
  }
}

/**
 * Returns the existing visitor ID if present; otherwise generates a new UUID,
 * persists it to localStorage, and returns it (D-05).
 * If the localStorage write fails (e.g. Safari private mode), the generated
 * UUID is still returned for use during the current session (best-effort).
 */
export function ensureVisitorId(): string {
  const existing = getStoredVisitorId();
  if (existing) return existing;

  const id = crypto.randomUUID();
  try {
    localStorage.setItem(MVP_VID_KEY, id);
  } catch {
    // Best-effort — return generated ID even if storage is unavailable.
  }
  return id;
}

// ─── Traffic Classification ───────────────────────────────────────────────────

/**
 * Classifies document.referrer into a source channel (D-08).
 * Returns ftSource, ftMedium, and sourceChannel for use in the session payload.
 */
export function classifyReferrer(referrer: string): {
  sourceChannel: SourceChannel;
  ftSource: string;
  ftMedium: string;
} {
  const trimmed = referrer.trim();

  if (!trimmed) {
    return { sourceChannel: 'Direct', ftSource: '(direct)', ftMedium: '(none)' };
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { sourceChannel: 'Direct', ftSource: '(direct)', ftMedium: '(none)' };
  }

  // Skip same-origin referrers — internal navigation is treated as Direct.
  if (typeof window !== 'undefined' && url.host === window.location.host) {
    return { sourceChannel: 'Direct', ftSource: '(direct)', ftMedium: '(none)' };
  }

  const host = url.host.toLowerCase();

  if (SEARCH_HOSTS.some((engine) => host.includes(engine))) {
    return { sourceChannel: 'Organic Search', ftSource: host, ftMedium: 'organic' };
  }

  if (SOCIAL_HOSTS.some((social) => host.includes(social))) {
    return { sourceChannel: 'Social Media', ftSource: host, ftMedium: 'social' };
  }

  return { sourceChannel: 'Referral', ftSource: host, ftMedium: 'referral' };
}

/**
 * Derives a SourceChannel from utm_medium (D-09).
 * Normalizes to lowercase/trimmed before mapping.
 */
export function channelFromUtmMedium(utmMedium: string | undefined | null): SourceChannel {
  const normalized = (utmMedium ?? '').toLowerCase().trim();

  if (!normalized) return 'Unknown';

  if (['cpc', 'ppc', 'paid', 'paidsearch', 'paidsocial'].includes(normalized)) return 'Paid Ads';
  if (['social', 'social-media'].includes(normalized)) return 'Social Media';
  if (normalized === 'email') return 'Email';
  if (normalized === 'organic') return 'Organic Search';

  // Any other non-empty medium is treated as Referral.
  return 'Referral';
}

// ─── Device Detection ─────────────────────────────────────────────────────────

/**
 * Detects the device type from userAgent (D-12).
 * Tablet check runs BEFORE mobile because iPad UA doesn't contain "Mobile".
 */
export function detectDeviceType(userAgent?: string): 'mobile' | 'tablet' | 'desktop' {
  const ua = userAgent ?? (typeof navigator !== 'undefined' ? navigator.userAgent : '');

  if (/(iPad|Android(?!.*Mobile))/i.test(ua)) return 'tablet';
  if (/(iPhone|Android.*Mobile|BlackBerry)/i.test(ua)) return 'mobile';
  return 'desktop';
}

// ─── Network Helpers ──────────────────────────────────────────────────────────

/**
 * Internal fire-and-forget POST helper.
 * Mirrors the reportEventHit pattern from client/src/lib/analytics.ts (lines 140-151).
 * Uses sendBeacon as primary path; falls back to fetch with keepalive: true.
 * NOT exported — callers must use the named helpers below.
 */
function postBeacon(url: string, body: object): void {
  if (typeof window === 'undefined') return;

  const json = JSON.stringify(body);

  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    const blob = new Blob([json], { type: 'application/json' });
    navigator.sendBeacon(url, blob);
    return;
  }

  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: json,
    keepalive: true,
  }).catch(() => undefined);
}

/**
 * Posts a session payload to /api/attribution/session.
 * Used by useAttribution — exported so the hook doesn't call sendBeacon directly.
 */
export function postSessionPing(payload: object): void {
  postBeacon('/api/attribution/session', payload);
}

/**
 * Fires a conversion event to /api/attribution/conversion (D-17 / D-19 / D-20).
 * Reads visitorId from localStorage via getStoredVisitorId — best-effort, silent if absent.
 */
export function fireConversionEvent(
  conversionType: 'lead_created' | 'phone_click' | 'form_submitted' | 'booking_started',
  pagePath?: string,
): void {
  if (isAttributionIgnoredPath(pagePath ?? (typeof window !== 'undefined' ? window.location.pathname : undefined))) return;
  const visitorId = getStoredVisitorId();
  if (!visitorId) return;

  const resolvedPath =
    pagePath !== undefined
      ? pagePath
      : typeof window !== 'undefined'
        ? window.location.pathname
        : undefined;

  postBeacon('/api/attribution/conversion', { visitorId, conversionType, pagePath: resolvedPath });
}

/**
 * Sends a page_view hit to /api/analytics/hit with visitorId (D-15).
 * Only fires when visitorId is non-null. Uses the dedicated attribution channel,
 * NOT the analytics.ts SERVER_REPORTED_EVENTS set (per D-16).
 */
export function reportAttributionPageView(pagePath: string, visitorId: string | null): void {
  // Phase 45 — no consumer endpoint in this codebase (the source's
  // analytics_event_hits table is out of scope per CONTEXT.md). Helper kept for source
  // parity with use-attribution.ts; the call is a no-op to avoid 404 network spam.
  void pagePath;
  void visitorId;
}
