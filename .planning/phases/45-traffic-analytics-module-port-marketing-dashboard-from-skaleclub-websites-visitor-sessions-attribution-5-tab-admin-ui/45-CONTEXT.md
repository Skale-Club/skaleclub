# Phase 45: Traffic Analytics — port Marketing dashboard from skaleclub-websites

**Gathered:** 2026-05-18
**Status:** Ready for planning
**Mode:** Autonomous port — user asleep, agent makes all judgment calls

<domain>
## Phase Boundary

Port the Marketing Attribution feature from the sister project
`C:\Users\Vanildo\Dev\skaleclub-websites` into this codebase. The source is
multi-tenant; the destination is single-tenant — every `tenant_id` column,
every `this._tenantId` reference, every `res.locals.tenant?.id` guard MUST
be dropped during the port. Otherwise the port is faithful: same DB shape,
same aggregation SQL, same UI.

In scope:
- 2 new tables (visitor_sessions, attribution_conversions) + raw-SQL migration
- 1 column add to existing form_leads (visitor_id integer FK, nullable)
- 6 storage methods (1 upsert + 5 aggregation queries)
- 2 public attribution endpoints (session upsert, conversion insert)
- 5 admin marketing endpoints (overview / sources / campaigns / conversions / journey)
- 2 client libraries (attribution.ts + use-attribution.ts hook)
- App.tsx integration (mount useAttribution + report page views)
- 7 admin UI files (MarketingSection.tsx + 5 tab components + utils.ts)
- Sidebar entry "Traffic" + Admin.tsx lazy import + slug map updates
- Server-side hook: when a form_leads row is created, fire a `lead_created`
  attribution_conversions row automatically (using the visitor's UUID from
  the request body or headers — captured in the form payload)

Out of scope:
- Phone-click and booking-started conversion types — port the types/enums
  but don't wire UI handlers yet (deferred — only `lead_created` and
  `form_submitted` fire automatically in v1).
- Extending the source's `analyticsEventHits` system — that's a separate
  feature (event tracking ≠ session attribution).
- Replacing the existing analytics.ts (GTM/GA4/FB Pixel) — those keep
  running side-by-side; attribution is the lead-attribution layer above them.

</domain>

<decisions>
## Implementation Decisions

### Source → Destination map

| Source file | Destination file |
|---|---|
| `shared/schema.ts` (visitorSessions + attributionConversions tables only) | `shared/schema/attribution.ts` (new, single-tenant) |
| `shared/marketing-types.ts` | `shared/marketing-types.ts` (identical — pure types) |
| `server/routes/attribution.ts` | `server/routes/attribution.ts` (single-tenant adapt) |
| `server/routes/marketing.ts` | `server/routes/marketing.ts` (single-tenant adapt) |
| `server/storage.ts` (6 methods only) | append to existing `server/storage.ts` |
| `client/src/lib/attribution.ts` | `client/src/lib/attribution.ts` (identical) |
| `client/src/hooks/use-attribution.ts` | `client/src/hooks/use-attribution.ts` (identical) |
| `client/src/components/admin/MarketingSection.tsx` | `client/src/components/admin/MarketingSection.tsx` (rename heading to "Traffic Analytics" per screenshot) |
| `client/src/components/admin/marketing/*.tsx` (5 tabs + utils) | `client/src/components/admin/marketing/*.tsx` (1:1) |

### Single-tenant adaptation rules

For every file ported:
1. **Drop `tenantId` column** from new tables. Drop all `tenant_id` indexes.
2. **Drop `this._tenantId` references** in storage methods. The destination
   `DatabaseStorage` class is a single class for one tenant — no scoping.
3. **Drop `res.locals.tenant?.id` checks** in routes. Use the existing
   `requireAdmin` middleware shape (from `server/auth/supabaseAuth.ts`).
4. **Drop `res.locals.storage`** — destination uses imported `storage`
   singleton from `server/storage.js`.
5. **Adapt `visitor_sessions_tenant_visitor_id_unique` index** to be just
   `visitor_sessions_visitor_id_unique` (unique on `visitor_id` alone).

### `form_leads.visitor_id` integer FK

