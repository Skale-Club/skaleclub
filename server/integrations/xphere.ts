// Xphere lead handoff + visit booking (quick 260906-g80).
// Ported from skaleclub-websites/server/integrations/xphere.ts and adapted to
// this single-tenant repo: plaintext key in the xphere_settings singleton, no
// tenants table, tenant_ref read from settings (never a code constant).
import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, lte } from "drizzle-orm";
import { db } from "../db.js";
import {
  formLeads,
  forms,
  integrationDeliveries,
  xphereSettings,
  type FormConfig,
  type FormLead,
  type IntegrationDelivery,
  type XphereSettings,
} from "#shared/schema.js";
import { xphereLeadEnvelopeSchema, type XphereLeadEnvelope } from "#shared/xphere-contract.js";
import { getConditionalFields } from "#shared/form.js";
import { storage } from "../storage.js";

const XPHERE_API_BASE = "https://xphere.app/api/v1";
const XPHERE_BOOK_BASE = "https://xphere.app/book";
const WORKER_ID = `skaleclub-${process.pid}-${randomUUID()}`;
const MAX_ATTEMPTS = 8;
const RETRY_DELAYS_MS = [60_000, 300_000, 1_800_000, 7_200_000, 28_800_000, 86_400_000];
const TENANT_ID = 1;
// `product` is a closed contract enum identifying the sending codebase — a
// module constant on purpose. `tenant_ref` identifies the sending organisation
// and comes from xphere_settings.tenant_ref (DEFAULT_TENANT_REF is only the
// fallback when that column is blank).
const PRODUCT = "skaleclub" as const;
const DEFAULT_TENANT_REF = "skaleclub";
const DEFAULT_SITE_DOMAIN = "skale.club";
const EMPTY_FORM_CONFIG: FormConfig = { questions: [], maxScore: 0, thresholds: { hot: 0, warm: 0, cold: 0 } };
const LEAD_CLASSIFICATIONS = new Set(["HOT", "WARM", "COLD", "DISQUALIFIED"]);
const FALLBACK_ANSWER_IDS = [
  "cidadeEstado", "tipoNegocio", "tipoNegocioOutro", "tempoNegocio", "experienciaMarketing",
  "orcamentoAnuncios", "principalDesafio", "disponibilidade", "expectativaResultado",
];

export type XphereInfo = {
  organization: { id: string; name: string };
  scopes: string[];
  capabilities: { lead_ingestion: boolean; lead_schema_versions: string[] };
};

type DeliveryError = Error & { permanent?: boolean; status?: number; code?: string };

function sanitizeError(value: unknown): string {
  const message = value instanceof Error ? value.message : String(value);
  return message.replace(/xph_[a-zA-Z0-9]+/g, "[REDACTED]").slice(0, 300);
}

export async function validateKey(apiKey: string): Promise<XphereInfo> {
  const response = await fetch(`${XPHERE_API_BASE}/integration-info`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    redirect: "error",
    signal: AbortSignal.timeout(8_000),
  });
  const body = await response.json().catch(() => ({})) as Partial<XphereInfo> & { error?: string };
  if (!response.ok) throw new Error(body.error || `Xphere returned HTTP ${response.status}`);
  if (!body.organization?.id || !body.organization.name || !body.capabilities?.lead_ingestion) {
    throw new Error("The API key must grant the leads:write scope");
  }
  return body as XphereInfo;
}

function leadValue(lead: FormLead, id: string): string | undefined {
  const direct = (lead as unknown as Record<string, unknown>)[id];
  if (direct !== undefined && direct !== null && String(direct).trim()) return String(direct);
  return lead.customAnswers?.[id];
}

// Conditional field ids are included so answers such as `enderecoBarbearia`
// (shown only for in-person visits) ship alongside the parent question.
function configuredAnswerIds(formConfig: FormConfig): string[] {
  return formConfig.questions.flatMap((question) => [
    question.id,
    ...getConditionalFields(question).map((field) => field.id),
  ]);
}

