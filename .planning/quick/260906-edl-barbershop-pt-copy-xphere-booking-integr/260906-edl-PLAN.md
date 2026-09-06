---
phase: quick/260906-edl
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - scripts/seed-barbershop-translations.ts
  - plan/xphere-booking-integration-plan.md
autonomous: true
requirements: [EDL-01, EDL-02]

must_haves:
  truths:
    - "Running the seed script inserts 46 en to pt rows into the translations table"
    - "Re-running the seed script updates in place and inserts 0 new rows (no duplicates)"
    - "Visiting /barbershops-br shows hand-written PT copy for every form question, option, placeholder, hero and CTA string"
    - "A reader of plan/xphere-booking-integration-plan.md can tell exactly what this repo would build in Stage 1 and Stage 2 without re-researching the Xphere repo"
    - "plan/xphere-booking-integration-plan.md states, above Current State, that Stage 1 is BLOCKED because Xphere's ingestion schema only accepts product 'skaleclub_websites' (a different project), and lists three resolution options with their trade-offs"
    - 'plan/xphere-booking-integration-plan.md names C:\Users\Vanildo\Dev\skaleclub-websites as the CONFIRMED reference implementation and lists its four files (shared/xphere-contract.ts, server/integrations/xphere.ts, scripts/verify-xphere-contract.ts, docs/integrations/xphere-lead-integration-plan.md) with their exported surface'
    - "plan/xphere-booking-integration-plan.md frames Stage 1 as a PORT of the sibling integration (contract module + integration module + durable delivery queue), not a greenfield design, and states plainly that a fire-and-forget POST would be a regression against it"
    - "plan/xphere-booking-integration-plan.md contains no UNVERIFIED hedge about whether the sibling integration exists"
    - "plan/xphere-booking-integration-plan.md states that the sibling being integrated does NOT unblock this repo, and that the sibling is precisely why the product literal is narrow"
    - "plan/xphere-booking-integration-plan.md asks, without answering it, whether the Xphere contract module should be extracted into something both repos share or deliberately duplicated here"
  artifacts:
    - path: "scripts/seed-barbershop-translations.ts"
      provides: "Idempotent hand-written pt-BR translation seed for the barbershop landing"
      contains: "onConflictDoUpdate"
      min_lines: 90
    - path: "plan/xphere-booking-integration-plan.md"
      provides: "Scoping/design doc for lead handoff plus booking redirect into Xphere"
      contains: "https://xphere.app/api/v1/leads"
      min_lines: 110
  key_links:
    - from: "scripts/seed-barbershop-translations.ts"
      to: "translations table"
      via: "drizzle insert with onConflictDoUpdate on the (source_text, source_language, target_language) unique index"
      pattern: "onConflictDoUpdate"
    - from: "scripts/seed-barbershop-translations.ts"
      to: "server/db.js"
      via: "import { pool, db }"
      pattern: "server/db\\.js"
---

<objective>
Two independent deliverables for the barbershop landing track:

1. Hand-seed pt-BR translations for every display string on `/barbershops-br` so the PT
   landing reads correctly today, without waiting on the AI translate provider fix.
2. Write the scoping document for routing barbershop leads into Xphere and letting the
   lead book an in-person or online visit.

Purpose: `/barbershops-br` currently renders English because `POST /api/translate` echoes
the source text back and caches nothing (a separate session owns that bug). Because `t()`
consults the `translations` table BEFORE calling the provider, hand-seeded rows are
authoritative and keep winning after the provider fix lands. Separately, the `tipoVisita`
question seeded in quick task 260906-e15 is a deliberate hook point with no consumer yet —
this plan produces the design for that consumer.

Output: `scripts/seed-barbershop-translations.ts` (run against the configured DB) and
`plan/xphere-booking-integration-plan.md`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@scripts/seed-barbershop-landing.ts
@docs/DYNAMIC_TRANSLATION_SYSTEM.md
@plan/skale-hub-ghl-visit-sync-plan.md
@shared/schema/cms.ts
</context>

<interfaces>
<!-- Everything the executor needs. Do NOT go exploring the codebase or the xphere repo. -->

Drizzle table (`shared/schema/cms.ts:7-15`) — these are ALL the columns, there are no others:

```typescript
export const translations = pgTable("translations", {
  id: serial("id").primaryKey(),
  sourceText: text("source_text").notNull(),
  sourceLanguage: text("source_language").notNull().default("en"),
  targetLanguage: text("target_language").notNull(),
  translatedText: text("translated_text").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
```

There is a UNIQUE index on `(source_text, source_language, target_language)`.

Script boilerplate to mirror (from `scripts/seed-barbershop-landing.ts`):

