---
phase: 34-rss-sources-foundation
plan: 02
subsystem: storage
tags: [storage, drizzle, postgres, rss, blog, istorage]

requires:
  - phase: 34-rss-sources-foundation
    plan: 01
    provides: blogRssSources + blogRssItems Drizzle tables, types, and Zod schemas via #shared/schema.js barrel
provides:
  - 9 IStorage method declarations (listRssSources, getRssSource, createRssSource, updateRssSource, deleteRssSource, upsertRssItem, listPendingRssItems, markRssItemUsed, markRssItemSkipped)
  - DatabaseStorage implementations for all 9 methods using Drizzle (no raw SQL)
  - upsertRssItem race-safe dedupe via .onConflictDoUpdate({ target: [sourceId, guid] }) against the UNIQUE INDEX from Plan 01
affects: [35 fetcher engine, 36 scoring algorithm, 37 admin UI, 38 cron integration]

tech-stack:
  added: []
  patterns:
    - "Drizzle .onConflictDoUpdate against natural-key UNIQUE INDEX for idempotent upsert (matches v1.6 Hub participant pattern)"
    - "sql template for `published_at DESC NULLS LAST` ordering (Drizzle desc() helper does not expose nulls ordering)"
    - "Explicit-verb mutations (markRssItemUsed/markRssItemSkipped) — never a generic update path (D-08)"

key-files:
  created: []
  modified:
    - server/storage.ts

key-decisions:
  - "upsertRssItem refreshes only url/title/summary/publishedAt on conflict; never touches status/usedAt/usedPostId/skipReason — preserves operator intent"
  - "deleteRssSource relies entirely on FK ON DELETE CASCADE from Plan 01 (no manual child-row cleanup)"
  - "listPendingRssItems uses sql`${col} DESC NULLS LAST` template instead of desc(col) — Drizzle's desc() helper does not surface NULLS ordering"
  - "All 9 methods inserted between getLatestBlogGenerationJob and getHubLives, preserving existing file order"

patterns-established:
  - "RSS storage method block placement: directly after blog generation jobs and before hub live methods in both IStorage and DatabaseStorage"
  - "Conflict-update field whitelist (url/title/summary/publishedAt) is the canonical safe-refresh set for re-parsed RSS entries"

requirements-completed: [RSS-04]

duration: ~2 min
completed: 2026-05-05
---

# Phase 34 Plan 02: RSS Storage Layer Summary

**9 IStorage methods declared and implemented on DatabaseStorage so Phase 35's fetcher and Phase 37's admin UI can persist RSS sources and items through typed Drizzle queries — no raw SQL, no generic update paths.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-05-05T02:13:01Z
- **Completed:** 2026-05-05T02:14:58Z
- **Tasks:** 2/2
- **Files modified:** 1 (`server/storage.ts`, +115 lines)

## Accomplishments

- **9 typed methods** added to `IStorage` and implemented on `DatabaseStorage`, exactly per CONTEXT.md §D-08:

| # | Method | Behavior |
|---|--------|----------|
| 1 | `listRssSources(): Promise<BlogRssSource[]>` | Returns all sources ordered by `created_at` DESC |
| 2 | `getRssSource(id): Promise<BlogRssSource \| undefined>` | Single-row lookup; `undefined` (not throw) when missing |
| 3 | `createRssSource(input): Promise<BlogRssSource>` | Inserts and returns the row including auto-assigned id, timestamps, and default `enabled=true` |
| 4 | `updateRssSource(id, patch): Promise<BlogRssSource \| undefined>` | Patches supplied keys + bumps `updatedAt`; `undefined` if id missing |
| 5 | `deleteRssSource(id): Promise<void>` | Deletes the source; FK CASCADE drops child items (D-01) |
| 6 | `upsertRssItem(item): Promise<BlogRssItem>` | Race-safe upsert keyed on `(source_id, guid)` |
| 7 | `listPendingRssItems(limit?): Promise<BlogRssItem[]>` | Filters `status='pending'`, orders by `published_at DESC NULLS LAST`, optional limit |
| 8 | `markRssItemUsed(itemId, postId): Promise<void>` | Atomically sets `status='used'`, `usedAt=now()`, `usedPostId=postId` |
| 9 | `markRssItemSkipped(itemId, reason?): Promise<void>` | Sets `status='skipped'`; writes `skip_reason` when provided |

