---
phase: 38-dynamic-cron-observability
plan: 03
subsystem: ui
tags: [react, admin, blog, observability, durations-ms, expand-on-click, tailwind, lucide]

# Dependency graph
requires:
  - phase: 38-dynamic-cron-observability
    provides: Plan 38-01 — DurationsMs type + durations_ms JSONB column on blog_generation_jobs
  - phase: 38-dynamic-cron-observability
    provides: Plan 38-02 — runPipeline writes per-stage timings (success path) + partialDurationsMs propagation (failure path)
  - phase: 37-admin-ux-rss-job-improvements
    provides: GET /api/blog/jobs endpoint + JobHistoryPanel skeleton (Plan 37-02 + 37-03)
provides:
  - "Server BlogGenerationJobWithRssItem interface inherits durationsMs from BlogGenerationJob via $inferSelect (no explicit redeclaration)"
  - "Both listBlogGenerationJobs and getBlogGenerationJobWithRssItem SELECT projections include durationsMs: blogGenerationJobs.durationsMs"
  - "5 new translation keys (Topic / Content / Image / Total / Stage timings) in pt-BR — Upload / Started / Completed / Source item reused"
  - "JobHistoryPanel.tsx expand-on-click row UI per CONTEXT D-05: total chip in collapsed view, 5-cell breakdown grid in expanded view"
  - "Per-job toggle state via useState<Set<number>>; multiple rows can be expanded simultaneously; persists across query refetches within mount"
  - "Action buttons (Retry/Cancel) use stopPropagation so clicks don't toggle row expansion"
  - "Pre-Phase-38 historical rows (durationsMs=null) stay non-clickable — no chevron, no chip, no cursor change"
  - "Image cell in breakdown grid renders em-dash (—) when durationsMs.image is null (Phase 22 D-04 invariant surfaces correctly)"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Drizzle explicit-projection extension: when adding a new column to a table that has an explicit `.select({ ... })` projection, the projection must be augmented or the field silently disappears at the join boundary"
    - "Expand-on-click row with stopPropagation isolation for action buttons — pattern reusable for any list row with both clickable surface and inline actions"
    - "Single-line consolidated translation keys (Phase 37-03 compaction strategy 4) — multiple `'key': 'value',` pairs on one line keep file under 600-line cap"

key-files:
  created: []
  modified:
    - "server/storage.ts"
    - "client/src/lib/translations.ts"
    - "client/src/components/admin/blog/JobHistoryPanel.tsx"

key-decisions:
  - "Server interface left unchanged — durationsMs propagates via `extends BlogGenerationJob` (post-38-01 $inferSelect); only the SELECT projections needed augmentation"
  - "Total chip uses one-decimal seconds format (`(ms / 1000).toFixed(1)`) — matches RESEARCH Open Question 2 recommendation; raw ms only shown in expanded breakdown"
  - "Expanded breakdown grid uses 5 columns regardless of image-skip state — Image cell renders em-dash inline (RESEARCH canonical JSX)"
  - "Multiple rows can be expanded simultaneously via Set<number> state; React state survives refetches but resets on unmount (acceptable per CONTEXT D-05)"
  - "Action-button container stopPropagation is on the wrapper div, not on each Button — single isolation point covers both Retry and Cancel"

patterns-established:
  - "Drizzle explicit-projection augmentation: paired SELECT projections in list/get methods MUST be updated together — no implicit propagation from $inferSelect when explicit projection narrows the columns"
  - "Conditional-clickable row: `cursor-pointer` class + onClick handler both gated on the same `hasDurations` boolean — prevents misleading hover state on non-interactive rows"

requirements-completed:
  - BLOG2-15

# Metrics
duration: 5min
completed: 2026-05-05
---

# Phase 38 Plan 03: JobHistoryPanel Stage-Timing Breakdown Summary

**Admin Job History rows now show a `⏱ {n.n}s` total chip in the collapsed view and an expand-on-click 5-cell breakdown grid (Topic / Content / Image / Upload / Total) for every job whose `durationsMs` JSONB is populated — completing the BLOG2-15 admin-facing surface.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-05-05T15:42:30Z
- **Completed:** 2026-05-05T15:46:57Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- **Server projection extension:** Added `durationsMs: blogGenerationJobs.durationsMs,` to BOTH explicit SELECT projections in `server/storage.ts` (`listBlogGenerationJobs` line 2243, `getBlogGenerationJobWithRssItem` line 2280). The `BlogGenerationJobWithRssItem` interface itself needed no field — `extends BlogGenerationJob` (post-38-01 `$inferSelect`) propagates `durationsMs: DurationsMs | null` automatically. A rationale comment was added above the interface to document the inheritance contract for future readers.
- **Translation keys:** Added 5 new pt-BR keys to `client/src/lib/translations.ts` line 434 in single-line consolidated format: `Topic` → `Pauta`, `Content` → `Conteúdo`, `Image` → `Imagem`, `Total` → `Total`, `Stage timings` → `Tempos por etapa`. Existing keys (`Upload`, `Started`, `Completed`, `Source item`) reused — no TS2300 duplicate-identifier failure. File: 443 → 444 lines (156 lines under 600 cap).
- **JobHistoryPanel UI:** Replaced the row JSX block in `client/src/components/admin/blog/JobHistoryPanel.tsx` with the canonical expand-on-click pattern from RESEARCH:
  - Outer div is conditionally `cursor-pointer` based on `hasDurations`
  - Chevron icon (`ChevronRight` collapsed / `ChevronDown` expanded) renders only when `durationsMs !== null`
  - Total chip (`⏱ {n.n}s` via `(durationsMs.total / 1000).toFixed(1)`) appears in the badge row beside the existing Started/Completed timestamps
  - Action-buttons container has `onClick={(e) => e.stopPropagation()}` so Retry/Cancel never toggle the row
  - Expanded view renders a `grid grid-cols-5 gap-2 text-xs` with raw-ms values; Image cell renders `—` when `durationsMs.image === null` (Phase 22 D-04 image-skip path surfaces correctly)
  - State held in `useState<Set<number>>(new Set())` with a `toggleExpanded(id)` helper using immutable Set updates
  - File: 225 → 293 lines (307 lines under 600 cap)
