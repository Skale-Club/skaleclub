# Phase 38: Dynamic Cron & Observability - Research

**Researched:** 2026-05-05
**Domain:** Node.js cron rescheduling, Gemini SDK retry, Drizzle JSONB, Vercel cron limits
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01: Recursive `setTimeout` self-pacing scheduler** in `server/cron.ts`. Each tick reads `postsPerDay` from `getBlogSettings()`, computes `nextIntervalMs = max(24h / postsPerDay, 60min)`, runs the generator, then `setTimeout(tick, nextIntervalMs)`. If `postsPerDay = 0`, schedule 60min poll (no generation) so admin re-enable wakes the loop. Vercel guard `if (process.env.VERCEL) return;` stays.
- **D-02: New `withGeminiRetry(label, fn)`** wrapper that **wraps `withGeminiTimeout` internally** and applies `[1s, 5s, 30s]` backoff on transient errors. The 3 existing call sites in `blog-generator.ts` (topic / content / image) change from `withGeminiTimeout("topic", ...)` to `withGeminiRetry("topic", ...)`. **Transient classifier:** `GeminiTimeoutError`, `GeminiEmptyResponseError`, network errors (ECONNRESET / ETIMEDOUT / fetch failed), HTTP 5xx. **Do NOT retry 4xx** (auth, quota, malformed prompt).
- **D-03: Image generation gets full retry** but Phase 22 D-04 non-blocking semantics preserved: if all 3 retries fail, post still saves with `featureImageUrl: null` and a `console.warn`. Worst-case user delay: ~36s.
- **D-04: New `durations_ms` JSONB column** on `blog_generation_jobs`. Shape: `{ topic: number, content: number, image: number | null, upload: number, total: number }` (image=null when not generated; integer ms). Populated by `runPipeline` via `Date.now()` deltas. Skipped jobs: `durations_ms` stays NULL. Failed jobs: populate whatever stages completed before failure. Migration: raw-SQL tsx script + Supabase mirror (Phase 34 D-09 / v1.2 D-04 pattern).
- **D-05: `JobHistoryPanel.tsx` expand-on-click row** that reveals per-stage breakdown when admin clicks. Collapsed view shows existing fields plus a single new `total` chip ("⏱ 12.4s"). Expanded view: small inline table `topic | content | image | upload | total`. Touch scope ~30 lines; stays under 600-line cap (currently 225 lines).
- **D-06: Three plans in dependency order:**
  - **38-01** (Wave 1, alone): `durations_ms` migration + schema + storage shape (foundation, no behavior change)
  - **38-02** (Wave 2): Recursive `setTimeout` rescheduler + `withGeminiRetry` wrapper + per-stage timing capture + retry classifier
  - **38-03** (Wave 3): `JobHistoryPanel` expand-on-click breakdown
  - Strict dependency chain — no parallel waves.

### Claude's Discretion

- Exact transient-error classifier predicate (regex on error message vs. `instanceof` checks vs. HTTP status from `@google/genai` SDK errors) — **researcher to investigate**.
- Whether `total` chip uses ms or human format (`12.4s` vs `12400ms`) — Claude's call during planning; pick whichever matches the existing chip style in JobHistoryPanel.
- Vercel cron behavior: if `vercel.json` schedule is fixed at deploy time, document the dynamic feature as "node runtime only" in PROJECT.md and treat Vercel cron as a manual override. **Researcher to confirm.**
- Whether to migrate the RSS fetcher cron to the same recursive-setTimeout shape now (consistency) or leave it on `setInterval` (smaller diff). **Default: leave it for now — Phase 38 does not own the fetcher.**

### Deferred Ideas (OUT OF SCOPE)

- Migrate RSS fetcher cron to recursive `setTimeout` (consistency only — defer)
- Structured logging to external sink (Better Stack, Datadog) — Phase 38 uses `console.log` with stable shape
- Per-stage retry budget (e.g., "image gets 1 retry, content gets 3") — uniform `[1s, 5s, 30s]` per spec
- Jitter on backoff — fixed delays per spec
- Dashboard for cron timing trends (p50/p95) — per-job durations only
- `retryAttempts` count column on jobs — researcher may suggest as low-cost add during planning
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BLOG2-14 | Generator cron frequency dynamic — derived from `postsPerDay` (e.g., 4/day → every 6h) instead of hardcoded 60min | Recursive `setTimeout` pattern (Q5), Vercel cron is fixed-at-deploy-time (Q1) — node-only feature |
| BLOG2-15 | Structured logs include `durationMs` per stage (topic, content, image, upload), persisted in `blog_generation_jobs` | Drizzle `jsonb()` declaration pattern (Q3), raw-SQL tsx migration template (Q4), `Date.now()` deltas, storage signature additions (Q6, Q7) |
| BLOG2-16 | Failed Gemini calls retry with exponential backoff (1s, 5s, 30s) before run is marked failed | `@google/genai` `ApiError` class with `.status: number` HTTP code (Q2), classifier predicate, `withGeminiRetry` composing over `withGeminiTimeout` |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Surgical scope** — minimize changes, keep existing patterns, just clean up
- **API stability** — `/api/blog/*` endpoint signatures unchanged
- **No DB-breaking changes** — `durations_ms` is purely additive (NULL default, no NOT NULL constraint, no rename)
- **No feature changes** — observability is observable; behavior must be identical when nothing fails
- **600-line file cap** — `blog-generator.ts` currently 588 lines; adding `withGeminiRetry` (~30 LOC) + per-stage timing in `runPipeline` (~10 LOC) WILL exceed cap; compaction required (verified strategy in Phase 36-03)
- **Manual QA only** — `npm test` does NOT exist; `npm run check` is the only automated gate
- **Translation rule** — Admin UI strings must use `t()` with keys in `client/src/lib/translations.ts` (currently 443 lines / 600 cap; ~157 line headroom)
- **GSD enforcement** — All edits via GSD command (this is `/gsd:plan-phase`)

## Summary

All six phase decisions are **fully implementable with the existing codebase patterns** — no new dependencies, no new architectural concepts, and every reference implementation already exists in the repo or in `node_modules`.

**Key research outcomes:**