- **`upsertRssItem` confirmed idempotent** via `.onConflictDoUpdate({ target: [blogRssItems.sourceId, blogRssItems.guid], set: { url, title, summary, publishedAt } })` — concurrent inserts of the same `(sourceId, guid)` cannot fail with a UNIQUE violation. Conflict path refreshes metadata only and never overwrites `status`, `usedAt`, `usedPostId`, or `skipReason`.
- **No generic `updateRssItem` exists** — D-08 mandate honored. Mutations to item state go exclusively through `markRssItemUsed` and `markRssItemSkipped`.
- **`npm run check` passed cleanly** (zero TS errors) after Task 2 closed the interface/class gap intentionally opened by Task 1.

## Task Commits

Each task was committed atomically:

1. **Task 1: Declare RSS methods on IStorage and add Drizzle imports** — `90e89f0` (feat)
2. **Task 2: Implement the 9 RSS methods on DatabaseStorage** — `458ecda` (feat)

**Plan metadata commit:** _(pending — created after this SUMMARY.md is written)_

## Files Modified

- `server/storage.ts` (+115 lines, -0 lines) — Added value imports for `blogRssSources`/`blogRssItems`; added type imports for `BlogRssSource`/`InsertBlogRssSource`/`BlogRssItem`/`InsertBlogRssItem`; declared 9 methods on `IStorage` interface (lines ~700–710); implemented 9 methods on `DatabaseStorage` (lines ~2034–2131). No other code touched.

## Decisions Made

All decisions were locked in `34-CONTEXT.md` (D-08 method signatures, D-01 cascade reliance, D-06 unique-index dedupe). No new in-flight decisions were required during execution.

## Deviations from Plan

None — plan executed exactly as written.

## Verification

- ✅ `npm run check` passed cleanly (zero TS errors)
- ✅ Literal-grep verifier confirmed all 9 method declarations inside `IStorage` block and all 9 implementations inside `DatabaseStorage` class
- ✅ `upsertRssItem` contains `onConflictDoUpdate` and targets `[blogRssItems.sourceId, blogRssItems.guid]`
- ✅ `listPendingRssItems` includes `NULLS LAST` ordering and conditional `.limit()`
- ✅ `markRssItemUsed` writes `status: "used"`; `markRssItemSkipped` writes `status: "skipped"`
- ✅ `deleteRssSource` does NOT manually delete child items (relies on FK cascade per D-01)
- ✅ `grep -n "updateRssItem\b"` returns zero matches — no generic update path exists
- ✅ Drizzle `sql` helper was already imported on line 124, no new imports needed beyond the schema additions
- ✅ Only `server/storage.ts` modified — `shared/schema/blog.ts` and `shared/schema.ts` untouched

## Note for Phase 35 (Fetcher Engine)

The fetcher should call:
- `upsertRssItem(...)` per parsed feed entry (idempotent against the UNIQUE index, safe under concurrent runs)
- `updateRssSource(id, { lastFetchedAt: new Date(), lastFetchedStatus: "ok"|"error", errorMessage: null|string })` after each feed pass to record the operational outcome

Phase 36 (scoring) consumes `listPendingRssItems(limit)` to read candidates, computes scores in-memory (D-04: no `score` column), then calls `markRssItemUsed(itemId, postId)` for the winner and `markRssItemSkipped(itemId, reason?)` for any items the operator drops.

Phase 37 (admin UI) calls the full CRUD set: `listRssSources`, `getRssSource`, `createRssSource`, `updateRssSource`, `deleteRssSource`.

## Self-Check

- ✅ FOUND: server/storage.ts (modified)
- ✅ FOUND commit: 90e89f0 (Task 1)
- ✅ FOUND commit: 458ecda (Task 2)
- ✅ FOUND: .planning/phases/34-rss-sources-foundation/34-02-SUMMARY.md (this file)

## Self-Check: PASSED
