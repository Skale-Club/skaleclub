---
phase: 35-rss-fetcher-and-topic-selection
plan: 03
subsystem: blog-automation
tags: [rss, cron, blog-generator, integration, gemini, vercel-cron]

# Dependency graph
requires:
  - phase: 35-rss-fetcher-and-topic-selection
    plan: 01
    provides: fetchAllRssSources() orchestrator + FetchSummary contract
  - phase: 35-rss-fetcher-and-topic-selection
    plan: 02
    provides: selectNextRssItem(settings, now?) -> BlogRssItem | null
  - phase: 34-rss-sources-foundation
    plan: 02
    provides: storage.listPendingRssItems / storage.markRssItemUsed
provides:
  - Hourly setInterval cron tick for fetchAllRssSources (Vercel-guarded)
  - POST /api/blog/cron/fetch-rss endpoint with CRON_SECRET Bearer auth
  - BlogGenerator pipeline now RSS-driven — picks item before Gemini, marks used after createBlogPost
  - New SkipReason 'no_rss_items' recorded in blog_generation_jobs when queue empty
affects: [36-generator-quality-overhaul, 37-rss-admin-ui, 38-dynamic-cron-frequency]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-interval startCron(): one Vercel guard, two independent setIntervals (generator + fetcher)"
    - "Cron endpoint pair: /api/blog/cron/generate + /api/blog/cron/fetch-rss share isAuthorizedCronRequest middleware"
    - "RSS gating sits BETWEEN too_soon and acquireLock in the skip chain (preserves existing order, adds one new reason)"
    - "Non-fatal markRssItemUsed try/catch — post creation success is the contract; mark failure logs and continues"

key-files:
  created: []
  modified:
    - server/cron.ts
    - server/routes/blogAutomation.ts
    - server/lib/blog-generator.ts

key-decisions:
  - "Two independent setInterval calls under one Vercel guard (D-03) — each cron job owns its own lifecycle, no scheduling coupling"
  - "Selector + skip job recording happen BEFORE acquireLock (D-09, D-10) — empty queue must not consume the lock or hit Gemini"
  - "markRssItemUsed wrapped in try/catch (warn-only) — preserves the contract that 'post creation succeeded' is the source of truth even if the mark step fails transiently"
  - "Both Gemini prompts (topic + post) receive rssItem.title/summary as context; the post prompt also gets rssItem.url — pt-BR enforcement and HTML validation deferred to Phase 36 per CONTEXT scope"
  - "BlogGeneratorStorage Pick<IStorage,…> extended (not duplicated) with listPendingRssItems + markRssItemUsed — keeps the testable storage surface narrow"

patterns-established:
  - "[rss-fetcher] cron prefix matches existing [cron] / [rss-selector] log convention"
  - "Cron endpoints under /api/blog/cron/* gated uniformly by isAuthorizedCronRequest"
  - "Skip chain order: no_settings -> disabled -> posts_per_day_zero -> too_soon -> no_rss_items -> locked"

requirements-completed: [RSS-06, RSS-07, RSS-08]

# Metrics
duration: 3min
completed: 2026-05-05
---

# Phase 35 Plan 03: Cron + Endpoint + Generator Integration Summary

**Wires Wave 1 (rssFetcher.ts) and Wave 2 (rssTopicSelector.ts) into the running system — hourly setInterval, POST /api/blog/cron/fetch-rss endpoint, and a BlogGenerator pipeline that picks an RSS item before Gemini and marks it used after createBlogPost succeeds.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-05-05T02:41:28Z
- **Completed:** 2026-05-05T02:44:35Z
- **Tasks:** 2
- **Files modified:** 3 (0 created, 3 modified)
- **Net diff:** +112 lines / -10 lines across the three files

## Accomplishments