// storage.upsertFormLeadProgress stamps classifyLead(0, {0,0,0}) = "HOT" on every
// completed lead of an unscored form, so the DB row cannot tell us whether the
// form was scored — only the config can.
export function isUnscoredForm(formConfig: FormConfig): boolean {
  return formConfig.maxScore === 0
    || !formConfig.questions.some((q) => (q.options ?? []).some((o) => o.points > 0));
}

export function serializeLeadForXphere(
  lead: FormLead,
  formConfig: FormConfig,
  formSlug: string,
  tenantRef: string,
): XphereLeadEnvelope {
  const configuredIds = configuredAnswerIds(formConfig);
  const answerIds = configuredIds.length
    ? configuredIds
    : [...FALLBACK_ANSWER_IDS, ...Object.keys(lead.customAnswers ?? {})];
  const answers = Object.fromEntries(answerIds.flatMap((id) => {
    const value = leadValue(lead, id);
    return value ? [[id, value]] : [];
  }));
  let siteDomain = DEFAULT_SITE_DOMAIN;
  try { if (lead.urlOrigem) siteDomain = new URL(lead.urlOrigem).hostname || DEFAULT_SITE_DOMAIN; } catch { /* keep fallback */ }
  const unscored = isUnscoredForm(formConfig);
  const classification = lead.classificacao && LEAD_CLASSIFICATIONS.has(lead.classificacao) ? lead.classificacao : null;
  return xphereLeadEnvelopeSchema.parse({
    schema_version: "1.0",
    event_id: `skaleclub:${formSlug}:${lead.sessionId}`,
    occurred_at: (lead.updatedAt ?? lead.createdAt ?? new Date()).toISOString(),
    source: {
      product: PRODUCT,
      tenant_ref: (tenantRef || DEFAULT_TENANT_REF).trim(),
      site_domain: siteDomain,
      form: formSlug,
    },
    contact: { name: lead.nome || null, email: lead.email || null, phone: lead.telefone || null },
    lead: {
      status: "new",
      score: unscored ? null : (lead.scoreTotal ?? null),
      classification: unscored ? null : classification,
      page_url: lead.urlOrigem ?? null,
      answers,
    },
    attribution: {
      utm_source: lead.utmSource ?? null,
      utm_medium: lead.utmMedium ?? null,
      utm_campaign: lead.utmCampaign ?? null,
    },
  });
}

async function resolveFormSlug(lead: FormLead, hint?: string): Promise<string> {
  if (hint) return hint;
  if (lead.formId) {
    const [row] = await db.select({ slug: forms.slug }).from(forms).where(eq(forms.id, lead.formId)).limit(1);
    if (row?.slug) return row.slug;
  }
  return "default";
}

export async function enqueueXphereLead(
  lead: FormLead,
  formConfig: FormConfig,
  formSlug?: string,
): Promise<IntegrationDelivery | null> {
  const settings = await storage.getXphereSettings();
  if (!settings?.enabled || !settings.apiKey) return null;
  const slug = await resolveFormSlug(lead, formSlug);
  const payload = serializeLeadForXphere(lead, formConfig, slug, settings.tenantRef);
  const [delivery] = await db.insert(integrationDeliveries).values({
    tenantId: TENANT_ID,
    provider: "xphere",
    eventType: "lead.captured",
    aggregateType: "form_lead",
    aggregateId: lead.id,
    idempotencyKey: payload.event_id,
    payload,
  }).onConflictDoNothing().returning();
  if (delivery) queueXphereDeliverySweep();
  return delivery ?? null;
}

async function deliver(row: IntegrationDelivery): Promise<Record<string, unknown>> {
  const settings = await storage.getXphereSettings();
  const apiKey = settings?.apiKey;
  if (!apiKey) {
    throw Object.assign(new Error("Xphere credential is missing"), { permanent: true, code: "missing_credential" });
  }
  const response = await fetch(`${XPHERE_API_BASE}/leads`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": row.idempotencyKey,
    },
    body: JSON.stringify(row.payload),
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
  });
  const body = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    const permanent = [400, 401, 403, 409, 413, 422].includes(response.status);
    throw Object.assign(new Error(typeof body.error === "string" ? body.error : `HTTP ${response.status}`), {
      permanent,
      status: response.status,
      code: typeof body.code === "string" ? body.code : `http_${response.status}`,
    });
  }
  return body;
}

