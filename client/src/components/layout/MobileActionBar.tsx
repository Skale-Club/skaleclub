import { lazy, Suspense, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { MessageCircle, Phone, FileText } from "lucide-react";
import type { CompanySettings } from "@shared/schema";
import { defaultWhatsappMessage, telHref, whatsappHref } from "@shared/phone";
import { PillButton, PillLink } from "@/components/editorial";
import { useTranslation } from "@/hooks/useTranslation";
import { trackCTAClick, trackEvent } from "@/lib/analytics";

const LeadFormModal = lazy(() => import("@/components/LeadFormModal").then((m) => ({ default: m.LeadFormModal })));

// Routes that render their own full-screen UI or are not marketing pages.
const HIDDEN_PREFIXES = ["/admin", "/e/", "/p/", "/nfc-order", "/print", "/oauth/"];

/**
 * Fixed call / WhatsApp / quote bar for phones, shipped with the site chrome.
 * The quote pill owns its own lead form (the global `data-form-trigger`
 * listener only exists on Home), and the bar hides while any modal has locked
 * body scroll, which is what LeadFormModal does while open.
 */
export function MobileActionBar() {
  const [location] = useLocation();
  const { t, language } = useTranslation();
  const { data: settings } = useQuery<CompanySettings>({ queryKey: ["/api/company-settings"] });
  const [formOpen, setFormOpen] = useState(false);
  const [formMounted, setFormMounted] = useState(false);
  const [scrollLocked, setScrollLocked] = useState(false);

  useEffect(() => {
    const check = () => setScrollLocked(document.body.style.overflow === "hidden");
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.body, { attributes: true, attributeFilter: ["style"] });
    return () => observer.disconnect();
  }, []);

  const hidden = HIDDEN_PREFIXES.some((p) => location === p.replace(/\/$/, "") || location.startsWith(p));
  const phone = settings?.companyPhone?.trim() || "";

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
                onClick={() => trackEvent("click_call", { location: "mobile-bar" })}
              >
                <Phone className="h-4 w-4" aria-hidden="true" />
                {t("Call")}
              </PillLink>
            )}
            {phone && (
              <PillLink
                href={whatsappHref(phone, defaultWhatsappMessage(language))}
                target="_blank"
                size="sm"
                variant="ghost"
                className="flex-1"
                onClick={() => trackEvent("click_whatsapp", { location: "mobile-bar" })}
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
                trackCTAClick("mobile-bar", settings?.ctaText || "Quote");
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
