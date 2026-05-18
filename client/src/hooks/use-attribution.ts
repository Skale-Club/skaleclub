/**
 * useAttribution — Single-call hook; mount it once in the App root (AppContent).
 *
 * Two-effect pattern (D-03):
 *   1. Empty-deps effect: runs ONCE on mount. Reads window.location.search before
 *      any Wouter navigation can destroy it. Generates/retrieves mvp_vid from
 *      localStorage. Classifies UTMs or referrer. POSTs to /api/attribution/session
 *      with full ft_* + lt_* payload, and fires the initial page_view hit.
 *   2. [location, visitorId] effect: runs on every Wouter route change. Updates
 *      lt_* columns (and lt_* only) and fires a visitor-correlated page_view hit.
 *
 * Distributes visitorId to consumers via React state so they can read it reactively.
 */

import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  ensureVisitorId,
  classifyReferrer,
  channelFromUtmMedium,
  detectDeviceType,
  isAttributionIgnoredPath,
  postSessionPing,
  reportAttributionPageView,
  type SourceChannel,
} from "@/lib/attribution";

// Normalizes a URLSearchParams value: lowercases, trims, returns undefined if empty.
const norm = (v: string | null): string | undefined => {
  if (!v) return undefined;
  const t = v.toLowerCase().trim();
  return t.length > 0 ? t : undefined;
};

// Strips undefined values from an object before sending to the server.
// The session schema rejects empty strings but allows omitted (optional) fields.
function stripUndefined(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}

export function useAttribution(): { visitorId: string | null } {
  const [visitorId, setVisitorId] = useState<string | null>(null);
  const [trackingDeferred, setTrackingDeferred] = useState(false);
  const [location] = useLocation();

  // ─── Effect A: Mount-only — capture UTMs, generate visitor ID, first ping ───
  // Dependency array is intentionally empty: we MUST read window.location.search
  // at mount before any Wouter navigation can replace or clear it.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (isAttributionIgnoredPath(window.location.pathname)) {
      setTrackingDeferred(true);
      return;
    }

    // 1. Resolve visitor ID and expose it via state.
    const id = ensureVisitorId();
    setVisitorId(id);

    // 2. Read UTMs synchronously from the URL at mount time.
    const params = new URLSearchParams(window.location.search);
    const utmSource = norm(params.get("utm_source"));
    const utmMedium = norm(params.get("utm_medium"));
    const utmCampaign = norm(params.get("utm_campaign"));
    const utmTerm = norm(params.get("utm_term"));
    const utmContent = norm(params.get("utm_content"));
    const utmId = norm(params.get("utm_id"));

    // 3. Capture document.referrer.
    const referrer = document.referrer || "";

    // 4. Determine first-touch attribution.
    let ftSource: string | undefined;
    let ftMedium: string | undefined;
    let ftCampaign: string | undefined;
    let ftTerm: string | undefined;
    let ftContent: string | undefined;
    let ftId: string | undefined;
    let ftSourceChannel: SourceChannel | undefined;

    if (utmSource) {
      // UTMs take precedence over referrer classification.
      ftSource = utmSource;
      ftMedium = utmMedium ?? "(not set)";
      ftCampaign = utmCampaign;
      ftTerm = utmTerm;
      ftContent = utmContent;
      ftId = utmId;
      ftSourceChannel = channelFromUtmMedium(utmMedium);
    } else {
      // Fall back to referrer classification.
      const cls = classifyReferrer(referrer);
      ftSource = cls.ftSource;
      ftMedium = cls.ftMedium;
      ftSourceChannel = cls.sourceChannel;
    }

    // 5. Build full session payload (ft_* + lt_* mirrored on first ping).
    //    Server upsert will preserve ft_* columns on subsequent pings (ON CONFLICT DO UPDATE
    //    only touches lt_* and lastSeenAt), so mirroring here is safe (D-11).
    const payload = stripUndefined({
      visitorId: id,
      ftSource,
      ftMedium,
      ftCampaign,
      ftTerm,
      ftContent,
      ftId,
      ftSourceChannel,
      ftLandingPage: window.location.pathname,
      ftReferrer: referrer || undefined,
      // Mirror first-touch as last-touch on initial visit.
      ltSource: ftSource,
      ltMedium: ftMedium,
      ltCampaign: ftCampaign,
      ltTerm: ftTerm,
      ltContent: ftContent,
      ltId: ftId,
      ltSourceChannel: ftSourceChannel,
      ltLandingPage: window.location.pathname,
      ltReferrer: referrer || undefined,
      deviceType: detectDeviceType(),
    });

    // 6. Fire the session ping.
    postSessionPing(payload);

    // 7. Fire the initial page_view hit for the landing page.
    //    Effect B handles subsequent navigations, but visitorId is null on Effect B's
    //    first run (before this setState flushes), so we fire the landing page_view here.
    reportAttributionPageView(window.location.pathname, id);
  }, []);

  // ─── Effect B: Per-navigation — update lt_* and send page_view ────────────
  // Runs whenever the Wouter location changes (or when visitorId becomes non-null
  // after Effect A's setState). Guards against the initial render where visitorId
  // is still null — Effect A already handled that page_view.
  useEffect(() => {
    if (isAttributionIgnoredPath(location)) return;

    if (!visitorId && !trackingDeferred) return;

    const activeVisitorId = visitorId ?? ensureVisitorId();
    if (!visitorId) {
      setVisitorId(activeVisitorId);
      setTrackingDeferred(false);
    }

    // Re-read params for the current URL (relevant when ad clicks include UTMs).
    const params = new URLSearchParams(window.location.search);
    const utmSource = norm(params.get("utm_source"));

    const ltPayload: Record<string, unknown> = {
      visitorId: activeVisitorId,
      ltLandingPage: location,
    };

    if (utmSource) {
      // Only override lt_* when UTMs are present in the navigation URL.
      // Never overwrite with referrer — the in-app referrer is meaningless for last-touch.
      ltPayload.ltSource = utmSource;
      ltPayload.ltMedium = norm(params.get("utm_medium"));
      ltPayload.ltCampaign = norm(params.get("utm_campaign"));
      ltPayload.ltTerm = norm(params.get("utm_term"));
      ltPayload.ltContent = norm(params.get("utm_content"));
      ltPayload.ltId = norm(params.get("utm_id"));
      ltPayload.ltSourceChannel = channelFromUtmMedium(params.get("utm_medium"));
    }

    postSessionPing(stripUndefined(ltPayload));
    reportAttributionPageView(location, activeVisitorId);
  }, [location, visitorId, trackingDeferred]);

  return { visitorId };
}