```typescript
import "dotenv/config";
import { pool, db } from "../server/db.js";
import { translations } from "../shared/schema/cms.js";
// ... main() ... await pool.end();
main().catch(async (err) => {
  console.error("Seed failed:", err);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
```

Note the `.js` extension on relative imports — required for `npx tsx` (STATE.md decision
from Phase 18-01: the `#shared/` alias needs a bundler and is unavailable here).

**Verified Xphere facts for Task 2 (do NOT re-research, do NOT open the xphere repo):**

- Xphere = separate Next.js 16 + Supabase repo at `C:\Users\Vanildo\Dev\xphere`,
  production origin `https://xphere.app`. It is NOT Xpot.
- Public REST API doc: `C:\Users\Vanildo\Dev\xphere\docs\api\public-api.md`.
  Base `https://xphere.app/api/v1`. CORS-enabled.
  Auth: `Authorization: Bearer xph_<64 hex>`, scoped keys, generated in
  Xphere Settings > API Keys, shown once, stored as SHA-256.
- `POST /api/v1/leads` — scope `leads:write`, route `src/app/api/v1/leads/route.ts`.
  Requires an `Idempotency-Key` header that MUST equal `payload.event_id`.
  Responses: 201 accepted / 200 duplicate / 409 idempotency conflict / 422 invalid /
  413 too large (64 KB cap).
- **BLOCKER — `POST /api/v1/leads` is NOT usable from this repo today.** Ingestion Zod
  schema `src/lib/leads/ingestion-schema.ts:11` declares
  `product: z.literal('skaleclub_websites')` — a single literal — and every object in that
  schema is `.strict()`. `skaleclub_websites` is a DIFFERENT project: the service-business
  website platform / forkable template at `C:\Users\Vanildo\Dev\skaleclub-websites`
  (remote `github.com/Skale-Club/websites`). It is NOT this repo
  (`C:\Users\Vanildo\Dev\skaleclub`, the Skale Club marketing site). A payload with any
  other product value fails Zod and returns 422 `invalid_payload`.
  `grep -rn "skaleclub" src/lib src/app` in the xphere repo returns that literal exactly
  once — there is no existing product value for this marketing site.
  Other ingestion fields: `schema_version: '1.0'`, `event_id`, `occurred_at` (ISO with
  offset), `source { product, tenant_ref, site_domain, form }`,
  `contact { name, email, phone }` (at least one required),
  `lead { status: 'new', score?, classification? HOT|WARM|COLD|DISQUALIFIED, page_url?,
  answers: Record<string,string> max 100 }`,
  `attribution { utm_*, first_touch, last_touch }?`.
- `POST /api/v1/contacts` — scope `contacts:write`. No product literal in its payload, so it
  works today, but it creates a bare contact: no `answers`, `score`, `classification` or
  `attribution`, and no `lead.captured` event.
- Xphere is a shared ops hub for sibling apps: `src/lib/obs/alerts.ts:10` and
  `src/app/api/cron/obs-alerts/route.ts:15` enumerate "xphere, xkedule, skaleclub,
  xtimator". This repo is a recognised sibling, just not yet a registered lead source.
- **VERIFIED prior art - the sibling repo is ALREADY integrated.**
  `C:\Users\Vanildo\Dev\skaleclub-websites` (remote `github.com/Skale-Club/websites`) has a
  complete, production-grade Xphere lead integration as `skaleclub_websites`. This has been
  read and confirmed. It is NOT a hypothesis. Four files:
  - `shared/xphere-contract.ts` (33 lines) - the shared contract types
  - `server/integrations/xphere.ts` (318 lines) - the implementation
  - `scripts/verify-xphere-contract.ts` - a contract verification script
  - `docs/integrations/xphere-lead-integration-plan.md` (661 lines) - the full design doc
  Verified exported surface of `server/integrations/xphere.ts`:
  - `getXphereIntegration(tenantId)` / `saveXphereIntegration(tenantId, apiKey, enabled)` /
    `setXphereEnabled(tenantId, enabled)` / `disconnectXphere(tenantId)` - per-tenant API key
    storage and lifecycle
  - `testXphereIntegration(tenantId, apiKey?)` - connection test against
    `${XPHERE_API_BASE}/integration-info`
  - `serializeLeadForXphere(tenant, lead, formConfig)` - builds the ingestion payload
  - `enqueueXphereLead(tenant, lead, formConfig)` - POSTs to `${XPHERE_API_BASE}/leads`
  - `listXphereDeliveries(tenantId, limit)` / `retryXphereDelivery(tenantId, id)` /
    `queueXphereDeliverySweep()` / `reconcileMissingXphereDeliveries()` - a durable delivery
    queue with retry and a reconciliation sweep
  This is materially more sophisticated than a naive fire-and-forget POST: it persists
  delivery attempts, retries failures, and reconciles missed ones. Anything less here is a
  regression against the sibling.
