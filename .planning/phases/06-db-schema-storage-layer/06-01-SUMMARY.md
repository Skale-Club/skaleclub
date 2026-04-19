---
phase: 06-db-schema-storage-layer
plan: "01"
subsystem: database

tags: [drizzle, zod, postgresql, jsonb, typescript, estimates]

# Dependency graph
requires: []
provides:
  - estimates Drizzle pgTable definition with id, clientName, slug, note, services (jsonb), createdAt, updatedAt
  - discriminatedUnion Zod schema for EstimateServiceItem (catalog | custom)
  - insertEstimateSchema for input validation
  - TypeScript types: Estimate, InsertEstimate, EstimateServiceItem, CatalogServiceItem, CustomServiceItem
  - barrel export in shared/schema.ts wiring estimates into #shared/schema.js
affects:
  - 06-02-storage-layer
  - 07-api-routes
  - 08-admin-ui
  - 09-public-viewer

# Tech tracking
tech-stack:
  added: []
  patterns:
    - discriminatedUnion Zod schema with type: "catalog" | "custom" for JSONB service snapshot
    - manual Zod insert schema (not drizzle-zod createInsertSchema) following cms.ts convention
    - $onUpdate(() => new Date()) for updatedAt timestamps

key-files:
  created:
    - shared/schema/estimates.ts
  modified:
    - shared/schema.ts

key-decisions:
  - "JSONB snapshot for services (not FK to portfolio_services) — editing catalog never mutates sent proposals"
  - "UUID slugs as text column — generated in application code via crypto.randomUUID(), not DB uuid type"
  - "Item type discriminator field (catalog | custom) — required so editor restores correct input mode on re-open"
  - "No drizzle-zod createInsertSchema — portfolioServices uses manual Zod, followed same pattern"
  - "No status/expiresAt/totalPrice columns — YAGNI, surgical scope constraint (D-07)"

patterns-established:
  - "Estimates schema: discriminatedUnion pattern for JSONB polymorphic array items"
  - "Service snapshot: catalog items carry sourceId for traceability, both types share title/description/price/features/order"

requirements-completed: [EST-01]

# Metrics
duration: 3min
completed: 2026-04-19
---

# Phase 6 Plan 01: Estimates Schema Summary

**Drizzle estimates table + discriminatedUnion Zod types for JSONB service snapshot, wired into shared barrel**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-19T21:06:08Z
- **Completed:** 2026-04-19T21:08:47Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Created `shared/schema/estimates.ts` with the full Drizzle `estimates` pgTable (id, clientName, slug, note, services jsonb, createdAt, updatedAt)
- Defined discriminated union Zod schemas for `EstimateServiceItem` (catalog vs custom) with type narrowing support
- Wired estimates into `shared/schema.ts` barrel so all downstream code can import via `#shared/schema.js`

## Task Commits

Each task was committed atomically:

1. **Task 1: Create shared/schema/estimates.ts** - `4ee68e4` (feat)
2. **Task 2: Add barrel export to shared/schema.ts** - `ba9b8b3` (feat)

**Plan metadata:** _(docs commit follows)_

## Files Created/Modified

- `shared/schema/estimates.ts` - Drizzle table definition, discriminated union Zod schemas, insert schema, TypeScript types
- `shared/schema.ts` - Added `export * from "./schema/estimates.js"` as seventh barrel entry

## Decisions Made

None during execution — all decisions were pre-made in 06-CONTEXT.md (D-01 through D-09) and implemented as specified.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `shared/schema/estimates.ts` is complete and type-safe — zero TypeScript errors confirmed
- `server/storage.ts` can now import `estimates` and the TypeScript types to implement the six CRUD methods (plan 06-02)
- Drizzle migration will create the `estimates` table when `npm run db:push` is next run (plan 06-02 handles this)

---

*Phase: 06-db-schema-storage-layer*
*Completed: 2026-04-19*
