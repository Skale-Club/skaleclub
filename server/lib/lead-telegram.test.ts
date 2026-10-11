import assert from "node:assert/strict";
import test from "node:test";
import type { FormConfig, FormLead } from "#shared/schema.js";
import { buildLeadTelegramMessage, resolveLeadLanguage } from "./lead-telegram.js";

const config: FormConfig = {
  questions: [
    { id: "nome", order: 1, title: "Full Name", type: "text", required: true },
    { id: "telefone", order: 2, title: "Phone Number", type: "tel", required: true },
    {
      id: "tipoNegocio",
      order: 3,
      title: "Business Type",
      type: "select",
      required: true,
      options: [{ value: "barbershop", label: "Barbershop", points: 0 }],
    },
    { id: "principalDesafio", order: 4, title: "Main challenge", type: "textarea", required: true },
  ],
  maxScore: 0,
  thresholds: { hot: 0, warm: 0, cold: 0 },
};

function lead(overrides: Partial<FormLead> = {}): FormLead {
  return {
    id: 42,
    tenantId: 1,
    sessionId: "00000000-0000-4000-8000-000000000001",
    formId: 7,
    createdAt: new Date("2026-10-11T15:30:00Z"),
    updatedAt: new Date("2026-10-11T15:30:00Z"),
    nome: "João <Silva>",
    email: "joao@example.com",
    telefone: "+1 (508) 555-0147",
    cidadeEstado: null,
    tipoNegocio: "barbershop",
    tipoNegocioOutro: null,
    tempoNegocio: null,
    experienciaMarketing: null,
    orcamentoAnuncios: null,
    principalDesafio: "Quero mais clientes & mais tempo.",
    disponibilidade: null,
    expectativaResultado: null,
    scoreTotal: 0,
    classificacao: null,
    scoreTipoNegocio: 0,
    scoreTempoNegocio: 0,
    scoreExperiencia: 0,
    scoreOrcamento: 0,
    scoreDesafio: 0,
    scoreDisponibilidade: 0,
    scoreExpectativa: 0,
    tempoTotalSegundos: 90,
    userAgent: "Test",
    urlOrigem: "https://skale.club/br/barbershops?utm_source=google",
    referrerUrl: "https://google.com/",
    language: "pt",
    utmSource: "google",
    utmMedium: "cpc",
    utmCampaign: "barbearias",
    status: "novo",
    formCompleto: true,
    ultimaPerguntaRespondida: 4,
    notificacaoEnviada: false,
    dataContato: null,
    observacoes: null,
    customAnswers: {},
    ghlContactId: null,
    ghlSyncStatus: "pending",
    source: "form",
    conversationId: null,
    visitorId: null,
    ...overrides,
  };
}

const context = {
  companyName: "Skale Club",
  formName: "Barbershops",
  formSlug: "barbershops",
  formConfig: config,
};

test("Portuguese leads produce localized structured notifications", () => {
  const message = buildLeadTelegramMessage(lead(), context, {
    Barbershops: "Barbearias",
    "Business Type": "Tipo de negócio",
    Barbershop: "Barbearia",
    "Main challenge": "Principal desafio",
  });

  assert.match(message, /NOVO LEAD/);
  assert.match(message, /Barbearias \| Formulário concluído/);
  assert.match(message, /CONTATO/);
  assert.match(message, /RESPOSTAS DO FORMULÁRIO/);
  assert.match(message, /Tipo de negócio<\/b>\nBarbearia/);
  assert.match(message, /Principal desafio<\/b>\nQuero mais clientes &amp; mais tempo/);
  assert.match(message, /ORIGEM/);
  assert.match(message, /Português \(pt\)/);
  assert.match(message, /UTM.*google/i);
  assert.ok(!message.includes("João <Silva>"), "user values must be HTML escaped");
  assert.match(message, /João &lt;Silva&gt;/);
  assert.ok(message.split("\n").filter((line) => line === "────────────").length === 3);
});

test("English leads keep English labels and preserve free-text answers", () => {
  const message = buildLeadTelegramMessage(lead({
    language: "en",
    urlOrigem: "https://skale.club/barbershops",
    principalDesafio: "Need more appointments",
  }), context);

  assert.match(message, /NEW LEAD/);
  assert.match(message, /Completed form/);
  assert.match(message, /FORM ANSWERS/);
  assert.match(message, /Main challenge<\/b>\nNeed more appointments/);
  assert.match(message, /English \(en\)/);
});

test("NFC leads include the frozen server-side order summary", () => {
  const message = buildLeadTelegramMessage(lead({
    language: "en",
    customAnswers: {
      nfcTypeLabel: "Google plaque",
      nfcQuantity: "2",
      nfcUnitPrice: "$39.50",
      nfcSubtotal: "$79.00",
      nfcArtFee: "$0.00",
      nfcTotal: "$79.00",
      nfcPreviousOrders: "1",
      nfcDeclaredReturning: "yes",
    },
  }), context);

  assert.match(message, /ORDER SUMMARY/);
  assert.match(message, /Google plaque/);
  assert.match(message, /<b>Total:<\/b> \$79\.00/);
  assert.match(message, /Returning customer/);
});

test("locale fallback follows the /br page when an old lead has no valid locale", () => {
  assert.equal(resolveLeadLanguage({ language: null as unknown as "en", urlOrigem: "https://skale.club/br/contact" }), "pt");
});

test("notification stays below Telegram's message limit", () => {
  const longConfig: FormConfig = {
    ...config,
    questions: Array.from({ length: 20 }, (_, index) => ({
      id: `answer${index}`,
      order: index,
      title: `Long question ${index}`,
      type: "textarea" as const,
      required: true,
    })),
  };
  const customAnswers = Object.fromEntries(
    longConfig.questions.map((question) => [question.id, "x".repeat(1_000)]),
  );
  const message = buildLeadTelegramMessage(lead({ customAnswers }), { ...context, formConfig: longConfig });
  assert.ok(message.length <= 4_000);
  assert.match(message, /limite do Telegram/);
  assert.match(message, /ORIGEM/);
});