- This repo calls NOTHING in Xphere today (grep for `xphere.app` / `v1/leads` is empty).
- Xphere scheduling tables: `event_types` (org_id, user_id, title, slug, duration_minutes,
  `location_type` CHECK IN ('video','phone','in_person'), location_value,
  allowed_location_kinds, active, booking_type personal|round_robin) and `bookings`
  (booker_name/email/phone, booker_timezone, start_at, end_at, notes,
  status confirmed|cancelled|no_show, linked_contact_id, cancel_token, location_kind,
  location_data, meeting_url, meeting_phone).
- Xphere RLS already permits anon SELECT of active `event_types` and anon INSERT of
  `bookings` — the public booking flow already works.
- Public booking pages: `/book/[slug]/[eventType]` and `/book/cancel/[id]`.
  Slot math lives in `src/lib/calendar/slots.ts` (`generateSlots`,
  `getDaysWithAvailability`). There is NO public HTTP API for free slots — slots are
  computed server-side for the booking page only.
- Prefill gap: `src/app/book/[slug]/[eventType]/page.tsx` reads ONLY `searchParams.debug`.
  No name/email/phone prefill, so a redirected lead retypes their details. Closing this is
  a small change in the Xphere repo (out of scope here).
- `event_types.location_type` `in_person` / `video` maps directly onto the barbershop
  form's `tipoVisita` answers `presencial` / `online`.

**skaleclub-side anchors for Task 2 (verified paths):**

- `POST /api/forms/slug/:slug/leads/progress` — `server/routes/forms.ts:366`. Handler
  upserts via `storage.upsertFormLeadProgress`, then calls `runLeadPostProcessing`.
- `runLeadPostProcessing` — `server/lib/lead-processing.ts:24`. The natural hook point for
  a best-effort Xphere POST when `formCompleto === true`.
- `form_leads.sessionId` is a `uuid("session_id").notNull()` with a unique index
  (`shared/schema/forms.ts:42` and `:90`) — a ready-made idempotency key.
- UTM capture already exists in `client/src/components/LeadFormModal.tsx`.
- Existing integration-settings pattern lives in `server/routes/integrations.ts`.
- Barbershop form slug is `barbershop-leads` (form id=4 in prod, seeded by 260906-e15).
</interfaces>

<tasks>

<task type="auto">
  <name>Task 1: Seed hand-written pt-BR translations for the barbershop landing</name>
  <files>scripts/seed-barbershop-translations.ts</files>
  <action>
Create `scripts/seed-barbershop-translations.ts`, a standalone idempotent seed script.

Structure — mirror `scripts/seed-barbershop-landing.ts` exactly:
- Header comment block explaining what it does, the run command
  (`npx tsx --env-file=.env scripts/seed-barbershop-translations.ts`), and which rows it
  touches.
- `import "dotenv/config";`, then `import { pool, db } from "../server/db.js";` and
  `import { translations } from "../shared/schema/cms.js";` (keep the `.js` extensions —
  the `#shared/` alias does not work under bare `npx tsx`).
- Section-comment banners in the same `// -- Title --------` style.
- `async function main()` at the bottom, `await pool.end()` on success, and the same
  `main().catch(async (err) => { ... process.exit(1); })` tail.

Data: a single flat list, e.g.
`const PT_TRANSLATIONS: Array<{ source: string; translated: string }>`.
Use EXACTLY these 46 pairs, verbatim. Do not paraphrase, add, or drop any:

