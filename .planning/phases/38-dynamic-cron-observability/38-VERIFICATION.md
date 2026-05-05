---
phase: 38-dynamic-cron-observability
verified: 2026-05-05T00:00:00Z
status: human_needed
score: 3/3 success criteria automated-verified
re_verification:
  is_re_verification: false
human_verification:
  - test: "Apply the durations_ms migration to the live database"
    expected: "`npx tsx scripts/migrate-blog-durations-ms.ts` exits 0; verification SELECT confirms the column exists; `psql` SELECT on `information_schema.columns` returns the row."
    why_human: "38-01-SUMMARY.md explicitly defers the migration step to user post-merge. Code wiring is verified, but the column does not yet physically exist on the configured DATABASE_URL until the user runs the runner. No automation can execute migrations on the user's DB."
  - test: "Dynamic cron interval observed end-to-end"
    expected: "Set postsPerDay=24 in admin → next-tick log shows `interval≈60min` (clamp). Set postsPerDay=2 → next-tick log shows `interval≈720min` (12h). Set postsPerDay=0 → log shows `posts_per_day_zero (poll mode)` and the loop wakes again 60min later."
    why_human: "Requires running the dev server and waiting one tick (60min minimum) — outside the 10s spot-check budget. Code paths are statically verified."
  - test: "Per-stage timing breakdown surfaces in admin UI"
    expected: "After at least one Generate Now run post-migration, admin → Blog → Job History shows `⏱ {n}s` chip on the row. Click the row → 5-cell grid renders Topic | Content | Image | Upload | Total in ms. Image cell shows `—` if image stage was gracefully skipped."
    why_human: "Requires browser session, admin login, generated-job DB rows. Visual UX verification only possible at runtime."
  - test: "Transient Gemini retry observed in logs"
    expected: "Mock Gemini to throw 503 once during a generate run → `[blog-generator] topic attempt 1 failed; retrying in 1000ms` appears, then the call succeeds and the post saves. Mock 3 image failures in a row → `featureImageUrl: null` is persisted and a `console.warn` appears."
    why_human: "Requires injecting a fault into a third-party API call at runtime; static code review covers the predicate but cannot exercise the runtime branch."
---

# Phase 38: Dynamic Cron & Observability — Verification Report

**Phase Goal:** "The cron firing rate adapts to `postsPerDay`, every job records per-stage timing for observability, and transient Gemini failures auto-retry instead of being lost."

**Verified:** 2026-05-05
**Status:** human_needed (all automated artifact + wiring + data-flow checks pass; behavioral UAT and live-DB migration deferred to user)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                                                                                                       | Status     | Evidence                                                                                                                                                                                                                                            |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 1   | `startCron()` reads `postsPerDay` and sets the interval to `24h / postsPerDay` clamped to ≥ 60min; settings change picked up on next tick without redeploy.                  | ✓ VERIFIED | `server/cron.ts:10–15` `getBlogIntervalMs()` lazy-imports storage and computes `Math.max(DAY_IN_MS / settings.postsPerDay, MIN_BLOG_INTERVAL_MS)`. `:36–39` reschedules in `finally` via recursive `setTimeout(blogTick, nextMs)`. No setInterval used for blog generator.        |
| 2   | `blog_generation_jobs` gains nullable `durations_ms` JSONB column; `{ topic, content, image, upload, total }` populated on completion; admin job history surfaces breakdown. | ✓ VERIFIED — column DDL & schema artifacts in place; runtime population requires migration to be applied | `migrations/0042_blog_jobs_durations_ms.sql:8–9`; `shared/schema/blog.ts:65` `durationsMs: jsonb("durations_ms").$type<DurationsMs>()`; `server/lib/blog-generator.ts:345–360` populates and writes `durationsMs`. `server/storage.ts:2248,2286` SELECT projections include the column. `JobHistoryPanel.tsx:210–214` renders chip; `:262–285` renders 5-cell grid. |
| 3   | Transient Gemini errors retry with backoff `[1s, 5s, 30s]`; only fourth-attempt failure marks job failed.                                                                    | ✓ VERIFIED | `server/lib/blog-generator.ts:133` `RETRY_DELAYS_MS: readonly number[] = [1000, 5000, 30000]`. `:135–150` `isTransientError` covers `GeminiTimeoutError`, `GeminiEmptyResponseError`, `ApiError && status >= 500 && < 600`, `ECONNRESET/ETIMEDOUT/ENOTFOUND`, `/fetch failed|network|socket hang up/i`. `:156–170` `withGeminiRetry` loops `attempt = 0..3`, sleeps `RETRY_DELAYS_MS[attempt]` between transient retries, throws on non-transient or exhaustion. All 3 call sites (`:202` topic, `:212` post, `:227` image) migrated.        |