1. **Vercel cron is fixed at deploy time** — confirmed by Vercel docs. The dynamic-frequency feature is **node-runtime only**. The Vercel path (`POST /api/blog/cron/generate` triggered by `vercel-cron/1.0` user agent) currently has **no `crons` block in `vercel.json`** at all — meaning the project today has zero scheduled triggers on Vercel. Phase 38 does not need to add Vercel cron config; the dynamic scheduler runs only on the long-lived node process started by `server/index.ts`. This is fine for the project's actual deployment model.
2. **`@google/genai` 1.50.1 exposes a clean `ApiError extends Error` class** with `.name === "ApiError"` and a numeric `.status` property carrying the HTTP code. Transient-error classification can use a precise three-pronged predicate (`instanceof GeminiTimeoutError || instanceof GeminiEmptyResponseError`, `error instanceof ApiError && error.status >= 500`, and message-regex on `ECONNRESET|ETIMEDOUT|fetch failed`).
3. **Drizzle JSONB declaration is mechanical** — 17+ existing tables in `shared/schema/*.ts` use `jsonb("col_name").$type<Shape>().default(default)` or `.notNull()`. The canonical type-narrowing pattern for our shape is `jsonb("durations_ms").$type<DurationsMs>()` (no default, nullable, mirrors the SQL `JSONB` column without `NOT NULL`).
4. **Raw-SQL tsx migration template is well-established** — six existing scripts in `scripts/migrate-*.ts` follow byte-identical structure: `pool.connect()`, `client.query(sql)`, verification SELECT, `client.release()` + `pool.end()`. The Phase 31 `migrate-notification-templates.ts` is the closest 1:1 template (32 lines).
5. **Recursive `setTimeout` has no async-safety quirks here** — node's single-threaded event loop and the existing `try/catch` per tick make the pattern self-quiescent. No need for `clearTimeout` discipline at shutdown for the project's deployment model (process exit kills the timer).
6. **600-line cap risk is real and pre-mitigated** — Phase 36-03 already used template-literal prompts + comment trims + `defaultStorage` method-shorthand to fit the same file under the cap. Phase 38 will need ~5–10 more lines of trim to absorb the retry wrapper. The plan must explicitly authorize this compaction (Phase 36-03 plan did so as Rule 3 pre-authorization).

**Primary recommendation:** Implement exactly as decided. The risk surface is line-cap pressure on `blog-generator.ts` — every other dimension (Drizzle JSONB, Gemini error class, recursive setTimeout, raw-SQL migration) is a one-line lookup against existing patterns.

## Standard Stack

### Core (already present, no installs)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@google/genai` | 1.50.1 | Gemini text + image SDK | Already used; exposes `ApiError` with `.status` |
| `drizzle-orm` | 0.39.3 | Type-safe Postgres ORM | Already used; `jsonb()` column pattern in 17+ schema files |
| `pg` | (transitive via `@neondatabase/serverless` / direct) | Raw migration runner | Used by all 6 existing `scripts/migrate-*.ts` |
| `dotenv` | (project default) | `import "dotenv/config"` | Used at top of every migration script |
| `tsx` | 4.20.5 | TypeScript executor for migration | Already in package.json `dev` script |

### Supporting (already present)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `date-fns` | 3.6.0 | Time formatting on UI | `formatDistanceToNow` for total chip if humanized |
| `lucide-react` | 0.453.0 | Icon library | New chevron icon for expand-on-click row |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Recursive `setTimeout` | `node-cron` library | Adds dep, no value (we already have settings-driven loop) |
| Manual retry helper | `p-retry` npm package | Adds dep, ~50 LOC saved but breaks "no new deps" surgical-scope rule |
| `instanceof ApiError` | Regex on `err.message` | Less robust; Gemini SDK could change message format |
| JSONB column | Five new INTEGER columns (`topic_ms`, `content_ms`, etc.) | More migration churn; less flexible for future stages |

**No installations needed for Phase 38.**

**Version verification (verified 2026-05-05):**
- `@google/genai` latest = 1.52.0 (project pinned at 1.50.1 — CLAUDE.md "no breaking changes" → keep pinned, do not upgrade)
- `drizzle-orm` latest = 0.45.2 (project pinned at 0.39.3 — same rule)
- No version action required.

## Architecture Patterns

### Recommended Project Structure

```
shared/schema/blog.ts               # +DurationsMs type, +durationsMs column on blogGenerationJobs
migrations/0042_blog_jobs_durations_ms.sql            # Plan 38-01
supabase/migrations/{ts}_blog_jobs_durations_ms.sql   # Plan 38-01 (byte-identical mirror)
scripts/migrate-blog-durations-ms.ts                  # Plan 38-01 (tsx runner)
server/storage.ts                   # +durationsMs in createBlogGenerationJob/updateBlogGenerationJob (auto-typed via $inferInsert)
server/cron.ts                      # Plan 38-02: setInterval → recursive setTimeout
server/lib/blog-generator.ts        # Plan 38-02: +withGeminiRetry, per-stage timing in runPipeline
client/src/components/admin/blog/JobHistoryPanel.tsx  # Plan 38-03: +expand-on-click row
client/src/lib/translations.ts      # Plan 38-03: +6-8 keys (Topic/Content/Image/Upload/Total/Stage timings)
```

### Pattern 1: Recursive `setTimeout` Self-Pacing Scheduler

**What:** Replace `setInterval(fn, FIXED_MS)` with a tail-recursive `tick()` that reads settings at the top of every iteration and schedules the next call with a freshly-computed delay.

**When to use:** Any scheduler whose interval is settings-driven and must update without restart.

**Example (canonical shape for D-01):**

