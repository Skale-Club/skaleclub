---
phase: 38-dynamic-cron-observability
plan: 01
subsystem: database
tags: [drizzle, postgres, jsonb, zod, migration, blog]

# Dependency graph
requires:
  - phase: 21-blog-schema-storage-foundation
    provides: blog_generation_jobs table (BLOG-04)
  - phase: 34-rss-sources-foundation
    provides: byte-identical mirrored migration pattern (D-09)
provides:
  - "Nullable durations_ms JSONB column on blog_generation_jobs"
  - "DurationsMs type exported from shared/schema/blog.ts (z.infer single source of truth)"
  - "Drizzle column wired with $type<DurationsMs>() so $inferInsert/$inferSelect propagate the new field to storage with zero edits"
  - "Insert/select Zod schemas accept the new field (insert: nullable+optional; select: nullable)"
  - "tsx migration runner mirroring Phase 31 canonical template — user runs npx tsx scripts/migrate-blog-durations-ms.ts after merge"
affects: [38-02-cron-rescheduler-and-retry, 38-03-job-history-breakdown-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Drizzle JSONB with $type<T>() and no .notNull/.default for nullable observability columns"
    - "z.infer<typeof schema> as Drizzle generic source of truth (Pitfall 4 mitigation)"

key-files:
  created:
    - "migrations/0042_blog_jobs_durations_ms.sql"
    - "supabase/migrations/20260505120000_blog_jobs_durations_ms.sql"
    - "scripts/migrate-blog-durations-ms.ts"
  modified:
    - "shared/schema/blog.ts"

key-decisions:
  - "DurationsMs derived from Zod via z.infer — single source of truth between Drizzle generic and runtime validation (Pitfall 4)"
  - "durations_ms column is purely additive: nullable, no default — skipped jobs stay NULL per D-04"
  - "Migration mirrored byte-for-byte at supabase/migrations/20260505120000_*.sql per Phase 34 D-09"
  - "Storage layer signature changes are zero-edit — Drizzle $inferInsert propagates the new field to server/storage.ts and server/lib/blog-generator.ts automatically"

patterns-established:
  - "Phase 38 observability columns: nullable JSONB with typed shape, populated by application code, never required at insert"
  - "Mirror raw-SQL migration to supabase/migrations/{YYYYMMDDHHMMSS}_*.sql byte-for-byte (Phase 34 D-09 enforcement)"

requirements-completed:
  - BLOG2-15

# Metrics
duration: 6min
completed: 2026-05-05
---

# Phase 38 Plan 01: durations_ms Foundation Summary

**Additive nullable JSONB column on blog_generation_jobs with z.infer-derived DurationsMs type, byte-identical Supabase mirror, and Phase 31-template tsx migration runner — zero-edit storage propagation via Drizzle $inferInsert.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-05-05T15:23:44Z
- **Completed:** 2026-05-05T15:28:27Z
- **Tasks:** 3
- **Files modified:** 4 (3 created, 1 modified)

## Accomplishments

- Created `migrations/0042_blog_jobs_durations_ms.sql` and its byte-identical Supabase mirror at `supabase/migrations/20260505120000_blog_jobs_durations_ms.sql` (idempotent via `ADD COLUMN IF NOT EXISTS`, nullable, no default).
- Created `scripts/migrate-blog-durations-ms.ts` mirroring the Phase 31 canonical template (32 lines, `pool.connect()` → `client.query(sql)` → `information_schema.columns` verification → `pool.end()` cleanup).
- Extended `shared/schema/blog.ts` with `durationsMsSchema` Zod object, `DurationsMs = z.infer<typeof durationsMsSchema>` type alias, and `durationsMs: jsonb("durations_ms").$type<DurationsMs>()` column on `blogGenerationJobs`. Added `durationsMs` to both `insertBlogGenerationJobSchema` (nullable + optional) and `selectBlogGenerationJobSchema` (nullable).
- `npm run check` exits 0 across server, client, and shared. File length: 209/600 lines (well under cap).

## Task Commits

Each task was committed atomically:

1. **Task 1: SQL migration file + Supabase mirror** - `c620b22` (feat)
2. **Task 2: tsx migration runner script** - `67440fd` (feat)
3. **Task 3: Drizzle column + DurationsMs type + Zod schema additions** - `8879353` (feat)

## Files Created/Modified

- `migrations/0042_blog_jobs_durations_ms.sql` (new) — `ALTER TABLE blog_generation_jobs ADD COLUMN IF NOT EXISTS durations_ms JSONB` wrapped in `BEGIN/COMMIT`.
- `supabase/migrations/20260505120000_blog_jobs_durations_ms.sql` (new) — byte-identical Supabase mirror (D-09 enforcement; `diff` exits 0).
- `scripts/migrate-blog-durations-ms.ts` (new) — tsx runner that reads the SQL via `readFileSync` and executes through the project's pg pool with column-level verification.
- `shared/schema/blog.ts` (modified) — added `jsonb` to imports, exported `durationsMsSchema` + `DurationsMs` type, added `durationsMs` JSONB column to `blogGenerationJobs`, threaded the new field through both insert and select Zod schemas.

## Decisions Made

- **Source of truth = Zod.** `DurationsMs = z.infer<typeof durationsMsSchema>` ensures the Drizzle generic and runtime validation never drift (RESEARCH Pitfall 4 mitigation).
- **No defaults on the column.** D-04 spec: skipped jobs leave `durations_ms` NULL; completed jobs populate the full object; failed jobs populate the stages that completed before failure. Adding a default would defeat all three semantics.
- **Image stage nullable inside the object.** `image: z.number().int().nonnegative().nullable()` — `null` represents "image generation skipped" (Phase 22 D-04 carries forward), distinct from the column-level NULL that represents "no stages ran".
- **Storage layer untouched.** Drizzle `$inferInsert/$inferSelect` propagates the field automatically to `server/storage.ts` and `server/lib/blog-generator.ts` — no edits needed there. Phase 38-02 will write to `durationsMs` through the same `createBlogGenerationJob` / `updateBlogGenerationJob` signatures used today.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed missing npm dependencies before Task 2 typecheck**
- **Found during:** Task 2 verification (`npm run check`)
- **Issue:** `npm run check` failed with `Cannot find module 'sanitize-html'` and `Cannot find module 'rss-parser'` — both packages are declared in `package.json` (`sanitize-html@^2.17.3` + `@types/sanitize-html@^2.16.1` from Phase 36; `rss-parser@^3.13.0` from Phase 35) but the local `node_modules/` had not been synced. Pure environment drift; not caused by my changes.
- **Fix:** Ran `npm install` at the project root. Lockfile already present, so the install was a no-op for `package-lock.json`; only `node_modules/` was populated.
- **Files modified:** None (no source/lockfile changes; only `node_modules/` populated)
- **Verification:** `npm run check` exits 0 after install
- **Committed in:** N/A — environment fix only, no source changes

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Pure environment fix unblocking the only automated gate (`npm run check`). No scope creep, no behavior change.

## Issues Encountered

- LF→CRLF git warnings on Windows for the new files (informational only — `core.autocrlf` operating as configured). No action required.

## User Setup Required

**Manual database step (deferred to user post-merge):**

```bash
npx tsx scripts/migrate-blog-durations-ms.ts
```

The migration is idempotent (`ADD COLUMN IF NOT EXISTS`) and additive — running it on a database that already has the column is a no-op. Set `DATABASE_URL` (or `POSTGRES_URL`) in the local `.env` before running. Production application is via Supabase migrations pipeline (mirror file already in place).

## Next Phase Readiness

- **38-02 (cron rescheduler + Gemini retry + per-stage timing capture):** unblocked. `DurationsMs` is importable from `#shared/schema.js`; `createBlogGenerationJob` / `updateBlogGenerationJob` accept the new field with zero storage edits required.
- **38-03 (JobHistoryPanel expand-on-click breakdown):** unblocked at the type level — `BlogGenerationJobWithRssItem` inherits `durationsMs: DurationsMs | null` from Drizzle `$inferSelect`. The DB column will be populated only after 38-02 ships, so 38-03 must handle the `null` case gracefully (collapsed view shows existing fields when `durationsMs` is null; expand chevron + breakdown only render when populated).
- No blockers.

## Self-Check: PASSED

Verification (all checks ran in this conversation, all green):
- `migrations/0042_blog_jobs_durations_ms.sql` exists ✓
- `supabase/migrations/20260505120000_blog_jobs_durations_ms.sql` exists ✓
- `diff` between the two SQL files exits 0 (byte-identical mirror) ✓
- `scripts/migrate-blog-durations-ms.ts` exists ✓
- Commit `c620b22` (Task 1) found in git log ✓
- Commit `67440fd` (Task 2) found in git log ✓
- Commit `8879353` (Task 3) found in git log ✓
- `npm run check` exits 0 ✓
- `wc -l shared/schema/blog.ts` = 209 (≤ 600 cap) ✓

---
*Phase: 38-dynamic-cron-observability*
*Completed: 2026-05-05*