| source_text | translated_text |
|---|---|
| What's your name? | Qual é o seu nome? |
| Your full name | Seu nome completo |
| What's your WhatsApp? | Qual é o seu WhatsApp? |
| (555) 123-4567 | (555) 123-4567 |
| What's your email? | Qual é o seu e-mail? |
| you@yourshop.com | voce@suabarbearia.com |
| What's the name of your barbershop? | Qual é o nome da sua barbearia? |
| Your shop name | O nome da sua barbearia |
| How many chairs does your shop have? | Quantas cadeiras a sua barbearia tem? |
| 1 | 1 |
| 2-3 | 2-3 |
| 4-6 | 4-6 |
| 7+ | 7+ |
| How many barbers work with you? | Quantos barbeiros trabalham com você? |
| Just me | Só eu |
| How do clients book with you today? | Como os clientes agendam com você hoje? |
| WhatsApp only | Só pelo WhatsApp |
| Booking app (Booksy, Agendor, etc.) | Aplicativo de agendamento (Booksy, Agendor, etc.) |
| Walk-ins only | Só por ordem de chegada |
| Phone calls | Por ligação |
| Other | Outro |
| What's your average ticket per client? | Qual é o seu ticket médio por cliente? |
| Under $25 | Menos de US$ 25 |
| $25-$45 | US$ 25 a US$ 45 |
| $45-$75 | US$ 45 a US$ 75 |
| Over $75 | Mais de US$ 75 |
| How much do you invest in ads per month today? | Quanto você investe em anúncios por mês hoje? |
| Nothing yet | Ainda não invisto |
| Under $300 | Menos de US$ 300 |
| $300-$1,000 | US$ 300 a US$ 1.000 |
| Over $1,000 | Mais de US$ 1.000 |
| What's your biggest challenge right now? | Qual é o seu maior desafio hoje? |
| Not enough new clients | Poucos clientes novos |
| Clients don't come back | Os clientes não voltam |
| Empty chairs on slow days | Cadeiras vazias nos dias fracos |
| No time to handle marketing | Falta tempo para cuidar do marketing |
| How would you like to meet us? | Como você prefere falar com a gente? |
| In-person visit at my shop | Visita presencial na minha barbearia |
| Online meeting (video call) | Reunião online (chamada de vídeo) |
| Anything else we should know? | Mais alguma coisa que a gente deva saber? |
| Optional | Opcional |
| I want more clients | Quero mais clientes |
| Your barbershop deserves a full chair, every day. | Sua barbearia merece cadeira cheia todos os dias. |
| We bring new clients into your shop with ads and booking that actually work — set up in days, not months. | Levamos clientes novos até a sua barbearia com anúncios e agendamento que realmente funcionam — no ar em dias, não em meses. |
| Let's fill your chairs | Vamos encher suas cadeiras |
| Tell us about your barbershop in 1 minute. We'll reply within 24 hours. | Conte sobre a sua barbearia em 1 minuto. Respondemos em até 24 horas. |

That is 46 rows. `Other`, `7+`, `2-3` and `4-6` each appear ONCE even though the source form
reuses them across questions — the unique index keys on the source string, so one row covers
every occurrence.

Required code comments:
1. Above the identity rows (`1`, `2-3`, `4-6`, `7+`, `(555) 123-4567`): explain they are
   deliberate no-op translations. Without a cached row, `t()` treats every render as a
   cache miss and re-queries the (currently broken) AI provider forever. Seeding an
   identity row short-circuits that.
2. Near the top: note that `barbershop-leads` is deliberately EXCLUDED — it is the
   `formSlug` prop on the `leadFormCta` section, not display text, and must never be
   translated.

Every row uses `sourceLanguage: 'en'` and `targetLanguage: 'pt'`.

Idempotency: use a Drizzle insert with
`.onConflictDoUpdate({ target: [translations.sourceText, translations.sourceLanguage, translations.targetLanguage], set: { translatedText: <value>, updatedAt: new Date() } })`.

To report inserted-vs-updated counts, SELECT the existing `source_text` values for
`source_language='en' AND target_language='pt'` before writing, build a `Set`, then classify
each pair. Log a summary like `Done. 46 rows processed - N inserted, M updated.`
Re-running MUST print `0 inserted, 46 updated` and must never duplicate a row.

Do NOT modify `scripts/seed-barbershop-landing.ts`, the `pages`/`forms` rows from quick task
260906-e15, or `server/routes/translate.ts` (a separate session owns the provider bug).

Then run the script TWICE against the configured database:
`npx tsx --env-file=.env scripts/seed-barbershop-translations.ts`
  </action>
  <verify>
    <automated>npx tsx --env-file=.env scripts/seed-barbershop-translations.ts &amp;&amp; npx tsx --env-file=.env scripts/seed-barbershop-translations.ts &amp;&amp; npm run check</automated>
  </verify>
  <done>
Script exists and `npm run check` is clean. First run reports 46 rows processed. Second run
reports `0 inserted, 46 updated`. A DB spot check confirms exactly 46 rows exist for
`(source_language='en', target_language='pt')` matching the seed list, and
`What's your name?` maps to `Qual é o seu nome?`.
  </done>
</task>

<task type="auto">
  <name>Task 2: Write the Xphere booking integration scoping doc</name>
  <files>plan/xphere-booking-integration-plan.md</files>
  <action>
Create `plan/xphere-booking-integration-plan.md`. This is a DESIGN DOCUMENT ONLY — write no
code, run no migrations, touch no other file, and do not open or modify anything under
`C:\Users\Vanildo\Dev\xphere` or `C:\Users\Vanildo\Dev\skaleclub-websites`.

House style: follow the FORMAT of `plan/skale-hub-ghl-visit-sync-plan.md` — `# Title`, then
further `##` sections; terse declarative bullets and numbered lists, backticked identifiers
and file paths, no marketing prose. Mirror its format only — its GHL content is stale and
discontinued.

