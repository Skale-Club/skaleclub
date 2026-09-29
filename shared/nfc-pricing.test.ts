// Table-driven guard for the NFC keychain pricing rules.
//
// Run: npx tsx --test shared/nfc-pricing.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import {
  NFC_ART_FEE_CENTS,
  NFC_QUANTITY,
  NFC_VOLUME_TIERS,
  formatUsdCents,
  nfcQuantityStops,
  quantityFromSliderPosition,
  quoteNfcOrder,
  sliderPositionFromQuantity,
  snapQuantity,
  tierUnitPriceCents,
} from "./nfc-pricing";

test("tierUnitPriceCents: every tier boundary", () => {
  const table: Array<[number, number]> = [
    [20, 1000],
    [30, 1000],
    [40, 1000],
    [50, 900],
    [60, 900],
    [90, 900],
    [100, 800],
    [150, 800],
    [200, 800],
  ];
  for (const [quantity, expected] of table) {
    assert.equal(tierUnitPriceCents(quantity), expected, `quantity ${quantity}`);
  }
});

test("tierUnitPriceCents: out-of-range input is clamped to the range", () => {
  assert.equal(tierUnitPriceCents(1), 1000);
  assert.equal(tierUnitPriceCents(10_000), 800);
  assert.equal(tierUnitPriceCents(Number.NaN), 1000);
});

test("tiers are sorted ascending and get cheaper", () => {
  for (let i = 1; i < NFC_VOLUME_TIERS.length; i++) {
    assert.ok(NFC_VOLUME_TIERS[i].minQuantity > NFC_VOLUME_TIERS[i - 1].minQuantity);
    assert.ok(NFC_VOLUME_TIERS[i].unitPriceCents < NFC_VOLUME_TIERS[i - 1].unitPriceCents);
  }
});

test("snapQuantity: clamp and snap to the step", () => {
  const table: Array<[number, number]> = [
    [-5, 20],
    [0, 20],
    [19, 20],
    [20, 20],
    [24, 20],
    [25, 30],
    [26, 30],
    [54, 50],
    [55, 60],
    [199, 200],
    [200, 200],
    [201, 200],
    [9999, 200],
    [Number.NaN, 20],
    [Number.POSITIVE_INFINITY, 20],
  ];
  for (const [input, expected] of table) {
    assert.equal(snapQuantity(input), expected, `snapQuantity(${input})`);
  }
});

test("quoteNfcOrder: flat keychain totals, first order (art fee) vs returning", () => {
  const table: Array<{
    quantity: number;
    first: boolean;
    subtotal: number;
    total: number;
    upgradeTo: number | null;
  }> = [
    { quantity: 20, first: true, subtotal: 20_000, total: 20_000 + NFC_ART_FEE_CENTS, upgradeTo: null },
    { quantity: 20, first: false, subtotal: 20_000, total: 20_000, upgradeTo: null },
    { quantity: 40, first: true, subtotal: 40_000, total: 40_000 + NFC_ART_FEE_CENTS, upgradeTo: null },
    { quantity: 50, first: true, subtotal: 45_000, total: 45_000 + NFC_ART_FEE_CENTS, upgradeTo: null },
    { quantity: 80, first: false, subtotal: 72_000, total: 72_000, upgradeTo: null },
    // 90 x $9.00 = $810 > 100 x $8.00 = $800: capped at the cheaper bigger order.
    { quantity: 90, first: true, subtotal: 80_000, total: 80_000 + NFC_ART_FEE_CENTS, upgradeTo: 100 },
    { quantity: 100, first: false, subtotal: 80_000, total: 80_000, upgradeTo: null },
    { quantity: 200, first: true, subtotal: 160_000, total: 160_000 + NFC_ART_FEE_CENTS, upgradeTo: null },
  ];
  for (const row of table) {
    const quote = quoteNfcOrder({ quantity: row.quantity, typeId: "standard", isFirstOrder: row.first });
    const label = `q=${row.quantity} first=${row.first}`;
    assert.equal(quote.subtotalCents, row.subtotal, `${label} subtotal`);
    assert.equal(quote.totalCents, row.total, `${label} total`);
    assert.equal(quote.artFeeApplies, row.first, `${label} art fee flag`);
    assert.equal(quote.artFeeCents, row.first ? NFC_ART_FEE_CENTS : 0, `${label} art fee`);
    assert.equal(quote.upgrade?.quantity ?? null, row.upgradeTo, `${label} upgrade`);
    assert.equal(quote.quoteOnRequest, false);
  }
});

