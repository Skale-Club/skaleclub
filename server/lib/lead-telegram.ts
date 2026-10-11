import { and, eq, inArray } from "drizzle-orm";
import type { FormConfig, FormLead } from "#shared/schema.js";
import { translations as translationTable } from "#shared/schema.js";
import { translations as staticDictionary } from "#shared/i18n/pt.js";
import { db } from "../db.js";
import type { IStorage } from "../storage.js";
import { sendTelegramToAll, type TelegramFanoutResult } from "../integrations/telegram.js";

export type LeadLanguage = "en" | "pt";

export type LeadTelegramContext = {
  companyName: string;
  formName: string;
  formSlug: string;
  formConfig: FormConfig;
};

const DIVIDER = "────────────";
const MAX_TELEGRAM_LENGTH = 4_000;
const MAX_VALUE_LENGTH = 650;

const COPY = {
  en: {
    newLead: "NEW LEAD",
    completedForm: "Completed form",
    contactCaptured: "Contact captured",
    contact: "CONTACT",
    answers: "FORM ANSWERS",
    orderSummary: "ORDER SUMMARY",
    product: "Product",
    quantity: "Quantity",
    unitPrice: "Unit price",
    subtotal: "Subtotal",
    artFee: "Artwork fee",
    total: "Total",
    customer: "Customer",
    newCustomer: "New customer",
    returningCustomer: "Returning customer",
    source: "SOURCE",
    name: "Name",
    email: "Email",
    phone: "Phone",
    whatsapp: "Open WhatsApp",
    form: "Form",
    page: "Page",
    language: "Language",
    referrer: "Referrer",
    utmSource: "UTM source",
    utmMedium: "UTM medium",
    utmCampaign: "UTM campaign",
    channel: "Capture channel",
    received: "Received",
    empty: "Not provided",
    noAnswers: "No additional answers",
    omitted: "Additional answers omitted because the message reached Telegram's size limit.",
    languageValue: "English (en)",
  },
  pt: {
    newLead: "NOVO LEAD",
    completedForm: "Formulário concluído",
    contactCaptured: "Contato capturado",
    contact: "CONTATO",
    answers: "RESPOSTAS DO FORMULÁRIO",
    orderSummary: "RESUMO DO PEDIDO",
    product: "Produto",
    quantity: "Quantidade",
    unitPrice: "Preço unitário",
    subtotal: "Subtotal",
    artFee: "Taxa de arte",
    total: "Total",
    customer: "Cliente",
    newCustomer: "Novo cliente",
    returningCustomer: "Cliente recorrente",
    source: "ORIGEM",
    name: "Nome",
    email: "E-mail",
    phone: "Telefone",
    whatsapp: "Abrir WhatsApp",
    form: "Formulário",
    page: "Página",
    language: "Idioma",
    referrer: "Referência",
    utmSource: "Origem UTM",
    utmMedium: "Mídia UTM",
    utmCampaign: "Campanha UTM",
    channel: "Canal de captura",
    received: "Recebido em",
    empty: "Não informado",
    noAnswers: "Nenhuma resposta adicional",
    omitted: "Respostas adicionais omitidas porque a mensagem atingiu o limite do Telegram.",
    languageValue: "Português (pt)",
  },
} as const;

const LEAD_FIELDS: Record<string, keyof FormLead> = {
  nome: "nome",
  email: "email",
  telefone: "telefone",
  cidadeEstado: "cidadeEstado",
  tipoNegocio: "tipoNegocio",
  tipoNegocioOutro: "tipoNegocioOutro",
  tempoNegocio: "tempoNegocio",
  experienciaMarketing: "experienciaMarketing",
  orcamentoAnuncios: "orcamentoAnuncios",
  principalDesafio: "principalDesafio",
  disponibilidade: "disponibilidade",
  expectativaResultado: "expectativaResultado",
};

const CONTACT_QUESTION_IDS = new Set(["nome", "email", "telefone"]);