Every fact you need is already in this plan's `<interfaces>` block. Cite file paths inline
the way the house-style doc does. Do NOT re-research either repo.

Required sections, IN THIS ORDER:

**## Goal**
Leads from the barbershop landing (and future niche landings) flow into Xphere as structured
leads, and the lead books an in-person or online visit.

**## Blocker — Stage 1 Cannot Ship Yet**
This section goes SECOND, immediately after Goal and BEFORE Current State. It must be
impossible to miss — this is a hard blocker, not a footnote. Content:

- `src/lib/leads/ingestion-schema.ts:11` declares `product: z.literal('skaleclub_websites')`
  — a single literal — and every object in that schema is `.strict()`.
- `skaleclub_websites` is a DIFFERENT project: the service-business website platform /
  forkable template at `C:\Users\Vanildo\Dev\skaleclub-websites`
  (remote `github.com/Skale-Club/websites`). It is NOT this repo, which is the Skale Club
  marketing site at `C:\Users\Vanildo\Dev\skaleclub`.
- Consequence: this repo CANNOT call `POST /api/v1/leads` today. A payload with any other
  product value fails Zod validation and returns 422 `invalid_payload`.
- `grep -rn "skaleclub" src/lib src/app` in the xphere repo returns that literal exactly
  once. There is no existing product value for this marketing site.
- Ecosystem note: Xphere is a shared ops hub for sibling apps — `src/lib/obs/alerts.ts:10`
  and `src/app/api/cron/obs-alerts/route.ts:15` enumerate "xphere, xkedule, skaleclub,
  xtimator". This repo is a recognised sibling, just not yet a registered lead source.
- State this connection plainly, because it is easy to get backwards: the fact that
  `skaleclub-websites` IS fully integrated (see Prior Art below) does NOT unblock this repo.
  If anything it is the CAUSE of the blocker — the literal is narrow precisely because that
  sibling is the only registered lead source today. Reading the sibling's code tells you HOW
  to build this integration; it does not make `product` accept a value for this repo. The
  blocker stands until option (a) lands.

Then a `### Resolution options` subsection presenting all three honestly, each with its
trade-off:

(a) **RECOMMENDED** — widen `product` in `src/lib/leads/ingestion-schema.ts` from
`z.literal(...)` to `z.enum([...])` including a new value for this site (e.g. `'skaleclub'`
or `'skaleclub_marketing'`). A one-line change in the Xphere repo. Keeps the two products
cleanly separated in Xphere's reporting. Trade-off: needs a change plus a deploy on the
Xphere side before anything here can ship, and the new value must be threaded through
whatever downstream reporting keys off `product`.

(b) Reuse `POST /api/v1/contacts` (scope `contacts:write`) instead. Its payload carries no
product literal, so it works today with zero Xphere changes. Trade-off: it creates a bare
contact — it loses the lead-specific fields (`answers`, `score`, `classification`,
`attribution`) and does not emit the `lead.captured` event. Everything the barbershop form
collects beyond name/email/phone is dropped. Viable only as a stopgap.

(c) Send `product: 'skaleclub_websites'` from this app anyway. State plainly that this is
the WRONG choice: it silently merges two different products' lead attribution inside Xphere
and will corrupt reporting. It is listed only so nobody rediscovers it as a shortcut — do
not recommend it anywhere else in the document.

Close the section by stating that everything below assumes option (a) lands first, and that
Stage 2 (booking) is NOT blocked and can proceed independently.

**## Prior Art — CONFIRMED Reference Implementation**
State this as established fact. It has been read and verified. Use NO hedging language here —
no "probably", no "likely", no "confirm this first". The literal string UNVERIFIED must
not appear anywhere in the produced document.

- `C:\Users\Vanildo\Dev\skaleclub-websites` (remote `github.com/Skale-Club/websites`) ALREADY
  has a complete, production-grade Xphere lead integration, registered as the
  `skaleclub_websites` product. It is the reference implementation for this work.
- The four files to read, with line counts:
  | File | Lines | What it is |
  |---|---|---|
  | `shared/xphere-contract.ts` | 33 | the shared contract types |
  | `server/integrations/xphere.ts` | 318 | the implementation |
  | `scripts/verify-xphere-contract.ts` | — | a contract verification script |
  | `docs/integrations/xphere-lead-integration-plan.md` | 661 | the full design doc for that integration |