- `server/cron.ts` (+15 lines) — second `setInterval` (60min, Vercel-guarded) calls `fetchAllRssSources` and logs `sources=N upserted=M errors=K`; existing blog-generator interval untouched
- `server/routes/blogAutomation.ts` (+14 lines) — `POST /api/blog/cron/fetch-rss` mirrors `/cron/generate` shape: 401 on auth fail, 200 with `FetchSummary` JSON on success, 500 with `{ error }` on throw
- `server/lib/blog-generator.ts` (+83 / -9 lines, 495 → 568, still under 600-line cap):
  - New imports: `BlogRssItem` type + `selectNextRssItem` orchestrator
  - `SkipReason` union extended with `'no_rss_items'` (now 6 members)
  - `BlogGeneratorStorage` extended with `listPendingRssItems` and `markRssItemUsed`; `defaultStorage` forwards via lazy `getStorage()`
  - `BlogGenerator.generate()` calls `selectNextRssItem(settings, now)` AFTER the `too_soon` check and BEFORE `acquireLock` (D-09 placement)
  - Null path inserts a `blog_generation_jobs` row with `status='skipped', reason='no_rss_items', startedAt=now, completedAt=now` and returns `{ skipped: true, reason: 'no_rss_items' }` — Gemini is never invoked, lock is never acquired
  - Non-null path threads `rssItem` through `runPipeline → generateTopic → generatePost`; both Gemini prompts now reference `rssItem.title` + `rssItem.summary` (post prompt also gets `rssItem.url`)
  - After `createBlogPost` succeeds, `markRssItemUsed(rssItem.id, post.id)` runs inside try/catch — failure logs `[blog-generator] markRssItemUsed failed for item N: …` but does NOT throw (post is already created)
  - On `runPipeline` throw (anywhere before `markRssItemUsed`), the existing failure handler runs and the item stays `pending` for natural retry on the next tick

## Task Commits

1. **Task 1: Wire fetcher into cron.ts and register POST /api/blog/cron/fetch-rss** — `cd634c0` (feat)
2. **Task 2: Integrate selectNextRssItem into BlogGenerator pipeline** — `df83b55` (feat)

**Plan metadata:** _pending_ (final docs commit recorded after this SUMMARY)

## New Code Paths

### Path A — Hourly fetcher (non-Vercel)
```
startCron() (server/cron.ts)
  └─ setInterval(60min)
       └─ fetchAllRssSources()  ← Plan 35-01 module
            └─ console.log("[rss-fetcher] cron tick: sources=N upserted=M errors=K")
```

### Path B — Vercel-cron fetcher endpoint
```
POST /api/blog/cron/fetch-rss
  └─ isAuthorizedCronRequest(req)  ← _shared.ts (Bearer ${CRON_SECRET})
       └─ 401 OR fetchAllRssSources() → res.json(summary)
```

### Path C — Generator with RSS gating (manual + scheduled)
```
BlogGenerator.generate({ manual })
  ├─ getBlogSettings()                  → no_settings (skip)
  ├─ enabled?                           → disabled (skip)
  ├─ postsPerDay > 0?                   → posts_per_day_zero (skip)
  ├─ shouldSkipTooSoon?                 → too_soon (skip)
  ├─ selectNextRssItem(settings, now)   ── NEW
  │    └─ null? → createBlogGenerationJob(skipped, 'no_rss_items') → return  ── NEW (NO Gemini)
  ├─ acquireLock                        → locked (skip)
  ├─ createBlogGenerationJob(running)
  └─ runPipeline({ ..., rssItem })      ── NEW (rssItem threaded)
       ├─ generateTopic({ ..., rssItem })   ← prompt references rssItem.title/summary
       ├─ generatePost({ ..., rssItem })    ← prompt references rssItem.title/summary/url
       ├─ generateImage / uploadImage (unchanged)
       ├─ createBlogPost(postInput)
       └─ markRssItemUsed(rssItem.id, post.id)  ── NEW (try/catch, warn-only)
```

## SkipReason Union (after this plan)

```typescript
type SkipReason =
  | "no_settings"
  | "disabled"
  | "posts_per_day_zero"
  | "too_soon"
  | "locked"
  | "no_rss_items";  // NEW — recorded in blog_generation_jobs.reason
```

The new `no_rss_items` reason is recorded with `status='skipped'` so Phase 37 admin UI can surface "no RSS items pending — add a source" guidance.

## Skip Chain Order Confirmation

Original chain (preserved byte-identical):
1. `no_settings` (line 446)
2. `disabled` (line 450, gated by `!manual`)
3. `posts_per_day_zero` (line 454, gated by `!manual`)
4. `too_soon` (line 458, gated by `!manual`)
5. **`no_rss_items`** ← NEW (line 462–470, runs always, including manual)
6. `locked` (line 472)

