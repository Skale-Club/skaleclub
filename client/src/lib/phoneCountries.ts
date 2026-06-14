export type PhoneCountry = {
  code: string;
  name: string;
  dialCode: string;
  flagCode: string;
  format: string;
  placeholder: string;
  maxDigits: number;
};

export const PHONE_COUNTRIES: PhoneCountry[] = [
  { code: "US", name: "United States", dialCode: "+1", flagCode: "us", format: "(###) ###-####", placeholder: "(555) 555-5555", maxDigits: 10 },
  { code: "BR", name: "Brazil", dialCode: "+55", flagCode: "br", format: "(##) #####-####", placeholder: "(11) 98765-4321", maxDigits: 11 },
  { code: "PT", name: "Portugal", dialCode: "+351", flagCode: "pt", format: "### ### ###", placeholder: "912 345 678", maxDigits: 9 },
  { code: "CA", name: "Canada", dialCode: "+1", flagCode: "ca", format: "(###) ###-####", placeholder: "(416) 555-1234", maxDigits: 10 },
  { code: "UK", name: "United Kingdom", dialCode: "+44", flagCode: "gb", format: "#### ######", placeholder: "7911 123456", maxDigits: 10 },
  { code: "ES", name: "Spain", dialCode: "+34", flagCode: "es", format: "### ### ###", placeholder: "612 345 678", maxDigits: 9 },
  { code: "IT", name: "Italy", dialCode: "+39", flagCode: "it", format: "### ### ####", placeholder: "312 345 6789", maxDigits: 10 },
  { code: "DE", name: "Germany", dialCode: "+49", flagCode: "de", format: "### #######", placeholder: "030 1234567", maxDigits: 10 },
  { code: "FR", name: "France", dialCode: "+33", flagCode: "fr", format: "# ## ## ## ##", placeholder: "6 12 34 56 78", maxDigits: 9 },
  { code: "IE", name: "Ireland", dialCode: "+353", flagCode: "ie", format: "## ### ####", placeholder: "87 123 4567", maxDigits: 9 },
  { code: "AU", name: "Australia", dialCode: "+61", flagCode: "au", format: "### ### ###", placeholder: "412 345 678", maxDigits: 9 },
  { code: "JP", name: "Japan", dialCode: "+81", flagCode: "jp", format: "## #### ####", placeholder: "90 1234 5678", maxDigits: 10 },
  { code: "MX", name: "Mexico", dialCode: "+52", flagCode: "mx", format: "## #### ####", placeholder: "55 1234 5678", maxDigits: 10 },
  { code: "AR", name: "Argentina", dialCode: "+54", flagCode: "ar", format: "## ####-####", placeholder: "11 1234-5678", maxDigits: 10 },
  { code: "PY", name: "Paraguay", dialCode: "+595", flagCode: "py", format: "### ### ###", placeholder: "981 234 567", maxDigits: 9 },
  { code: "UY", name: "Uruguay", dialCode: "+598", flagCode: "uy", format: "## ### ###", placeholder: "98 765 432", maxDigits: 8 },
  { code: "CL", name: "Chile", dialCode: "+56", flagCode: "cl", format: "# #### ####", placeholder: "9 8765 4321", maxDigits: 9 },
];

export function getPhoneCountryFlagUrl(country: PhoneCountry) {
  return `/flags/nucleo/${country.flagCode}.svg`;
}

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
