// Pre-filled WhatsApp message for the site-wide buttons (floating button,
// mobile bar, footer, hero, contact, portfolio CTA).
//
// Every message ends with a page reference, e.g. "(Page: products/nfc-review-plaque)",
// so the lead that lands on the phone says which page it came from. Xphere
// automations key off that reference, so it must stay stable:
//   - it is built from the route path (not the page title, which admins edit);
//   - the message is picked per language here, NOT run through t(), because a
//     machine-translated fallback is free to rephrase or drop the reference.
//
// Landing sections with their own WhatsApp CTA (pages/sections/whatsappCta.tsx,
// NFC pages) keep their configured messages; this is only the generic default.
//
// Kept dependency-free so the client bundle can import it.

export type SiteWhatsappLanguage = "en" | "pt";

const BASE_MESSAGES: Record<SiteWhatsappLanguage, { text: string; label: string }> = {
  en: { text: "Hi! I found you on the Skale Club website and would like to talk about my project.", label: "Page" },
  pt: { text: "Olá! Vim pelo site da Skale Club e gostaria de conversar sobre meu projeto.", label: "Página" },
};

/**
 * Stable page reference from a route path: "/" -> "home",
 * "/Products/NFC-Review-Plaque/" -> "products/nfc-review-plaque".
 * Pass the path without the `/br` language prefix (what wouter's location gives).
 */
export function whatsappPageRef(path: string): string {
  const clean = path.split(/[?#]/)[0].replace(/^\/+|\/+$/g, "").toLowerCase();
  return clean || "home";
}

export function siteWhatsappMessage(path: string, language: SiteWhatsappLanguage): string {
  const { text, label } = BASE_MESSAGES[language] ?? BASE_MESSAGES.en;
  return `${text} (${label}: ${whatsappPageRef(path)})`;
}
