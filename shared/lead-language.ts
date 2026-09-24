// Which language someone should be spoken to in, derived from what a lead
// already carries. The site is EN + PT only (shared/landingSeo.ts), so the
// answer is one of two values and never a locale we cannot staff.
//
// Xphere uses this to route an order callback to the Portuguese or the English
// voice assistant. A wrong guess is a phone call in the wrong language, so the
// order of signals matters:
//
//   1. the page they filled in — `/br/...` is the Portuguese site
//   2. the country they picked in the phone field (custom_answers.countryCode)
//   3. the dial prefix of the number itself
//
// Note the deliberate consequence of 2 and 3 outranking an English page URL:
// someone who reads the English page but leaves a +55 number is called in
// Portuguese. The language belongs to the person, not to the page.

export type LeadLanguage = "pt-BR" | "en";

const PT_COUNTRY_CODES = new Set(["BR", "PT"]);
const PT_DIAL_PREFIXES = ["+55", "+351"];

export interface LeadLanguageSignals {
  pageUrl?: string | null;
  countryCode?: string | null;
  phone?: string | null;
}

/** True when the URL's first path segment is the Portuguese site prefix. */
function isPortuguesePath(pageUrl: string): boolean {
  let path = pageUrl;
  try {
    path = new URL(pageUrl).pathname;
  } catch {
    // A bare path such as "/br/nfc-order" is not a valid URL — use it as-is.
  }
  const [first] = path.split("/").filter(Boolean);
  return first?.toLowerCase() === "br";
}

export function deriveLeadLanguage(signals: LeadLanguageSignals): LeadLanguage {
  const pageUrl = signals.pageUrl?.trim();
  if (pageUrl && isPortuguesePath(pageUrl)) return "pt-BR";

  const countryCode = signals.countryCode?.trim().toUpperCase();
  if (countryCode && PT_COUNTRY_CODES.has(countryCode)) return "pt-BR";

  const phone = signals.phone?.replace(/[\s()-]/g, "") ?? "";
  if (PT_DIAL_PREFIXES.some((prefix) => phone.startsWith(prefix))) return "pt-BR";

  return "en";
}
