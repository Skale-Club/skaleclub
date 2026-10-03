// Table-driven guard for the NFC plaque pricing rules and the order catalogue.
//
// Run: npx tsx --test shared/nfc-plaque-pricing.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { NFC_PLAQUE_QUANTITY, quotePlaqueOrder, snapPlaqueQuantity } from "./nfc-plaque-pricing";
import { getOrderCatalog } from "./order-catalog";
import { quoteFromAnswers, validateFormConfig, isQuestionRequired } from "./form";
import type { FormConfig, FormQuestion } from "./schema";

test("standard plaques: every pair is $79, an odd one is $49", () => {
  const table: Array<[number, number]> = [
    [1, 4900],
    [2, 7900],
    [3, 12800],
    [4, 15800],
    [5, 20700],
    [10, 39500],
  ];
  for (const typeId of ["google", "instagram"]) {
    for (const [quantity, expected] of table) {
      assert.equal(quotePlaqueOrder({ quantity, typeId }).totalCents, expected, `${typeId} x${quantity}`);
    }
  }
});

test("custom plaques: $89 the first, $49 each additional", () => {
  const table: Array<[number, number]> = [
    [1, 8900],
    [2, 13800],
    [3, 18700],
    [10, 53000],
  ];
  for (const [quantity, expected] of table) {
    assert.equal(quotePlaqueOrder({ quantity, typeId: "custom" }).totalCents, expected, `custom x${quantity}`);
  }
});

test("lines always add up to the total", () => {
  for (const typeId of ["google", "custom"]) {
    for (let quantity = NFC_PLAQUE_QUANTITY.min; quantity <= NFC_PLAQUE_QUANTITY.max; quantity++) {
      const quote = quotePlaqueOrder({ quantity, typeId });
      const sum = (quote.lines ?? []).reduce((acc, line) => acc + line.totalCents, 0);
      const count = (quote.lines ?? []).reduce(
        (acc, line) => acc + line.count * (line.label === "Pair of plaques" ? 2 : 1),
        0,
      );
      assert.equal(sum, quote.totalCents, `${typeId} x${quantity} sum`);
      assert.equal(count, quantity, `${typeId} x${quantity} pieces`);
      assert.equal(quote.artFeeApplies, false);
      assert.equal(quote.upgrade, null);
    }
  }
});

test("quantity is clamped to 1..10 and unknown types fall back to Google", () => {
  assert.equal(snapPlaqueQuantity(0), 1);
  assert.equal(snapPlaqueQuantity(99), 10);
  assert.equal(snapPlaqueQuantity(Number.NaN), 1);
  assert.equal(quotePlaqueOrder({ quantity: 1, typeId: "nope" }).typeId, "google");
});

test("catalogue: linear slider round-trips every plaque quantity", () => {
  const catalog = getOrderCatalog("nfc-plaque")!;
  for (let quantity = 1; quantity <= 10; quantity++) {
    assert.equal(catalog.quantityFromPosition(catalog.positionFromQuantity(quantity)), quantity);
  }
  assert.equal(catalog.quantityFromPosition(0), 1);
  assert.equal(catalog.quantityFromPosition(1), 10);
  assert.equal(getOrderCatalog("unknown"), null);
  assert.equal(getOrderCatalog("constructor"), null);
});

const PLAQUE_CONFIG: FormConfig = {
  questions: [
    { id: "tipoPlaca", order: 1, title: "Which plaque?", type: "productPicker", required: true },
    { id: "quantidade", order: 2, title: "How many?", type: "quantitySlider", required: true },
  ],
  maxScore: 0,
  thresholds: { hot: 0, warm: 0, cold: 0 },
  pricing: { model: "nfc-plaque", typeQuestionId: "tipoPlaca", quantityQuestionId: "quantidade" },
};

test("quoteFromAnswers prices a plaque form and ignores the art-fee question", () => {
  const quote = quoteFromAnswers(PLAQUE_CONFIG, { tipoPlaca: "custom", quantidade: "3" });
  assert.equal(quote?.totalCents, 18700);
  assert.equal(quote?.artFeeCents, 0);
  assert.equal(quoteFromAnswers(PLAQUE_CONFIG, { tipoPlaca: "google" }), null);
  assert.deepEqual(validateFormConfig(PLAQUE_CONFIG), []);
});

test("requiredWhen makes a question required for one answer only", () => {
  const logo: FormQuestion = {
    id: "logo",
    order: 3,
    title: "Logo",
    type: "fileUpload",
    required: false,
    upload: { extensions: ["png"], maxSizeMb: 3 },
    requiredWhen: { questionId: "tipoPlaca", equals: "custom" },
  };
  assert.equal(isQuestionRequired(logo, { tipoPlaca: "custom" }), true);
  assert.equal(isQuestionRequired(logo, { tipoPlaca: "google" }), false);
  const broken = { ...PLAQUE_CONFIG, questions: [...PLAQUE_CONFIG.questions, { ...logo, requiredWhen: { questionId: "missing", equals: "x" } }] };
  assert.equal(validateFormConfig(broken).length, 1);
});
