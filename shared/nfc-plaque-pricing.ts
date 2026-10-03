/**
 * NFC counter plaque order — business rules (models, quantity, price).
 *
 * Same contract as shared/nfc-pricing.ts: the ONLY place the plaque's numbers
 * exist, no imports beyond types, integer cents end to end, and the server
 * recomputes every quote with these same functions (the browser's number is
 * display-only).
 *
 * Prices are the ones recommended on 2026-10-02 (Notion: "Projeção de preços —
 * plaquinhas NFC de balcão, padrão e custom"):
 *   - Standard (our ready-made Google or Instagram design, QR + chip through a
 *     Smart Tags link): $49 each, or every pair for $79.
 *   - Custom (the customer's logo / name / @, QR + chip straight to their own
 *     link): $89 the first (it carries the hour of custom artwork), $49 each
 *     additional.
 * No art fee: the custom first-plaque price already covers the artwork.
 */
import type { NfcQuote, NfcQuoteLine } from "./nfc-pricing.js";

// Stamped on every saved order. Bump it whenever a constant below changes.
export const NFC_PLAQUE_PRICING_VERSION = "2026-10-02.1";

export const NFC_PLAQUE_CURRENCY = "USD";

export const NFC_PLAQUE_QUANTITY = { min: 1, max: 10, step: 1 } as const;

export type NfcPlaquePricing = "standard" | "custom";

export type NfcPlaqueType = {
  id: string;
  label: string;
  description: string;
  pricing: NfcPlaquePricing;
  /** One-line price rule on the picker card (built from NFC_PLAQUE_PRICES). */
  priceSummary: string;
  active: boolean;
};

export const NFC_PLAQUE_PRICES = {
  standardUnitCents: 4900,
  standardPairCents: 7900,
  customFirstCents: 8900,
  customAdditionalCents: 4900,
} as const;

const dollars = (cents: number) => `$${cents / 100}`;

/** The picker's price line per pricing kind. English: the UI passes it through t(). */
export const NFC_PLAQUE_PRICE_SUMMARY: Record<NfcPlaquePricing, string> = {
  standard: `${dollars(NFC_PLAQUE_PRICES.standardUnitCents)} each, or 2 for ${dollars(NFC_PLAQUE_PRICES.standardPairCents)}`,
  custom: `${dollars(NFC_PLAQUE_PRICES.customFirstCents)} the first, ${dollars(NFC_PLAQUE_PRICES.customAdditionalCents)} each additional`,
};

export const NFC_PLAQUE_TYPES: NfcPlaqueType[] = [
  {
    id: "google",
    label: "Google Review plaque",
    description: "Our ready-made \"Review us on Google\" design. Tap or scan opens your review page, and we can change the link anytime.",
    pricing: "standard",
    priceSummary: NFC_PLAQUE_PRICE_SUMMARY.standard,
    active: true,
  },
  {
    id: "instagram",
    label: "Instagram plaque",
    description: "Our ready-made \"Follow us on Instagram\" design. Tap or scan opens your profile, and we can change the link anytime.",
    pricing: "standard",
    priceSummary: NFC_PLAQUE_PRICE_SUMMARY.standard,
    active: true,
  },
  {
    id: "custom",
    label: "Custom plaque",
    description: "Your logo, name or @ on the plaque. Tap or scan opens your own link directly.",
    pricing: "custom",
    priceSummary: NFC_PLAQUE_PRICE_SUMMARY.custom,
    active: true,
  },
];

export const NFC_PLAQUE_DEFAULT_TYPE_ID = "google";

/** Clamp to [min, max] and snap to a whole plaque. */
export function snapPlaqueQuantity(quantity: number): number {
  const { min, max, step } = NFC_PLAQUE_QUANTITY;
  if (!Number.isFinite(quantity)) return min;
  const snapped = Math.round(Math.min(max, Math.max(min, quantity)) / step) * step;
  return Math.min(max, Math.max(min, snapped));
}

export function getNfcPlaqueType(typeId?: string | null): NfcPlaqueType {
  const active = NFC_PLAQUE_TYPES.filter((type) => type.active);
  const pool = active.length > 0 ? active : NFC_PLAQUE_TYPES;
  return (
    pool.find((type) => type.id === typeId) ??
    pool.find((type) => type.id === NFC_PLAQUE_DEFAULT_TYPE_ID) ??
    pool[0]
  );
}

function line(label: string, count: number, unitPriceCents: number): NfcQuoteLine {
  return { label, count, unitPriceCents, totalCents: count * unitPriceCents };
}

function plaqueLines(quantity: number, pricing: NfcPlaquePricing): NfcQuoteLine[] {
  const p = NFC_PLAQUE_PRICES;
  if (pricing === "custom") {
    const lines = [line("First plaque, custom artwork included", 1, p.customFirstCents)];
    if (quantity > 1) lines.push(line("Additional plaque", quantity - 1, p.customAdditionalCents));
    return lines;
  }
  const pairs = Math.floor(quantity / 2);
  const lines: NfcQuoteLine[] = [];
  if (pairs > 0) lines.push(line("Pair of plaques", pairs, p.standardPairCents));
  if (quantity % 2 === 1) lines.push(line("Single plaque", 1, p.standardUnitCents));
  return lines;
}

/** Price a plaque order. Returns the same shape as the keychain quote. */
export function quotePlaqueOrder(input: { quantity: number; typeId?: string | null }): NfcQuote {
  const type = getNfcPlaqueType(input.typeId);
  const quantity = snapPlaqueQuantity(input.quantity);
  const lines = plaqueLines(quantity, type.pricing);
  const subtotalCents = lines.reduce((sum, l) => sum + l.totalCents, 0);
  const unitPriceCents =
    type.pricing === "custom" ? NFC_PLAQUE_PRICES.customFirstCents : NFC_PLAQUE_PRICES.standardUnitCents;

  return {
    quantity,
    typeId: type.id,
    typeLabel: type.label,
    quoteOnRequest: false,
    unitPriceCents,
    effectiveUnitPriceCents: Math.round(subtotalCents / quantity),
    subtotalCents,
    artFeeApplies: false,
    artFeeCents: 0,
    totalCents: subtotalCents,
    upgrade: null,
    lines,
    pricingVersion: NFC_PLAQUE_PRICING_VERSION,
    currency: NFC_PLAQUE_CURRENCY,
  };
}
