# Xphere Booking Integration Plan

## Goal
Route leads from the barbershop landing (and future niche landings) into Xphere as structured leads, and let the lead book an in-person or online visit without leaving the funnel.

Two independent stages:
- Stage 1 — lead handoff: `POST https://xphere.app/api/v1/leads` on form completion.
- Stage 2 — booking: redirect the lead to Xphere's existing public booking page, choosing the event type from the form's `tipoVisita` answer.

Xphere is the separate Next.js 16 + Supabase ops platform at `C:\Users\Vanildo\Dev\xphere`, production origin `https://xphere.app`. It is not Xpot.

## Blocker — Stage 1 Cannot Ship Yet

Stage 1 is **BLOCKED**. This is a hard blocker, not a caveat.

- `src/lib/leads/ingestion-schema.ts:11` in the Xphere repo declares `product: z.literal('skaleclub_websites')` — a single literal, not an enum — and every object in that schema is `.strict()`.
- `skaleclub_websites` is a **different project**: the service-business website platform / forkable template at `C:\Users\Vanildo\Dev\skaleclub-websites` (remote `github.com/Skale-Club/websites`). It is **not** this repo, which is the Skale Club marketing site at `C:\Users\Vanildo\Dev\skaleclub`.
- Consequence: this repo cannot call `POST /api/v1/leads` today. A payload carrying any other `product` value fails Zod validation and returns `422 invalid_payload`.
- `grep -rn "skaleclub" src/lib src/app` in the Xphere repo returns that literal exactly once. There is no existing product value for this marketing site.
- Ecosystem note: Xphere is a shared ops hub for sibling apps. `src/lib/obs/alerts.ts:10` and `src/app/api/cron/obs-alerts/route.ts:15` enumerate `xphere`, `xkedule`, `skaleclub`, `xtimator`. This repo is a recognised sibling — it is just not yet a registered lead source.
- State the following plainly, because it is easy to get backwards: the fact that `skaleclub-websites` **is** fully integrated (see Prior Art below) does **not** unblock this repo. If anything it is the *cause* of the blocker — the literal is narrow precisely because that sibling is the only registered lead source today. Reading the sibling's code tells you *how* to build this integration; it does not make `product` accept a value for this repo. The blocker stands until option (a) lands.

### Resolution options

**(a) RECOMMENDED — widen `product` to an enum in the Xphere repo.**
Change `src/lib/leads/ingestion-schema.ts:11` from `z.literal('skaleclub_websites')` to `z.enum([...])` including a new value for this site (for example `'skaleclub'` or `'skaleclub_marketing'`).
- One-line change in the Xphere repo.
- Keeps the two products cleanly separated in Xphere's reporting.
- Trade-off: needs a change plus a deploy on the Xphere side before anything here can ship, and the new value must be threaded through whatever downstream reporting keys off `product`.

**(b) Fall back to `POST /api/v1/contacts` (scope `contacts:write`).**
Its payload carries no product literal, so it works today with zero Xphere changes.
- Trade-off: it creates a bare contact. It loses the lead-specific fields (`answers`, `score`, `classification`, `attribution`) and does not emit the `lead.captured` event. Everything the barbershop form collects beyond name / email / phone is dropped.
- Viable only as a stopgap.

**(c) Send `product: 'skaleclub_websites'` from this app anyway. WRONG — do not do this.**
It silently merges two different products' lead attribution inside Xphere and will corrupt reporting. It is listed here only so nobody rediscovers it as a shortcut.

Everything below assumes option (a) lands first. **Stage 2 (booking) is not blocked** and can proceed independently.

## Prior Art — CONFIRMED Reference Implementation

This section is established fact. The sibling repo has been read.

- `C:\Users\Vanildo\Dev\skaleclub-websites` (remote `github.com/Skale-Club/websites`) already has a complete, production-grade Xphere lead integration, registered as the `skaleclub_websites` product. It is the reference implementation for this work.

