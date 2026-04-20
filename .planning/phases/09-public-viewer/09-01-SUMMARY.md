---
phase: 09-public-viewer
plan: "01"
subsystem: estimates
tags: [backend, db-schema, storage, routes, view-tracking, access-code]
dependency_graph:
  requires: [phase-06-db-schema-storage-layer, phase-07-admin-api-routes]
  provides: [estimate_views table, access_code column, recordEstimateView, listEstimates with stats, POST /api/estimates/:id/view, POST /api/estimates/:id/verify-code]
  affects: [server/routes/estimates.ts, server/storage.ts, shared/schema/estimates.ts]
tech_stack:
  added: []
  patterns: [LEFT JOIN aggregation with sql<number> cast, plain-text access code (D-07), cascade FK delete, raw SQL migration via tsx script]
key_files:
  created:
    - migrations/0032_estimate_views_and_access_code.sql
    - scripts/migrate-estimate-views.ts
  modified:
    - shared/schema/estimates.ts
    - server/storage.ts
    - server/routes/estimates.ts
decisions:
  - "Plain text access code comparison (D-07): codes must be readable for GHL automation, not bcrypt hashed"
  - "Raw SQL migration via tsx script (pattern from Phase 6.2): drizzle-kit push fails due to .js ESM imports in CJS bundle"
  - "count(id)::int SQL cast: Drizzle returns count as string, explicit ::int cast ensures number type"
metrics:
  duration: "~20 minutes"
  completed_date: "2026-04-19"
  tasks: 3
  files_changed: 5
---

# Phase 9 Plan 01: View Tracking and Access Code Protection — Backend Foundation

JWT auth with view tracking via LEFT JOIN aggregation and plain-text access code verification for public estimate viewer.

## What Was Built

Backend foundation for Phase 9 public estimate viewer: adds `access_code` column to estimates table, creates `estimate_views` table with cascade FK, updates `listEstimates()` to return view statistics via LEFT JOIN aggregation, adds `recordEstimateView()` storage method, and adds two public endpoints (view tracking + code verification) while redacting `access_code` from the public slug endpoint.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Schema: access_code + estimateViews + EstimateWithStats | 3402fa1 | shared/schema/estimates.ts |
| 2 | Storage: listEstimates with LEFT JOIN, recordEstimateView | 9cee918 | server/storage.ts |
| 3 | Routes: view/verify-code endpoints, slug redaction, DB migrate | e1d3253 | server/routes/estimates.ts, migrations/0032_*.sql, scripts/migrate-estimate-views.ts |

## Decisions Made

- **Plain text access code (D-07)**: Access codes are stored as plain text, not bcrypt-hashed. This is intentional — GoHighLevel automation must be able to read and inject codes into links without knowing the hash. See 09-RESEARCH.md decision D-07.
- **Raw SQL migration**: `npm run db:push` fails in this project because drizzle-kit (CJS bundle) cannot resolve `.js` extension imports used throughout `shared/schema/`. The existing Phase 6 pattern (raw SQL file + tsx runner) was followed instead.
- **count(id)::int cast**: Drizzle's `sql<number>` tag returns strings from PostgreSQL `count()`. The `::int` cast ensures the TypeScript type contract is satisfied at runtime.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] leftJoin and groupBy are NOT importable from drizzle-orm**
- **Found during:** Task 2 implementation
- **Issue:** The plan's Change 1 instructed importing `leftJoin, groupBy` from `drizzle-orm`. These are query builder chain methods, not standalone exports.
- **Fix:** Only added `count` to the drizzle-orm imports; `leftJoin` and `groupBy` are used as method chains on the query builder (as used elsewhere in storage.ts).
- **Files modified:** server/storage.ts
- **Commit:** 9cee918

**2. [Rule 3 - Blocking] npm run db:push fails in this project**
- **Found during:** Task 3 — database migration step
- **Issue:** drizzle-kit (CJS bundle) cannot resolve `.js` ESM extension imports in shared/schema/sales.ts. This is a known pre-existing limitation. The plan said "run npm run db:push" but that command cannot work.
- **Fix:** Created raw SQL migration file `migrations/0032_estimate_views_and_access_code.sql` and runner script `scripts/migrate-estimate-views.ts` following the Phase 6.2 pattern. Migration ran successfully.
- **Files modified:** migrations/0032_estimate_views_and_access_code.sql (created), scripts/migrate-estimate-views.ts (created)
- **Commit:** e1d3253

## Verification

- `npm run check` exits 0 — no TypeScript errors
- DB migration verified: access_code column exists on estimates table; estimate_views table exists in public schema
- All acceptance criteria met for all three tasks

## Known Stubs

None. All data flows are wired end-to-end.
