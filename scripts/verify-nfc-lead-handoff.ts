// verify-nfc-lead-handoff: regression check for what an NFC keychain ORDER
// carries when it is handed to Xphere, and for the language the callback robot
// will be spoken in.
//
// Runs without DB or network: `npx tsx scripts/verify-nfc-lead-handoff.ts`.
// The fixture is synthetic on purpose — never paste real customer data here.
//
// server/integrations/xphere.ts imports server/db.ts, which throws at import
// time without a connection string, so the import is dynamic and happens after
// the placeholder below. node-postgres opens no socket until a query runs, and
// this script runs none.
process.env.POSTGRES_URL ||= "postgres://verify:verify@127.0.0.1:5432/verify?sslmode=disable";

import assert from "node:assert/strict";
import { deriveLeadLanguage } from "../shared/lead-language.js";
import { NFC_ON_REQUEST_LABEL, NFC_SNAPSHOT_KEYS } from "../shared/nfc-pricing.js";
import type { FormConfig, FormLead } from "../shared/schema.js";

const formConfig: FormConfig = {
  maxScore: 0,
  thresholds: { hot: 0, warm: 0, cold: 0 },
  questions: [
    { id: "telefone", title: "What's your WhatsApp?", type: "phoneCountry", required: true, options: [] },
    { id: "nome", title: "What's your name?", type: "text", required: true, options: [] },
    { id: "nomeEmpresa", title: "Business name?", type: "text", required: true, options: [] },
    { id: "quantidade", title: "How many?", type: "quantitySlider", required: true, options: [] },
    { id: "enderecoEnvio", title: "Ship where?", type: "textarea", required: true, options: [] },
  ],
} as unknown as FormConfig;

const lead = {
  id: 1,
  sessionId: "9d2f1c3e-6a4b-4f0e-8c7d-2b1a0e9f8d7c",
  formId: 7,
  nome: "Test Customer",
  email: null,
  telefone: "+5511987654321",
  urlOrigem: "https://skale.club/br/nfc-order",
  scoreTotal: 0,
  classificacao: "HOT",
  utmSource: null,
  utmMedium: null,
  utmCampaign: null,
  createdAt: new Date("2026-09-24T12:00:00.000Z"),
  updatedAt: new Date("2026-09-24T12:05:00.000Z"),
  customAnswers: {
    nomeEmpresa: "Barbearia Exemplo",
    quantidade: "60",
    enderecoEnvio: "Rua Exemplo 123, Sao Paulo",
    countryCode: "BR",
    logo: "https://example.invalid/logo.png",
    logo__filename: "logo.png",
    nfcQuantity: "60",
    nfcTypeId: "standard",
    nfcTypeLabel: "Standard",
    nfcUnitPrice: "$9.00",
    nfcSubtotal: "$540.00",
    nfcArtFee: "$50.00",
    nfcTotal: "$590.00",
    nfcPricingVersion: "2026-09-19.1",
    nfcQuoteOnRequest: "no",
    nfcPreviousOrders: "0",
    nfcDeclaredReturning: "no",
    nfcOrderNotifiedAt: "2026-09-24T12:05:00.000Z",
  },
} as unknown as FormLead;

function checkLanguageTable(): void {
  const cases: Array<[Parameters<typeof deriveLeadLanguage>[0], string]> = [
    [{ pageUrl: "https://skale.club/br/nfc-order", countryCode: "US", phone: "+15555550100" }, "pt-BR"],
    [{ pageUrl: "/br/nfc-order" }, "pt-BR"],
    [{ pageUrl: "https://skale.club/nfc-order", countryCode: "BR" }, "pt-BR"],
    [{ pageUrl: "https://skale.club/nfc-order", countryCode: "PT" }, "pt-BR"],
    [{ pageUrl: "https://skale.club/nfc-order", phone: "+55 (11) 98765-4321" }, "pt-BR"],
    [{ pageUrl: "https://skale.club/nfc-order", phone: "+351912345678" }, "pt-BR"],
    [{ pageUrl: "https://skale.club/nfc-order", countryCode: "US", phone: "+15555550100" }, "en"],
    [{ pageUrl: "https://skale.club/brasil/nfc-order" }, "en"], // only the /br segment counts
    [{}, "en"],
  ];
  for (const [signals, expected] of cases) {
    assert.equal(
      deriveLeadLanguage(signals),
      expected,
      `deriveLeadLanguage(${JSON.stringify(signals)}) should be ${expected}`,
    );
  }
}

async function main(): Promise<void> {
  checkLanguageTable();

  const { serializeLeadForXphere } = await import("../server/integrations/xphere.js");
  const envelope = serializeLeadForXphere(lead, formConfig, "nfc-keychain-order", "skaleclub");
  const answers = envelope.lead.answers;

  // (a) the frozen price snapshot reaches Xphere — the robot reads these aloud
  for (const key of NFC_SNAPSHOT_KEYS) {
    assert.ok(answers[key], `answers.${key} must be present`);
  }
  assert.equal(answers.nfcTotal, "$590.00");
  assert.equal(answers.nfcPreviousOrders, "0");
  assert.equal(answers.nfcDeclaredReturning, "no");

  // (b) so do the two fields with no question of their own
  assert.equal(answers.countryCode, "BR");
  assert.equal(answers.logo__filename, "logo.png");

  // (c) the language the callback is routed on
  assert.equal(answers.lang, "pt-BR");

  // (d) the configured questions still ship, and an unscored form still reports null
  assert.equal(answers.nomeEmpresa, "Barbearia Exemplo");
  assert.equal(answers.enderecoEnvio, "Rua Exemplo 123, Sao Paulo");
  assert.equal(envelope.lead.score, null);
  assert.equal(envelope.lead.classification, null);
  assert.equal(envelope.source.form, "nfc-keychain-order");

  // (e) an English order from the US routes to the English assistant
  const usLead = {
    ...lead,
    urlOrigem: "https://skale.club/nfc-order",
    telefone: "+15555550100",
    customAnswers: { ...lead.customAnswers, countryCode: "US" },
  } as unknown as FormLead;
  const usEnvelope = serializeLeadForXphere(usLead, formConfig, "nfc-keychain-order", "skaleclub");
  assert.equal(usEnvelope.lead.answers.lang, "en");

  // (f) a keychain style with no list price hands the robot the fact that
  // there IS no number to read out, instead of a missing key it would have to
  // guess about
  const onRequestLead = {
    ...lead,
    customAnswers: {
      ...lead.customAnswers,
      tipoChaveiro: "custom-shape",
      nfcTypeId: "custom-shape",
      nfcTypeLabel: "Custom shape",
      nfcQuoteOnRequest: "yes",
      nfcTotal: NFC_ON_REQUEST_LABEL,
      nfcUnitPrice: NFC_ON_REQUEST_LABEL,
      nfcSubtotal: NFC_ON_REQUEST_LABEL,
    },
  } as unknown as FormLead;
  const onRequestAnswers = serializeLeadForXphere(
    onRequestLead,
    formConfig,
    "nfc-keychain-order",
    "skaleclub",
  ).lead.answers;
  assert.equal(onRequestAnswers.nfcQuoteOnRequest, "yes");
  assert.equal(onRequestAnswers.nfcTotal, NFC_ON_REQUEST_LABEL);

  // (g) the envelope stays within the contract's 100-answer cap
  assert.ok(Object.keys(answers).length <= 100, "answers must stay within the contract cap");

  console.log(`verify-nfc-lead-handoff: OK (${Object.keys(answers).length} answers, lang=${answers.lang})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