**Score:** 3/3 truths verified by static analysis.

### Required Artifacts

| Artifact                                                                  | Expected                                                                            | Status     | Details                                                                                                                                                                                                |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `migrations/0042_blog_jobs_durations_ms.sql`                              | `ALTER TABLE blog_generation_jobs ADD COLUMN IF NOT EXISTS durations_ms JSONB`     | ✓ VERIFIED | 11 lines, contains `BEGIN/COMMIT`, no `NOT NULL`, no `DEFAULT`. Idempotent.                                                                                                                            |
| `supabase/migrations/20260505120000_blog_jobs_durations_ms.sql`           | Byte-identical mirror                                                              | ✓ VERIFIED | `diff` confirms IDENTICAL with the local migration file.                                                                                                                                               |
| `scripts/migrate-blog-durations-ms.ts`                                    | tsx runner using `pool` from `server/db.js`, reads SQL via `readFileSync`           | ✓ VERIFIED | 38 lines, mirrors Phase 31 canonical template, verifies via `information_schema.columns`, releases client + ends pool in finally.                                                                      |
| `shared/schema/blog.ts` `durationsMs` JSONB column                        | Drizzle `jsonb("durations_ms").$type<DurationsMs>()`, nullable, no default          | ✓ VERIFIED | Line 65: exact form. `jsonb` added to imports (line 1). No `.notNull()`, no `.default(...)`.                                                                                                            |
| `shared/schema/blog.ts` `DurationsMs` type                                | `z.infer<typeof durationsMsSchema>` with 5-key shape (image nullable)               | ✓ VERIFIED | Lines 34–41. `image: z.number().int().nonnegative().nullable()` matches D-04. Single-source-of-truth via `z.infer` (Pitfall 4 avoided).                                                                |
| `shared/schema/blog.ts` Zod schemas updated                               | insert: `durationsMsSchema.nullable().optional()`; select: `durationsMsSchema.nullable()` | ✓ VERIFIED | Line 104 (insert), line 115 (select). Correct nullability semantics.                                                                                                                                  |
| `server/cron.ts` recursive `setTimeout` scheduler                         | `function blogTick`, `MIN_BLOG_INTERVAL_MS`, clamp, Vercel guard, RSS unchanged    | ✓ VERIFIED | Lines 17–40 (`blogTick`); 14 (clamp); 43 (`if (process.env.VERCEL) return;`); 59–68 (RSS still on `setInterval`). 69 lines total.                                                                       |
| `server/lib/blog-generator.ts` `withGeminiRetry`                          | Defined; 3 call sites migrated; backoff array literal `[1000, 5000, 30000]`         | ✓ VERIFIED | `function withGeminiRetry` at line 156. Call-site count: `grep -c withGeminiRetry` = 4 (1 def + 3 call sites). Old `withGeminiTimeout("topic"|"post"|"image")` quoted-label call sites = 0 (all migrated). |
| `server/lib/blog-generator.ts` `isTransientError`                         | `instanceof ApiError`, status range 500–599, network code list, message regex      | ✓ VERIFIED | Lines 135–150. Covers all required cases. 4xx not retried.                                                                                                                                              |
| `server/lib/blog-generator.ts` `runPipeline` per-stage timing             | `tStart`, partial.{topic,content,image,upload}, `total: Date.now() - tStart`        | ✓ VERIFIED | Lines 270–351. Captures all 5 stages, writes via `updateBlogGenerationJob({ ..., durationsMs })`.                                                                                                       |
| `server/lib/blog-generator.ts` partialDurationsMs propagation             | `Object.assign`-style attach on thrown error; read in `BlogGenerator.generate` catch | ✓ VERIFIED | Lines 365–375 (attach), 503–513 (read & write to failed-job row).                                                                                                                                       |
| `server/storage.ts` SELECT projections                                    | `durationsMs: blogGenerationJobs.durationsMs,` in BOTH list & get                   | ✓ VERIFIED | Lines 2248 and 2286. `grep -c "durationsMs: blogGenerationJobs.durationsMs,"` returns 2.                                                                                                                |
| `client/src/components/admin/blog/JobHistoryPanel.tsx` UI additions       | Interface, expand state, chevron, chip, 5-cell grid, stopPropagation               | ✓ VERIFIED | Lines 14–34 (interface), 57–66 (state + toggle), 177–181 (chevron), 210–214 (chip with `(durationsMs.total / 1000).toFixed(1)`), 262–285 (grid), 233 (stopPropagation).                                  |
| `client/src/lib/translations.ts` 5 new keys                               | `Topic`, `Content`, `Image`, `Total`, `Stage timings` (single-line consolidated)    | ✓ VERIFIED | Line 434: `'Topic': 'Pauta', 'Content': 'Conteúdo', 'Image': 'Imagem', 'Total': 'Total', 'Stage timings': 'Tempos por etapa',`. No duplicate `Upload` introduced (existing on line 181 reused).        |

