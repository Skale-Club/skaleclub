import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { SiWhatsapp } from "react-icons/si";
import type { CompanySettings } from "@shared/schema";
import { buildPagePaths } from "@shared/pageSlugs";
import { useSiteWhatsappHref } from "@/hooks/use-site-whatsapp";
import { trackEvent } from "@/lib/analytics";
import { isFloatingChromeHidden } from "./MobileActionBar";

/**
 * Floating WhatsApp button for tablet/desktop. Phones already get WhatsApp in
 * the MobileActionBar, so this one is hidden below `md` to avoid a duplicate.
 * Sits below the ChatWidget launcher (bottom-24) when both are on.
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
      onClick={() => trackEvent("click_whatsapp", { location: "floating_button" })}
      className="fixed bottom-6 right-6 z-40 hidden h-12 w-12 items-center justify-center rounded-full bg-[#25D366] text-white shadow-sm shadow-black/10 transition-colors hover:bg-[#1EBE5A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366]/50 focus-visible:ring-offset-2 md:flex"
      data-testid="floating-whatsapp"
    >
      <SiWhatsapp className="h-6 w-6" aria-hidden="true" />
    </a>
  );
}