The current `form_leads` table does NOT have a `visitor_id` column. The
schema migration must add it as a NULLable integer FK referencing
`visitor_sessions(id)` with `ON DELETE SET NULL`. Without this column,
the `linkLeadToVisitor` storage method (and the lead-creation hook) can't
work.

### Lead-creation hook

In whichever route currently inserts into `form_leads` (likely
`server/routes/forms.ts`), after the insert:
1. Check if the request body or headers carry a visitor UUID (the client
   tracking hook puts it in the form payload as `__visitorId` — or use a
   header like `X-Visitor-Id` — pick one and keep it consistent with the
   client side).
2. If present, fire-and-forget:
   `storage.linkLeadToVisitor(lead.id, visitorId)` → returns
   `visitor_sessions.id`. Then insert `attribution_conversions` with
   `{ visitorId: sessionPk, leadId: lead.id, conversionType: 'lead_created',
   ...copy ft_*/lt_* from visitor_sessions row }`.
3. Wrap in try/catch — attribution MUST NEVER block the lead-create
   critical path. Silently log errors.

### Endpoint routing

- Public: `POST /api/attribution/session` and `POST /api/attribution/conversion`
  (no auth). Per the source D-06 contract, ZodError → 400; all other errors
  → silently return 200 `{}` so attribution NEVER blocks the client.
- Admin: 5 endpoints under `/api/admin/marketing/*` — protect with the
  existing `requireAdmin` middleware.

### Storage method behavior

- `upsertVisitorSession(session)` — INSERT...ON CONFLICT DO UPDATE on
  `visitor_id` (unique). FT columns ONLY set on initial insert (the
  ON CONFLICT clause omits them). LT columns and `last_seen_at` updated
  every call. `converted` flag is monotonic (GREATEST).
- `getMarketingOverview(filters)` — Total visits + total leads +
  conversion rate + top source + top campaign + top landing page + time
  series (one row per day in the window). Default 30-day window if no
  filters.
- `getMarketingBySource(filters)` — GROUP BY ft_source_channel. Joins
  attribution_conversions to derive lead counts + hot/warm/cold splits
  from `form_leads.classificacao`.
- `getMarketingByCampaign(filters)` — GROUP BY ft_campaign + ft_source +
  ft_source_channel. Includes top 3 landing pages per campaign.
- `getMarketingConversions(filters)` — Flat list of attribution_conversions
  rows in the window, joined to visitor_sessions to expose the visitor UUID
  (for "Journey" tab linking).
- `getVisitorJourney(visitorUuid)` — Returns one VisitorSession + all
  AttributionConversions for that visitor. Used by Journey tab when admin
  clicks a row in Conversions tab.

### Client-side tracking

`attribution.ts` (229 LOC):
- Reads UTM params from URL on every page load
- Classifies source → source_channel (Organic Search / Paid Ads / Social /
  Referral / Direct)
- Persists visitor UUID in cookie `_skv` (180-day expiry)
- Persists first-touch payload in cookie `_skvft` (immutable after first set)
- Exports `reportAttributionPageView()` — fires the session POST
- Exports helper to grab visitor UUID for form submissions

`use-attribution.ts` (175 LOC):
- React hook that wraps the lib for use in App.tsx
- Returns `{ visitorId, ready }`
- Mounts on app boot, fires `reportAttributionPageView()` on every route
  change (via the existing analytics page-view hook pattern)

### UI

The source `MarketingSection.tsx` (238 LOC) is the parent container with
tab switcher + filter bar + active-tab routing. 5 tab components
(MarketingOverviewTab / SourcesTab / CampaignsTab / ConversionsTab /
JourneyTab) each fetch their endpoint with React Query and render KPIs +
tables + charts. `utils.ts` (107 LOC) contains formatting helpers
(date ranges, channel labels, conversion rate formatting).

- Match the screenshot the user shared: dark admin theme, KPI cards
  (Total Visits / Leads Generated / Conversion Rate / Top Traffic Source /
  Best Campaign / Best Landing Page), date-range buttons (Today /
  Yesterday / Last 7 / Last 30 / This month / Last month / Custom),
  source + campaign dropdowns, type filter, line chart "Visits &
  Conversions Over Time".
