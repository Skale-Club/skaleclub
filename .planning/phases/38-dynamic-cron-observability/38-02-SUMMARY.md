---
phase: 38-dynamic-cron-observability
plan: 02
subsystem: infra
tags: [cron, settimeout, retry, gemini, observability, durations-ms, blog]

# Dependency graph
requires:
  - phase: 38-dynamic-cron-observability
    provides: Plan 38-01 — DurationsMs type + durations_ms JSONB column on blog_generation_jobs
  - phase: 36-generator-quality-overhaul
    provides: withGeminiTimeout wrapper + GeminiTimeoutError/GeminiEmptyResponseError typed errors
  - phase: 22-blog-generator-engine
    provides: D-04 image-failure non-blocking semantics (preserved)
provides:
  - "Recursive setTimeout self-pacing scheduler in server/cron.ts — reads postsPerDay every tick, max(24h/postsPerDay, 60min) clamp, postsPerDay=0 enters poll mode"
  - "withGeminiRetry(label, fn) wrapper composing over withGeminiTimeout with [1s, 5s, 30s] backoff"
  - "isTransientError classifier: GeminiTimeoutError | GeminiEmptyResponseError | ApiError 5xx | ECONNRESET/ETIMEDOUT/ENOTFOUND/'fetch failed'/'socket hang up'/'network'"
  - "All 3 Gemini call sites (topic / post / image) migrated to withGeminiRetry with identical labels"
  - "Per-stage timing capture in runPipeline: { topic, content, image, upload, total } populated via Date.now() deltas"
  - "Failed jobs persist partial DurationsMs via Object.assign(err, { partialDurationsMs }) propagation pattern"
  - "Phase 22 D-04 image-failure non-blocking invariant preserved (image try/catch unchanged)"