### Key Link Verification

| From                                                              | To                                                          | Via                                            | Status   | Details                                                                                                                                  |
| ----------------------------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/migrate-blog-durations-ms.ts`                            | `migrations/0042_blog_jobs_durations_ms.sql`                | `readFileSync(join(cwd, "migrations/0042…"))` | ✓ WIRED  | Line 6–9 reads the exact file path; line 15 `client.query(sql)` executes it.                                                              |
| `shared/schema/blog.ts`                                           | `blog_generation_jobs.durations_ms` (DB)                    | Drizzle `jsonb("durations_ms").$type<...>()`  | ✓ WIRED  | Line 65 declaration matches SQL column name.                                                                                              |
| `server/cron.ts blogTick`                                         | `storage.getBlogSettings()`                                 | lazy `await import("./storage.js")`           | ✓ WIRED  | Lines 11–12 and 19–20 — settings read inside the recursive tick body, not captured at startup.                                            |
| `server/cron.ts blogTick finally`                                 | `setTimeout(blogTick, nextMs)`                              | recursive self-pacing                          | ✓ WIRED  | Line 38 inside `finally` block guarantees re-schedule even if both try and catch throw (loop never dies).                                 |
| `server/lib/blog-generator.ts withGeminiRetry`                    | `withGeminiTimeout(label, run)`                             | per-attempt internal call                      | ✓ WIRED  | Line 160 inside the for-loop body — retry composes over timeout (Pitfall 2 fresh AbortController per attempt).                            |
| `server/lib/blog-generator.ts isTransientError`                   | `@google/genai` `ApiError`                                  | `import { ApiError }` + `instanceof` check   | ✓ WIRED  | Import at line 4; instanceof check at line 140.                                                                                          |
| `server/lib/blog-generator.ts runPipeline`                        | `updateBlogGenerationJob({ ..., durationsMs })`             | success-path object assembly                   | ✓ WIRED  | Lines 345–360 build typed `DurationsMs` object and pass it to the storage call.                                                           |
| `server/lib/blog-generator.ts BlogGenerator.generate catch`       | `updateBlogGenerationJob({ durationsMs: partialDurationsMs })` | `(err as { partialDurationsMs })` read   | ✓ WIRED  | Lines 503–513 — failed jobs persist whatever stages completed before throw.                                                              |
| `server/storage.ts BlogGenerationJobWithRssItem`                  | `BlogGenerationJob.durationsMs`                             | `extends BlogGenerationJob` inheritance       | ✓ WIRED  | Line 157 `extends BlogGenerationJob` — `durationsMs: DurationsMs \| null` propagates via `$inferSelect`.                                  |
| `server/storage.ts SELECT projections`                            | `blogGenerationJobs.durationsMs` Drizzle column            | explicit projection field                      | ✓ WIRED  | `durationsMs: blogGenerationJobs.durationsMs,` appears 2× (list + get) confirming the value round-trips through the join.                  |
| `JobHistoryPanel row onClick`                                     | `expandedIds Set<number>` state                             | `toggleExpanded(job.id)`                       | ✓ WIRED  | Lines 173 (onClick) → 59–66 (toggle) → 168 (`expandedIds.has`) → 262 (conditional render).                                                |
| `JobHistoryPanel expanded view`                                   | `job.durationsMs.{topic\|content\|image\|upload\|total}`   | 5-cell grid render                             | ✓ WIRED  | Lines 262–285 — all 5 stages rendered. Image conditional `!== null ? "${ms}ms" : "—"` matches D-04.                                       |
| `JobHistoryPanel translation calls`                               | new keys in `translations.ts`                               | `t("Topic"\|"Content"\|"Image"\|"Total")`     | ✓ WIRED  | Lines 265, 269, 273, 277, 281 use `t()`. Existing `t("Upload")` on line 277 reuses the line-181 entry.                                    |

### Data-Flow Trace (Level 4)

| Artifact                                                                  | Data Variable                       | Source                                                                                                              | Produces Real Data | Status     |
| ------------------------------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------ | ---------- |
| `JobHistoryPanel.tsx` chip + breakdown grid                               | `job.durationsMs`                   | `useQuery(['/api/blog/jobs', 50])` → `GET /api/blog/jobs?limit=50` → `storage.listBlogGenerationJobs(50)` SELECT incl. `durationsMs` | Yes — once a generation run completes post-migration | ✓ FLOWING (subject to migration applied) |
| `runPipeline` → `updateBlogGenerationJob({ durationsMs })`                | `durationsMs` payload               | `Date.now()` deltas (`tTopic`, `tContent`, `tImage`, `tUpload`, `tStart`)                                            | Yes (real wall-clock measurements)         | ✓ FLOWING  |
| `BlogGenerator.generate` catch → `updateBlogGenerationJob({ durationsMs: partialDurationsMs })` | `partialDurationsMs`               | error-attached partial via `(err as { partialDurationsMs?: Partial<DurationsMs> }).partialDurationsMs = { ...partial, total: Date.now() - tStart }` | Yes — partial captures of stages completed before throw | ✓ FLOWING  |
| `server/cron.ts getBlogIntervalMs`                                        | `nextIntervalMs`                    | `await storage.getBlogSettings()` then `Math.max(DAY_IN_MS / settings.postsPerDay, MIN_BLOG_INTERVAL_MS)`            | Yes — recomputed each tick | ✓ FLOWING  |

Note: All data-flow paths flow real values once the migration is applied. The chip/grid will only render `null` (and skip the chevron) for pre-Phase-38 historical rows or rows that hit early-return skip paths — exactly matching D-04 spec.

### Behavioral Spot-Checks

| Behavior                                                       | Command                                                                                       | Result                                                  | Status   |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------- | -------- |
| TypeScript compiles cleanly across server/client/shared        | `npm run check`                                                                               | exit 0 (no output beyond `> tsc`)                       | ✓ PASS   |
| Migration files are byte-identical mirrors                     | `diff migrations/0042_blog_jobs_durations_ms.sql supabase/migrations/20260505120000_*.sql`    | exit 0 (IDENTICAL)                                      | ✓ PASS   |
| Both SELECT projections include `durationsMs`                  | `grep -c "durationsMs: blogGenerationJobs.durationsMs," server/storage.ts`                   | 2                                                       | ✓ PASS   |
| All 3 Gemini call sites migrated to `withGeminiRetry`          | `grep -c withGeminiRetry server/lib/blog-generator.ts` (def + 3 calls)                        | 4                                                       | ✓ PASS   |
| No stray `withGeminiTimeout("topic\|post\|image")` quoted call sites | `grep -cE 'withGeminiTimeout\("(topic\|post\|image)"\|withGeminiTimeout<any>\("image"' …` | 0                                                       | ✓ PASS   |
| File line caps respected                                       | `wc -l server/lib/blog-generator.ts` (≤600); `server/cron.ts` (≤100); `JobHistoryPanel.tsx` (≤600); `translations.ts` (≤600) | 524, 69, 293, 444                                       | ✓ PASS   |
| Phase 22 D-04 image fall-through preserved                     | `grep -nE "console.warn.*continuing without feature image" server/lib/blog-generator.ts`      | 2 occurrences (line 311 — empty bytes; line 315 — exhaust-retry catch path) | ✓ PASS   |
| Live cron behavior with postsPerDay change                     | requires `npm run dev` + admin UI + 60min wait                                                | (deferred)                                              | ? SKIP   |
| Live retry observed in logs                                    | requires fault injection on Gemini API                                                        | (deferred)                                              | ? SKIP   |
| Migration applied to live DB                                   | `npx tsx scripts/migrate-blog-durations-ms.ts`                                               | (deferred to user post-merge per 38-01-SUMMARY)         | ? SKIP   |

### Requirements Coverage

| Requirement | Source Plan      | Description                                                                                                                                                              | Status      | Evidence                                                                                                                                                          |
| ----------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BLOG2-14    | 38-02            | Cron frequency dynamic — derived from `postsPerDay`                                                                                                                      | ✓ SATISFIED | `server/cron.ts` recursive `setTimeout` reads `postsPerDay` every tick; `Math.max(DAY_IN_MS / postsPerDay, 60min)` clamp.                                          |
| BLOG2-15    | 38-01, 38-02, 38-03 | Structured `durationMs` per stage on every job, persisted in `blog_generation_jobs`                                                                              | ✓ SATISFIED | DB column added; `runPipeline` populates 5-key object; failed jobs persist partial via `partialDurationsMs`; storage projections + admin UI surface it. (Live persistence requires migration to be applied — see human verification.) |
| BLOG2-16    | 38-02            | Failed Gemini calls retry with exponential backoff (1s, 5s, 30s)                                                                                                         | ✓ SATISFIED | `withGeminiRetry` + `isTransientError` + 3 call sites migrated; image-stage exhaustion still saves the post per Phase 22 D-04.                                    |

No orphaned requirements — `.planning/REQUIREMENTS.md:84–86` marks BLOG2-14/15/16 as Phase 38, all three claimed by the plans.

### Anti-Patterns Found

None.

Spot-checks for stub patterns in modified files:

- `server/cron.ts`: no TODO/FIXME, no `return null`/empty handlers. All async paths reach `setTimeout(blogTick, nextMs)` in `finally` (line 38) → loop never silently dies.
- `server/lib/blog-generator.ts`: no TODO/FIXME (existing `console.warn` are intentional Phase 22 D-04 / Phase 38 D-03 behavior, not stubs). `withGeminiRetry` returns the call result on success and re-throws the last error after exhaustion (line 169).
- `server/storage.ts`: SELECT projections explicit; no `.select()` without projection on the affected methods that would silently drop the new column.
- `JobHistoryPanel.tsx`: chip+grid render guarded by `job.durationsMs && …` — null-safe. Pre-Phase-38 rows with `durationsMs: null` correctly omit chip + chevron + cursor-pointer.
- `translations.ts`: no duplicate-identifier (`Upload` reused, not redeclared). Single-line consolidated style preserved.

### Human Verification Required

#### 1. Apply the durations_ms migration to the live database

**Test:** `npx tsx scripts/migrate-blog-durations-ms.ts` (with `DATABASE_URL` configured).
**Expected:** Script logs `Running Phase 38 migration: blog_generation_jobs.durations_ms ...` → `Migration complete.` → `Verified: blog_generation_jobs.durations_ms exists.` and exits 0. Confirm via `psql "$DATABASE_URL" -c "\d blog_generation_jobs"` (or Supabase Studio) that `durations_ms` appears as `jsonb` (nullable, no default).
**Why human:** 38-01-SUMMARY explicitly defers this to user post-merge. The runner cannot be exercised without a live DB connection. Until executed, BLOG2-15 runtime persistence is "code-ready, schema-not-applied".

#### 2. Dynamic cron interval observed end-to-end (BLOG2-14 UAT)

**Test:** `npm run dev`. In admin → Blog settings, set `postsPerDay = 24`. Watch the server log for the next-tick line. Then change to `2`, then to `0`.
**Expected:**
- After save with `postsPerDay = 24`: `[cron] blog next tick in 60min` (clamped, since `24h / 24 = 60min` ties to the floor).
- After save with `postsPerDay = 2`: next-tick log shows `~720min` (12h).
- After save with `postsPerDay = 0`: tick logs `[cron] blog generation skipped: posts_per_day_zero (poll mode)` and reschedules with `60min`.
**Why human:** Requires a live process and 60min minimum wait between ticks — outside any 10s spot-check budget. Static analysis confirms the code paths exist; runtime confirms they fire correctly.

#### 3. Per-stage timing breakdown surfaces in admin UI (BLOG2-15 UAT)

**Test:** After (1) is applied, run Generate Now from admin → Blog. Observe Job History after the job completes.
**Expected:**
- Completed row shows `⏱ {n}s` chip in the badge row (e.g. `⏱ 12.4s`) and a `>` chevron.
- Click the row → 5-cell grid expands: `Topic | Content | Image | Upload | Total`, each value in raw milliseconds.
- If image stage was skipped (e.g. by exhausted retry), the Image cell shows `—`.
- Click `Retry` button on a failed row → row does NOT also expand (stopPropagation).
- Pre-Phase-38 historical rows (durationsMs=null) have NO chip, NO chevron, are NOT clickable.
- pt-BR labels: `Pauta`, `Conteúdo`, `Imagem`, `Total`, `Tempos por etapa`.
**Why human:** UI/UX verification, requires admin login and at least one completed run with the column applied.

#### 4. Transient Gemini retry observed in logs (BLOG2-16 UAT)

**Test:** Inject a fault — e.g., temporarily mock `getBlogGeminiClient` (or set Gemini API key to one that returns 503) and trigger a generate run. Then mock 3+ image failures in a row.
**Expected:**
- For the topic/post call, console shows `[blog-generator] topic attempt 1 failed; retrying in 1000ms` (or similar) followed by a successful retry. Job completes with `status: "completed"`.
- For 4 image failures in a row, the existing image try/catch swallows the throw and the post saves with `featureImageUrl: null` plus a `Blog generator image pipeline failed; continuing without feature image: ...` warning. Phase 22 D-04 invariant preserved.
- 4xx (e.g. 401, 429) errors do NOT retry — first failure marks the job failed immediately.
**Why human:** Requires fault injection at the third-party API boundary; static analysis confirms predicate correctness but cannot exercise runtime.

### Gaps Summary

No gaps found in the artifacts or wiring layers. All 3 requirement IDs (BLOG2-14, BLOG2-15, BLOG2-16) are satisfied by the code that exists in the working tree, and `npm run check` is clean. The phase is `human_needed` only because:

1. The DB migration is intentionally deferred to user execution (per 38-01-SUMMARY contract — the script exists and is verified, but the schema change is not a code-action).
2. UAT for the three behavioral truths (dynamic interval, breakdown UI, retry-with-backoff) requires a running server, browser session, and/or fault injection — outside the verifier's automated capabilities.

Once the user runs the migration and performs the four manual UAT items above, Phase 38 is complete.

---

_Verified: 2026-05-05_
_Verifier: Claude (gsd-verifier)_