- `npm run check` exits 0 after each task and at plan close.

## Task Commits

Each task was committed atomically:

1. **Task 1: Storage interface comment + 2× SELECT projection augmentation** — `5254396` (feat)
2. **Task 2: 5 translation keys** — `773fbf2` (feat)
3. **Task 3: Expand-on-click row + total chip + breakdown grid** — `77fc992` (feat)

## Files Created/Modified

- `server/storage.ts` (modified, 3133 → 3140 lines, +7) — Added rationale comment block above `BlogGenerationJobWithRssItem` and added `durationsMs: blogGenerationJobs.durationsMs,` line to BOTH explicit SELECT projections (`listBlogGenerationJobs` and `getBlogGenerationJobWithRssItem`). The `getBlogGenerationJob(id)` bare-select method needed no edit — Drizzle returns all columns when no explicit projection is given.
- `client/src/lib/translations.ts` (modified, 443 → 444 lines, +1) — Added 5 pt-BR translation keys (Topic / Content / Image / Total / Stage timings) on a single new line below the existing blog-admin section.
- `client/src/components/admin/blog/JobHistoryPanel.tsx` (modified, 225 → 293 lines, +68 net / +142 -74) — Imported `useState` from React + `ChevronDown` / `ChevronRight` from lucide-react; extended the local `BlogGenerationJobWithRssItem` interface with the `durationsMs: { topic, content, image: number|null, upload, total } | null` shape; added `expandedIds` Set state + `toggleExpanded(id)` helper; rewrote the `(jobs ?? []).map(...)` block to use the canonical expand-on-click pattern (chevron + chip in collapsed; 5-cell grid in expanded; `cursor-pointer` and onClick gated on `hasDurations`).

## Decisions Made

- **Interface inheritance over explicit redeclaration.** Per Plan 38-01's `$inferSelect` propagation, `BlogGenerationJob` already includes `durationsMs: DurationsMs | null`, so `BlogGenerationJobWithRssItem extends BlogGenerationJob` inherits the field for free. No explicit `durationsMs:` declaration was added to the interface body. A rationale comment was added above the declaration to make this contract self-documenting.
- **Two-projection augmentation is the only required server edit.** Drizzle's explicit `.select({ ... })` returns ONLY listed fields, so adding the column to the schema (Plan 38-01) without touching the projections would silently strip the field from REST responses. The `getBlogGenerationJob(id)` method (bare `db.select()`) needs no edit since it returns all columns by default.
- **Field ordering in projections preserved per source-of-truth shape.** `durationsMs` placed AFTER `error` and BEFORE `rssItemTitle` in BOTH projections — keeps the order matching `BlogGenerationJob`'s natural shape (status/reason/postId/startedAt/completedAt/error/durationsMs) before the join-derived fields (rssItemTitle/rssItemId).
- **Single-line consolidated translation keys.** Phase 37-03's compaction strategy 4 — multiple `'key': 'value',` pairs on one line — applied: 5 new keys took 1 new line (433 → 434), keeping `translations.ts` at 444 lines (156 lines under 600 cap). No format regressions; matches the surrounding lines (424, 433).
- **Set<number> over individual booleans for expanded state.** Cleaner than maintaining N booleans in state (one per job) and supports multi-row expansion natively. `toggleExpanded` uses immutable `new Set(prev)` updates for React's reference-change-detection.
- **stopPropagation on the action-buttons wrapper, not per-button.** Single isolation point covers both Retry and Cancel buttons regardless of which is currently rendered. The wrapper div already exists for layout (`shrink-0 flex flex-col gap-1`) — adding `onClick={(e) => e.stopPropagation()}` to it is a one-line edit.

## Phase 22 D-04 Invariant Verification

Phase 22 D-04 (image-failure non-blocking) requires that posts save successfully even when image generation fails. After Phase 38-02, this manifests in the `durationsMs` shape as `image: null` while the rest of the timings are populated. This UI surfaces that null correctly:

```tsx
<div>{job.durationsMs.image !== null ? `${job.durationsMs.image}ms` : "—"}</div>
```

The em-dash (NOT a hyphen) renders inline in the grid's Image cell, distinguishing "image stage gracefully skipped" from "image stage took 0ms" (which would render `0ms`). The remaining 4 cells (Topic / Content / Upload / Total) render their numeric values normally — the column-level `durationsMs` is non-null because the run reached `runPipeline`.

## Deviations from Plan

None — plan executed exactly as written.

The plan's `tdd="true"` flag on Task 3 was acknowledged but not actionable: per CLAUDE.md project constraints ("Manual QA only — No test framework available"), the project has no test runner configured, so the RED/GREEN/REFACTOR cycle cannot produce meaningful test artifacts. Implementation followed the plan's `<behavior>` block as the de-facto acceptance contract; verification is via `npm run check` (the only automated gate) plus the manual UAT items listed in `.planning/phases/38-dynamic-cron-observability/38-VALIDATION.md`. No structural deviation from the plan's action specification.

## Issues Encountered

- LF→CRLF git warnings on Windows for the two modified client files (informational only — `core.autocrlf` operating as configured). No action required.

## User Setup Required

None — no external service configuration required for this plan.

(Plan 38-01's user-setup remains: user must run `npx tsx scripts/migrate-blog-durations-ms.ts` post-merge once to add the `durations_ms` column to local/dev DB. Production application is via Supabase migrations pipeline. Without that migration, the `GET /api/blog/jobs` endpoint will return `durationsMs: undefined` for every row and the chip/breakdown UI will simply not render — degraded gracefully, no errors.)

## Next Phase Readiness

- **Phase 38 complete.** All 3 plans shipped:
  - 38-01: `durations_ms` column foundation (BLOG2-15 schema)
  - 38-02: cron rescheduler (BLOG2-14) + Gemini retry (BLOG2-16) + per-stage timing capture (BLOG2-15)
  - 38-03: admin Job History breakdown UI (BLOG2-15 admin-facing) ← THIS PLAN
- **Manual UAT remains** per `.planning/phases/38-dynamic-cron-observability/38-VALIDATION.md`:
  - BLOG2-14: admin postsPerDay change → next-tick cron interval reschedule (Plan 38-02)
  - BLOG2-15: Generate Now → admin Job History → confirm `⏱ 12.4s` chip in collapsed row → click row → confirm 5-cell breakdown grid → confirm pt-BR labels (Pauta / Conteúdo / Imagem / Total / Tempos por etapa)
  - BLOG2-15 negative path: pre-Phase-38 historical row (durationsMs=null) → confirm no chevron, no chip, no cursor change, click does nothing
  - BLOG2-15 stopPropagation: failed row with Retry button → click Retry → confirm row does NOT also expand
  - BLOG2-15 image-skip path: trigger Phase 22 D-04 (image gen fails 3×) → confirm Image cell renders `—` (em-dash) in expanded breakdown
  - BLOG2-16: mock Gemini 503 → console retry log at 1s; post still saves
- **Phase 38 readiness for `/gsd:verify-work`:** all 3 SUMMARY files present, all `requirements-completed` arrays populated (BLOG2-14 / BLOG2-15 / BLOG2-16), `npm run check` clean.

## Self-Check: PASSED

Verification (all checks ran in this conversation, all green):

- `server/storage.ts` modified ✓ (interface comment + 2× projection lines)
- `grep -c "durationsMs: blogGenerationJobs.durationsMs," server/storage.ts` returns 2 ✓
- `client/src/lib/translations.ts` modified ✓ (444 lines, ≤ 600 cap)
- `grep -c "'Upload':" client/src/lib/translations.ts` returns 1 (no duplicate; baseline preserved) ✓
- All 5 new keys present (`Topic`, `Content`, `Image`, `Total`, `Stage timings`) ✓
- `client/src/components/admin/blog/JobHistoryPanel.tsx` modified ✓ (293 lines, ≤ 600 cap)
- `useState<Set<number>>` present at line 57 ✓
- `function toggleExpanded` present at line 59 ✓
- `ChevronDown` and `ChevronRight` imported and used ✓
- `(job.durationsMs.total / 1000).toFixed(1)` chip format present at line 212 ✓
- `grid grid-cols-5 gap-2` breakdown layout present at line 263 ✓
- `onClick={(e) => e.stopPropagation()}` action-buttons isolation present at line 233 ✓
- `t("Topic")` / `t("Content")` / `t("Image")` / `t("Upload")` / `t("Total")` all present (lines 265, 269, 273, 277, 281) ✓
- `EmptyState`, `STATUS_TO_BADGE_VARIANT`, `isStaleRunning`, `retryMutation.mutate`, `cancelMutation.mutate` all preserved ✓
- Commit `5254396` (Task 1) found in git log ✓
- Commit `773fbf2` (Task 2) found in git log ✓
- Commit `77fc992` (Task 3) found in git log ✓
- `npm run check` exits 0 ✓

---
*Phase: 38-dynamic-cron-observability*
*Completed: 2026-05-05*
