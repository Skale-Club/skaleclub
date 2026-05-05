# Phase 38: Dynamic Cron & Observability - Context

**Gathered:** 2026-05-05
**Status:** Ready for planning
**Mode:** Recommended defaults selected by user (`do recommended`) — all 4 gray areas resolved

<domain>
## Phase Boundary

Make the auto-post system production-ready along three dimensions:
1. **Adaptive scheduling** — cron interval is `24h / postsPerDay` (clamped to ≥ 60min); changing `postsPerDay` in admin reschedules on the next tick without redeploy.
2. **Per-stage observability** — every completed `blog_generation_jobs` row carries `durationsMs` JSONB with `{ topic, content, image, upload, total }`; admin job history surfaces the breakdown.
3. **Resilient Gemini calls** — transient errors (timeouts, 5xx, network) retry with exponential backoff `[1s, 5s, 30s]` per call site; only a final failure after the third attempt marks the job failed.

Touches: `server/cron.ts`, `server/lib/blog-generator.ts`, `shared/schema/blog.ts`, `migrations/`, `client/src/components/admin/blog/JobHistoryPanel.tsx` (small expand-on-click addition).

OUT OF SCOPE: changes to RSS fetcher cron cadence (still 60min — separate concern), changes to non-Gemini retries (DB writes, image upload to Supabase already have their own paths), structured logging to external sinks (Phase 38 uses `console.log` with stable shape only).

</domain>

<decisions>
## Implementation Decisions

### Cron Rescheduling Mechanism

