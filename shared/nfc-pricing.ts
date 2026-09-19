/**
 * NFC keychain order — business rules (quantity, price, art fee).
 *
 * This file is the ONLY place the product's numbers exist. Fine-tuning price is
 * editing the constants at the top; nothing below depends on React, the
 * database or the network, so the server can (and does) recompute every quote
 * on its own. The price the browser sends is display-only and never trusted.
 *
 * Money is handled in integer cents end to end — no float arithmetic on totals.
 */

// Stamped on every saved order so a later price change never rewrites what was
// quoted yesterday. Bump it whenever the constants below change.
export const NFC_PRICING_VERSION = "2026-09-19.1";

export const NFC_CURRENCY = "USD";

// ── Quantity range ─────────────────────────────────────────────────────────
// `max` is deliberately low for now (raise it here, nowhere else — the slider
// curve and the volume tiers both re-derive from it).
export const NFC_QUANTITY = {
  min: 20,
  max: 200,
  step: 10,
} as const;

// ── Keychain types ─────────────────────────────────────────────────────────
// PLACEHOLDER — the real catalogue is still to be defined. Today everything is
// priced as the standard piece (1.0x). To add a type, append a row here: the
// picker, the price panel, the order summary and the Telegram alert all read
// this list, so nothing else needs to change.
//
// `priceMultiplier` multiplies the per-unit tier price (1.2 = 20% dearer).
export type NfcKeychainType = {
  id: string;
  label: string;
  description: string;
  priceMultiplier: number;
  active: boolean;
};

export const NFC_KEYCHAIN_TYPES: NfcKeychainType[] = [
  {
    id: "standard",
    label: "Standard",
    description: "3D-printed in a single color with your logo.",
    priceMultiplier: 1,
    active: true,
  },
  // Examples, disabled until the catalogue and the real multipliers are set:
  // { id: "two-tone",     label: "Two-tone",     description: "...", priceMultiplier: 1.2, active: false },
  // { id: "custom-shape", label: "Custom shape", description: "...", priceMultiplier: 1.4, active: false },
];

export const NFC_DEFAULT_TYPE_ID = "standard";

/**
 * Default question ids a priced form reads its quote from, overridable per
 * form via `FormConfig["pricing"]`.
 *
 * It lives here rather than beside the FormConfig types because this module has
 * no imports: shared/schema.ts pulls in node's `crypto` transitively, so a
 * client-side runtime import of that barrel would break the browser bundle.
 */
export const NFC_PRICING_QUESTION_IDS = {
  typeQuestionId: "tipoChaveiro",
  quantityQuestionId: "quantidade",
  returningQuestionId: "pedidoAnterior",
  returningValue: "yes",
} as const;

// ── Volume tiers ───────────────────────────────────────────────────────────
// Sorted ascending by `minQuantity`; the last tier whose minimum the order
// reaches wins. Tiers above NFC_QUANTITY.max are unreachable today and sit
// dormant — raising the max activates them with no code change.
export type NfcVolumeTier = { minQuantity: number; unitPriceCents: number };

export const NFC_VOLUME_TIERS: NfcVolumeTier[] = [
  { minQuantity: 20, unitPriceCents: 1000 },
  { minQuantity: 50, unitPriceCents: 900 },
  { minQuantity: 100, unitPriceCents: 800 },
  // Dormant while max = 200:
  { minQuantity: 250, unitPriceCents: 700 },
  { minQuantity: 500, unitPriceCents: 650 },
  { minQuantity: 1000, unitPriceCents: 600 },
];

// One-time art / design fee, charged on a customer's first order only.
export const NFC_ART_FEE_CENTS = 5000;

// ── Quantity <-> slider position ───────────────────────────────────────────
// The slider is exponential so the low end (where nearly every order lives)
// gets most of the travel: with 20..200, the 20-50 range takes ~40% of the
// track while the last 50 units take ~12%. Raising `max` keeps that shape.

/** Clamp to [min, max] and snap to the nearest `step` multiple. */
export function snapQuantity(quantity: number): number {
  const { min, max, step } = NFC_QUANTITY;
  if (!Number.isFinite(quantity)) return min;
  const clamped = Math.min(max, Math.max(min, quantity));
  const snapped = Math.round(clamped / step) * step;
  return Math.min(max, Math.max(min, snapped));
}

/** Slider position (0..1) -> quantity. */
export function quantityFromSliderPosition(position: number): number {
  const { min, max } = NFC_QUANTITY;
  const t = Math.min(1, Math.max(0, Number.isFinite(position) ? position : 0));
  return snapQuantity(min * Math.pow(max / min, t));
}

/** Quantity -> slider position (0..1). Inverse of the above, pre-snapping. */
export function sliderPositionFromQuantity(quantity: number): number {
  const { min, max } = NFC_QUANTITY;
  const q = Math.min(max, Math.max(min, Number.isFinite(quantity) ? quantity : min));
  return Math.log(q / min) / Math.log(max / min);
}

/** Every quantity the slider can land on, low to high. */
export function nfcQuantityStops(): number[] {
  const { min, max, step } = NFC_QUANTITY;
  const stops: number[] = [];
  for (let q = min; q <= max; q += step) stops.push(q);
  if (stops[stops.length - 1] !== max) stops.push(max);
  return stops;
}

