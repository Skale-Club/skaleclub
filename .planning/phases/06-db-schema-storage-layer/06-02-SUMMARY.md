---
phase: 06-db-schema-storage-layer
plan: "02"
subsystem: database

tags: [drizzle, postgresql, jsonb, typescript, storage, estimates, migration]

# Dependency graph
requires:
  - phase: 06-01
    provides: shared/schema/estimates.ts with Drizzle pgTable + Zod types + barrel export
provides:
  - Six typed CRUD methods on DatabaseStorage: listEstimates, getEstimate, getEstimateBySlug, createEstimate, updateEstimate, deleteEstimate
  - estimates table in PostgreSQL (id, client_name, slug, note, services jsonb, created_at, updated_at)
  - RLS enabled on estimates table with service_role_all_access policy
  - SQL migration file at migrations/0031_create_estimates.sql (idempotent)
affects:
  - 07-api-routes
  - 08-admin-ui
  - 09-public-viewer

# Tech tracking
tech-stack:
  added: []
  patterns:
    - DatabaseStorage CRUD pattern: listX (desc createdAt), getX(id), getXBySlug, createX (insert+returning), updateX (set+updatedAt+returning), deleteX
    - Direct SQL migration via tsx script as fallback when drizzle-kit push fails on Windows (CJS/.js extension issue)

key-files:
  created:
    - migrations/0031_create_estimates.sql
    - scripts/create-estimates-table.ts
  modified:
    - server/storage.ts

key-decisions:
  - "Used direct SQL migration (not npm run db:push) — drizzle-kit CJS loader cannot resolve ESM .js extension imports in cross-schema files on Windows (pre-existing issue)"
  - "Included estimates import alongside cherry-picked 06-01 schema files in same commit since worktree branch was behind dev"

patterns-established:
  - "Estimates storage: six methods follow portfolioServices naming convention exactly (getEstimate, getEstimateBySlug vs getPortfolioService, getPortfolioServiceBySlug)"

requirements-completed: [EST-01, EST-02]

# Metrics
duration: 15min
completed: 2026-04-19
---

# Phase 6 Plan 02: Storage Layer Summary

**Six typed DatabaseStorage CRUD methods for estimates + estimates table created in PostgreSQL via idempotent SQL migration**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-19T21:10:00Z
- **Completed:** 2026-04-19T21:25:00Z
- **Tasks:** 2
- **Files modified:** 3 (server/storage.ts, migrations/0031_create_estimates.sql, scripts/create-estimates-table.ts)

## Accomplishments

- Added `estimates` table import + `Estimate`/`InsertEstimate` type imports to `server/storage.ts`
- Implemented all six CRUD methods on `DatabaseStorage` following the `portfolioServices` pattern exactly
- Created the `estimates` table in the live PostgreSQL database with JSONB `services` column, unique `slug`, and RLS
- Documented the `db:push` CJS failure and applied idempotent SQL migration as a workaround

## Task Commits

Each task was committed atomically:

1. **Task 1: Add estimates CRUD methods to DatabaseStorage** - `dec0f6f` (feat)
2. **Task 2: Create estimates table via SQL migration** - `6612398` (feat)

## Files Created/Modified

- `server/storage.ts` - Added estimates import, Estimate/InsertEstimate types, and six CRUD methods before closing `}` of DatabaseStorage
- `migrations/0031_create_estimates.sql` - Idempotent SQL migration creating estimates table with RLS
- `scripts/create-estimates-table.ts` - tsx runner that applied the migration to the live database

## Decisions Made

- Direct SQL migration used instead of `npm run db:push` because drizzle-kit's CJS module loader cannot resolve `./auth.js` style ESM imports in cross-schema TypeScript files on Windows. This is a pre-existing project issue (not introduced in this plan). The SQL migration achieves the same result and is idempotent.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] drizzle-kit push fails; used direct SQL migration instead**
- **Found during:** Task 2 (Run Drizzle migration)
- **Issue:** `npm run db:push` (and `npx drizzle-kit push` directly) fails with `Cannot find module './auth.js'` — drizzle-kit's CJS loader resolves ESM-style `.js` extension imports literally and cannot find the file. This affects `shared/schema/sales.ts` (which imports `./auth.js`) when drizzle-kit loads the schema directory. The same issue occurs with `shared/schema.ts` barrel file (which re-exports from `./schema/auth.js`).
- **Fix:** Created `migrations/0031_create_estimates.sql` (idempotent `CREATE TABLE IF NOT EXISTS` with RLS) and `scripts/create-estimates-table.ts` (tsx runner). Ran the migration directly with `POSTGRES_URL=...port 5432... npx tsx scripts/create-estimates-table.ts`. Table confirmed present in `pg_tables`.
- **Files modified:** migrations/0031_create_estimates.sql, scripts/create-estimates-table.ts
- **Verification:** tsx script confirmed `estimates table exists in public schema` via `pg_tables` query.
- **Committed in:** `6612398` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking — drizzle-kit CJS/ESM resolution failure on Windows)
**Impact on plan:** The `estimates` table was created and verified. The drizzle-kit issue is pre-existing and affects future plans too — Phase 7+ should use the same SQL migration pattern or fix the drizzle.config.ts resolution approach.

## Issues Encountered

- Worktree branch (`worktree-agent-ac266753`) was behind `dev` and didn't have the 06-01 schema files. Cherry-picked commits `4ee68e4` and `ba9b8b3` (06-01 feat commits) into the worktree before proceeding.
- drizzle-kit CJS resolution issue documented above.

## Known Stubs

None — all six methods are fully implemented with real database queries.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `storage.estimates` methods are fully typed and callable from route handlers
- `estimates` table exists in the live PostgreSQL database with RLS enabled
- Phase 7 (Admin API Routes) can import `storage.listEstimates()`, `storage.createEstimate()`, etc. with full TypeScript inference
- Note: For future migrations, use the SQL migration pattern (`scripts/create-*.ts`) rather than `npm run db:push` until the drizzle-kit CJS/ESM resolution issue is fixed

---
*Phase: 06-db-schema-storage-layer*
*Completed: 2026-04-19*