- **D-01:** Replace `setInterval` in `startCron()` with a **recursive `setTimeout` self-pacing loop**. Each tick reads the current `postsPerDay` from `getBlogSettings()`, computes `nextIntervalMs = max(24h / postsPerDay, 60min)`, runs the generator, then `setTimeout(tick, nextIntervalMs)`. If `postsPerDay = 0`, schedules a 60min poll (no generation) so the loop wakes back up if the admin re-enables.
  - **Why:** Cleanest pattern. No `clearInterval` race. Settings changes take effect on the very next tick — no separate watcher loop, no double-scheduling. Works identically for fetcher cron if we choose to migrate it later.
  - **Vercel:** `if (process.env.VERCEL) return;` guard stays — Vercel still uses `POST /api/blog/cron/generate` triggered by `vercel.json` schedule (which we'll update to match the dynamic interval admin set, OR document that Vercel cron is currently fixed at the deployed schedule and the dynamic feature is non-Vercel-only — researcher to confirm Vercel cron capability).

### Retry Wrapper Placement

- **D-02:** Add a new `withGeminiRetry(label, fn)` wrapper that **wraps `withGeminiTimeout` internally** and applies the `[1s, 5s, 30s]` backoff on transient errors. The 3 existing call sites in `blog-generator.ts` (topic / content / image) change from `withGeminiTimeout("topic", ...)` to `withGeminiRetry("topic", ...)`.
  - **Transient error classifier:** retry on `GeminiTimeoutError`, `GeminiEmptyResponseError`, network errors (ECONNRESET / ETIMEDOUT / fetch failed), and HTTP 5xx responses. Do NOT retry on 4xx (auth, quota, malformed prompt) — those are permanent.
  - **Why:** Smallest blast radius. Each Gemini call gets retry transparently. Existing timeout semantics preserved. New wrapper composes — easy to remove later if approach changes.
  - **Naming:** keep `withGeminiTimeout` as-is; new helper sits beside it. Both stay in `blog-generator.ts` (already 588 lines — net add ~30 lines after replacing 3 call-site names; researcher to confirm we stay under 600).

### Image Failure Under Retry

- **D-03:** Image generation gets the **full `[1s, 5s, 30s]` retry treatment**, but Phase 22 D-04's non-blocking semantics remain unchanged: if all 3 retries fail, the post still saves with `featureImageUrl: null` and a `console.warn` describing the failure.
  - **Why:** Spec explicitly says "transient Gemini errors retry with backoff per call site" — image is one of those call sites. Retrying first is the correct behavior; falling through to non-blocking after exhaustion preserves the v1.5 product invariant ("a draft must always save when content + topic succeed"). User-perceived delay on a fully-failing image: ~36s (1+5+30 + 3× timeout) — acceptable for a background cron job.

### `durationsMs` Schema + Population

- **D-04:** Add `durations_ms` JSONB column to `blog_generation_jobs` via raw-SQL tsx migration (v1.2 D-04 pattern). Shape: `{ topic: number, content: number, image: number | null, upload: number, total: number }` (image is `null` when feature image was not generated; numbers are integer ms). Populated by `runPipeline` using `Date.now()` deltas around each stage.
  - **Skipped jobs:** `durations_ms` stays `NULL` (no stages ran). Existing skip reasons (`disabled`, `too_soon`, `no_rss_items`, `lock_held`) are unaffected.
  - **Failed jobs:** populate whatever stages completed before the failure (e.g., `{topic: 1200, content: 8500}` if image errored).
  - **Migration:** raw-SQL tsx script + Supabase mirror (v1.2 D-04 / Phase 34 D-01 pattern).

### Admin Display of `durationsMs`

- **D-05:** `JobHistoryPanel.tsx` (Phase 37) gets an **expand-on-click row** that reveals the per-stage breakdown when admin clicks the row. Collapsed view shows the existing fields plus a single new `total` chip ("⏱ 12.4s"). Expanded view shows a small inline table: `topic | content | image | upload | total` in ms or seconds.
  - **Why:** Spec says "admin job history surfaces the breakdown" — chip alone doesn't cut it. Expand-on-click keeps the list compact while making the breakdown discoverable. Reuses the row pattern; no new modal.
  - **Touch scope on JobHistoryPanel.tsx:** ~30 lines (add expand state + collapsed/expanded conditional). Stays under 600-line cap (currently 225 lines).

### Plan Topology

- **D-06:** Three plans (one per requirement, dependency-ordered):
  - **38-01:** `durations_ms` migration + schema + storage shape (foundation, no behavior change)
  - **38-02:** Recursive `setTimeout` rescheduler in `cron.ts` + `withGeminiRetry` wrapper in `blog-generator.ts` + per-stage timing capture + retry classifier (the bulk of the work — backend logic)
  - **38-03:** `JobHistoryPanel` expand-on-click breakdown (frontend touch — depends on 38-01 column existing in DB)
  - Wave 1: 38-01 (alone). Wave 2: 38-02. Wave 3: 38-03. Strict dependency chain — no parallel waves.

### Claude's Discretion

- Exact transient-error classifier predicate (e.g., regex on error message, instanceof checks, HTTP status if accessible from `@google/genai` SDK errors) — researcher to investigate the SDK's error surface.
- Whether `total` chip uses ms or "human" format (`12.4s` vs `12400ms`) — Claude's call during planning; will pick whichever matches the existing chip style in JobHistoryPanel.
- Vercel cron behavior: if `vercel.json` schedule is fixed at deploy time, document the dynamic feature as "node runtime only" in PROJECT.md and treat Vercel cron as a manual override. Researcher to confirm.
- Whether to migrate the RSS fetcher cron to the same recursive-setTimeout shape now (consistency) or leave it on `setInterval` (smaller diff). Default: leave it for now — Phase 38 does not own the fetcher.

### Folded Todos

None — `todo match-phase 38` returned 0 matches.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Specification
- `.planning/ROADMAP.md` §"Phase 38: Dynamic Cron & Observability" — goal, success criteria, requirement IDs
- `.planning/REQUIREMENTS.md` BLOG2-14, BLOG2-15, BLOG2-16 — acceptance criteria

### Prior-Phase Context (load order)
- `.planning/phases/22-blog-generator-engine/22-CONTEXT.md` — D-04 (image failure non-blocking) carries forward
- `.planning/phases/36-generator-quality-overhaul/36-CONTEXT.md` — D-07 (`withGeminiTimeout` via Promise.race + AbortController) is the wrapper we extend
- `.planning/phases/36-generator-quality-overhaul/36-03-SUMMARY.md` — current shape of `withGeminiTimeout` and 3 call sites
- `.planning/phases/37-admin-ux-rss-job-improvements/37-03-SUMMARY.md` — `JobHistoryPanel.tsx` location + structure (where the expand-on-click row goes)

### Existing Code Touchpoints
- `server/cron.ts` (38 lines) — current `startCron()` with two `setInterval` blocks
- `server/lib/blog-generator.ts` (588 lines, 12 line headroom under 600 cap) — `withGeminiTimeout` at line 149; 3 call sites at lines 213, 233, 248
- `shared/schema/blog.ts` lines 44–57 — `blogGenerationJobs` table schema (where `durationsMs` column gets added)
- `client/src/components/admin/blog/JobHistoryPanel.tsx` (225 lines) — Phase 37 component that needs the breakdown UI
- `migrations/` + `supabase/migrations/` — raw-SQL tsx mirror pattern (Phase 34 D-01)

### Vercel
- `vercel.json` — confirm whether cron schedule is fixed at deploy time and what fields control it
- Vercel docs on cron jobs (researcher to fetch if dynamic schedule isn't supported declaratively)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`withGeminiTimeout`** (`blog-generator.ts:149-166`): existing Promise.race + AbortController wrapper. New `withGeminiRetry` wraps this transparently — no rewrite, no behavior loss.
- **`getBlogSettings()`**: already returns `postsPerDay`. Recursive scheduler reads this on every tick — no new storage method needed.
- **`Date.now()` deltas**: idiomatic in this codebase; `runPipeline` already runs the stages sequentially, so wrapping each call site with `start = Date.now()` / `durations.topic = Date.now() - start` is mechanical.
- **Raw-SQL tsx migration pattern** (v1.2 D-04, Phase 34 D-01): `npx tsx scripts/migrate-XX-name.ts` reads `process.env.DATABASE_URL` and runs `ALTER TABLE` via `pg.Client`. Supabase mirror file in `supabase/migrations/`.
- **`AdminCard` row collapse pattern**: not currently used in JobHistoryPanel but exists elsewhere (e.g., `RssSourcesPanel` error_message expansion). Researcher to confirm whether to reuse or write inline `useState` toggle.

### Established Patterns
- **Cron guard** (`cron.ts:7-11`): `if (process.env.VERCEL) return;` — recursive scheduler keeps this guard.
- **Phase 36 D-08**: empty-Gemini-response error class (`GeminiEmptyResponseError`). Retry classifier treats this as transient (model hiccup, retry).
- **Phase 36 D-13**: failure-reason taxonomy on jobs. Retry exhaustion uses the existing reason values (`gemini_timeout`, `gemini_empty_response`, etc.) — retry adds no new reasons.
- **Drizzle JSONB pattern**: existing `blog_posts.tags` is JSONB array; `durations_ms` follows the same Drizzle `jsonb()` column declaration.

### Integration Points
- **`runPipeline`** in `blog-generator.ts`: timing capture wraps each stage call here, builds the `durations_ms` object, passes it to `createBlogGenerationJob`/`updateBlogGenerationJob`.
- **`createBlogGenerationJob` / `updateBlogGenerationJob`** in `storage.ts`: signatures need to accept the new `durationsMs` field. Storage layer is already typed to accept it once schema includes the column.
- **Admin REST endpoint `GET /api/blog/jobs`** (Phase 37 Plan 02): the `BlogGenerationJobWithRssItem` interface needs `durationsMs` added. Frontend reads it via `useQuery` already in place.

</code_context>

<specifics>
## Specific Ideas

- **Backoff schedule is exactly `[1s, 5s, 30s]`** — no jitter, no exponential formula derivation, just three fixed delays. Per spec.
- **Min interval clamp is exactly 60 minutes** — even if `postsPerDay = 25` (which would compute to ~57.6min), schedule is 60min. Per spec.
- **`durationsMs` shape is exactly `{ topic, content, image, upload, total }`** — no extra fields, no nested arrays. Per spec.
- **Per-call-site retry, not pipeline-level** — if `topic` succeeds and `content` fails after 3 retries, `topic`'s success time is preserved in `durations_ms.topic`; only `content` triggers the job-level failure.

</specifics>

<deferred>
## Deferred Ideas

- **Migrate RSS fetcher cron to recursive `setTimeout`** — consistency with new generator cron. Defer to a future cleanup phase; low value vs current 60min hardcoded interval.
- **Structured logging to external sink** (e.g., Better Stack, Datadog) — Phase 38 logs to `console.log` with stable shape; exporting is a separate ops phase.
- **Per-stage retry budget** (e.g., "image gets 1 retry, content gets 3") — uniform `[1s, 5s, 30s]` for all stages per spec.
- **Jitter on backoff** — fixed delays per spec; jitter would be a follow-up if thundering-herd becomes a concern.
- **Dashboard for cron timing trends** (p50/p95 over time) — Phase 38 surfaces per-job durations only; aggregate analytics is a future phase.
- **Retry observability column** (e.g., `retryAttempts` count on jobs) — interesting but not in spec; researcher may suggest as low-cost add during planning.

### Reviewed Todos (not folded)

None — no pending todos matched Phase 38 scope.

</deferred>

---

*Phase: 38-dynamic-cron-observability*
*Context gathered: 2026-05-05*