```typescript
// server/cron.ts
import { BlogGenerator } from "./lib/blog-generator.js";
import { fetchAllRssSources } from "./lib/rssFetcher.js";

const HOUR_IN_MS = 60 * 60 * 1000;
const DAY_IN_MS = 24 * HOUR_IN_MS;
const MIN_BLOG_INTERVAL_MS = 60 * 60 * 1000;

async function getBlogIntervalMs(): Promise<number> {
  const { storage } = await import("./storage.js");
  const settings = await storage.getBlogSettings();
  if (!settings || settings.postsPerDay <= 0) return MIN_BLOG_INTERVAL_MS;
  return Math.max(DAY_IN_MS / settings.postsPerDay, MIN_BLOG_INTERVAL_MS);
}

async function blogTick(): Promise<void> {
  try {
    const result = await BlogGenerator.generate({ manual: false });
    if (result.skipped) {
      console.log(`[cron] blog generation skipped: ${result.reason}`);
    } else {
      console.log(`[cron] blog generation completed: postId=${result.postId}`);
    }
  } catch (err) {
    console.error("[cron] blog generation error:", err);
  } finally {
    const nextMs = await getBlogIntervalMs();
    setTimeout(blogTick, nextMs);
  }
}

export function startCron(): void {
  if (process.env.VERCEL) return;

  console.log("[cron] blog auto-generator starting (recursive setTimeout, postsPerDay-driven)");
  // First tick fires after the initial computed interval — same as setInterval semantics
  void getBlogIntervalMs().then((ms) => setTimeout(blogTick, ms));

  // RSS fetcher: keep current setInterval per CONTEXT (Phase 38 does not own it)
  console.log("[rss-fetcher] cron starting — runs every 60 minutes");
  setInterval(async () => {
    try {
      const summary = await fetchAllRssSources();
      console.log(`[rss-fetcher] cron tick: sources=${summary.sourcesProcessed} upserted=${summary.itemsUpserted} errors=${summary.errors.length}`);
    } catch (err) {
      console.error("[rss-fetcher] cron error:", err);
    }
  }, HOUR_IN_MS);
}
```

**Critical properties:**
- `finally` block always reschedules (success or thrown-but-caught error) — the loop never silently dies.
- `getBlogIntervalMs()` is called **after** the tick body, so the next interval reflects the latest `postsPerDay` even if the admin changed it during the tick.
- `void getBlogIntervalMs().then(...)` preserves "first tick fires later, not immediately" — matches `setInterval` behavior so existing manual-run tests still pass.
- No `stop()` function needed — process exit cancels pending `setTimeout`. The project has no graceful-shutdown mechanism today (verified in `server/index.ts`).

### Pattern 2: Retry Wrapper Composing Over Existing Timeout Wrapper

**What:** `withGeminiRetry(label, fn)` calls `withGeminiTimeout(label, fn)` internally; on transient error, sleeps `[1000, 5000, 30000]` ms and retries. After third failure, throws the last error.

**Canonical shape:**

```typescript
// server/lib/blog-generator.ts (additive)

const RETRY_DELAYS_MS = [1000, 5000, 30000] as const;

function isTransientError(err: unknown): boolean {
  if (err instanceof GeminiTimeoutError) return true;
  if (err instanceof GeminiEmptyResponseError) return true;
  // @google/genai 1.50.x: ApiError extends Error with .name === "ApiError" and .status: number
  if (err && typeof err === "object" && "name" in err && (err as Error).name === "ApiError") {
    const status = (err as { status?: number }).status;
    return typeof status === "number" && status >= 500 && status < 600;
  }
  // Network errors surfaced by undici/fetch (no @google/genai wrapping)
  if (err instanceof Error) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ECONNRESET" || code === "ETIMEDOUT" || code === "ENOTFOUND") return true;
    if (/fetch failed|network|socket hang up/i.test(err.message)) return true;
  }
  return false;
}

async function withGeminiRetry<T>(
  label: string,
  run: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < RETRY_DELAYS_MS.length + 1; attempt++) {
    try {
      return await withGeminiTimeout(label, run);
    } catch (err) {
      lastErr = err;
      if (!isTransientError(err) || attempt === RETRY_DELAYS_MS.length) throw err;
      const delayMs = RETRY_DELAYS_MS[attempt];
      console.warn(`[blog-generator] ${label} attempt ${attempt + 1} failed; retrying in ${delayMs}ms`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastErr;
}
```

**Why this shape:**
- Loops `attempt = 0..3` (4 iterations: 1 initial + 3 retries) — exactly the spec's "3 retries" semantic.
- `RETRY_DELAYS_MS[attempt]` is read on the failed iteration, indexing 0/1/2 → 1s/5s/30s; on `attempt === 3` (i.e., the 4th try failed) the loop throws.
- `await withGeminiTimeout(...)` keeps the existing 30s-per-call timeout layer intact — total worst-case time per call site = `30s + 1s + 30s + 5s + 30s + 30s + 30s ≈ 156s` (4 tries × 30s timeout + 36s backoff). Documented as "image stage worst-case ~36s + 4×30s ≈ 156s" in the CONTEXT specifics; spec accepts this.
- Image fall-through (D-03 / Phase 22 D-04) is unchanged: existing `try/catch` around `deps.generateImage(...)` in `runPipeline` (lines 349–360) catches the final `throw` and continues with `featureImageUrl = null`.

### Pattern 3: Drizzle JSONB Column with Typed Shape

**What:** `jsonb("col_name").$type<Shape>()` — column declaration with TypeScript generic that flows into `$inferInsert` and `$inferSelect`.

**Canonical references in the repo:**

| File | Line | Pattern |
|------|------|---------|
| `shared/schema/cms.ts` | 92 | `features: jsonb("features").$type<string[]>().default([])` |
| `shared/schema/estimates.ts` | 42 | `services: jsonb("services").$type<EstimateServiceItem[]>().notNull().default([])` |
| `shared/schema/hub.ts` | 123 | `metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({})` |
| `shared/schema/presentations.ts` | 43 | `slides: jsonb("slides").$type<SlideBlock[]>().notNull().default([])` |
| `shared/schema/settings.ts` | 84 | `homepageContent: jsonb("homepage_content").$type<HomepageContent>().default({})` |

**For Phase 38 (canonical):**

```typescript
// shared/schema/blog.ts (additions)

export type DurationsMs = {
  topic: number;
  content: number;
  image: number | null;  // null when image generation skipped (Phase 22 D-04)
  upload: number;
  total: number;
};

export const blogGenerationJobs = pgTable("blog_generation_jobs", {
  id: serial("id").primaryKey(),
  status: text("status").notNull(),
  reason: text("reason"),
  postId: integer("post_id"),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
  error: text("error"),
  // Phase 38 BLOG2-15: per-stage timing breakdown. NULL when skipped (no
  // stages ran). Failed jobs populate completed-stage entries before throw.
  durationsMs: jsonb("durations_ms").$type<DurationsMs>(),
});
```

**Zod schema additions (canonical shape):**

```typescript
const durationsMsSchema = z.object({
  topic: z.number().int().nonnegative(),
  content: z.number().int().nonnegative(),
  image: z.number().int().nonnegative().nullable(),
  upload: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
});

export const insertBlogGenerationJobSchema = z.object({
  // ...existing fields...
  durationsMs: durationsMsSchema.nullable().optional(),
});

export const selectBlogGenerationJobSchema = z.object({
  // ...existing fields...
  durationsMs: durationsMsSchema.nullable(),
});
```

