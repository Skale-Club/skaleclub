/**
 * Phone helpers. Company numbers are stored as free text ("(508) 500-1095"),
 * so every tel:/wa.me link is built from the E.164 form instead of raw digits.
 */

/** Digits only, with a leading "+"; 10-digit (or 1 + 10) numbers are treated as US. */
export function toE164(raw: string | null | undefined, defaultCountry: "US" = "US"): string {
  // Drop extensions ("ext 2", "x2", "ramal 2") before counting digits.
  const input = (raw ?? "").replace(/\s*(?:ext\.?|extension|ramal|x)\s*\d+\s*$/i, "").trim();
  const digits = input.replace(/\D/g, "");
  if (!digits) return "";
  if (input.startsWith("+")) return `+${digits}`;
  if (input.startsWith("00") && digits.length > 4) return `+${digits.slice(2)}`;
  if (defaultCountry === "US") {
    // NANP area codes never start with 0 or 1.
    if (/^[2-9]\d{9}$/.test(digits)) return `+1${digits}`;
    if (/^1[2-9]\d{9}$/.test(digits)) return `+${digits}`;
  }
  // Anything else is ambiguous without a country code; refuse to guess.
  return "";
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

/** "+15085001095" or "5085001095" -> "(508) 500-1095"; other numbers are returned as typed. */
export function formatPhoneDisplay(raw: string | null | undefined): string {
  const e164 = toE164(raw);
  const us = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(e164);
  if (us) return `(${us[1]}) ${us[2]}-${us[3]}`;
  return (raw ?? "").trim();
}