- Exported surface of `server/integrations/xphere.ts`, grouped by concern:
  - Settings lifecycle: `getXphereIntegration(tenantId)`,
    `saveXphereIntegration(tenantId, apiKey, enabled)`, `setXphereEnabled(tenantId, enabled)`,
    `disconnectXphere(tenantId)` — per-tenant API key storage and lifecycle.
  - Connection test: `testXphereIntegration(tenantId, apiKey?)` — hits
    `${XPHERE_API_BASE}/integration-info`.
  - Payload + send: `serializeLeadForXphere(tenant, lead, formConfig)` builds the ingestion
    payload; `enqueueXphereLead(tenant, lead, formConfig)` POSTs to
    `${XPHERE_API_BASE}/leads`.
  - Durable delivery queue: `listXphereDeliveries(tenantId, limit)`,
    `retryXphereDelivery(tenantId, id)`, `queueXphereDeliverySweep()`,
    `reconcileMissingXphereDeliveries()` — persisted delivery attempts, retry, and a
    reconciliation sweep for missed deliveries.
- Consequence for this document: **Stage 1 here is a PORT, not a greenfield design.** The
  default is to mirror the sibling's shape — a contract module, an integration module, and a
  durable delivery queue — rather than invent a second, divergent integration. Any design
  decision that departs from the sibling needs an explicit reason stated in this doc.
- Say plainly that a naive fire-and-forget POST would be a REGRESSION against the sibling's
  durable queue-with-retry-and-reconcile behaviour, and is therefore not an acceptable
  Stage 1 target.

**## Current State**
What exists on each side, with paths. Be explicit that this repo calls NOTHING in Xphere
today. On this repo's side: `POST /api/forms/slug/:slug/leads/progress`
(`server/routes/forms.ts:366`), `runLeadPostProcessing` (`server/lib/lead-processing.ts:24`),
`form_leads.sessionId` uuid + unique index (`shared/schema/forms.ts:42`, `:90`), UTM capture
in `client/src/components/LeadFormModal.tsx`, and the `barbershop-leads` form with its
`tipoVisita` question seeded by quick task 260906-e15. On the Xphere side: the public API
base + auth model (`Authorization: Bearer xph_<64 hex>`, scoped keys), `POST /api/v1/leads`
with its `skaleclub_websites`-only ingestion schema (built for the sibling project, NOT for
this repo), `POST /api/v1/contacts`, the `event_types` / `bookings` tables, the anon RLS
grants, the `/book/[slug]/[eventType]` page, and `src/lib/calendar/slots.ts`.

**## Proposed Flow**
Two clearly labelled stages.

`### Stage 1 — Lead handoff (BLOCKED on the product value)`
On form completion (`formCompleto === true`, inside `runLeadPostProcessing`), this app POSTs
to `https://xphere.app/api/v1/leads`. Give the full field mapping as a table:
- `schema_version` -> `'1.0'`
- `event_id` -> `form_leads.sessionId` (already a uuid, already unique); reuse it verbatim as
  the `Idempotency-Key` header so retries are naturally idempotent and Xphere returns
  200 duplicate rather than creating a second lead
- `occurred_at` -> lead completion timestamp, ISO with offset
- `source.product` -> the NEW value agreed with Xphere per option (a) above. Do NOT write
  `'skaleclub_websites'` here.
- `source.tenant_ref` / `source.site_domain` / `source.form` -> configured tenant ref,
  request host, form slug (`barbershop-leads`)
- `contact.name` / `.email` / `.phone` -> `nome` / `email` / `telefone`
- `lead.status` -> `'new'`; `lead.page_url` -> the landing URL the lead converted on
- `lead.answers` -> every remaining custom answer including `tipoVisita`, `nomeBarbearia`,
  `numeroCadeiras`, `numeroBarbeiros`, `sistemaAgendamento`, `ticketMedio`,
  `investimentoAnuncios`, `principalDesafio`, `observacoes` — stringified, max 100 entries
- `attribution` -> existing UTM capture from `LeadFormModal.tsx`

Note the `.strict()` schema (unknown keys are rejected -> 422) and the 64 KB body cap -> 413.

State the reliability rule explicitly, and state it in the sibling's terms: the Xphere call
must NEVER fail the lead submission (same principle as the reliability rules in the skale-hub
plan) — but "must not fail the submission" does NOT mean fire-and-forget. Mirror
`enqueueXphereLead`: enqueue the delivery, persist the attempt, retry failures, and reconcile
missed ones (`listXphereDeliveries`, `retryXphereDelivery`, `queueXphereDeliverySweep`,
`reconcileMissingXphereDeliveries`). Log-and-drop loses leads; the sibling already solved this
and shipping less here is a regression.

Mirror the sibling's module split too, rather than inlining everything into
`runLeadPostProcessing`: a contract module (analogue of `shared/xphere-contract.ts`), an
integration module owning serialize + enqueue + queue (analogue of
`server/integrations/xphere.ts`), and a contract verification script (analogue of
`scripts/verify-xphere-contract.ts`). `runLeadPostProcessing` should only call into it.