### Pattern 4: Raw-SQL tsx Migration Runner

**Reference template:** `scripts/migrate-notification-templates.ts` (32 lines, Phase 31). Byte-identical structure also in `migrate-blog-automation.ts`, `migrate-presentations.ts`, `migrate-skale-hub.ts`, `migrate-skale-hub-ghl-sync.ts`, `migrate-telegram-settings.ts`.

**Canonical shape:**

```typescript
// scripts/migrate-blog-durations-ms.ts
import "dotenv/config";
import { readFileSync } from "fs";
import { join } from "path";
import { pool } from "../server/db.js";

const sql = readFileSync(
  join(process.cwd(), "migrations/0042_blog_jobs_durations_ms.sql"),
  "utf-8",
);

async function migrate() {
  const client = await pool.connect();
  try {
    console.log("Running Phase 38 migration: blog_generation_jobs.durations_ms ...");
    await client.query(sql);
    console.log("Migration complete.");

    const check = await client.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'blog_generation_jobs'
         AND column_name = 'durations_ms'`,
    );
    if (check.rows.length === 0) {
      throw new Error("durations_ms column not found after migration.");
    }
    console.log("Verified: blog_generation_jobs.durations_ms exists.");
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
```

**SQL file (idempotent):**

```sql
-- migrations/0042_blog_jobs_durations_ms.sql
-- Phase 38 BLOG2-15: per-stage timing breakdown on blog_generation_jobs

BEGIN;

ALTER TABLE blog_generation_jobs
  ADD COLUMN IF NOT EXISTS durations_ms JSONB;

