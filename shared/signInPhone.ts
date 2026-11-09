// Phone numbers as a sign-in identity, stored in E.164 ("+15085550100").
// (shared/phone.ts is the display/link helper for company numbers; this is the strict sign-in form.)

export const E164_PATTERN = /^\+[1-9]\d{7,14}$/;

/**
 * E.164 from what a person types, or null when it cannot be a phone number.
 * `dialCode` (digits, no "+") is used when the input has no leading "+".
 */
export function normalizePhone(input: string | null | undefined, dialCode = "1"): string | null {
  const raw = (input ?? "").trim();
  if (!raw) return null;
  // Digits, spaces and the usual separators only; no letters.
  if (!/^\+?[\d\s().-]+$/.test(raw)) return null;
  const digits = raw.replace(/\D/g, "");
  const cc = dialCode.replace(/\D/g, "");
  let e164: string;
  if (raw.startsWith("+")) e164 = `+${digits}`;
  else if (raw.startsWith("00")) e164 = `+${digits.slice(2)}`;
  else if (cc === "1" && digits.length === 11 && digits.startsWith("1")) e164 = `+${digits}`;
  else e164 = `+${cc}${digits}`;
  if (!E164_PATTERN.test(e164)) return null;
  // North American numbers are exactly +1 and 10 digits.
  if (e164.startsWith("+1") && e164.length !== 12) return null;
  return e164;
}

/** "+15085550100" becomes "+1 (508) 555-0100"; "+5511987654321" becomes "+55 11 98765-4321". */
export function formatSignInPhone(e164: string | null | undefined): string {
  if (!e164) return "";
  const us = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(e164);
  if (us) return `+1 (${us[1]}) ${us[2]}-${us[3]}`;
  const br = /^\+55(\d{2})(\d{4,5})(\d{4})$/.exec(e164);
  if (br) return `+55 ${br[1]} ${br[2]}-${br[3]}`;
  return e164;
}
