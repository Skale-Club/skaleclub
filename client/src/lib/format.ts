import type { Language } from "@/context/LanguageContext";

const locale = (lang: string) => (lang === "pt" ? "pt-BR" : "en-US");

/** "September 29, 2026" / "29 de setembro de 2026". Empty string for missing or invalid input. */
export function formatDate(date: string | number | Date | null | undefined, lang: Language | string = "en"): string {
  if (date === null || date === undefined || date === "") return "";
  const value = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(value.getTime())) return "";
  return new Intl.DateTimeFormat(locale(lang), { dateStyle: "long" }).format(value);
}

/** USD from cents; PT renders "US$ 10,00". */
export function formatMoneyUsd(cents: number, lang: Language | string = "en"): string {
  return new Intl.NumberFormat(locale(lang), { style: "currency", currency: "USD" }).format(cents / 100);
}

/** Labels that read before the value ("from $299"); anything else trails it ("$49 / month"). */
const PREFIX_LABEL = /^(from|starting(\s+at)?|a partir de)$/i;

export interface PriceParts {
  value: string;
  /** Text rendered before the value. */
  prefix?: string;
  /** Text rendered after the value; `tight` means no space ("US$ 49/mês"). */
  suffix?: string;
  tight?: boolean;
}

/**
 * Splits a catalog price into its display parts. The value comes from the DB
 * as typed ("$299"); in PT a leading "$" becomes "US$ ". Prefix-type labels go
 * before the value in both languages, and callers always separate the parts
 * with a space (except a "/unit" suffix).
 */
export function priceParts(
  price: { value: string; label?: string },
  lang: Language | string,
  translate: (key: string) => string,
): PriceParts {
  const value = lang === "pt" ? price.value.replace(/^\$\s*(?=\d)/, "US$ ") : price.value;
  if (!price.label) return { value };
  const label = translate(price.label);
  if (PREFIX_LABEL.test(price.label.trim()) || PREFIX_LABEL.test(label.trim())) return { value, prefix: label };
  return { value, suffix: label, tight: label.trimStart().startsWith("/") };
}