export function resolveLeadLanguage(lead: Pick<FormLead, "language" | "urlOrigem">): LeadLanguage {
  if (lead.language === "pt") return "pt";
  if (lead.language === "en") return "en";
  return lead.urlOrigem && /\/br(?:\/|$|[?#])/i.test(lead.urlOrigem) ? "pt" : "en";
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function compactValue(value: unknown, maxLength = MAX_VALUE_LENGTH): string {
  const normalized = String(value ?? "").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1)}…`;
}

function escapeCompact(value: unknown, maxLength = MAX_VALUE_LENGTH): string {
  const normalized = String(value ?? "").trim();
  const escaped = escapeHtml(normalized);
  if (escaped.length <= maxLength) return escaped;
  let result = "";
  for (const character of normalized) {
    const next = escapeHtml(character);
    if (result.length + next.length + 1 > maxLength) break;
    result += next;
  }
  return `${result}…`;
}

function answerFor(lead: FormLead, id: string): string {
  const field = LEAD_FIELDS[id];
  const direct = field ? lead[field] : undefined;
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  const custom = lead.customAnswers?.[id];
  return typeof custom === "string" ? custom.trim() : "";
}

function waLink(phone: string | null): string | null {
  const digits = (phone || "").replace(/\D/g, "");
  return digits.length >= 8 ? `https://wa.me/${digits}` : null;
}

function labelTranslator(language: LeadLanguage, translated: Record<string, string>) {
  const staticPt = staticDictionary.pt as Record<string, string>;
  return (value: string) => language === "pt" ? (staticPt[value] || translated[value] || value) : value;
}

function fieldLine(label: string, value: unknown, empty: string, maxLength = 200): string {
  const rendered = String(value ?? "").trim() ? escapeCompact(value, maxLength) : escapeHtml(empty);
  return `<b>${escapeHtml(label)}:</b> ${rendered}`;
}

export function buildLeadTelegramMessage(
  lead: FormLead,
  context: LeadTelegramContext,
  translated: Record<string, string> = {},
): string {
  const language = resolveLeadLanguage(lead);
  const copy = COPY[language];
  const t = labelTranslator(language, translated);
  const formLabel = compactValue(t(context.formName || context.formSlug), 120);
  const contact = [
    `👤 <b>${copy.contact}</b>`,
    fieldLine(copy.name, lead.nome, copy.empty, 300),
    fieldLine(copy.email, lead.email, copy.empty, 300),
    fieldLine(copy.phone, lead.telefone, copy.empty, 80),
  ];
  const whatsapp = waLink(lead.telefone);
  if (whatsapp) contact.push(`💬 <a href="${whatsapp}">${copy.whatsapp}</a>`);

  const answerEntries: string[] = [];
  const sortedQuestions = [...context.formConfig.questions].sort((a, b) => a.order - b.order);
  for (const question of sortedQuestions) {
    if (CONTACT_QUESTION_IDS.has(question.id)) continue;
    const raw = answerFor(lead, question.id);
    if (raw) {
      const option = question.options?.find((item) => item.value === raw);
      const rendered = option ? t(option.label) : raw;
      answerEntries.push(`<b>${escapeCompact(t(question.title), 180)}</b>\n${escapeCompact(rendered)}`);
    }
    const conditionalFields = [
      ...(question.conditionalField ? [question.conditionalField] : []),
      ...(question.conditionalFields || []),
    ];
    for (const conditional of conditionalFields) {
      const conditionalAnswer = answerFor(lead, conditional.id);
      if (conditionalAnswer) {
        answerEntries.push(`<b>${escapeCompact(t(conditional.title), 180)}</b>\n${escapeCompact(conditionalAnswer)}`);
      }
    }
  }

  const order = lead.customAnswers || {};
  if (order.nfcTotal) {
    const previousOrders = Number(order.nfcPreviousOrders || "0");
    const returning = order.nfcDeclaredReturning === "yes" || previousOrders > 0;
    answerEntries.unshift([
      `🧾 <b>${copy.orderSummary}</b>`,
      fieldLine(copy.product, order.nfcTypeLabel, copy.empty),
      fieldLine(copy.quantity, order.nfcQuantity, copy.empty),
      fieldLine(copy.unitPrice, order.nfcUnitPrice, copy.empty),
      fieldLine(copy.subtotal, order.nfcSubtotal, copy.empty),
      fieldLine(copy.artFee, order.nfcArtFee, copy.empty),
      fieldLine(copy.total, order.nfcTotal, copy.empty),
      fieldLine(copy.customer, returning ? copy.returningCustomer : copy.newCustomer, copy.empty),
    ].join("\n"));
  }

  const received = new Intl.DateTimeFormat(language === "pt" ? "pt-BR" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/New_York",
  }).format(lead.createdAt || new Date());
  const source = [
    `📍 <b>${copy.source}</b>`,
    fieldLine(copy.form, `${formLabel} (${context.formSlug})`, copy.empty),
    fieldLine(copy.page, lead.urlOrigem, copy.empty),
    fieldLine(copy.language, copy.languageValue, copy.empty),
    fieldLine(copy.referrer, lead.referrerUrl, copy.empty),
    fieldLine(copy.utmSource, lead.utmSource, copy.empty),
    fieldLine(copy.utmMedium, lead.utmMedium, copy.empty),
    fieldLine(copy.utmCampaign, lead.utmCampaign, copy.empty),
    fieldLine(copy.channel, lead.source, copy.empty),
    fieldLine(copy.received, received, copy.empty),
  ];

  const header = [
    `🔴 <b>${copy.newLead} | ${escapeCompact(context.companyName, 120)}</b>`,
    `${escapeCompact(formLabel, 120)} | ${lead.formCompleto ? copy.completedForm : copy.contactCaptured}`,
  ];

  const build = (entries: string[], omitted: boolean) => [
    ...header,
    "",
    DIVIDER,
    ...contact,
    "",
    DIVIDER,
    `📝 <b>${copy.answers}</b>`,
    ...(entries.length ? entries.flatMap((entry) => [entry, ""]) : [copy.noAnswers, ""]),
    ...(omitted ? [`<i>${copy.omitted}</i>`, ""] : []),
    DIVIDER,
    ...source,
  ].join("\n");

  const included = [...answerEntries];
  let message = build(included, false);
  let omitted = false;
  while (message.length > MAX_TELEGRAM_LENGTH && included.length > 0) {
    included.pop();
    omitted = true;
    message = build(included, omitted);
  }
  return message.slice(0, MAX_TELEGRAM_LENGTH);
}

