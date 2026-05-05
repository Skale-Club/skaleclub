---
phase: 35-rss-fetcher-and-topic-selection
plan: 02
subsystem: blog-automation
tags: [rss, scoring, topic-selection, blog-generator, drizzle, typescript]

# Dependency graph
requires:
  - phase: 34-rss-sources-foundation
    provides: blog_rss_items table, listPendingRssItems(limit) storage method (DESC NULLS LAST ordering)
provides:
  - Pure scoreItem(item, settings, now?) ranker — D-08 formula (0.6*keywords + 0.4*recency, 14-day window)
  - selectNextRssItem(settings, now?) orchestrator — pulls 50 pending items, scores, returns top or null (D-09)
  - Implicit stable tiebreaker via DB ordering (newer publishedAt wins on score ties)
affects: [35-03 (BlogGenerator integration), 36-generator-quality-overhaul, 37-admin-ux-rss]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure-function scorer separated from storage-aware orchestrator (testability + composability)"
    - "Implicit tiebreak via DB sort + strict > comparison instead of multi-key comparator"
    - "Default Date arg on scoreItem/selectNextRssItem for deterministic test clocks"

key-files:
  created:
    - server/lib/rssTopicSelector.ts
  modified: []

key-decisions:
  - "scoreItem accepts settings (not pre-parsed keywords) and splits internally — call volume is tiny (≤50/run); profile-only optimization deferred"
  - "Empty seoKeywords -> keywordOverlap = 0 (NOT 1, NOT NaN) — no signal beats false signal"
  - "Null publishedAt -> recencyScore = 0 — treat undated items as old"
  - "Strict > on score keeps newer publishedAt as implicit tiebreaker (DB already orders DESC NULLS LAST)"
  - "PENDING_BATCH_SIZE = 50 hard-coded (D-09); not env-configurable in v1.9"
  - "No markRssItemUsed call in selector — that's the generator's job after a successful post create (Plan 35-03)"

patterns-established:
  - "Selector module pattern: pure scoreX() helpers + async selectNextX() orchestrator with deps via storage import"
  - "[rss-selector] log prefix matches existing [cron]/[rss-fetcher] style"

requirements-completed: [RSS-07]

# Metrics
duration: ~5min
completed: 2026-05-05
---

# Phase 35 Plan 02: RSS Topic Selector Summary

**Pure scoring + selection module — `scoreItem` ranker (0.6 * keyword overlap + 0.4 * recency, 14-day window) and `selectNextRssItem` orchestrator that pulls 50 pending items and returns the top scorer or null.**

## Performance

- **Duration:** ~5 min
- **Tasks:** 1
- **Files created:** 1
- **Files modified:** 0
- **Lines added:** 142

## Accomplishments

- `scoreItem(item, settings, now?)` — pure function returning a number in [0, 1] per D-08 formula
- `selectNextRssItem(settings, now?)` — async orchestrator hitting `storage.listPendingRssItems(50)`, returning the top-scored `BlogRssItem` or `null` per D-09
- Empty seoKeywords case handled (returns 0, never NaN)
- Null publishedAt case handled (recency = 0)
- Future-dated items handled (clamped to recency = 1)
- Stable tiebreak via DB ordering + strict `>` comparison
- No side effects beyond a single info log line per selection

## Task Commits

1. **Task 1: Implement scoreItem and selectNextRssItem in server/lib/rssTopicSelector.ts** — `83c5e4f` (feat)

**Plan metadata:** _(pending — final docs commit covers SUMMARY + STATE + ROADMAP)_

## Files Created/Modified

- `server/lib/rssTopicSelector.ts` (NEW, 142 lines) — exports `scoreItem` + `selectNextRssItem`; file-local helpers `parseSeoKeywords`, `scoreKeywordOverlap`, `scoreRecency`; module constants `RECENCY_WINDOW_MS = 14 * 24 * 60 * 60 * 1000`, `KEYWORD_WEIGHT = 0.6`, `RECENCY_WEIGHT = 0.4`, `PENDING_BATCH_SIZE = 50`

## Function Signatures

```typescript
export function scoreItem(
  item: BlogRssItem,
  settings: BlogSettings,
  now: Date = new Date(),
): number;

export async function selectNextRssItem(
  settings: BlogSettings,
  now: Date = new Date(),
): Promise<BlogRssItem | null>;
```

## Decisions Implemented

- **D-08 (scoring):** `0.6 * keywordOverlap + 0.4 * recency`. Keyword overlap = (distinct keywords matching `title + " " + summary` case-insensitively) / max(keywords.length, 1), capped at 1. Recency = `1 - clamp((now - publishedAt) / 14days, 0, 1)`. Empty keyword list → 0. Null publishedAt → 0.
- **D-09 (selection):** `listPendingRssItems(50)` → score each → return top scorer or `null` if empty. Tiebreak via DB ordering (newer `published_at` first).

## Notes for Plan 35-03 (Generator Integration)

The selector is intentionally side-effect-free. Plan 35-03 must wire it into `BlogGenerator.generate()`:

1. **Before** the existing topic prompt to Gemini (and after the standard skip checks `no_settings`/`disabled`/`posts_per_day_zero`/`too_soon`/`locked`):
   ```ts
   const item = await selectNextRssItem(settings);
   if (!item) {
     // RSS-08 skip path
     await storage.createBlogGenerationJob({
       status: "skipped",
       reason: "no_rss_items",
       startedAt: new Date(),
       completedAt: new Date(),
     });
     return { skipped: true, reason: "no_rss_items" };
   }
   ```
2. **Pass** `item.title` and `item.summary` to the Gemini topic prompt (replaces the v1.5 "invent a generic topic" path).
3. **After** `createBlogPost()` succeeds (and ONLY then):
   ```ts
   await storage.markRssItemUsed(item.id, post.id);
   ```
   On generation failure, leave the item `pending` so it can be retried next run.
4. The selector accepts an optional `now: Date` — Plan 35-03 should pass the generator's existing `deps.now()` clock for deterministic time in test/dev runs.

## Decisions Made

See "Decisions Implemented" section above. No deviations from the plan.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Plan 35-01 (parallel — `rssFetcher.ts` + `rss-parser` dep) is in flight; no file overlap
- Plan 35-03 ready to consume `selectNextRssItem` once 35-01 completes (cron wiring depends on the fetcher; generator hookup depends only on this plan)
- No blockers

## Self-Check: PASSED

- File exists: `server/lib/rssTopicSelector.ts` — FOUND (142 lines)
- Both exports present: `scoreItem` (line 83), `selectNextRssItem` (line 112)
- Constants present: `RECENCY_WINDOW_MS`, `KEYWORD_WEIGHT = 0.6`, `RECENCY_WEIGHT = 0.4`, `PENDING_BATCH_SIZE = 50`
- `storage.listPendingRssItems(PENDING_BATCH_SIZE)` call present (line 116)
- Commit `83c5e4f` — FOUND in git log
- `npm run check` — clean

---
*Phase: 35-rss-fetcher-and-topic-selection*
*Plan: 02*
*Completed: 2026-05-05*
