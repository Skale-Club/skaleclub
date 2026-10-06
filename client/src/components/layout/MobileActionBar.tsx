import { lazy, Suspense, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Phone } from "lucide-react";
import type { CompanySettings } from "@shared/schema";
import { buildPagePaths, DEFAULT_PAGE_SLUGS } from "@shared/pageSlugs";
import { telHref } from "@shared/phone";
import { PillLink } from "@/components/editorial";
import { useTranslation } from "@/hooks/useTranslation";
import { trackEvent } from "@/lib/analytics";
import { WHATSAPP_CHAT_OPEN_EVENT, hasWhatsAppChatLead, type WhatsAppChatEntry } from "@/lib/whatsappChat";

const WhatsAppChat = lazy(() => import("./WhatsAppChat").then((m) => ({ default: m.WhatsAppChat })));

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
 * Fixed call bar for phones, shipped with the site chrome. The bar hides while
 * a modal has locked body scroll.
 *
 * It also hosts the WhatsApp chat (name + phone before the wa.me handoff) for
 * the floating WhatsApp button: this component is mounted at all widths (only
 * its action bar is hidden by CSS from `md` up), so the button reaches the
 * same host through the `whatsapp-chat:open` event.
 */
export function MobileActionBar() {
  const [location] = useLocation();
  const { t } = useTranslation();
  const { data: settings } = useQuery<CompanySettings>({ queryKey: ["/api/company-settings"] });
  const [scrollLocked, setScrollLocked] = useState(false);
  const [chat, setChat] = useState<{ open: boolean; entry: WhatsAppChatEntry } | null>(null);

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

  // Claim a WhatsApp button's click unless there is no number to hand off to
  // or this visitor already left their contact (then the link goes straight
  // to WhatsApp).
  useEffect(() => {
    if (hidden || !phone) return;
    const onOpen = (e: Event) => {
      if (hasWhatsAppChatLead()) return;
      e.preventDefault();
      const entry = (e as CustomEvent<{ entry: WhatsAppChatEntry }>).detail.entry;
      setChat((cur) => (cur?.open ? { ...cur, open: false } : { open: true, entry }));
    };
    document.addEventListener(WHATSAPP_CHAT_OPEN_EVENT, onOpen);
    return () => document.removeEventListener(WHATSAPP_CHAT_OPEN_EVENT, onOpen);
  }, [hidden, phone]);

  if (hidden) return null;

  return (
    <>
      {!scrollLocked && phone && (
        <div
          className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-navy-950/95 px-3 pt-2.5 backdrop-blur md:hidden"
          style={{ paddingBottom: "max(0.625rem, env(safe-area-inset-bottom))" }}
          data-testid="mobile-action-bar"
        >
          <div className="mx-auto flex w-full max-w-xs items-center justify-center">
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
          </div>
        </div>
      )}
      {chat && (
        <Suspense fallback={null}>
          <WhatsAppChat
            open={chat.open}
            entry={chat.entry}
            onClose={() => setChat((cur) => (cur ? { ...cur, open: false } : cur))}
            phone={phone}
            companyName={settings?.companyName?.trim() || "WhatsApp"}
            avatarUrl={settings?.heroImageUrl?.trim() || settings?.logoIcon?.trim() || undefined}
          />
        </Suspense>
      )}
    </>
  );
}
