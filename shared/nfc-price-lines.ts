// Price ladder for the NFC keychain pages, derived from shared/nfc-pricing.ts.
// Lives in shared/ (not scripts/) so both the seed scripts AND the client
// PricingTableSection default can import the same generator — no page or
// component may hand-type a price the tiers do not charge.
//
// Kept dependency-free like shared/nfc-pricing.ts itself: only import
// "./nfc-pricing.js" here, never the shared/schema barrel (it pulls in
// node's `crypto` transitively and would break the browser bundle).
import {
  NFC_ART_FEE_CENTS,
  NFC_QUANTITY,
  NFC_VOLUME_TIERS,
  formatUsdCents,
  tierUnitPriceCents,
} from "./nfc-pricing.js";

export type PriceLine = { label: string; price: string; note?: string; kind: "one-time" | "per-unit" | "minimum" };

export function buildPriceLines(): PriceLine[] {
  const reachable = NFC_VOLUME_TIERS.filter((tier) => tier.minQuantity <= NFC_QUANTITY.max);

  const tierLines: PriceLine[] = reachable.map((tier, index) => {
    const next = reachable[index + 1];
    const upper = next ? next.minQuantity - 1 : NFC_QUANTITY.max;
    return {
      label: `${tier.minQuantity}-${upper} pieces`,
      price: `${formatUsdCents(tier.unitPriceCents)} each`,
      kind: "per-unit",
    };
  });

  const minimumTotal = tierUnitPriceCents(NFC_QUANTITY.min) * NFC_QUANTITY.min;

  return [
    ...tierLines,
    {
      label: "Minimum order",
      price: formatUsdCents(minimumTotal),
      note: `${NFC_QUANTITY.min} pieces`,
      kind: "minimum",
    },
    {
      label: "Art / design fee",
      price: formatUsdCents(NFC_ART_FEE_CENTS),
      note: "First order only — waived from your second order onward",
      kind: "one-time",
    },
  ];
}
