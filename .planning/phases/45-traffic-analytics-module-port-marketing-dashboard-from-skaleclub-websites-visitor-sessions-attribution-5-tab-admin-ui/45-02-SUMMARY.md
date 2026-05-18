---
phase: 45-traffic-analytics-module-port-marketing-dashboard-from-skaleclub-websites-visitor-sessions-attribution-5-tab-admin-ui
plan: 02
subsystem: storage
tags: [attribution, marketing, storage, drizzle, port, single-tenant]
requires:
  - 45-01 (visitor_sessions + attribution_conversions tables + form_leads.visitor_id column + marketing-types.ts)
provides:
  - storage.upsertVisitorSession (FT-immutable visitor session upsert by visitor_id UUID)
  - storage.createAttributionConversion (append-only conversion event insert)
  - storage.linkLeadToVisitor (UUID → integer FK resolver + stamps form_leads.visitor_id)
  - storage.getMarketingOverview (KPI aggregates + time series, default 30-day window)
  - storage.getMarketingBySource (per-channel splits with QUENTE/MORNO/FRIO buckets)
  - storage.getMarketingByCampaign (per-campaign aggregates with top 3 landing pages)
  - storage.getMarketingConversions (flat list, joined to visitor_sessions for UUID, capped 500)
  - storage.getVisitorJourney (single session + all its conversions for the Journey tab)
affects:
  - server/storage.ts (+305 LOC, 3184 → 3489)
tech-stack:
  added: []
  patterns: [drizzle "excluded.*" upsert, FILTER (WHERE ...) aggregation, GREATEST monotonic boolean, getTableColumns spread]
key-files:
  created: []
  modified:
    - server/storage.ts