`### Stage 2 — Booking (not blocked)`
After submit, redirect the lead to Xphere's existing public booking page
`https://xphere.app/book/{calendarProfileSlug}/{eventTypeSlug}`, choosing the event type from
`tipoVisita`: `presencial` -> an `in_person` event type, `online` -> a `video` event type.
`event_types.location_type` maps 1:1 onto those answers. This path needs no ingestion-schema
change and can ship ahead of Stage 1. Call out the prefill gap:
`src/app/book/[slug]/[eventType]/page.tsx` reads only `searchParams.debug`, so a redirected
lead retypes name/email/phone. Closing it is a small change in the Xphere repo (add
name/email/phone `searchParams`) — out of scope here, but it should land before this ships to
real traffic.

**## Why Redirect Rather Than Embed**
There is no public free-slots HTTP API in Xphere — slot math (`generateSlots`,
`getDaysWithAvailability` in `src/lib/calendar/slots.ts`) runs server-side for the booking
page only. Embedding would require: (a) building and securing a new public slots endpoint in
Xphere, (b) a new form question type here for date/slot selection, (c) duplicating conflict
and timezone logic that already exists. Present embedding as the explicitly DEFERRED
alternative with that cost listed.

**## Configuration Needed**
- New secret `XPHERE_API_KEY` in this repo's env plus a documented entry in `.env.example`
  (format `xph_<64 hex>`, generated in Xphere Settings > API Keys, shown once).
- The agreed `source.product` value, the two event type slugs (in-person, online), the
  calendar profile slug, and `source.tenant_ref` MUST be admin-configurable settings, not
  hardcoded. CLAUDE.md and the standing memory rule forbid inheriting tenant-specific
  IDs/URLs into source. Suggest storing them alongside the other integration settings behind
  `/api/integrations/*` (see `server/routes/integrations.ts` for the existing pattern).
- Optional: a feature flag so the handoff can be switched off without a deploy.

**## Open Questions for the User**
1. Which `product` value should Xphere accept for this site — `'skaleclub'`,
   `'skaleclub_marketing'`, or something else?
2. Should the two Skale Club properties (this marketing site and `skaleclub-websites`)
   appear as ONE lead source or TWO inside Xphere's reporting?
3. Which Xphere org / calendar profile owns barbershop bookings?
4. Do in-person visits need a shop address field added to the `barbershop-leads` form?
5. Is booking mandatory after submit, or skippable (hard redirect vs. an optional
   "Book your visit" CTA on the thank-you state)?
6. Should the API key be per-environment (a separate staging key)?
7. Should the Xphere contract module be EXTRACTED into something both repos share (a published
   package, a git submodule, or a synced file with a contract-verification script on both
   sides), or deliberately DUPLICATED in this repo? Present the trade-off and leave it OPEN —
   do NOT pick an answer. Extraction: one definition, no drift, but it creates a cross-repo
   release dependency between two independently deployed apps and needs somewhere to live.
   Duplication: zero coupling and each repo deploys freely, but two copies of a `.strict()`
   contract WILL drift, and drift surfaces as production 422s rather than build-time errors.
   Note that `skaleclub-websites` already ships `scripts/verify-xphere-contract.ts`, so the
   duplication path at minimum implies porting an equivalent check here.

**## Out of Scope**
- GoHighLevel entirely — discontinued. No GHL path is proposed or considered.
- No DB schema change in this repo (no migration, no new column).
- No new form question type in Stage 1 or Stage 2.
- No changes inside the Xphere repo (the ingestion-schema widening and the booking-page
  prefill fix are both specified here, not performed).
- No changes inside `skaleclub-websites` — read-only reference. (If open question 7 is later
  resolved in favour of extracting a shared contract module, that becomes its own scoped piece
  of work; it is not proposed here.)
