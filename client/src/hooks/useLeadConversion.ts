import { useEffect } from "react";
import { trackEvent } from "@/lib/analytics";

/**
 * Fires the lead conversion (`generate_lead`) on the page a completed form
 * lands on: the thank-you page, or a form's `completionRedirect` page (the
 * keychain order form lands on /nfc-guide).
 *
 * The form's own `form_completed` can be lost when it navigates away right
 * after firing, so the landing page confirms it. It is queued by trackEvent if
 * analytics is still initialising. The URL carries no lead id, so it dedupes by
 * form slug for 30 minutes in this browser session (a reload must not double
 * count).
 *
 * Pass `enabled: false` on a page that is only sometimes a form landing (the
 * guide without `?form=`).
 */
export function useLeadConversion(formLabel: string | null, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const label = formLabel ?? "unknown";
    const dedupeKey = `generate_lead:${label}`;
    let alreadyCounted = false;
    try {
      const last = Number(window.sessionStorage.getItem(dedupeKey));
      alreadyCounted = Number.isFinite(last) && last > 0 && Date.now() - last < 30 * 60 * 1000;
      if (!alreadyCounted) window.sessionStorage.setItem(dedupeKey, String(Date.now()));
    } catch {
      // Storage blocked: fire anyway.
    }
    if (!alreadyCounted) {
      trackEvent("generate_lead", { location: window.location.pathname, label });
    }
  }, [formLabel, enabled]);
}