decisions:
  - Hot/warm/cold use the destination PT-BR enum (QUENTE/MORNO/FRIO) — UI labels stay English in plan 06
  - ON CONFLICT target is `visitor_sessions.visitorId` alone (single-column unique index, not the source's composite (tenantId, visitorId))
  - First-touch (ft_*) and firstSeenAt are intentionally omitted from the ON CONFLICT SET — they are immutable after initial INSERT
  - `converted` flag is monotonic via GREATEST — never reverts true → false
  - getMarketingConversions hard-caps at 500 rows (matches source) — pagination is a future plan
metrics:
  duration: ~10 minutes
  completed: 2026-05-18
---

# Phase 45 Plan 02: Port 8 Attribution + Marketing Storage Methods (Single-Tenant) Summary

Ported the 8 attribution/marketing storage methods from skaleclub-websites/server/storage.ts into the destination DatabaseStorage class, dropping every tenant_id reference and adapting the hot/warm/cold FILTER clauses to the destination's PT-BR enum (QUENTE/MORNO/FRIO).

## Where each method landed in server/storage.ts

| Method | IStorage signature | DatabaseStorage impl |
|---|---|---|
| `upsertVisitorSession` | line 883 | line 3214 |
| `createAttributionConversion` | line 885 | line 3245 |
| `linkLeadToVisitor` | line 887 | line 3267 |
| `getMarketingOverview` | line 889 | line 3280 |
| `getMarketingBySource` | line 890 | line 3373 |
| `getMarketingByCampaign` | line 891 | line 3410 |
| `getMarketingConversions` | line 892 | line 3449 |
| `getVisitorJourney` | line 893 | line 3470 |

Section banner comment: line 3199-3202 (`// === Marketing Attribution (Phase 45) ===`).
Final file size: **3489 LOC** (was 3184 before this plan; +305 lines). The 600-LOC ceiling
is a pre-existing violation deferred by Phase 41 for storage.ts; not split as part of this plan.

## Differences from source (skaleclub-websites/server/storage.ts)

| Source line range | Source code | Destination code | Why |
|---|---|---|---|
| 2608 | `.values({ ...session, tenantId: this._tenantId ?? 1 })` | `.values(session)` | Single-tenant — no tenantId column |
| 2610 | `target: [visitorSessions.tenantId, visitorSessions.visitorId]` | `target: visitorSessions.visitorId` | Destination unique index is on visitor_id alone |
| 2652 | `.values({ ...conversion, tenantId: this._tenantId ?? 1, conversionType: ... })` | `.values({ ...conversion, conversionType: ... })` | Single-tenant |
| 2687-2696 | `and(eq(visitorSessions.visitorId, visitorId), this._tenantId !== null ? eq(visitorSessions.tenantId, this._tenantId) : undefined)` | `eq(visitorSessions.visitorId, visitorId)` | Single-tenant |
| 2693-2696 | `and(eq(formLeads.id, leadId), this._tenantId !== null ? eq(formLeads.tenantId, this._tenantId) : undefined)` | `eq(formLeads.id, leadId)` | Single-tenant |
| 2711, 2729, 2781 | `...(this._tenantId !== null ? [eq(visitorSessions.tenantId, this._tenantId)] : [])` inside conditions arrays | (removed entirely) | Single-tenant |
| 2821-2823 | `filter (where ${formLeads.classificacao} = 'HOT')` and `'WARM'` / `'COLD'` | `filter (where ${formLeads.classificacao} = 'QUENTE')` and `'MORNO'` / `'FRIO'` | Destination PT-BR enum (DESQUALIFICADO excluded from all 3 buckets) |
| 2826-2828, 2867-2869 | `leftJoin(formLeads, and(eq(formLeads.visitorId, ...), this._tenantId !== null ? eq(formLeads.tenantId, this._tenantId) : undefined))` | `leftJoin(formLeads, eq(formLeads.visitorId, visitorSessions.id))` | Single-tenant |
| 2901, 2915, 2925 | `this._tenantId !== null ? eq(...tenantId, this._tenantId) : undefined` inside `and(...)` | (removed) | Single-tenant |

## Imports added to server/storage.ts

```ts
// in the schema-barrel destructure (#shared/schema.js)
visitorSessions,
attributionConversions,
type VisitorSession,
type InsertVisitorSession,
type AttributionConversion,
type InsertAttributionConversion,

// new dedicated import block
import type {
  MarketingFilters,
  MarketingOverview,
  MarketingBySource,
  MarketingByCampaign,
  VisitorJourney,
} from "#shared/marketing-types.js";

// drizzle-orm — added `lte` and `getTableColumns`
import { eq, and, or, ilike, gte, lte, lt, desc, asc, sql, ne, inArray, count, getTableColumns } from "drizzle-orm";
```

## Verification

- `npm run check` — passes with zero new errors.
- `grep -c "this._tenantId" server/storage.ts` returns 0.
- `grep "QUENTE" server/storage.ts` finds 1 occurrence (in getMarketingBySource, alongside MORNO and FRIO).
- All 8 method names appear in both the IStorage interface and the DatabaseStorage class.
- The 8 implementations live in a single `// === Marketing Attribution (Phase 45) ===` block immediately before `export const storage = new DatabaseStorage();`.

## Deviations from Plan

**None of substance.** The plan listed "8 methods" in the top-level objective but only itemized 6 in the must_haves and the Differences table titles ("6 storage methods"). The IStorage code block and the implementation paste-block both clearly enumerated 8 entries — `upsertVisitorSession`, `createAttributionConversion`, `linkLeadToVisitor`, `getMarketingOverview`, `getMarketingBySource`, `getMarketingByCampaign`, `getMarketingConversions`, `getVisitorJourney` — and that is what shipped. The "6 methods" phrasing was a leftover from an earlier draft where `createAttributionConversion` and `linkLeadToVisitor` were considered helpers of `upsertVisitorSession`. All 8 are implemented, signed in `IStorage`, and exercised by the type-checker.

## Self-Check: PASSED

- server/storage.ts present and modified — FOUND (3489 LOC)
- All 8 method names present in both IStorage and DatabaseStorage — FOUND
- 0 `this._tenantId` references in the file — FOUND
- 'QUENTE' literal present — FOUND
- `npm run check` exit 0 — FOUND
