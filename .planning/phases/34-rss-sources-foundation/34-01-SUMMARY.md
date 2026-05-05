---
phase: 34-rss-sources-foundation
plan: 01
subsystem: database
tags: [drizzle, postgres, supabase, rss, blog, zod, schema]

requires:
  - phase: 21-blog-schema-foundation
    provides: shared/schema/blog.ts co-location pattern + nullableDateInputSchema helper reused here
provides:
  - blog_rss_sources + blog_rss_items SQL tables with cascade FK, status CHECK, dual indexes, RLS
  - Drizzle table definitions blogRssSources + blogRssItems exported via shared/schema.ts barrel
  - Zod insert/select schemas + status enum (blogRssItemStatusSchema)
  - TypeScript types BlogRssSource / InsertBlogRssSource / BlogRssItem / InsertBlogRssItem / BlogRssItemStatus
affects: [34-02 storage layer, 35 fetcher engine, 36 scoring algorithm, 37 admin UI, 38 cron integration]

tech-stack:
  added: []
  patterns:
    - "RSS source registry + parsed-item ledger split (sources own metadata; items hold parse state)"
    - "Status text + CHECK + Zod enum (D-05) — same pattern as v1.5/v1.6, no pgEnum"
    - "Dual-index strategy (regular composite + unique natural key) for hot-path queries + dedupe (D-06)"

key-files:
  created:
    - migrations/0041_create_blog_rss_tables.sql
    - supabase/migrations/20260504150000_create_blog_rss_tables.sql
  modified:
    - shared/schema/blog.ts

key-decisions:
  - "ON DELETE CASCADE on blog_rss_items.source_id (D-01) — matches v1.5/v1.6 cascade pattern"
  - "No auth columns / no score column / status as text+CHECK (D-03/D-04/D-05) — additive-only, forward-compatible"
  - "Dual indexes on items: composite (source_id,status) + UNIQUE (source_id,guid) (D-06)"
  - "Co-locate RSS tables in shared/schema/blog.ts; no new file (D-07)"
  - "Migration mirrored byte-for-byte to migrations/ + supabase/migrations/ (D-09)"

patterns-established:
  - "Idempotent migration scaffolding: BEGIN/COMMIT wrapper + IF NOT EXISTS on every CREATE + DROP/CREATE for RLS policies"
  - "Reuse of nullableDateInputSchema helper across schema modules (do not redefine per file)"

requirements-completed: [RSS-01, RSS-02, RSS-03]

duration: ~3 min
completed: 2026-05-05
---

# Phase 34 Plan 01: RSS Sources Foundation Summary

**Foundation tables and typed contracts for admin-curated RSS feeds + parsed item ledger, ready for Phase 34-02 storage layer to implement IStorage methods.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-05-05T02:07:25Z
- **Completed:** 2026-05-05T02:09:48Z
- **Tasks:** 2/2
- **Files modified:** 3 (2 created, 1 extended)

## Accomplishments

- Two parity SQL migration files (raw + Supabase CLI mirror) at byte-identical 2136 bytes
- `blog_rss_sources` + `blog_rss_items` tables with cascade FK, status CHECK constraint, regular `(source_id,status)` index, UNIQUE `(source_id,guid)` natural-key dedupe, and service_role RLS policies on both tables
- `shared/schema/blog.ts` extended (now 193 lines, well under 600-line ceiling) with Drizzle tables, Zod insert/select schemas, status enum, and TS types — all 11 new symbols flow automatically through the existing `shared/schema.ts` barrel
- `npm run check` green; existing `blogSettings` and `blogGenerationJobs` exports untouched

## Task Commits

Each task was committed atomically:

1. **Task 1: Write SQL migration (raw + Supabase mirror)** — `3f35d80` (feat)
2. **Task 2: Extend shared/schema/blog.ts with RSS Drizzle tables, Zod schemas, and TS types** — `681cf92` (feat)

**Plan metadata commit:** _(pending — created after this SUMMARY.md is written)_

## Files Created/Modified

- `migrations/0041_create_blog_rss_tables.sql` (created, 2136 bytes) — Idempotent DDL for both RSS tables, FK cascade, dual indexes, status CHECK, RLS policies
- `supabase/migrations/20260504150000_create_blog_rss_tables.sql` (created, 2136 bytes) — Byte-for-byte mirror for Supabase CLI parity (D-09)
- `shared/schema/blog.ts` (modified, +94 lines, -1 line) — Added `blogRssSources`, `blogRssItems` Drizzle tables; `BlogRssSource`/`InsertBlogRssSource`/`BlogRssItem`/`InsertBlogRssItem` types; `blogRssItemStatusSchema`; `insertBlogRssSourceSchema`/`selectBlogRssSourceSchema`/`insertBlogRssItemSchema`/`selectBlogRssItemSchema` Zod schemas. Imports updated to add `index` and `uniqueIndex` from drizzle-orm/pg-core.

## New Exports (from shared/schema/blog.ts → barreled by shared/schema.ts)

`blogRssSources`, `blogRssItems`, `BlogRssSource`, `InsertBlogRssSource`, `BlogRssItem`, `InsertBlogRssItem`, `BlogRssItemStatus`, `blogRssItemStatusSchema`, `insertBlogRssSourceSchema`, `selectBlogRssSourceSchema`, `insertBlogRssItemSchema`, `selectBlogRssItemSchema`.

## Decisions Made

All decisions were locked in `34-CONTEXT.md` (D-01, D-03, D-04, D-05, D-06, D-07, D-09). No new in-flight decisions were required.

## Deviations from Plan

None — plan executed exactly as written.

## Verification

- ✅ Both migration files exist at planned paths (2136 bytes each, byte-for-byte identical — verified by inline node parity check)
- ✅ Migration contains: both `CREATE TABLE` statements, `ON DELETE CASCADE`, `blog_rss_items_source_id_status_idx`, `blog_rss_items_source_id_guid_uniq` UNIQUE, `status IN ('pending','used','skipped')` CHECK, `service_role_all_access` RLS policies on both tables, BEGIN/COMMIT wrapper
- ✅ No `auth_type` / `auth_value` / `score` columns
- ✅ `npm run check` passed cleanly (zero TS errors)
- ✅ Literal-grep verifier passed: all 10 expected symbols present in `shared/schema/blog.ts`
- ✅ `nullableDateInputSchema` helper still appears exactly once (not redefined)
- ✅ `shared/schema/blog.ts` is 193 lines (< 600-line CLAUDE.md ceiling)
- ✅ `shared/schema.ts` unchanged (existing `export * from "./schema/blog.js"` re-exports new symbols transparently)

## Note for Plan 34-02

The storage layer can now import all RSS contracts directly from the barrel:

```ts
import {
  blogRssSources,
  blogRssItems,
  type BlogRssSource,
  type InsertBlogRssSource,
  type BlogRssItem,
  type InsertBlogRssItem,
  insertBlogRssSourceSchema,
  insertBlogRssItemSchema,
  blogRssItemStatusSchema,
} from "#shared/schema.js";
```

No further schema work is required for Plan 34-02 to implement the nine `IStorage` methods specified in `34-CONTEXT.md` D-08.

## Self-Check: PASSED

- ✅ FOUND: migrations/0041_create_blog_rss_tables.sql
- ✅ FOUND: supabase/migrations/20260504150000_create_blog_rss_tables.sql
- ✅ FOUND: shared/schema/blog.ts (modified)
- ✅ FOUND: .planning/phases/34-rss-sources-foundation/34-01-SUMMARY.md
- ✅ FOUND commit: 3f35d80 (Task 1)
- ✅ FOUND commit: 681cf92 (Task 2)
