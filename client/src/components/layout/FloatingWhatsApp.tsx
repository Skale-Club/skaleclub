import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { SiWhatsapp } from "react-icons/si";
import type { CompanySettings } from "@shared/schema";
import { buildPagePaths } from "@shared/pageSlugs";
import { useSiteWhatsappHref } from "@/hooks/use-site-whatsapp";
import { trackEvent } from "@/lib/analytics";
import { openWhatsAppChat } from "@/lib/whatsappChat";
import { isFloatingChromeHidden } from "./MobileActionBar";

/**
 * Floating WhatsApp button for phones, tablets, and desktop. On phones it sits
 * above the action bar; at `md` and up it moves down to the screen edge.
 *
 * A click first asks for the WhatsApp chat (name + phone, hosted by
 * MobileActionBar); the plain wa.me link only goes ahead when nothing claims it.
 */
export function FloatingWhatsApp() {
  const [location] = useLocation();
  const { data: settings } = useQuery<CompanySettings>({ queryKey: ["/api/company-settings"] });

  const phone = settings?.companyPhone?.trim() || "";
  const whatsappLink = useSiteWhatsappHref(phone);
  if (!phone || isFloatingChromeHidden(location, buildPagePaths(settings?.pageSlugs).thankYou)) return null;

  return (
    <a
      href={whatsappLink}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="WhatsApp"
      onClick={(e) => {
        if (openWhatsAppChat("floating_button")) e.preventDefault();
        else trackEvent("click_whatsapp", { location: "floating_button" });
      }}
      className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-[#25D366] text-white shadow-sm shadow-black/10 transition-[transform,background-color] duration-300 ease-out hover:scale-110 hover:bg-[#1EBE5A] motion-reduce:transition-colors motion-reduce:hover:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366]/50 focus-visible:ring-offset-2 md:bottom-6 md:right-6"
      data-testid="floating-whatsapp"
    >
      <SiWhatsapp className="h-6 w-6" aria-hidden="true" />
    </a>
  );
}