// ── Pricing ────────────────────────────────────────────────────────────────

export function getNfcKeychainType(typeId?: string | null): NfcKeychainType {
  const active = NFC_KEYCHAIN_TYPES.filter((type) => type.active);
  const pool = active.length > 0 ? active : NFC_KEYCHAIN_TYPES;
  return (
    pool.find((type) => type.id === typeId) ??
    pool.find((type) => type.id === NFC_DEFAULT_TYPE_ID) ??
    pool[0]
  );
}

/** Tier unit price for a quantity, before the type multiplier. */
export function tierUnitPriceCents(quantity: number): number {
  const q = snapQuantity(quantity);
  let price = NFC_VOLUME_TIERS[0].unitPriceCents;
  for (const tier of NFC_VOLUME_TIERS) {
    if (q >= tier.minQuantity) price = tier.unitPriceCents;
    else break;
  }
  return price;
}

function unitPriceCentsFor(quantity: number, type: NfcKeychainType): number {
  return Math.round(tierUnitPriceCents(quantity) * type.priceMultiplier);
}

function rawSubtotalCents(quantity: number, type: NfcKeychainType): number {
  return unitPriceCentsFor(quantity, type) * quantity;
}

export type NfcQuote = {
  quantity: number;
  typeId: string;
  typeLabel: string;
  /** Table price per unit for this quantity and type. */
  unitPriceCents: number;
  /** What each unit actually costs after the monotonic cap below. */
  effectiveUnitPriceCents: number;
  subtotalCents: number;
  artFeeApplies: boolean;
  artFeeCents: number;
  totalCents: number;
  /**
   * Set when a larger quantity costs the same or less. The customer is never
   * charged more than this, so the hint is an offer of extra pieces at no extra
   * cost — not an upsell.
   */
  upgrade: { quantity: number; subtotalCents: number } | null;
  pricingVersion: string;
  currency: string;
};

/**
 * Price an order.
 *
 * Because tiers get cheaper in steps, a raw table lookup can make a smaller
 * order dearer than a bigger one (90 x $9.00 = $810 against 100 x $8.00 =
 * $800). The subtotal is therefore capped by the cheapest reachable quantity at
 * or above the requested one, which guarantees the total never rises as the
 * slider goes right — whatever the tiers are edited to later.
 */
export function quoteNfcOrder(input: {
  quantity: number;
  typeId?: string | null;
  isFirstOrder?: boolean;
}): NfcQuote {
  const type = getNfcKeychainType(input.typeId);
  const quantity = snapQuantity(input.quantity);

  let bestQuantity = quantity;
  let bestSubtotal = rawSubtotalCents(quantity, type);
  for (const tier of NFC_VOLUME_TIERS) {
    if (tier.minQuantity <= quantity || tier.minQuantity > NFC_QUANTITY.max) continue;
    const candidate = rawSubtotalCents(tier.minQuantity, type);
    if (candidate <= bestSubtotal) {
      bestSubtotal = candidate;
      bestQuantity = tier.minQuantity;
    }
  }

  const artFeeApplies = input.isFirstOrder !== false;
  const artFeeCents = artFeeApplies ? NFC_ART_FEE_CENTS : 0;

  return {
    quantity,
    typeId: type.id,
    typeLabel: type.label,
    unitPriceCents: unitPriceCentsFor(quantity, type),
    effectiveUnitPriceCents: Math.round(bestSubtotal / quantity),
    subtotalCents: bestSubtotal,
    artFeeApplies,
    artFeeCents,
    totalCents: bestSubtotal + artFeeCents,
    upgrade: bestQuantity > quantity ? { quantity: bestQuantity, subtotalCents: bestSubtotal } : null,
    pricingVersion: NFC_PRICING_VERSION,
    currency: NFC_CURRENCY,
  };
}

/** "$1,234.50" — cents in, display string out. */
export function formatUsdCents(cents: number): string {
  const value = (Math.round(cents) / 100).toFixed(2);
  const [whole, fraction] = value.split(".");
  return `$${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${fraction}`;
}

// ── Order snapshot ─────────────────────────────────────────────────────────
// form_leads.custom_answers is Record<string, string>, so the quote is frozen
// onto the lead as flat strings. Keys are prefixed `nfc` to stay clear of form
// question ids.

export const NFC_SNAPSHOT_KEYS = [
  "nfcQuantity",
  "nfcTypeId",
  "nfcTypeLabel",
  "nfcUnitPrice",
  "nfcSubtotal",
  "nfcArtFee",
  "nfcTotal",
  "nfcPricingVersion",
] as const;

export function buildNfcQuoteSnapshot(quote: NfcQuote): Record<string, string> {
  return {
    nfcQuantity: String(quote.quantity),
    nfcTypeId: quote.typeId,
    nfcTypeLabel: quote.typeLabel,
    nfcUnitPrice: formatUsdCents(quote.effectiveUnitPriceCents),
    nfcSubtotal: formatUsdCents(quote.subtotalCents),
    nfcArtFee: formatUsdCents(quote.artFeeCents),
    nfcTotal: formatUsdCents(quote.totalCents),
    nfcPricingVersion: quote.pricingVersion,
  };
}
