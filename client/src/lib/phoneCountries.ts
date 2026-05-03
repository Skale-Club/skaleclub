export type PhoneCountry = {
  code: string;
  name: string;
  dialCode: string;
  flag: string;
  format: string;
  maxDigits: number;
};

export const PHONE_COUNTRIES: PhoneCountry[] = [
  { code: "US", name: "United States", dialCode: "+1", flag: "\u{1F1FA}\u{1F1F8}", format: "(###) ###-####", maxDigits: 10 },
  { code: "BR", name: "Brazil", dialCode: "+55", flag: "\u{1F1E7}\u{1F1F7}", format: "(##) #####-####", maxDigits: 11 },
  { code: "PT", name: "Portugal", dialCode: "+351", flag: "\u{1F1F5}\u{1F1F9}", format: "### ### ###", maxDigits: 9 },
  { code: "CA", name: "Canada", dialCode: "+1", flag: "\u{1F1E8}\u{1F1E6}", format: "(###) ###-####", maxDigits: 10 },
  { code: "UK", name: "United Kingdom", dialCode: "+44", flag: "\u{1F1EC}\u{1F1E7}", format: "#### ######", maxDigits: 10 },
  { code: "ES", name: "Spain", dialCode: "+34", flag: "\u{1F1EA}\u{1F1F8}", format: "### ### ###", maxDigits: 9 },
  { code: "IT", name: "Italy", dialCode: "+39", flag: "\u{1F1EE}\u{1F1F9}", format: "### ### ####", maxDigits: 10 },
  { code: "DE", name: "Germany", dialCode: "+49", flag: "\u{1F1E9}\u{1F1EA}", format: "### #######", maxDigits: 10 },
  { code: "FR", name: "France", dialCode: "+33", flag: "\u{1F1EB}\u{1F1F7}", format: "# ## ## ## ##", maxDigits: 9 },
  { code: "IE", name: "Ireland", dialCode: "+353", flag: "\u{1F1EE}\u{1F1EA}", format: "## ### ####", maxDigits: 9 },
  { code: "AU", name: "Australia", dialCode: "+61", flag: "\u{1F1E6}\u{1F1FA}", format: "### ### ###", maxDigits: 9 },
  { code: "JP", name: "Japan", dialCode: "+81", flag: "\u{1F1EF}\u{1F1F5}", format: "## #### ####", maxDigits: 10 },
  { code: "MX", name: "Mexico", dialCode: "+52", flag: "\u{1F1F2}\u{1F1FD}", format: "## #### ####", maxDigits: 10 },
  { code: "AR", name: "Argentina", dialCode: "+54", flag: "\u{1F1E6}\u{1F1F7}", format: "## ####-####", maxDigits: 10 },
  { code: "PY", name: "Paraguay", dialCode: "+595", flag: "\u{1F1F5}\u{1F1FE}", format: "### ### ###", maxDigits: 9 },
  { code: "UY", name: "Uruguay", dialCode: "+598", flag: "\u{1F1FA}\u{1F1FE}", format: "## ### ###", maxDigits: 8 },
  { code: "CL", name: "Chile", dialCode: "+56", flag: "\u{1F1E8}\u{1F1F1}", format: "# #### ####", maxDigits: 9 },
];

export function detectDefaultPhoneCountry(): PhoneCountry {
  if (typeof window === "undefined") {
    return PHONE_COUNTRIES[0];
  }

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  const language = navigator.language || "";
  const brazilTimezones = new Set([
    "America/Sao_Paulo",
    "America/Manaus",
    "America/Belem",
    "America/Fortaleza",
    "America/Recife",
    "America/Bahia",
    "America/Cuiaba",
    "America/Campo_Grande",
    "America/Boa_Vista",
    "America/Porto_Velho",
    "America/Rio_Branco",
    "America/Noronha",
  ]);

  if (brazilTimezones.has(timezone) || (timezone.startsWith("America/") && language.toLowerCase() === "pt-br")) {
    return PHONE_COUNTRIES.find((country) => country.code === "BR") || PHONE_COUNTRIES[0];
  }

  return PHONE_COUNTRIES[0];
}

export function formatPhoneForCountry(value: string, country: PhoneCountry) {
  const digits = value.replace(/\D/g, "").slice(0, country.maxDigits);
  let result = "";
  let digitIndex = 0;

  for (const char of country.format) {
    if (digitIndex >= digits.length) break;
    if (char === "#") {
      result += digits[digitIndex];
      digitIndex += 1;
    } else {
      result += char;
    }
  }

  return result;
}

export function isValidPhoneForCountry(value: string, country: PhoneCountry) {
  return value.replace(/\D/g, "").length === country.maxDigits;
}

export function getInternationalPhone(value: string, country: PhoneCountry) {
  const digits = value.replace(/\D/g, "");
  return digits ? `${country.dialCode}${digits}` : "";
}