Files to read:

| File | Lines | What it is |
|---|---|---|
| `shared/xphere-contract.ts` | 33 | the shared contract types |
| `server/integrations/xphere.ts` | 318 | the implementation |
| `scripts/verify-xphere-contract.ts` | — | a contract verification script |
| `docs/integrations/xphere-lead-integration-plan.md` | 661 | the full design doc for that integration |

Exported surface of `server/integrations/xphere.ts`, grouped by concern:

1. Settings lifecycle — per-tenant API key storage and lifecycle:
   - `getXphereIntegration(tenantId)`
   - `saveXphereIntegration(tenantId, apiKey, enabled)`
   - `setXphereEnabled(tenantId, enabled)`
   - `disconnectXphere(tenantId)`
2. Connection test:
   - `testXphereIntegration(tenantId, apiKey?)` — hits `${XPHERE_API_BASE}/integration-info`
3. Payload + send:
   - `serializeLeadForXphere(tenant, lead, formConfig)` — builds the ingestion payload
   - `enqueueXphereLead(tenant, lead, formConfig)` — POSTs to `${XPHERE_API_BASE}/leads`
4. Durable delivery queue — persisted delivery attempts, retry, and a reconciliation sweep for missed deliveries:
   - `listXphereDeliveries(tenantId, limit)`
   - `retryXphereDelivery(tenantId, id)`
   - `queueXphereDeliverySweep()`
   - `reconcileMissingXphereDeliveries()`

Consequences for this document:

- **Stage 1 here is a PORT, not a greenfield design.** The default is to mirror the sibling's shape — a contract module, an integration module, and a durable delivery queue — rather than invent a second, divergent integration.
- Any design decision that departs from the sibling needs an explicit reason stated in this doc.
- A naive fire-and-forget POST would be a **regression** against the sibling's durable queue-with-retry-and-reconcile behaviour, and is therefore not an acceptable Stage 1 target.

## Current State

### This repo (`C:\Users\Vanildo\Dev\skaleclub`)
- Calls **nothing** in Xphere today. `xphere.app` and `v1/leads` do not appear anywhere in the source.
- `POST /api/forms/slug/:slug/leads/progress` — `server/routes/forms.ts:366`. Upserts via `storage.upsertFormLeadProgress`, then calls `runLeadPostProcessing`.
- `runLeadPostProcessing` — `server/lib/lead-processing.ts:24`. The natural hook point for the Xphere handoff when `formCompleto === true`.
- `form_leads.sessionId` — `uuid("session_id").notNull()` with a unique index (`shared/schema/forms.ts:42` and `:90`). A ready-made idempotency key.
- UTM capture already exists in `client/src/components/LeadFormModal.tsx`.
- Form `barbershop-leads` (id=4 in prod, seeded by quick task 260906-e15) carries the `tipoVisita` question with answers `presencial` / `online`. It has no consumer yet — it is the hook point this document designs for.

### Xphere (`C:\Users\Vanildo\Dev\xphere`)
- Public REST API doc: `docs/api/public-api.md`. Base `https://xphere.app/api/v1`. CORS-enabled.
- Auth: `Authorization: Bearer xph_<64 hex>`. Scoped keys, generated in Xphere Settings > API Keys, shown once, stored as SHA-256.
- `POST /api/v1/leads` — scope `leads:write`, route `src/app/api/v1/leads/route.ts`. Requires an `Idempotency-Key` header that must equal `payload.event_id`. Responses: `201` accepted / `200` duplicate / `409` idempotency conflict / `422` invalid / `413` too large (64 KB cap). Its ingestion schema accepts `skaleclub_websites` only — it was built for the sibling project, not for this repo.
- `POST /api/v1/contacts` — scope `contacts:write`. No product literal in its payload.
- Scheduling tables:
  - `event_types` — `org_id`, `user_id`, `title`, `slug`, `duration_minutes`, `location_type` CHECK IN (`video`, `phone`, `in_person`), `location_value`, `allowed_location_kinds`, `active`, `booking_type` (`personal` | `round_robin`).
  - `bookings` — `booker_name` / `booker_email` / `booker_phone`, `booker_timezone`, `start_at`, `end_at`, `notes`, `status` (`confirmed` | `cancelled` | `no_show`), `linked_contact_id`, `cancel_token`, `location_kind`, `location_data`, `meeting_url`, `meeting_phone`.
