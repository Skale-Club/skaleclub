/**
 * Phone helpers. Company numbers are stored as free text ("(508) 500-1095"),
 * so every tel:/wa.me link is built from the E.164 form instead of raw digits.
 */

/** Digits only, with a leading "+"; 10-digit (or 1 + 10) numbers are treated as US. */
export function toE164(raw: string | null | undefined, defaultCountry: "US" = "US"): string {
  const input = (raw ?? "").trim();
  const digits = input.replace(/\D/g, "");
  if (!digits) return "";
  if (input.startsWith("+")) return `+${digits}`;
  if (input.startsWith("00") && digits.length > 4) return `+${digits.slice(2)}`;
  if (defaultCountry === "US") {
    if (digits.length === 10) return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  }
  return `+${digits}`;
}

export function telHref(raw: string | null | undefined): string {
  const e164 = toE164(raw);
  return e164 ? `tel:${e164}` : "#";
}

/** wa.me wants the number without "+" and the message URL-encoded. */
export function whatsappHref(raw: string | null | undefined, message?: string): string {
  const digits = toE164(raw).replace(/\D/g, "");
  if (!digits) return "#";
  return `https://wa.me/${digits}${message ? `?text=${encodeURIComponent(message)}` : ""}`;
}

/** Pre-filled WhatsApp opener for the site-wide buttons. */
export function defaultWhatsappMessage(lang: string): string {
  return lang === "pt"
    ? "Olá! Vim pelo site da Skale Club e gostaria de conversar sobre meu projeto."
    : "Hi! I found you on the Skale Club website and would like to talk about my project.";
}

/** "+15085001095" or "5085001095" -> "(508) 500-1095"; other numbers are returned as typed. */
export function formatPhoneDisplay(raw: string | null | undefined): string {
  const e164 = toE164(raw);
  const us = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(e164);
  if (us) return `(${us[1]}) ${us[2]}-${us[3]}`;
  return (raw ?? "").trim();
}
