import { lazy, Suspense, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { MessageCircle, Phone, FileText } from "lucide-react";
import type { CompanySettings } from "@shared/schema";
import { buildPagePaths, DEFAULT_PAGE_SLUGS } from "@shared/pageSlugs";
import { telHref } from "@shared/phone";
import { PillButton, PillLink } from "@/components/editorial";
import { useTranslation } from "@/hooks/useTranslation";
import { useSiteWhatsappHref } from "@/hooks/use-site-whatsapp";
import { trackCTAClick, trackEvent } from "@/lib/analytics";

const LeadFormModal = lazy(() => import("@/components/LeadFormModal").then((m) => ({ default: m.LeadFormModal })));

// Routes that render their own full-screen UI or are not marketing pages.
const LEGACY_THANK_YOU = buildPagePaths(DEFAULT_PAGE_SLUGS).thankYou;
const HIDDEN_PREFIXES = ["/admin", "/e/", "/p/", "/nfc-order", "/plaque-order", "/print", "/oauth/", "/f/"];

/** True on routes where the floating site chrome (action bar, WhatsApp button) stays out of the way. */
export function isFloatingChromeHidden(location: string, thankYou: string) {
  return (
    HIDDEN_PREFIXES.some((p) => location === p.replace(/\/$/, "") || location.startsWith(p)) ||
    location === thankYou || location === LEGACY_THANK_YOU
  );
}

/**
 * Fixed call / WhatsApp / quote bar for phones, shipped with the site chrome.
 * The quote pill asks the page to open its lead form (`lead-form:open`) and only
 * mounts its own modal when nothing claims the event. The bar hides while a modal has locked
 * body scroll, which is what LeadFormModal does while open.
 */
export function MobileActionBar() {
  const [location] = useLocation();
  const { t } = useTranslation();
  const { data: settings } = useQuery<CompanySettings>({ queryKey: ["/api/company-settings"] });
  const [formOpen, setFormOpen] = useState(false);
  const [formMounted, setFormMounted] = useState(false);
  const [scrollLocked, setScrollLocked] = useState(false);

  useEffect(() => {
    const check = () => setScrollLocked(document.body.style.overflow === "hidden" || document.body.hasAttribute("data-scroll-locked"));
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.body, { attributes: true, attributeFilter: ["style", "data-scroll-locked"] });
    return () => observer.disconnect();
  }, []);

  const thankYou = buildPagePaths(settings?.pageSlugs).thankYou;
  const hidden = isFloatingChromeHidden(location, thankYou);
  const phone = settings?.companyPhone?.trim() || "";
  const whatsappLink = useSiteWhatsappHref(phone);

  if (hidden) return null;

  return (
    <>
      {!scrollLocked && !formOpen && (
        <div
          className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-navy-950/95 px-3 pt-2.5 backdrop-blur md:hidden"
          style={{ paddingBottom: "max(0.625rem, env(safe-area-inset-bottom))" }}
          data-testid="mobile-action-bar"
        >
          <div className="mx-auto flex max-w-md items-center justify-center gap-2">
            {phone && (
              <PillLink
                href={telHref(phone)}
                size="sm"
                variant="ghost"
                className="flex-1"
                onClick={() => trackEvent("click_call", { location: "mobile_bar" })}
              >
                <Phone className="h-4 w-4" aria-hidden="true" />
                {t("Call")}
              </PillLink>
            )}
            {phone && (
              <PillLink
                href={whatsappLink}
                target="_blank"
                size="sm"
                variant="ghost"
                className="flex-1"
                onClick={() => trackEvent("click_whatsapp", { location: "mobile_bar" })}
              >
                <MessageCircle className="h-4 w-4" aria-hidden="true" />
                WhatsApp
              </PillLink>
            )}
            <PillButton
              size="sm"
              variant="primary"
              className="flex-1"
              onClick={() => {
                trackCTAClick("mobile_bar", settings?.ctaText || "Quote");
                // Pages that already own a lead modal (Home, Portfolio) claim the event.
                const claimed = !document.dispatchEvent(
                  new CustomEvent("lead-form:open", { cancelable: true, detail: { source: "mobile-bar" } }),
                );
                if (claimed) return;
                setFormMounted(true);
                setFormOpen(true);
              }}
            >
              <FileText className="h-4 w-4" aria-hidden="true" />
              {t("Quote")}
            </PillButton>
          </div>
        </div>
      )}
      {formMounted && (
        <Suspense fallback={null}>
          <LeadFormModal open={formOpen} onClose={() => setFormOpen(false)} formSlug="default" />
        </Suspense>
      )}
    </>
  );
}