affects: [38-03-job-history-breakdown-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Recursive setTimeout self-pacing scheduler with try/catch/finally rescheduling guarantee — replaces setInterval for settings-driven cadence"
    - "Retry wrapper composing over existing timeout wrapper — withGeminiRetry → withGeminiTimeout → run, fresh AbortController per attempt"
    - "Transient-error classifier using instanceof ApiError + .status numeric branch (NOT regex on .message) — survives @google/genai SDK upgrades"
    - "Partial-timing-on-throw via Object.assign(err, { partialDurationsMs }) — preserves stage timings across stack-frame death (Pitfall 2 resolution)"

key-files:
  created: []
  modified:
    - "server/cron.ts"
    - "server/lib/blog-generator.ts"

key-decisions:
  - "RETRY_DELAYS_MS = [1000, 5000, 30000] as readonly number[] — fixed per spec, no jitter, no exponential formula"
  - "Loop bound `for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++)` (4 iterations: 1 initial + 3 retries) — matches spec semantic exactly"
  - "withGeminiRetry re-throws LAST error after exhaustion — preserves typed-error mapping at BlogGenerator.generate catch (gemini_timeout / gemini_empty_response reasons unchanged)"
  - "Image retry happens INSIDE deps.generateImage; existing image try/catch in runPipeline (now lines 359-367) catches the exhaustion-throw — Phase 22 D-04 invariant preserved (Pitfall 6)"
  - "Compaction strategy applied in Task 2 freed 115 lines net (588 → 473) — multi-line destructured signatures collapsed to single-line, single-line one-liner helpers, consolidated import block, redundant comment trims; Task 3 added 51 lines (473 → 524) for timing capture, ending at 524/600 (76-line headroom)"
  - "partialDurationsMs propagation via Object.assign on the thrown error (Pitfall 2 / Open Question 1 RESEARCH recommendation) — outer catch reads it via type-cast access, no signature change to runPipeline or BlogGenerator.generate"
  - "Skipped-job paths (no_settings, disabled, posts_per_day_zero, too_soon, locked, no_rss_items) untouched — they hit early returns BEFORE runPipeline is called, so durationsMs stays NULL via Drizzle insert default"

patterns-established:
  - "Settings-driven cron cadence via recursive setTimeout reading config on every tick — applicable to any future settings-driven scheduler (RSS fetcher migration deferred per D-06)"
  - "Composable Gemini call wrappers: withGeminiRetry composes over withGeminiTimeout — future variants (e.g., withGeminiCircuitBreaker) can layer on transparently"
  - "Partial observability propagation across throw boundaries via Object.assign on the error — pattern reusable for any pipeline that needs to persist partial state on failure"

requirements-completed:
  - BLOG2-14
  - BLOG2-15
  - BLOG2-16

# Metrics
duration: 6min
completed: 2026-05-05
---

# Phase 38 Plan 02: Cron Rescheduler + Gemini Retry + Per-Stage Timing Summary

**Recursive setTimeout scheduler reading postsPerDay every tick, [1s/5s/30s] backoff retry wrapper composing over existing timeout, and per-stage durations_ms capture with partial-on-failure propagation — all under the 600-line CLAUDE.md cap (524/600).**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-05-05T15:31:35Z
- **Completed:** 2026-05-05T15:37:36Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments

- **BLOG2-14 (cron rescheduler):** Replaced `setInterval(BlogGenerator.generate, 60min)` with a `blogTick` recursive `setTimeout` loop in `server/cron.ts`. Each tick lazy-imports `storage`, reads `postsPerDay`, computes `nextIntervalMs = max(24h/postsPerDay, 60min)`, and reschedules in a `finally` block so the loop never silently dies. `postsPerDay = 0` enters a 60min poll mode (no generation, but loop wakes for re-enable). Vercel guard preserved; RSS fetcher `setInterval` block unchanged per D-06 deferred.
- **BLOG2-16 (Gemini retry):** Added `withGeminiRetry(label, fn)` (15 LOC) wrapping `withGeminiTimeout` with `[1000, 5000, 30000]` ms backoff and a precise `isTransientError(err)` classifier (12 LOC). Classifier recognizes `GeminiTimeoutError`, `GeminiEmptyResponseError`, `ApiError` with HTTP status 500-599, and Node network errors (`ECONNRESET`/`ETIMEDOUT`/`ENOTFOUND`/`fetch failed`/`socket hang up`/`network`). 4xx errors never retry (Pitfall 3). Migrated all 3 Gemini call sites: `topic`, `post`, `image<any>` — labels preserved.
- **BLOG2-15 (per-stage timing):** Wrapped each stage in `runPipeline` with `Date.now()` deltas. Successful jobs persist `{ topic, content, image, upload, total }` via `updateBlogGenerationJob`. Image-skipped jobs (Phase 22 D-04 fall-through) leave `durationsMs.image = null`. Failed jobs propagate `partialDurationsMs` through `Object.assign(err, { partialDurationsMs })` so the outer `BlogGenerator.generate` catch persists whatever stages completed (Pitfall 2 resolution).
- **600-line cap respected:** `server/lib/blog-generator.ts` ended at **524 lines** (76-line headroom). Task 2 compaction freed 115 net lines (588 → 473), Task 3 timing capture added 51 lines (473 → 524).

## Task Commits

Each task was committed atomically:

1. **Task 1: Recursive setTimeout scheduler in `server/cron.ts` (BLOG2-14)** — `b4e77e6` (feat)
2. **Task 2: `withGeminiRetry` wrapper + `isTransientError` classifier (BLOG2-16)** — `7675c9b` (feat)
3. **Task 3: Per-stage timing capture in `runPipeline` + partial-on-failure (BLOG2-15)** — `02204f8` (feat)

## Files Created/Modified

- `server/cron.ts` (modified, 38 → 69 lines) — replaced first `setInterval` block with `blogTick`/`getBlogIntervalMs`/`setTimeout`-driven recursive scheduler; second `setInterval` block (RSS fetcher) untouched per D-06.
- `server/lib/blog-generator.ts` (modified, 588 → 524 lines) — added `ApiError` import from `@google/genai`, added `DurationsMs` to type imports, added `RETRY_DELAYS_MS` constant + `isTransientError` predicate + `withGeminiRetry` wrapper after `withGeminiTimeout`, migrated 3 call sites from `withGeminiTimeout("...", ...)` → `withGeminiRetry("...", ...)`, restructured `runPipeline` body inside a `try/catch` with `tStart` + `partial: Partial<DurationsMs>` outer-scope tracker + per-stage `Date.now()` deltas + success-path `durationsMs` write + catch-path `Object.assign(err, { partialDurationsMs })` propagation, updated `BlogGenerator.generate` failed-path `updateBlogGenerationJob` call to read and persist `partialDurationsMs`.

## Decisions Made

- **`RETRY_DELAYS_MS: readonly number[] = [1000, 5000, 30000]`** — exact spec backoff, no jitter, no exponential formula derivation. Loop bound `attempt = 0..3` inclusive (4 iterations: 1 initial + 3 retries) matches spec exactly; on `attempt === RETRY_DELAYS_MS.length` (4th try failed), throws without sleeping.
- **Image retry exhaustion-throw caught by existing image try/catch (now lines 359-367 in `runPipeline`).** Did NOT move the catch boundary — Phase 22 D-04 image-failure non-blocking semantics preserved (Pitfall 6). Worst-case image delay after exhaustion: 4 × 30s timeout + 36s backoff ≈ 156s, acceptable per CONTEXT D-03.
- **`partialDurationsMs` via `Object.assign` on thrown error (RESEARCH Open Question 1 recommendation).** Avoids restructuring `runPipeline` signature or hoisting timing accumulator into `BlogGenerator.generate` outer scope. The `runPipeline` outer catch assembles `{ ...partial, total: Date.now() - tStart }` and attaches it; the outer catch in `BlogGenerator.generate` reads via type-cast.
- **Skipped-job early returns hit BEFORE `runPipeline` is called** (`no_settings` / `disabled` / `posts_per_day_zero` / `too_soon` / `no_rss_items` / `locked`). These paths never throw — they return cleanly with no error to attach `partialDurationsMs` to, so the inserted `blog_generation_jobs` row leaves `durationsMs` NULL via Drizzle insert default. Matches D-04 spec exactly without explicit handling.
- **Compaction strategy in Task 2 freed 115 lines net** by collapsing multi-line destructured-parameter type signatures into single-line declarations (the 5+ `function foo({ a, b, c }: { a: A; b: B; c: C }): R` heads were on 6 lines each; compacting saved ~5 lines × 5 functions = 25 lines), unifying the previously-split type imports into a single statement (saved 7 lines), inlining one-line bodies (`getCadenceWindowMs`, `buildSlug`, test-deps setters), and trimming Phase 36 historical comments to single-line rationale. Phase 36-03 strategies 1-3 remained untouched (template literals, prompt strings, `defaultStorage` shorthand) — slack budget preserved for future phases.
- **`as DurationsMs | undefined` cast on the failed-path `updateBlogGenerationJob` call** is intentional. The JSONB column accepts any object shape, and the executor is deliberately writing a `Partial<DurationsMs>` for failed jobs (per D-04: "populate whatever stages completed"). The cast is a documented escape hatch, not type-laundering.

## Deviations from Plan

None - plan executed exactly as written.

The plan's revision-2 compaction guidance proved conservative — Task 2 landed at 473 lines (target ≤ 555, actual 82 lines under target). This left 127 lines of headroom for Task 3, more than the ~50-LOC additions required, so no Task 3 compaction trim was needed (524 final / 600 cap = 76-line headroom).

## Issues Encountered

- LF→CRLF git warnings on Windows for both modified files (informational only — `core.autocrlf` operating as configured). No action required.

## User Setup Required

None - no external service configuration required for this plan.

(Plan 38-01's user-setup remains: user must run `npx tsx scripts/migrate-blog-durations-ms.ts` post-merge once to add the `durations_ms` column to local/dev DB. Production application is via Supabase migrations pipeline.)

## Next Phase Readiness

- **38-03 (JobHistoryPanel expand-on-click breakdown):** unblocked. `durations_ms` is now populated by every completed run (and partially by failed runs that started executing stages). The frontend can rely on `BlogGenerationJobWithRssItem.durationsMs: DurationsMs | null`, where `null` means a skipped job (early-return path) and a populated object means the run reached `runPipeline`. The `image: number | null` field inside the object signals image-stage gracefully-skipped (Phase 22 D-04) vs successfully-generated.
- **Manual UAT items unblocked** (per Phase 38 VALIDATION.md):
  - BLOG2-14: `npm run dev` → admin sets `postsPerDay = 24` → next-tick log shows `interval=60min` (clamp); change to 2 → next tick logs `interval=720min` (12h)
  - BLOG2-15: trigger Generate Now → preview → Save → `SELECT durations_ms FROM blog_generation_jobs ORDER BY id DESC LIMIT 1` shows 5-key object
  - BLOG2-16: mock Gemini to throw 503 once → console logs show retry at 1s; post still saves
  - D-03 (Phase 22 D-04 invariant): mock image API to throw 3× → post saves with `featureImageUrl: null` and `console.warn` is logged
- No blockers.

## Self-Check: PASSED

Verification (all checks ran in this conversation, all green):

- `server/cron.ts` modified ✓ (69 lines, ≤ 100 cap)
- `server/lib/blog-generator.ts` modified ✓ (524 lines, ≤ 600 cap)
- Commit `b4e77e6` (Task 1) found in git log ✓
- Commit `7675c9b` (Task 2) found in git log ✓
- Commit `02204f8` (Task 3) found in git log ✓
- `npm run check` exits 0 ✓
- `grep -q "function blogTick" server/cron.ts` ✓
- `grep -q "MIN_BLOG_INTERVAL_MS" server/cron.ts` ✓
- `grep -q "Math.max(DAY_IN_MS / settings.postsPerDay, MIN_BLOG_INTERVAL_MS)" server/cron.ts` ✓
- `grep -q "setTimeout(blogTick, nextMs)" server/cron.ts` ✓
- `grep -q "process.env.VERCEL" server/cron.ts` ✓
- `grep -q "function withGeminiRetry" server/lib/blog-generator.ts` ✓
- `grep -q "function isTransientError" server/lib/blog-generator.ts` ✓
- `grep -q 'RETRY_DELAYS_MS: readonly number\[\] = \[1000, 5000, 30000\]' server/lib/blog-generator.ts` ✓
- `grep -q 'import { ApiError } from "@google/genai"' server/lib/blog-generator.ts` ✓
- `grep -c "withGeminiRetry" server/lib/blog-generator.ts` returns 4 (≥ 4: 1 declaration + 3 call sites) ✓
- `grep -c 'withGeminiTimeout("' server/lib/blog-generator.ts` returns 0 (all 3 call sites migrated) ✓
- `grep -q "const tStart = Date.now()" server/lib/blog-generator.ts` ✓
- `grep -q "partialDurationsMs" server/lib/blog-generator.ts` ✓
- `grep -q "console.warn(\`Blog generator image pipeline failed; continuing without feature image:" server/lib/blog-generator.ts` ✓ (Phase 22 D-04 invariant preserved)

---
*Phase: 38-dynamic-cron-observability*
*Completed: 2026-05-05*