Placement rationale (from PLAN.md): `no_rss_items` runs after `too_soon` (a too-soon manual run shouldn't even score items) and before `acquireLock` (don't acquire a lock if there's nothing to do). The check is NOT gated by `!manual` — manual runs also need an RSS item to operate on (D-09 mandates the selector is the only topic source post-v1.5).

## Decisions Implemented

- **D-03 (cron strategy):** Two paths — `setInterval` outside Vercel + `POST /api/blog/cron/fetch-rss` for Vercel cron — both gated by the same `process.env.VERCEL` check pattern (one early return; two intervals on the non-Vercel branch).
- **D-09 (selector integration):** `selectNextRssItem(settings, now)` runs in `BlogGenerator.generate()` BEFORE `acquireLock` and BEFORE any Gemini call. The picked `rssItem` is threaded through `runPipeline → generateTopic → generatePost` so both prompts can reference it.
- **D-10 (skip path):** When `selectNextRssItem` returns `null`, a `blog_generation_jobs` row is inserted with `status='skipped'`, `reason='no_rss_items'`, `startedAt=now`, `completedAt=now`. The function returns `{ skipped: true, reason: 'no_rss_items' }`. No lock is acquired. No Gemini API is invoked. No image is generated.
- **D-11 (file layout):** Only the three planned files were touched (`server/cron.ts`, `server/routes/blogAutomation.ts`, `server/lib/blog-generator.ts`). Wave 1 outputs (`rssFetcher.ts`, `rssTopicSelector.ts`) are read-only consumers from this plan's perspective.
- **D-12 (Bearer auth):** `POST /api/blog/cron/fetch-rss` reuses the existing `isAuthorizedCronRequest` helper from `server/routes/_shared.ts` — same Bearer-token pattern as `/api/blog/cron/generate`, no new env var introduced.

## Files Modified

- `server/cron.ts` — 25 → 39 lines. Added `import { fetchAllRssSources } from "./lib/rssFetcher.js"` and a second `setInterval` block inside `startCron()`. The Vercel-guard early return at the top of the function unchanged; both intervals share that single guard.
- `server/routes/blogAutomation.ts` — 70 → 84 lines. Added `import { fetchAllRssSources } from "../lib/rssFetcher.js"` and the new route between `/cron/generate` and `/jobs/latest`. The `_shared.ts` import line unchanged (already exposed `isAuthorizedCronRequest`).
- `server/lib/blog-generator.ts` — 495 → 568 lines. Five surgical edits per Plan 35-03 §Task 2 — type imports, `SkipReason` union extension, `BlogGeneratorStorage` Pick extension + `defaultStorage` forwarding, generator pipeline insertion (selector + skip-row + acquireLock unchanged), and prompt threading.

## Decisions Made

See "Decisions Implemented" above. No new decisions beyond the locked D-03/D-09/D-10/D-11/D-12 set in CONTEXT.md.

## Deviations from Plan

None — plan executed exactly as written. Every acceptance criterion from `35-03-PLAN.md` is satisfied:

- ✅ `server/cron.ts` imports `fetchAllRssSources`; two `setInterval` calls inside `startCron()` under one Vercel guard
- ✅ Fetcher setInterval body wraps `await fetchAllRssSources()` in try/catch — never throws out of the callback
- ✅ `POST /api/blog/cron/fetch-rss` registered between `/cron/generate` and `/jobs/latest`; gated by `isAuthorizedCronRequest`; returns `FetchSummary` JSON on success and `{ error }` 500 on throw
- ✅ `BlogRssItem` + `selectNextRssItem` imported in blog-generator.ts
- ✅ `SkipReason` union has 6 members including `"no_rss_items"`
- ✅ `BlogGeneratorStorage` extended with `listPendingRssItems` + `markRssItemUsed`; `defaultStorage` forwards both via `getStorage()`
- ✅ `selectNextRssItem(settings, now)` called AFTER `too_soon` check and BEFORE `acquireLock`
- ✅ Null path: `createBlogGenerationJob({ status: 'skipped', reason: 'no_rss_items', startedAt: now, completedAt: now })` and returns `{ skipped: true, reason: 'no_rss_items' }`; Gemini NEVER invoked
- ✅ Non-null path: `runPipeline({ ..., rssItem })` receives the item; both Gemini prompts reference `rssItem.title` + `rssItem.summary` (post prompt also `rssItem.url`)
- ✅ `markRssItemUsed(rssItem.id, post.id)` called after `createBlogPost` success in try/catch — non-fatal warning on failure
- ✅ Existing skip chain (`no_settings`, `disabled`, `posts_per_day_zero`, `too_soon`, `locked`) preserved byte-identical in original order
- ✅ `npm run check` clean after both tasks
- ✅ `server/lib/blog-generator.ts` at 568 lines (under 600-line CLAUDE.md cap)
- ✅ No new files created

## Issues Encountered

None. All three storage methods (`listPendingRssItems`, `markRssItemUsed`, `createBlogGenerationJob`) already existed on `IStorage` from earlier phases (34-02, 22-02). The Pick extension and lazy forwarding were drop-in additions — no signature mismatches, no type cast needed. Both per-task `npm run check` runs were clean on first compile.

## User Setup Required

None for the application code. Operational follow-ups for this plan to deliver value end-to-end:

1. **CRON_SECRET env var:** Already provisioned in v1.5 (re-used by `/api/blog/cron/generate`). No new value needed.
2. **Vercel cron schedule:** The user's `vercel.json` should add a cron entry for `POST /api/blog/cron/fetch-rss` (recommended `0 * * * *` — hourly). This is deploy-pipeline config, NOT application code, so it's outside this plan's scope.
3. **Seed RSS sources:** Until `blog_rss_sources` has at least one `enabled=true` row, the generator will skip every run with `reason='no_rss_items'`. Phase 37 will ship the admin UI to populate sources; for v1.9 dev-testing, seed via SQL or `storage.upsertRssSource`.

## Notes for Phase 36 (Generator Quality Overhaul)

- The Gemini prompts in `generateTopicWithGemini` and `generatePostWithGemini` are now RSS-aware (they reference `rssItem.title` / `summary` / `url`), but they remain ENGLISH-only. Phase 36 owns:
  - pt-BR enforcement (system instruction + language guard)
  - Strict-tag HTML validation (whitelist sanitizer on the `content` field)
  - Improved excerpt / focus-keyword quality
- The plumbing is in place: any prompt evolution in Phase 36 is a string-replacement inside the existing two helpers — no signature changes needed downstream.

## Notes for Phase 37 (Admin RSS UI)

- The new skip reason `'no_rss_items'` is now persisted in `blog_generation_jobs.reason`. The admin job-history view should add a row-level pill ("Empty RSS queue") when this reason appears, with a CTA linking to the source-management screen.
- The fetcher endpoint `POST /api/blog/cron/fetch-rss` returns the full `FetchSummary` JSON. Phase 37's "Fetch now" admin button should hit this endpoint server-side (not via the public route — admin should authenticate via session + a server-to-server fetch with the CRON_SECRET) and surface `summary.itemsUpserted` + `summary.errors[]` in toast/banner UI.

## Notes for Phase 38 (Dynamic Cron Frequency)

- The fetcher's hourly `setInterval` is hard-coded in `server/cron.ts`. Phase 38 may want to make this configurable per-source (`fetch_interval_minutes` column on `blog_rss_sources`?) — but at that scale you'd also want a job queue rather than a fixed interval. Defer that decision until source count grows.
- The generator's existing `posts_per_day` setting already drives generator cadence via `shouldSkipTooSoon`. The fetcher cadence and generator cadence are intentionally decoupled — keep them so.

## Next Phase Readiness

- ✅ Phase 35 plans 3/3 complete; all phase-level success criteria from CONTEXT.md satisfied
- ✅ RSS-05, RSS-06, RSS-07, RSS-08 all marked complete (35-01 → RSS-05, 35-02 → RSS-07 partial, 35-03 → RSS-06 + RSS-07 + RSS-08)
- ✅ Phase 36 (generator quality) and Phase 37 (admin UI) can both run in parallel — they touch different files (prompts vs admin React components) and the integration contract above is stable
- ✅ No blockers

## Self-Check: PASSED

- ✅ FOUND: `server/cron.ts` (39 lines) — `fetchAllRssSources` import + second `setInterval`
- ✅ FOUND: `server/routes/blogAutomation.ts` (84 lines) — `fetchAllRssSources` import + `/api/blog/cron/fetch-rss` route
- ✅ FOUND: `server/lib/blog-generator.ts` (568 lines) — `selectNextRssItem` import + `'no_rss_items'` skip path + `markRssItemUsed` call
- ✅ FOUND: commit `cd634c0` (Task 1 — cron + endpoint)
- ✅ FOUND: commit `df83b55` (Task 2 — generator integration)
- ✅ `npm run check` clean across the repo
- ✅ All grep verifications pass: `fetchAllRssSources` in cron.ts + blogAutomation.ts; `/api/blog/cron/fetch-rss` in blogAutomation.ts; `no_rss_items` + `selectNextRssItem` + `markRssItemUsed` in blog-generator.ts

---
*Phase: 35-rss-fetcher-and-topic-selection*
*Plan: 03*
*Completed: 2026-05-05*