async function cachedTranslations(context: LeadTelegramContext, language: LeadLanguage): Promise<Record<string, string>> {
  if (language !== "pt") return {};
  const staticPt = staticDictionary.pt as Record<string, string>;
  const texts = new Set<string>([context.formName]);
  for (const question of context.formConfig.questions) {
    texts.add(question.title);
    question.options?.forEach((option) => texts.add(option.label));
    if (question.conditionalField) texts.add(question.conditionalField.title);
    question.conditionalFields?.forEach((field) => texts.add(field.title));
  }
  const missing = Array.from(texts).filter((text) => text && !staticPt[text]);
  if (!missing.length) return {};
  try {
    const rows = await db
      .select({ sourceText: translationTable.sourceText, translatedText: translationTable.translatedText })
      .from(translationTable)
      .where(and(
        eq(translationTable.sourceLanguage, "en"),
        eq(translationTable.targetLanguage, "pt"),
        inArray(translationTable.sourceText, missing),
      ));
    return Object.fromEntries(rows.map((row) => [row.sourceText, row.translatedText]));
  } catch (error) {
    console.error("[lead-telegram] Could not load cached translations; using English labels:", error);
    return {};
  }
}

export async function sendCompletedLeadToTelegram(
  storage: IStorage,
  lead: FormLead,
  context: LeadTelegramContext,
): Promise<TelegramFanoutResult> {
  const empty: TelegramFanoutResult = { success: false, delivered: 0, failures: [] };
  const settings = await storage.getTelegramSettings();
  if (!settings?.enabled || !settings.botToken) {
    return { ...empty, failures: [{ chatId: "configuration", message: "Telegram is disabled or missing a bot token" }] };
  }
  const chatIds = settings.chatIds?.length
    ? settings.chatIds
    : (settings.chatId ? [settings.chatId] : []);
  if (!chatIds.length) {
    return { ...empty, failures: [{ chatId: "configuration", message: "Telegram destination is missing" }] };
  }
  const language = resolveLeadLanguage(lead);
  const translated = await cachedTranslations(context, language);
  const message = buildLeadTelegramMessage(lead, context, translated);
  return sendTelegramToAll(settings.botToken, chatIds, message, {
    parseMode: "HTML",
    disableWebPagePreview: true,
  });
}