COMMIT;
```

**Supabase mirror:** byte-identical content at `supabase/migrations/{YYYYMMDDHHMMSS}_blog_jobs_durations_ms.sql` (Phase 34 D-09 enforcement).

**Run:** `npx tsx scripts/migrate-blog-durations-ms.ts` (project convention; matches Phase 31 / Phase 22 invocation).

### Pattern 5: Per-Stage Timing in `runPipeline`

**What:** Wrap each stage call with `Date.now()` deltas; assemble `durations_ms` object before the final `updateBlogGenerationJob`.

**Canonical shape (insert into existing `runPipeline` lines 326–404):**

```typescript
async function runPipeline({...}): Promise<PipelineSuccess> {
  const deps = getDeps();
  const now = deps.now();
  const tStart = Date.now();

  const tTopic = Date.now();
  const topic = await deps.generateTopic({ settings, manual, rssItem });
  const dTopic = Date.now() - tTopic;

  const tContent = Date.now();
  const generatedPost = await deps.generatePost({ settings, topic, manual, rssItem });
  const dContent = Date.now() - tContent;

  // ...sanitize + length validate (unchanged, NOT timed — this is post-stage compute)...

  let dImage: number | null = null;
  let dUpload = 0;
  let featureImageUrl: string | null = null;
  try {
    const tImage = Date.now();
    const imageBytes = await deps.generateImage({ settings, post: generatedPost, manual });
    dImage = Date.now() - tImage;

    if (imageBytes?.length) {
      const tUpload = Date.now();
      const path = `blog-images/${now.getTime()}-${randomUUID()}.jpg`;
      featureImageUrl = await deps.uploadImage({ bytes: imageBytes, path });
      dUpload = Date.now() - tUpload;
    }
  } catch (error) {
    // dImage already set if the throw came from generateImage's withGeminiRetry exhaustion;
    // dImage remains null if the throw came from a transient error before any retry attempt completed.
    // Phase 22 D-04: degrade gracefully.
    console.warn(...);
  }

  // ...createBlogPost (unchanged)...

  const durationsMs: DurationsMs = {
    topic: dTopic,
    content: dContent,
    image: dImage,
    upload: dUpload,
    total: Date.now() - tStart,
  };

  await deps.storage.updateBlogGenerationJob(job.id, {
    status: "completed",
    postId: post.id,
    completedAt: now,
    reason: null,
    error: null,
    durationsMs,
  });
  // ...
}
```

**Failed-job timing (canonical — D-04 spec: "populate whatever stages completed before failure"):**

The catch block in `BlogGenerator.generate()` (lines 549–576) calls `updateBlogGenerationJob` to mark `status: 'failed'`. To populate partial timings, `runPipeline` must throw a typed error that carries the partial `durationsMs`, OR the timing accumulator must live in the outer scope. Recommended: track timing in the outer `BlogGenerator.generate` scope, OR throw `Object.assign(new Error(message), { partialDurationsMs })`. **Decision deferred to planning** — the simpler approach (re-throw an `Error & { partialDurationsMs?: Partial<DurationsMs> }` from `runPipeline`) is plan-time discretion.

### Anti-Patterns to Avoid

- **`setInterval` + manual `clearInterval` on settings change.** Race conditions, double-fires, stale closures. Recursive `setTimeout` eliminates the need entirely.
- **`new AbortController()` per retry attempt then forgetting to clean up.** `withGeminiTimeout` already handles `clearTimeout` in `finally`; `withGeminiRetry` calls `withGeminiTimeout` and gets fresh controllers per attempt — no leak.
- **Catching `Error` and only checking message strings.** The `@google/genai` SDK throws typed `ApiError` with `.status: number` — use `instanceof`-style checks for HTTP-status branching, not regex on `.message`.
- **Sleeping with `setTimeout(..., 0)` between retries.** Use the explicit `[1000, 5000, 30000]` schedule from spec; no jitter.
- **Adding `durations_ms NOT NULL` constraint.** Existing rows would become invalid; D-04 explicitly says NULL for skipped jobs.
- **Storing per-stage timings as separate columns.** JSONB shape is canonical per spec; column-per-stage breaks the spec contract on the storage layer signature.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Async retry with backoff | Generic `pRetry`-style helper | Inline 20-line `withGeminiRetry` | Tied to Gemini-specific transient classifier; no other call site needs it |
| Cron rescheduling | Watcher process / file watcher | Read settings on every tick | Self-correcting; admin change visible on next boundary |
| HTTP error classification | Regex on `err.message` | `@google/genai` `ApiError.status` | SDK guarantees the field; messages can change |
| Migration runner | Drizzle Kit `db:push` | Existing tsx + raw SQL pattern | Project convention since Phase 21 (STATE.md decision); no rebase against drizzle-kit |
| JSONB serialization | Manual `JSON.stringify` in storage | Drizzle ORM auto-serialization | Drizzle handles `jsonb()` → JSON encoding/decoding transparently |
| Date diff measurement | `process.hrtime()` | `Date.now()` deltas | Existing project convention (`runPipeline`'s `Date.now()` at line 328); ms precision is sufficient for "did the cron run for too long?" observability |

**Key insight:** Every "deceptively complex" subproblem (retry, cron, JSONB) has a 1:1 reference in the existing codebase. Phase 38 is composition, not invention.

## Runtime State Inventory

> Rename/refactor migration phase: this is an additive schema phase, but a partial inventory is needed because cron behavior changes mid-flight.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `blog_generation_jobs` table on production (Postgres + Supabase). Current rows have no `durations_ms` column. Existing rows: completed/failed/skipped jobs from Phases 21–37. | Migration adds nullable column — existing rows have `NULL`, no backfill needed. New rows post-deploy populate it. |
| Live service config | None — vercel.json has NO `crons` block currently. RSS fetcher and blog generator currently run only via the long-lived Node process (`server/index.ts` → `startCron`). No Vercel-side scheduled triggers exist to reconfigure. | None — Vercel cron remains absent; node-runtime scheduler is the only path. Documenting this in PROJECT.md is plan-time discretion (CONTEXT D-01 defers this to researcher's recommendation; recommendation: leave PROJECT.md unchanged — current shape is correct). |
| OS-registered state | None — no Windows Task Scheduler, launchd, systemd, or pm2 entries. The cron is in-process. | None. |
| Secrets/env vars | `CRON_SECRET` (used by `isAuthorizedCronRequest`) — code rename not happening. `BLOG_GEMINI_API_KEY`, `BLOG_GEMINI_TIMEOUT_MS`, `BLOG_CONTENT_MODEL`, `BLOG_IMAGE_MODEL` — all referenced by name only, no rename. | None. |
| Build artifacts / installed packages | None — no compiled output for blog-generator that survives a fresh `npm run build`; Vercel rebuilds from source. No egg-info or pip-style stale installs. | None. |

**The canonical question answered:** After every file in the repo is updated, no runtime systems carry stale references. The only "data drift" is the new column, which Drizzle reads correctly via `$type<DurationsMs>()` regardless of NULL or filled rows.

## Common Pitfalls

### Pitfall 1: Recursive `setTimeout` Drift Under Slow Ticks

**What goes wrong:** If `BlogGenerator.generate()` takes 90 seconds (long Gemini call + retry exhaustion), the next tick fires 90s LATER than `setInterval` would have. Effective cadence becomes `interval + tick_duration`.

**Why it happens:** Recursive `setTimeout` schedules from the END of the previous tick, not from a fixed wall-clock anchor.

**How to avoid:** This is **acceptable behavior for Phase 38** — the spec says "schedule on next tick" not "fire at exact wall-clock boundaries." The 60-min minimum already absorbs single-tick drift. Document explicitly in `cron.ts` comment so future maintainers don't try to "fix" it with `setInterval`.

**Warning signs:** Logs show `[cron] blog generation completed` timestamps drifting beyond the configured interval. This is expected; do not alert on it.

### Pitfall 2: `Date.now()` Capture Inside `runPipeline` Lost on Throw

**What goes wrong:** If `generateContent` throws after running for 8 seconds, the captured `tContent = Date.now()` is in `runPipeline`'s scope — but `runPipeline` re-throws, so the outer `BlogGenerator.generate()` catch block never sees the partial timing. Failed job's `durations_ms` ends up `NULL` instead of `{topic: 1200, content: 8000}`.

**Why it happens:** Stack-frame-local variables die when the function throws.

**How to avoid:** Either (a) declare timings in the outer scope `BlogGenerator.generate`, OR (b) attach `partialDurationsMs` to the thrown error: `throw Object.assign(err, { partialDurationsMs: { topic: dTopic, content: dContent } })`. Plan-time choice; (b) requires fewer signature changes.

**Warning signs:** Failed jobs show `durations_ms: null` even though the topic stage clearly ran (job's `started_at` to `completed_at` delta > 1s).

### Pitfall 3: Retry Storm on 4xx Errors

**What goes wrong:** Classifier mistakenly retries on HTTP 429 (rate limit) or 401 (auth). Three retries × 36s backoff = 108 seconds of wasted Gemini calls + a confused job log.

**Why it happens:** Treating "any HTTP error" as transient. 429 IS retryable in spirit but Gemini's free-tier rate limit windows are minutes, not seconds — retrying within 36s burns budget without success.

**How to avoid:** Per CONTEXT D-02: **DO NOT retry 4xx**. Classifier predicate: `error.status >= 500 && error.status < 600` only. 429 specifically: do not retry (it's a 4xx and Gemini's quota is a permanent-for-this-window failure).

**Warning signs:** `[blog-generator] image attempt 2 failed; retrying in 5000ms` logs followed by the same error message three times in a row.

### Pitfall 4: Drizzle `$type<DurationsMs>()` Drift from Zod Schema

**What goes wrong:** Drizzle generic accepts `{topic: number, ...}` but Zod schema validates differently — runtime parse error when storage tries to insert.

**Why it happens:** Two sources of truth.

**How to avoid:** Define `DurationsMs` as the Zod-inferred type: `export type DurationsMs = z.infer<typeof durationsMsSchema>`. Drizzle generic uses the same type. Single source of truth.

**Warning signs:** TypeScript compiles, but `npm run dev` throws `ZodError` on first job completion.

### Pitfall 5: 600-Line Cap Breach on `blog-generator.ts`

**What goes wrong:** Phase 38's additions push the file past 600 lines; CLAUDE.md hook flags the violation; planner has to retroactively compact, costing time.

**Why it happens:** File is at 588 lines today; `withGeminiRetry` (~30 lines) + per-stage timing (~10 lines) = 628.

**How to avoid:** Plan 38-02 must include explicit Rule 3 pre-authorization for compaction (per Phase 36-03 precedent). Specific strategies that worked in Phase 36-03:
1. Template-literal prompts instead of `array.join('\n')` (already applied; ~5 more lines available if any prompt is touched)
2. Comment trims — keep rationale comments single-line
3. Method-shorthand on `defaultStorage` adapter (already applied)
4. Inline trivial helpers (e.g., `getCadenceWindowMs` is one line — could be inlined into its single caller, saving 3 lines)
5. Combine related constants into single-line declarations

**Warning signs:** `wc -l server/lib/blog-generator.ts` returns > 600 at any commit boundary.

### Pitfall 6: Phase 22 D-04 Image-Failure Contract Violation

**What goes wrong:** Adding retry to image generation accidentally makes image failure FATAL — post stops saving when image fails three times.

**Why it happens:** Wrapping `generateImage` in `withGeminiRetry` and forgetting that `withGeminiRetry` re-throws on exhaustion; the existing `try/catch` at lines 349–360 should catch it, but a refactor might move the try/catch boundary.

**How to avoid:** **Do not move the `try/catch` block** at `runPipeline:349-360`. The retry happens INSIDE `deps.generateImage(...)`; the existing catch swallows the final exhaustion-throw. Verify with: post + topic succeed, mock image to throw 3× → assert `featureImageUrl: null` AND post is saved.

**Warning signs:** Failed jobs increase after deploy; job's `error` column shows image-related messages but `post_id` is also null.

## Code Examples

### `@google/genai` `ApiError` shape (verified from `node_modules`)

```typescript
// node_modules/@google/genai/dist/genai.d.ts:335-339 — Source of truth
export declare class ApiError extends Error {
    /** HTTP status code */
    status: number;
    constructor(options: ApiErrorInfo);
}