async function updateSettingsSingleton(patch: Partial<typeof xphereSettings.$inferInsert>): Promise<void> {
  const settings = await storage.getXphereSettings();
  if (!settings) return;
  await db.update(xphereSettings).set({ ...patch, updatedAt: new Date() }).where(eq(xphereSettings.id, settings.id));
}

async function processDelivery(id: string): Promise<void> {
  const [claimed] = await db.update(integrationDeliveries).set({
    status: "processing", lockedAt: new Date(), lockedBy: WORKER_ID, updatedAt: new Date(),
  }).where(and(
    eq(integrationDeliveries.id, id),
    inArray(integrationDeliveries.status, ["pending", "retry"]),
  )).returning();
  if (!claimed) return;
  try {
    const body = await deliver(claimed);
    const now = new Date();
    await db.update(integrationDeliveries).set({
      status: "delivered", deliveredAt: now, updatedAt: now, lockedAt: null, lockedBy: null,
      responseStatus: 200,
      providerReceiptId: typeof body.receipt_id === "string" ? body.receipt_id : null,
      providerContactId: typeof body.contact_id === "string" ? body.contact_id : null,
      lastErrorCode: null, lastErrorMessage: null,
    }).where(eq(integrationDeliveries.id, id));
    await updateSettingsSingleton({ status: "enabled", lastSuccessAt: now, lastErrorAt: null, lastErrorCode: null });
  } catch (rawError) {
    const error = rawError as DeliveryError;
    const attempts = claimed.attemptCount + 1;
    const permanent = Boolean(error?.permanent) || attempts >= MAX_ATTEMPTS;
    const status = permanent ? "dead_letter" : "retry";
    const delay = RETRY_DELAYS_MS[Math.min(attempts - 1, RETRY_DELAYS_MS.length - 1)];
    const code = error?.code || (error?.name === "TimeoutError" ? "timeout" : "network_error");
    await db.update(integrationDeliveries).set({
      status, attemptCount: attempts, nextAttemptAt: new Date(Date.now() + delay), lockedAt: null, lockedBy: null,
      responseStatus: error?.status ?? null, lastErrorCode: code, lastErrorMessage: sanitizeError(error), updatedAt: new Date(),
    }).where(eq(integrationDeliveries.id, id));
    await updateSettingsSingleton({ status: "degraded", lastErrorAt: new Date(), lastErrorCode: code });
  }
}

let sweepRunning = false;
export function queueXphereDeliverySweep(): void {
  if (sweepRunning) return;
  sweepRunning = true;
  void (async () => {
    try {
      const leaseExpiry = new Date(Date.now() - 5 * 60_000);
      await db.update(integrationDeliveries).set({
        status: "retry", lockedAt: null, lockedBy: null, nextAttemptAt: new Date(),
      }).where(and(
        eq(integrationDeliveries.provider, "xphere"),
        eq(integrationDeliveries.status, "processing"),
        lte(integrationDeliveries.lockedAt, leaseExpiry),
      ));
      const due = await db.select().from(integrationDeliveries).where(and(
        eq(integrationDeliveries.provider, "xphere"),
        inArray(integrationDeliveries.status, ["pending", "retry"]),
        lte(integrationDeliveries.nextAttemptAt, new Date()),
      )).orderBy(asc(integrationDeliveries.nextAttemptAt)).limit(25);
      for (const row of due) await processDelivery(row.id);
    } catch (error) {
      console.error("[xphere] delivery sweep failed:", sanitizeError(error));
    } finally {
      sweepRunning = false;
    }
  })();
}

export async function listXphereDeliveries(limit = 20): Promise<IntegrationDelivery[]> {
  return db.select().from(integrationDeliveries)
    .where(eq(integrationDeliveries.provider, "xphere"))
    .orderBy(desc(integrationDeliveries.createdAt))
    .limit(Math.min(limit, 100));
}