- Section name in sidebar: "Traffic" (matches the screenshot label).
- Admin route slug: `traffic` → `AdminSection = 'traffic'`.
- Sidebar icon: lucide `TrendingUp` or `LineChart` (pick by feel).

### Claude's Discretion

- Exact wording of tab labels (keep source's English).
- Chart library: source uses what's already in skaleclub-websites; check
  what current skaleclub has (likely `recharts` based on shadcn/admin).
- Where exactly to add the lead-creation hook in `server/routes/forms.ts`
  — find the insert into form_leads and add the fire-and-forget block
  immediately after.
- Whether to also fire `form_submitted` conversion (deferred → no).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Admin design system: `SectionHeader`, `AdminCard`, `EmptyState`,
  `FormGrid` — use these instead of raw divs.
- `AppLoader` (`client/src/components/ui/spinner.tsx`) — theme-aware
  full-screen loader for the section's initial load.
- React Query (`@tanstack/react-query`) for all admin endpoint fetching.
- `requireAdmin` middleware from `server/auth/supabaseAuth.ts`.
- `storage` singleton from `server/storage.ts`.

### Established Patterns
- Raw-SQL idempotent migrations (`scripts/migrate-*.ts`) following the
  Phase 43 + 44 pattern. Next migration file: `0045_*.sql`.
- Schema split: `shared/schema/<domain>.ts` + barrel re-export in
  `shared/schema.ts` (and `shared/schema.ts` itself).
- Admin section conventions: file lives at
  `client/src/components/admin/<SectionName>.tsx` (top-level) or
  `client/src/components/admin/<section>/SectionName.tsx` (folder).
  After Phase 41 split, the folder pattern is preferred for new sections
  with >1 file. Use `client/src/components/admin/marketing/` (matches
  source naming).
- Lazy admin section loading: register in `Admin.tsx` via
  `lazy(() => import('@/...').then(m => ({ default: m.XxxSection })))`.
- Sidebar entry in `client/src/components/admin/shared/constants.ts`
  `SIDEBAR_MENU_ITEMS`.
- AdminSection type union in `client/src/components/admin/shared/types.ts`.
- Slug map in `Admin.tsx` updated in TWO places (useMemo + handleSectionSelect).
- data-testid attributes on key buttons/inputs (project convention).

### Integration Points
- `App.tsx` — add `useAttribution()` near the top of the Router or App
  component so it runs on every render.
- `Admin.tsx` — lazy import + slug map + section-list branch.
- `server/routes.ts` — mount `registerAttributionRoutes(app)` +
  `registerMarketingRoutes(app)`.
- `server/routes/forms.ts` — locate the form_leads INSERT and add the
  fire-and-forget attribution-conversion block immediately after.
- `shared/schema.ts` — barrel re-export `attribution.ts`.

</code_context>

<specifics>
## Specific Ideas

- The source includes `notificationLogs` table and references to it in
  the lead-creation flow. Ignore — current skaleclub has its own
  notification system. The attribution hook is independent.
- The cookie name `_skv` is the source's convention. Keep it identical
  so any analytics tooling that expects this name keeps working.
- The visitor UUID is a v4 UUID generated client-side via `crypto.randomUUID()`.
- Default time window: 30 days. Hard limit: 90 days (enforce in route
  validation if not already in the source).
- The Custom date filter button in the screenshot opens a date-range
  picker. The source already implements this — port as-is.

</specifics>

<deferred>
## Deferred Ideas

- Phone-click conversion tracking — port the type/enum, wire UI handlers
  in a future phase.
- Booking-started conversion tracking — same.
- Real-time updates (websocket / SSE) — admin polls every page-view for v1.
- Multi-tenant restoration — if this app ever goes multi-tenant, the
  `tenant_id` column adds become migrations; storage methods need scope
  passing. Out of scope today.
- Drill-down from a Campaign row → list of conversions for that campaign.
  v1 admin clicks a Conversion row to open Journey tab; campaign-level
  drill-down is a follow-up.

</deferred>
