import { lazy, Suspense, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { CompanySettings } from "@shared/schema";
import { buildPagePaths, DEFAULT_PAGE_SLUGS } from "@shared/pageSlugs";
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
 * Hosts the WhatsApp pre-chat (name + phone before the wa.me handoff). The old
 * fixed call bar was removed so telephone calls no longer compete with the
 * page's primary lead-form action.
 */
export function MobileActionBar() {
  const [location] = useLocation();
  const { data: settings } = useQuery<CompanySettings>({ queryKey: ["/api/company-settings"] });
  const [chat, setChat] = useState<{ open: boolean; entry: WhatsAppChatEntry } | null>(null);

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

  if (!chat) return null;

  return (
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
  );
}