export async function retryXphereDelivery(id: string): Promise<IntegrationDelivery> {
  const [row] = await db.update(integrationDeliveries).set({
    status: "retry", nextAttemptAt: new Date(), lastErrorCode: null, lastErrorMessage: null, updatedAt: new Date(),
  }).where(and(
    eq(integrationDeliveries.id, id),
    eq(integrationDeliveries.provider, "xphere"),
    eq(integrationDeliveries.status, "dead_letter"),
  )).returning();
  if (!row) throw new Error("Delivery not found");
  queueXphereDeliverySweep();
  return row;
}

export async function cancelPendingXphereDeliveries(): Promise<void> {
  await db.update(integrationDeliveries).set({ status: "cancelled", updatedAt: new Date() }).where(and(
    eq(integrationDeliveries.provider, "xphere"),
    inArray(integrationDeliveries.status, ["pending", "retry"]),
  ));
}

// Enqueues any completed lead that has no delivery row yet (e.g. leads captured
// while the integration was disabled, or lost to a crash between upsert and enqueue).
export async function reconcileMissingXphereDeliveries(): Promise<void> {
  const settings = await storage.getXphereSettings();
  if (!settings?.enabled || !settings.apiKey) return;
  const rows = await db.select({ lead: formLeads, formSlug: forms.slug, formConfig: forms.config })
    .from(formLeads)
    .leftJoin(forms, eq(forms.id, formLeads.formId))
    .where(eq(formLeads.formCompleto, true))
    .orderBy(desc(formLeads.createdAt))
    .limit(500);
  for (const row of rows) {
    try {
      // The real per-form config drives isUnscoredForm + configuredAnswerIds;
      // fall back to EMPTY_FORM_CONFIG only when the form row is missing.
      const cfg = (row.formConfig as FormConfig | null) ?? EMPTY_FORM_CONFIG;
      const payload = serializeLeadForXphere(row.lead, cfg, row.formSlug ?? "default", settings.tenantRef);
      await db.insert(integrationDeliveries).values({
        tenantId: TENANT_ID, provider: "xphere", eventType: "lead.captured", aggregateType: "form_lead",
        aggregateId: row.lead.id, idempotencyKey: payload.event_id, payload,
      }).onConflictDoNothing();
    } catch (error) {
      console.error(`[xphere] reconcile skipped lead ${row.lead.id}:`, sanitizeError(error));
    }
  }
  queueXphereDeliverySweep();
}

// Pure: picks the in-person/online event from the lead's visit-type answer and
// returns a prefilled https://xphere.app/book/<profile>/<event> URL, else null.
export function buildXphereBookingUrl(
  lead: FormLead,
  formConfig: FormConfig,
  settings: XphereSettings,
): string | null {
  try {
    if (!settings.bookingEnabled || !settings.bookingProfileSlug) return null;
    const questionId = settings.visitTypeQuestionId || "tipoVisita";
    if (!formConfig.questions.some((q) => q.id === questionId)) return null;
    const answer = leadValue(lead, questionId);
    if (!answer) return null;
    const eventSlug = answer === (settings.inPersonAnswerValue || "presencial")
      ? settings.inPersonEventSlug
      : answer === (settings.onlineAnswerValue || "online")
        ? settings.onlineEventSlug
        : null;
    if (!eventSlug) return null;
    const url = new URL(`${XPHERE_BOOK_BASE}/${encodeURIComponent(settings.bookingProfileSlug)}/${encodeURIComponent(eventSlug)}`);
    const prefill: Array<[string, string | null | undefined]> = [
      ["name", lead.nome], ["email", lead.email], ["phone", lead.telefone],
    ];
    for (const [key, value] of prefill) {
      const trimmed = value?.trim();
      if (trimmed) url.searchParams.set(key, trimmed.slice(0, 200));
    }
    return url.toString();
  } catch {
    return null;
  }
}