- RLS already permits anon `SELECT` of active `event_types` and anon `INSERT` of `bookings` — the public booking flow already works.
- Public booking pages: `/book/[slug]/[eventType]` and `/book/cancel/[id]`.
- Slot math lives in `src/lib/calendar/slots.ts` (`generateSlots`, `getDaysWithAvailability`). There is **no** public HTTP API for free slots — slots are computed server-side for the booking page only.

## Proposed Flow

### Stage 1 — Lead handoff (BLOCKED on the product value)

Trigger: form completion (`formCompleto === true`) inside `runLeadPostProcessing` (`server/lib/lead-processing.ts:24`).

Target: `POST https://xphere.app/api/v1/leads`, `Authorization: Bearer xph_<64 hex>`, scope `leads:write`.

Field mapping:

| Xphere field | Source in this repo |
|---|---|
| `schema_version` | `'1.0'` |
| `event_id` | `form_leads.sessionId` (already a uuid, already unique) |
| `Idempotency-Key` header | the same `form_leads.sessionId`, verbatim — the header must equal `payload.event_id` |
| `occurred_at` | lead completion timestamp, ISO with offset |
| `source.product` | the NEW value agreed with Xphere per option (a). Do **not** send `'skaleclub_websites'`. |
| `source.tenant_ref` | configured tenant ref (admin setting) |
| `source.site_domain` | request host |
| `source.form` | form slug (`barbershop-leads`) |
| `contact.name` | `nome` |
| `contact.email` | `email` |
| `contact.phone` | `telefone` |
| `lead.status` | `'new'` |
| `lead.page_url` | the landing URL the lead converted on |
| `lead.answers` | every remaining custom answer, stringified, max 100 entries: `tipoVisita`, `nomeBarbearia`, `numeroCadeiras`, `numeroBarbeiros`, `sistemaAgendamento`, `ticketMedio`, `investimentoAnuncios`, `principalDesafio`, `observacoes` |
| `attribution` | existing UTM capture from `client/src/components/LeadFormModal.tsx` (`utm_*`, `first_touch`, `last_touch`) |

`contact` requires at least one of name / email / phone. `lead.score` and `lead.classification` (`HOT` | `WARM` | `COLD` | `DISQUALIFIED`) are optional; the `barbershop-leads` form is unscored, so both are omitted.

Payload constraints to respect:
- Every object in the ingestion schema is `.strict()` — unknown keys are rejected with `422`.
- Body cap is 64 KB — exceeding it returns `413`.

Reliability rule — state it in the sibling's terms:
1. The Xphere call must **never** fail the lead submission. Same principle as the reliability rules in `plan/skale-hub-ghl-visit-sync-plan.md`.
2. "Must not fail the submission" does **not** mean fire-and-forget. Mirror `enqueueXphereLead`: enqueue the delivery, persist the attempt, retry failures, and reconcile missed ones (`listXphereDeliveries`, `retryXphereDelivery`, `queueXphereDeliverySweep`, `reconcileMissingXphereDeliveries`).
3. Log-and-drop loses leads. The sibling already solved this; shipping less here is a regression.

Module split — mirror the sibling rather than inlining everything into `runLeadPostProcessing`:
- A contract module — analogue of `shared/xphere-contract.ts`.
- An integration module owning serialize + enqueue + queue — analogue of `server/integrations/xphere.ts`.
- A contract verification script — analogue of `scripts/verify-xphere-contract.ts`.
- `runLeadPostProcessing` only calls into it.

