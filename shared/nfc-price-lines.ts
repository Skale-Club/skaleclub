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

// Entry price for marketing copy ("From $10 per keychain"): the first tier's
// unit price, in whole dollars when it has no cents. Read from the same tiers
// the order form charges, so the landing never advertises a price the form
// does not quote. Seeds bake these strings into page copy, so re-run
// seed-nfc-keychains-landing + seed-nfc-keychains-translations after a price change.
export function nfcEntryPrice(): { en: string; pt: string; minimum: number } {
  const cents = NFC_VOLUME_TIERS[0].unitPriceCents;
  const amount = cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
  return {
    en: cents % 100 === 0 ? `$${amount}` : formatUsdCents(cents),
    pt: `US$ ${amount.replace(".", ",")}`,
    minimum: NFC_QUANTITY.min,
  };
}

// Marketing lines that carry the entry price, EN (page source) and PT (the
// hand-written translation row). Built here so the landing seed and the
// translation seed can never disagree on the exact source string.
export function nfcPriceCopy() {
  const p = nfcEntryPrice();
  return {
    faqAnswer: {
      en: `Flat keychains start at ${p.en} each, with a ${p.minimum}-piece minimum, and the form shows the price as you choose the quantity. Raised relief and custom shapes are priced one by one. For every style, we confirm the final total with you on WhatsApp before anything is produced.`,
      pt: `O chaveiro chapado sai a partir de ${p.pt} cada, com pedido mínimo de ${p.minimum} peças, e o formulário mostra o preço conforme você escolhe a quantidade. Os modelos com relevo e com shape customizado têm preço calculado peça a peça. Em todos os casos, confirmamos o valor final com você no WhatsApp antes de produzir qualquer coisa.`,
    },
    ctaNote: {
      en: `From ${p.en} per keychain | ${p.minimum}-piece minimum`,
      pt: `A partir de ${p.pt} por chaveiro | mínimo de ${p.minimum} peças`,
    },
  };
}
