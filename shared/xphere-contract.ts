// Duplicated (not shared) with skaleclub-websites/shared/xphere-contract.ts on purpose:
// the two repos deploy independently and Xphere validates the same envelope on ingest.
// Drift surfaces as Xphere 422s — keep the two files in sync manually.
import { z } from "zod";

const nullableText = (max: number) => z.string().trim().max(max).nullable().optional();

export const xphereLeadEnvelopeSchema = z.object({
  schema_version: z.literal("1.0"),
  event_id: z.string().trim().min(1).max(300),
  occurred_at: z.string().datetime({ offset: true }),
  source: z.object({
    product: z.enum(["skaleclub_websites", "skaleclub"]),
    tenant_ref: z.string().trim().min(1).max(100),
    site_domain: z.string().trim().min(1).max(255),
    form: z.string().trim().min(1).max(100),
  }).strict(),
  contact: z.object({
    name: nullableText(200), email: nullableText(320), phone: nullableText(40),
  }).strict().refine((value) => Boolean(value.name || value.email || value.phone)),
  lead: z.object({
    status: z.literal("new"),
    score: z.number().int().min(0).max(100).nullable().optional(),
    classification: z.enum(["HOT", "WARM", "COLD", "DISQUALIFIED"]).nullable().optional(),
    page_url: nullableText(1000),
    answers: z.record(z.string().max(100), z.string().max(2000)).refine((value) => Object.keys(value).length <= 100),
  }).strict(),
  attribution: z.object({
    utm_source: nullableText(200), utm_medium: nullableText(200), utm_campaign: nullableText(200),
    utm_content: nullableText(200), utm_term: nullableText(200),
    first_touch: z.object({ source: nullableText(200), medium: nullableText(200), campaign: nullableText(200) }).strict().optional(),
    last_touch: z.object({ source: nullableText(200), medium: nullableText(200), campaign: nullableText(200) }).strict().optional(),
  }).strict().optional(),
}).strict();

export type XphereLeadEnvelope = z.infer<typeof xphereLeadEnvelopeSchema>;