### Stage 2 — Booking (not blocked)

After submit, redirect the lead to Xphere's existing public booking page:

```
https://xphere.app/book/{calendarProfileSlug}/{eventTypeSlug}
```

Event type chosen from the `tipoVisita` answer:

| `tipoVisita` | Xphere `event_types.location_type` |
|---|---|
| `presencial` | `in_person` |
| `online` | `video` |

`event_types.location_type` maps 1:1 onto those answers. This path needs no ingestion-schema change and can ship ahead of Stage 1.

Prefill gap: `src/app/book/[slug]/[eventType]/page.tsx` reads only `searchParams.debug`. There is no name / email / phone prefill, so a redirected lead retypes details they just gave us. Closing it is a small change in the Xphere repo (add `name` / `email` / `phone` `searchParams`) — out of scope here, but it should land before this ships to real traffic.

## Why Redirect Rather Than Embed

There is no public free-slots HTTP API in Xphere. Slot math (`generateSlots`, `getDaysWithAvailability` in `src/lib/calendar/slots.ts`) runs server-side for the booking page only.

Embedding the picker in this repo's form would require:
1. Building and securing a new public slots endpoint in Xphere.
2. A new form question type here for date / slot selection (none exists).
3. Duplicating conflict and timezone logic that already exists in Xphere.

Embedding is therefore the explicitly **deferred** alternative, at that cost. Redirect ships now against a page that already works.

## Configuration Needed

- New secret `XPHERE_API_KEY` in this repo's env, plus a documented entry in `.env.example`. Format `xph_<64 hex>`, generated in Xphere Settings > API Keys, shown once.
- The following must be **admin-configurable settings, not hardcoded**:
  - the agreed `source.product` value
  - the in-person event type slug
  - the online event type slug
  - the calendar profile slug
  - `source.tenant_ref`
- CLAUDE.md and the standing memory rule forbid inheriting tenant-specific IDs / URLs into source. Store these alongside the other integration settings behind `/api/integrations/*` — see `server/routes/integrations.ts` for the existing pattern.
- Optional: a feature flag so the handoff can be switched off without a deploy.

## Open Questions for the User

1. Which `product` value should Xphere accept for this site — `'skaleclub'`, `'skaleclub_marketing'`, or something else?
2. Should the two Skale Club properties (this marketing site and `skaleclub-websites`) appear as ONE lead source or TWO inside Xphere's reporting?
3. Which Xphere org / calendar profile owns barbershop bookings?
4. Do in-person visits need a shop address field added to the `barbershop-leads` form?
5. Is booking mandatory after submit, or skippable — hard redirect vs. an optional "Book your visit" CTA on the thank-you state?
6. Should the API key be per-environment (a separate staging key)?
7. Should the Xphere contract module be **extracted** into something both repos share (a published package, a git submodule, or a synced file with a contract-verification script on both sides), or deliberately **duplicated** in this repo? This is left OPEN.
   - Extraction: one definition, no drift — but it creates a cross-repo release dependency between two independently deployed apps, and it needs somewhere to live.
   - Duplication: zero coupling, each repo deploys freely — but two copies of a `.strict()` contract *will* drift, and drift surfaces as production `422`s rather than build-time errors.
   - Note that `skaleclub-websites` already ships `scripts/verify-xphere-contract.ts`, so the duplication path at minimum implies porting an equivalent check here.

## Out of Scope

- GoHighLevel entirely — discontinued. No GHL path is proposed or considered.
- No DB schema change in this repo: no migration, no new column.
- No new form question type in Stage 1 or Stage 2.
- No changes inside the Xphere repo. The ingestion-schema widening and the booking-page prefill fix are both specified here, not performed.
- No changes inside `skaleclub-websites` — read-only reference. If open question 7 is later resolved in favour of extracting a shared contract module, that becomes its own scoped piece of work; it is not proposed here.
- Implementation of any of the above. This pass produces the document only.