test("quoteNfcOrder: isFirstOrder defaults to true, only an explicit false drops the fee", () => {
  assert.equal(quoteNfcOrder({ quantity: 20 }).artFeeApplies, true);
  assert.equal(quoteNfcOrder({ quantity: 20, isFirstOrder: undefined }).artFeeApplies, true);
  assert.equal(quoteNfcOrder({ quantity: 20, isFirstOrder: false }).artFeeApplies, false);
});

test("quoteNfcOrder: quote-on-request types and unknown ids", () => {
  assert.equal(quoteNfcOrder({ quantity: 50, typeId: "relief" }).quoteOnRequest, true);
  assert.equal(quoteNfcOrder({ quantity: 50, typeId: "custom-shape" }).quoteOnRequest, true);
  const unknown = quoteNfcOrder({ quantity: 50, typeId: "nope" });
  assert.equal(unknown.typeId, "standard");
  assert.equal(unknown.quoteOnRequest, false);
});

test("quoteNfcOrder: total never rises as quantity grows", () => {
  const stops = nfcQuantityStops();
  for (let i = 1; i < stops.length; i++) {
    const a = quoteNfcOrder({ quantity: stops[i - 1], isFirstOrder: false }).subtotalCents;
    const b = quoteNfcOrder({ quantity: stops[i], isFirstOrder: false }).subtotalCents;
    assert.ok(a <= b,`subtotal(${stops[i - 1]})=${a} must be <= subtotal(${stops[i]})=${b}`);
  }
});

test("slider mapping: endpoints and monotonicity", () => {
  assert.equal(quantityFromSliderPosition(0), NFC_QUANTITY.min);
  assert.equal(quantityFromSliderPosition(1), NFC_QUANTITY.max);
  assert.equal(quantityFromSliderPosition(-3), NFC_QUANTITY.min);
  assert.equal(quantityFromSliderPosition(7), NFC_QUANTITY.max);
  assert.equal(quantityFromSliderPosition(Number.NaN), NFC_QUANTITY.min);
  let previous = 0;
  for (let p = 0; p <= 1.0001; p += 0.05) {
    const q = quantityFromSliderPosition(p);
    assert.ok(q >= previous, `position ${p} -> ${q} went backwards`);
    assert.equal(q % NFC_QUANTITY.step, 0);
    previous = q;
  }
});

test("slider mapping: position <-> quantity round trip", () => {
  assert.equal(sliderPositionFromQuantity(NFC_QUANTITY.min), 0);
  assert.equal(sliderPositionFromQuantity(NFC_QUANTITY.max), 1);
  for (const quantity of nfcQuantityStops()) {
    const position = sliderPositionFromQuantity(quantity);
    assert.ok(position >= 0 && position <= 1);
    assert.equal(quantityFromSliderPosition(position), quantity, `round trip ${quantity}`);
  }
});

test("nfcQuantityStops: covers min..max in step increments", () => {
  const stops = nfcQuantityStops();
  assert.equal(stops[0], NFC_QUANTITY.min);
  assert.equal(stops[stops.length - 1], NFC_QUANTITY.max);
  assert.equal(stops.length, (NFC_QUANTITY.max - NFC_QUANTITY.min) / NFC_QUANTITY.step + 1);
});

test("formatUsdCents", () => {
  const table: Array<[number, string]> = [
    [0, "$0.00"],
    [5, "$0.05"],
    [5000, "$50.00"],
    [123_450, "$1,234.50"],
    [100_000_000, "$1,000,000.00"],
  ];
  for (const [cents, expected] of table) assert.equal(formatUsdCents(cents), expected);
});