export declare interface ApiErrorInfo {
    /** The error message. */
    message: string;
    /** The HTTP status code. */
    status: number;
}

// Usage in classifier:
import { ApiError } from "@google/genai";  // exported from package root

function isTransient5xx(err: unknown): boolean {
  return err instanceof ApiError && err.status >= 500 && err.status < 600;
}
```

**Verified at `node_modules/@google/genai/dist/node/index.mjs:7330-7337`:** `ApiError extends Error`, sets `this.name = 'ApiError'`, sets `this.status = options.status` from constructor.

**Note:** The SDK also has subclasses for 401 (`AuthenticationError`), 400 (`BadRequestError`), 404 (`NotFoundError`), 429 (`RateLimitError`), 5xx (`InternalServerError`), etc. **All inherit from `ApiError`**, so `err instanceof ApiError && err.status >= 500` is the safe predicate. Do NOT use `instanceof InternalServerError` — that subclass has `APIError<number, Headers>` shape (note capitalization mismatch: SDK has both `ApiError` and `APIError` declared — the public type for `ApiError` is the simpler one at line 335).

### Drizzle JSONB column declaration with typed shape (canonical from `shared/schema/presentations.ts:43`)

```typescript
slides: jsonb("slides").$type<SlideBlock[]>().notNull().default([])
```

For Phase 38 (no `notNull`, no `default` — both are correct because spec calls for NULL on skipped jobs):

```typescript
durationsMs: jsonb("durations_ms").$type<DurationsMs>()
```

### Existing migration pattern (`scripts/migrate-blog-automation.ts:1-42`)

(Reproduced as Pattern 4 above — already verified canonical.)

### Storage layer auto-typing via `$inferInsert`

```typescript
// shared/schema/blog.ts already exports:
export type InsertBlogGenerationJob = typeof blogGenerationJobs.$inferInsert;

// Adding `durationsMs: jsonb(...).$type<DurationsMs>()` to the table automatically
// adds `durationsMs?: DurationsMs | null | undefined` to InsertBlogGenerationJob.
// No edit needed to:
//   - server/storage.ts (createBlogGenerationJob / updateBlogGenerationJob signatures)
//   - server/lib/blog-generator.ts (BlogGeneratorStorage Pick<...>)
// The signatures are inferred from the table; adding the column = adding the field everywhere.
```

**This is the single most important architectural fact for Phase 38:** the storage layer signature changes are **zero-edit** — Drizzle `$inferInsert` propagates the new field automatically. Plan 38-01's only storage touch is the schema file.

### Expand-on-click row pattern (canonical for Plan 38-03)

```typescript
// client/src/components/admin/blog/JobHistoryPanel.tsx (canonical addition)

import { ChevronDown, ChevronRight } from "lucide-react";

// In the existing BlogGenerationJobWithRssItem interface, add:
interface BlogGenerationJobWithRssItem {
  // ...existing fields...
  durationsMs: { topic: number; content: number; image: number | null; upload: number; total: number } | null;
}

// In the component body — track which rows are expanded:
const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