- Implementation of any of the above — this pass produces the document only.
  </action>
  <verify>
    <automated>grep -q "https://xphere.app/api/v1/leads" plan/xphere-booking-integration-plan.md &amp;&amp; grep -q "Idempotency-Key" plan/xphere-booking-integration-plan.md &amp;&amp; grep -q "XPHERE_API_KEY" plan/xphere-booking-integration-plan.md &amp;&amp; grep -qi "BLOCKED" plan/xphere-booking-integration-plan.md &amp;&amp; grep -q "Prior Art — CONFIRMED Reference Implementation" plan/xphere-booking-integration-plan.md &amp;&amp; grep -q "skaleclub-websites" plan/xphere-booking-integration-plan.md &amp;&amp; grep -q "shared/xphere-contract.ts" plan/xphere-booking-integration-plan.md &amp;&amp; grep -q "server/integrations/xphere.ts" plan/xphere-booking-integration-plan.md &amp;&amp; grep -q "reconcileMissingXphereDeliveries" plan/xphere-booking-integration-plan.md &amp;&amp; grep -qi "fire-and-forget" plan/xphere-booking-integration-plan.md &amp;&amp; ! grep -q "UNVERIFIED" plan/xphere-booking-integration-plan.md &amp;&amp; grep -q "contacts:write" plan/xphere-booking-integration-plan.md &amp;&amp; grep -q "Out of Scope" plan/xphere-booking-integration-plan.md &amp;&amp; grep -q "Stage 2" plan/xphere-booking-integration-plan.md &amp;&amp; ! grep -q "getGHLFreeSlots" plan/xphere-booking-integration-plan.md</automated>
  </verify>
  <done>
`plan/xphere-booking-integration-plan.md` exists with every required section in order. The
Blocker section sits directly after Goal and above Current State, states that Stage 1 cannot
ship until Xphere accepts a product value for this app, and lists all three options —
(a) widen the literal to an enum (recommended), (b) fall back to `POST /api/v1/contacts`,
(c) reuse `skaleclub_websites` (explicitly called out as the wrong choice because it
corrupts cross-product attribution), and states plainly that the sibling already being
integrated does NOT unblock this repo. A Prior Art section presents
`C:\Users\Vanildo\Dev\skaleclub-websites` as the CONFIRMED reference implementation — the
string `UNVERIFIED` appears nowhere in the file — lists its four files with line counts and
the exported surface of `server/integrations/xphere.ts`, frames Stage 1 as a port of that
integration, and calls a fire-and-forget POST a regression against its durable
queue-with-retry-and-reconcile behaviour. Open question 7 raises shared-vs-duplicated contract
module without answering it. The doc nowhere claims the endpoint was built for this repo. It also gives the complete `POST /api/v1/leads` field
mapping with `sessionId` as `event_id` + `Idempotency-Key`, describes the Stage 2 booking
redirect keyed on `tipoVisita`, justifies redirect over embed via the missing slots API,
lists `XPHERE_API_KEY` and the admin-configurable slugs, and proposes no GHL path anywhere.
No source file outside `plan/` was modified.
  </done>
</task>

</tasks>

<verification>
1. `npm run check` passes (no new TypeScript errors).
2. `npx tsx --env-file=.env scripts/seed-barbershop-translations.ts` run twice: second run
   reports `0 inserted, 46 updated`.
3. `SELECT count(*) FROM translations WHERE source_language='en' AND target_language='pt'`
   increased by at most 46 and contains no duplicate `source_text` values.
4. `git status` shows exactly two new files:
   `scripts/seed-barbershop-translations.ts` and `plan/xphere-booking-integration-plan.md`.
   Nothing under `client/`, `server/`, `shared/`, or the 260906-e15 seed was touched.
5. Manual: load `/barbershops-br` and confirm the form questions, select options,
   placeholders, hero headline/subheadline and CTA all render in Portuguese.
</verification>

<success_criteria>
- `scripts/seed-barbershop-translations.ts` exists, type-checks, is idempotent, and has
  seeded all 46 en to pt rows.
- `barbershop-leads` does NOT appear as a `source_text` in the seeded rows.
- The identity rows (`1`, `2-3`, `4-6`, `7+`, `(555) 123-4567`) are present and explained by
  an inline comment.
- `plan/xphere-booking-integration-plan.md` exists, follows the house style, and covers Goal,
  Blocker (all three resolution options with trade-offs), Prior Art, Current State, both
  stages, redirect-vs-embed, configuration, open questions and out of scope. It mentions
  GoHighLevel only as discontinued/out of scope.
- The Prior Art section is stated as fact: `UNVERIFIED` appears nowhere in the file, the four
  sibling files are listed with line counts, and the exported surface of
  `server/integrations/xphere.ts` is reproduced.
- Stage 1 is framed as a PORT of the sibling integration, and the doc says explicitly that a
  fire-and-forget POST would be a regression against its durable delivery queue.
- The doc states that the sibling being integrated does not unblock this repo.
- Open question 7 asks shared-vs-duplicated contract module and leaves it unanswered.
- The doc nowhere claims `POST /api/v1/leads` was built for this repo, and nowhere
  recommends sending `product: 'skaleclub_websites'` from this app.
- No implementation of the Xphere integration was performed.
- `POST /api/translate` and `server/routes/translate.ts` were not touched.
</success_criteria>

<output>
After completion, create
`.planning/quick/260906-edl-barbershop-pt-copy-xphere-booking-integr/260906-edl-SUMMARY.md`
</output>
