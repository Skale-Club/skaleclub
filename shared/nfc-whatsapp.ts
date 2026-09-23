// "Talk to us on WhatsApp" for the NFC keychain pages.
//
// The WhatsApp line is served by an AI agent in Xphere that only takes a
// conversation when a message mentions the product (keyword activation — the
// line also handles unrelated topics). So the pre-filled message MUST contain
// one of the agent's activation keywords, in the page's own language, or the
// visitor who taps the button gets no answer from it.
//
// The message is picked per language here, NOT run through t(): a missing
// translation row falls back to machine translation, which is free to rephrase
// "chaveiros" away. Each language carries its own keyword on purpose:
//   EN -> "keychains" + "NFC"      PT -> "chaveiros" + "NFC"
//
// NFC_AGENT_KEYWORDS mirrors NFC_ACTIVATION_KEYWORDS in the Xphere repo
// (scripts/setup-skaleclub-nfc-agent.ts). shared/nfc-whatsapp.test.ts fails if a
// message stops matching it; if you change either list, change both.
//
// Kept dependency-free (like shared/nfc-pricing.ts) so the client bundle can
// import it.

export type NfcWhatsappLanguage = "en" | "pt";

/** Skale Club's WhatsApp Business line (digits only, country code first). */
export const NFC_WHATSAPP_NUMBER = "15088018190";

export const NFC_WHATSAPP_MESSAGES: Record<NfcWhatsappLanguage, string> = {
  en: "Hi! I'd like to know more about the NFC keychains.",
  pt: "Oi! Quero saber mais sobre os chaveiros NFC.",
};

export const NFC_AGENT_KEYWORDS = [
  "chaveiro",
  "chaveiros",
  "chaveirinho",
  "chaveirinhos",
  "keychain",
  "keychains",
  "key chain",
  "key chains",
  "keyring",
  "keyrings",
  "llavero",
  "llaveros",
  "nfc",
] as const;

/** Same normalisation as the Xphere matcher: lowercase, no accents, words only. */
function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** The agent keywords a text would trigger, in list order (empty = the agent stays silent). */
export function nfcAgentKeywordsIn(text: string): string[] {
  const haystack = ` ${normalize(text)} `;
  return NFC_AGENT_KEYWORDS.filter((keyword) => haystack.includes(` ${normalize(keyword)} `));
}

/** wa.me link with the language's pre-filled message. */
export function whatsappHref(number: string, message: string): string {
  const digits = number.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export function nfcWhatsappHref(language: NfcWhatsappLanguage): string {
  return whatsappHref(NFC_WHATSAPP_NUMBER, NFC_WHATSAPP_MESSAGES[language]);
}

/** Section prop (`whatsapp`) for heroWebsites / leadFormCta on the NFC pages. */
export const NFC_WHATSAPP_CTA = {
  number: NFC_WHATSAPP_NUMBER,
  label: "Talk to us on WhatsApp",
  messages: NFC_WHATSAPP_MESSAGES,
};

/** Slug of the NFC order form that the landing and order pages open. */
export const NFC_ORDER_FORM_SLUG = "nfc-keychain-order";

/**
 * WhatsApp CTA a lead-form section gets when its stored props carry none:
 * any section that opens the NFC order form offers NFC WhatsApp too. Lets the
 * button reach the live pages without re-running the page seeds; an explicit
 * `whatsapp` prop (set by the seeds) always wins.
 */
export function defaultWhatsappCtaForForm(formSlug: string | undefined) {
  return formSlug === NFC_ORDER_FORM_SLUG ? NFC_WHATSAPP_CTA : undefined;
}
