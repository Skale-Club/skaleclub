import { useLocation } from "wouter";
import { whatsappHref } from "@shared/phone";
import { siteWhatsappMessage } from "@shared/site-whatsapp";
import { useTranslation } from "@/hooks/useTranslation";

/** wa.me link whose pre-filled message names the current page (see shared/site-whatsapp.ts). */
export function useSiteWhatsappHref(phone: string | null | undefined): string {
  const [location] = useLocation();
  const { language } = useTranslation();
  return whatsappHref(phone, siteWhatsappMessage(location, language === "pt" ? "pt" : "en"));
}