function toggleExpanded(id: number) {
  setExpandedIds((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
}

// In the row JSX — add cursor-pointer + onClick to the outer div, and chip + expand panel:
<div
  key={job.id}
  className="rounded-lg border bg-card p-3 cursor-pointer"
  onClick={() => job.durationsMs && toggleExpanded(job.id)}
  data-testid={`row-job-${job.id}`}
>
  <div className="flex items-start gap-3">
    {job.durationsMs && (
      expandedIds.has(job.id)
        ? <ChevronDown className="w-4 h-4 mt-1 text-muted-foreground" />
        : <ChevronRight className="w-4 h-4 mt-1 text-muted-foreground" />
    )}
    <div className="flex-1 min-w-0 space-y-1">
      {/* existing top-row fields... */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* existing badges... */}
        {job.durationsMs && (
          <Badge variant="secondary" className="text-xs">
            ⏱ {(job.durationsMs.total / 1000).toFixed(1)}s
          </Badge>
        )}
      </div>
      {/* existing rssItemTitle, error... */}
    </div>
    {/* existing action buttons (Retry / Cancel) — DO NOT propagate click */}
    <div className="shrink-0 flex flex-col gap-1" onClick={(e) => e.stopPropagation()}>
      {/* ...buttons... */}
    </div>
  </div>

  {/* Expanded breakdown */}
  {expandedIds.has(job.id) && job.durationsMs && (
    <div className="mt-3 pl-7 grid grid-cols-5 gap-2 text-xs">
      <div><div className="text-muted-foreground">{t("Topic")}</div><div>{job.durationsMs.topic}ms</div></div>
      <div><div className="text-muted-foreground">{t("Content")}</div><div>{job.durationsMs.content}ms</div></div>
      <div><div className="text-muted-foreground">{t("Image")}</div><div>{job.durationsMs.image ?? "—"}{job.durationsMs.image != null ? "ms" : ""}</div></div>
      <div><div className="text-muted-foreground">{t("Upload")}</div><div>{job.durationsMs.upload}ms</div></div>
      <div><div className="text-muted-foreground">{t("Total")}</div><div>{job.durationsMs.total}ms</div></div>
    </div>
  )}
</div>
```

**Critical detail:** Action buttons must `stopPropagation()` so clicking Retry/Cancel doesn't toggle the row expansion.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `setInterval(fn, FIXED_MS)` | Recursive `setTimeout` for settings-driven intervals | This phase | Settings change visible on next tick; no double-fires |
| 5 separate timing columns (`topic_ms`, `content_ms`, etc.) | Single `JSONB` column with shape | This phase | One migration; flexible for future stages; one storage touch |
| Hand-rolled retry per call site | Composed `withGeminiRetry` over `withGeminiTimeout` | This phase | DRY; classifier in one place; existing timeout layer untouched |
| Regex on `err.message` for HTTP status | `instanceof ApiError && err.status >= 500` | This phase | SDK-guaranteed contract; survives Gemini SDK upgrades |
| `@google/genai` 1.0.x (no `ApiError` export) | 1.50.x with `ApiError extends Error` + `.status: number` | Pre-Phase 38 (project pinned at 1.50.1) | Exact transient classifier predicate is now possible without message parsing |

**Deprecated/outdated:** None — all referenced patterns are current.

## Open Questions

1. **Should failed jobs populate partial `durations_ms`?**
   - What we know: CONTEXT D-04 says "populate whatever stages completed before the failure (e.g., `{topic: 1200, content: 8500}` if image errored)."
   - What's unclear: The mechanism. `runPipeline` re-throws on stage failure; the outer catch in `BlogGenerator.generate()` doesn't see local stage timings.
   - Recommendation: Plan 38-02 attaches `partialDurationsMs` to the thrown error via `Object.assign(err, { partialDurationsMs })`. The catch block reads it. Avoids restructuring `runPipeline` signature.

2. **Should `total` chip show ms or human-formatted seconds?**
   - What we know: CONTEXT marks this as Claude's discretion.
   - What's unclear: Existing chip style in `JobHistoryPanel`.
   - Recommendation: Look at the existing badges in JobHistoryPanel (line 152, status badges) — they're terse. Use `(ms / 1000).toFixed(1) + "s"` format (`12.4s`) for the chip, raw ms in the expanded breakdown table. Consistent with the project's existing terseness.

3. **Should `durations_ms` be added to `selectBlogGenerationJobSchema` Zod, or only to the Drizzle table?**
   - What we know: Existing `selectBlogGenerationJobSchema` (line 92) is hand-rolled, not auto-generated. Storage returns `BlogGenerationJob` (Drizzle `$inferSelect`) which already has `durationsMs` after schema edit.
   - What's unclear: Whether downstream code re-validates via the Zod schema.
   - Recommendation: Add to both for symmetry. The select Zod is used as a contract surface for routes — if a future route validates input, it should accept the field.

4. **Does Plan 38-03 need new translation keys, and how many?**
   - What we know: CLAUDE.md requires admin UI strings to use `t()`. Translations.ts is at 443/600 lines (157-line headroom).
   - What's unclear: Exact key count needed.
   - Recommendation: 6 new keys: `Topic`, `Content`, `Image`, `Upload`, `Total`, `Stage timings` (plus possibly `Stage breakdown`). Topic/Content/Total may already exist (Topic likely exists from Phase 35-37 admin UI). Plan-time grep verifies. Worst-case 6 entries × 2 lines = 12 lines added — well within headroom.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@google/genai` | All Gemini calls (existing); retry classifier (new) | ✓ | 1.50.1 | — |
| `drizzle-orm` | JSONB column + storage auto-typing | ✓ | 0.39.3 | — |
| `pg` (via `pool`) | Migration runner | ✓ | (transitive, in `server/db.js`) | — |
| `tsx` | Run migration script | ✓ | 4.20.5 | — |
| `dotenv` | `import "dotenv/config"` in migration | ✓ | (already in scripts) | — |
| `lucide-react` | `ChevronDown` / `ChevronRight` icons for expand row | ✓ | 0.453.0 | Inline SVG (5 lines) |
| Postgres / Supabase database | Migration target | ✓ | Production + Supabase | — |
| `npm run check` (TypeScript compiler) | The only automated gate per CLAUDE.md ("Manual QA only") | ✓ | tsc 5.6.3 | — |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None.

**All required tooling is present.** Phase 38 introduces zero new dependencies.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None (project explicitly states "Manual QA only — No test framework available" in CLAUDE.md) |
| Config file | None |
| Quick run command | `npm run check` (TypeScript only — no behavior tests) |
| Full suite command | `npm run check` |
| Phase gate | `npm run check` exits 0 + manual QA per success criterion |

The project has 3 ad-hoc test files (`server/lib/__tests__/blog-generator.test.ts`, `blogSchema.test.ts`, `slideBlockSchema.test.ts`) using `node:assert`, but **no `npm test` script** is registered in `package.json`. They are run manually via `npx tsx` and are not part of any gate.

### Phase Requirements → Verification Map

| Req ID | Behavior | Test Type | Verification |
|--------|----------|-----------|-------------|
| BLOG2-14 | Cron interval = `24h / postsPerDay` clamped ≥ 60min; settings change reflected on next tick | manual-only | (1) Set `postsPerDay = 4` → next-tick log shows 6h interval; (2) Change to 24 → next tick shows 60min (clamped); (3) Change to 0 → next tick shows 60min (poll); (4) `npm run check` clean. |
| BLOG2-15 | Every completed job has `durations_ms` populated; admin UI shows chip + breakdown | manual-only + check | (1) Run `BlogGenerator.generate({ manual: true })` once via existing admin "Generate Now" → SELECT confirms `durations_ms IS NOT NULL`; (2) Open admin Job History → chip visible, click → breakdown shown; (3) `npm run check` clean. |
| BLOG2-16 | Transient Gemini error retries `[1s, 5s, 30s]`; final failure marks job failed | manual-only | (1) Mock Gemini to throw `ApiError(status=503)` 3× then succeed → log shows 3 retry messages, job completed; (2) Mock to throw 4× → job failed with reason mapped from final error; (3) Mock 4xx → no retry, immediate failure; (4) Image failure exhaustion → post saved with `featureImageUrl: null` (Phase 22 D-04 preserved). |

### Sampling Rate

- **Per task commit:** `npm run check` (only automated gate)
- **Per wave merge:** `npm run check` + git diff review
- **Phase gate:** `npm run check` clean + manual QA passes for all 3 BLOG2-XX criteria above

### Wave 0 Gaps

- [ ] None — `npm run check` infrastructure is already in place; no test files needed (project policy)

*The "Validation Architecture" section is included for nyquist_validation compliance, but the project's CLAUDE.md is explicit about manual-only QA. Plans should not specify automated test files unless the planner explicitly authorizes a deviation from the project policy.*

## Sources

### Primary (HIGH confidence)

- `node_modules/@google/genai/package.json` (v1.50.1, verified 2026-05-05) — Confirms installed Gemini SDK version
- `node_modules/@google/genai/dist/genai.d.ts:335-354` — Public `ApiError extends Error` with `status: number` property; `ApiErrorInfo` interface
- `node_modules/@google/genai/dist/node/index.mjs:7330-7337` — Runtime implementation of `ApiError` (sets `name = 'ApiError'`, `status = options.status`)
- `shared/schema/blog.ts:44-57` — Existing `blogGenerationJobs` table schema (where `durationsMs` column gets added)
- `shared/schema/presentations.ts:43`, `shared/schema/cms.ts:92`, `shared/schema/estimates.ts:42`, `shared/schema/hub.ts:123`, `shared/schema/settings.ts:84` — Five canonical references for `jsonb().$type<T>()` declaration
- `server/cron.ts:1-38` — Current `setInterval` shape (replaced by recursive setTimeout in Plan 38-02)
- `server/lib/blog-generator.ts:149-166` (existing `withGeminiTimeout`) — Wrapper that `withGeminiRetry` will compose over
- `server/lib/blog-generator.ts:316-405` (existing `runPipeline`) — Where per-stage timing capture inserts
- `server/lib/blog-generator.ts:349-360` — Existing image-failure non-blocking try/catch (Phase 22 D-04 contract — must NOT be moved)
- `server/lib/blogContentValidator.ts:112-124` — `GeminiTimeoutError` and `GeminiEmptyResponseError` classes (used by classifier)
- `server/storage.ts:152-155` — Existing `BlogGenerationJobWithRssItem extends BlogGenerationJob` interface (gains `durationsMs` automatically via Drizzle `$inferSelect`)
- `server/storage.ts:2058-2070` — `createBlogGenerationJob` and `updateBlogGenerationJob` (zero edits needed; auto-types from `$inferInsert`)
- `server/storage.ts:2229-2291` — `listBlogGenerationJobs` and `getBlogGenerationJobWithRssItem` (need `durationsMs: blogGenerationJobs.durationsMs` added to the explicit `select({...})` projection)
- `client/src/components/admin/blog/JobHistoryPanel.tsx` (225 lines) — Phase 37 component getting expand-on-click addition
- `scripts/migrate-notification-templates.ts:1-32` — Phase 31 raw-SQL tsx migration template (canonical shape)
- `scripts/migrate-blog-automation.ts:1-42` — Phase 21 raw-SQL tsx migration template (also canonical)
- `migrations/0035_create_blog_automation_tables.sql` — Original `blog_generation_jobs` table SQL (Phase 38's ALTER targets this table)
- `migrations/0041_create_blog_rss_tables.sql` + `supabase/migrations/20260504150000_create_blog_rss_tables.sql` — Phase 34 mirrored migration shape (most recent reference)
- `vercel.json:50-58` (functions block) — No `crons` block present; confirms Vercel cron is not currently configured
- `package.json` (scripts: `dev`, `check`, `build`; no `test` script) — Confirms manual-QA-only project policy
- `.planning/phases/36-generator-quality-overhaul/36-03-SUMMARY.md` — Compaction strategies (template literals, comment trims, method-shorthand) used to fit `blog-generator.ts` under 600-line cap; Phase 38 must reuse same playbook

### Secondary (MEDIUM confidence)

- Vercel docs: <https://vercel.com/docs/cron-jobs> (fetched 2026-05-05) — Confirms cron expressions are static (vercel.json), require redeploy to change. No runtime API for schedule mutation.
- Vercel docs: <https://vercel.com/docs/cron-jobs/manage-cron-jobs> — Reference for `vercel-cron/1.0` user agent (already used by `isAuthorizedCronRequest` via `x-vercel-cron` header detection)
- `npm view @google/genai version` → `1.52.0` (latest 2026-05-05); project pinned at 1.50.1 — surgical-scope rule says do not upgrade
- `npm view drizzle-orm version` → `0.45.2` (latest 2026-05-05); project pinned at 0.39.3 — same rule

### Tertiary (LOW confidence)

- "Recursive `setTimeout` self-pacing scheduler" pattern terminology — internal name; commonly called "self-pacing loop" or "recursive timer" in node ecosystem. No specific URL; pattern is canonical Node.js usage.
- Backoff schedule `[1s, 5s, 30s]` interpretation — CONTEXT spec is explicit about delays; researcher confirms no jitter, no exponential formula, fixed delays.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — All deps verified in `node_modules` and `package.json`; versions confirmed via `npm view`.
- Architecture: HIGH — Every pattern has 1+ canonical reference in the existing codebase. Recursive setTimeout is standard Node.js. Drizzle JSONB pattern has 17+ references in `shared/schema/*.ts`. Migration template has 6 byte-identical references.
- Pitfalls: HIGH — Phase 36-03 600-line cap pitfall is documented in the SUMMARY; Phase 22 D-04 image-failure contract is in CONTEXT. Other pitfalls are derived from the canonical patterns.
- Vercel cron behavior: HIGH — Confirmed by Vercel official docs that schedules are static. Confirmed by `vercel.json` inspection that no `crons` block exists today.
- Gemini SDK error surface: HIGH — Verified directly from `node_modules/@google/genai/dist/genai.d.ts:335` and `dist/node/index.mjs:7330`. Public class with documented `status: number` property.

**Research date:** 2026-05-05
**Valid until:** 2026-06-05 (30 days; stable codebase, no upcoming Gemini SDK major)

---

*Phase: 38-dynamic-cron-observability*
*Research completed: 2026-05-05*
