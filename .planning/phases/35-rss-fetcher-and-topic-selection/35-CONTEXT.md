# Phase 35: RSS Fetcher & Topic Selection - Context

**Gathered:** 2026-05-04
**Status:** Ready for planning
**Mode:** Auto (all gray areas resolved with recommended defaults)

<domain>
## Phase Boundary

Server-side machinery to (1) periodically fetch RSS items from enabled sources and persist new items to `blog_rss_items`, and (2) select the highest-scored pending item per generator run, marking it `used` once the post is created. This phase wires the existing schema (Phase 34) to a real ingestion pipeline and to the generator's topic-picking step.

NOT in this phase: the generator's own quality overhaul (Phase 36), admin UI for sources/items (Phase 37), dynamic cron frequency for the generator (Phase 38).

</domain>

<decisions>
## Implementation Decisions

### RSS Parser Library

- **D-01:** Use `rss-parser` (npm package) for feed parsing.
  - **Why:** Battle-tested, handles both RSS 2.0 and Atom, ~50KB, no native deps. Existing project pattern of "single canonical lib per concern" (e.g., `@google/genai` for blog gen, `@anthropic-ai/sdk` for presentations).

### Fetcher Architecture

- **D-02:** A single fetcher entry point `fetchAllRssSources()` in `server/lib/rssFetcher.ts` that:
  1. Lists all sources where `enabled = true`
  2. For each source: parses feed, upserts items, updates `last_fetched_at` + `last_fetched_status` + `error_message`
  3. Returns a summary `{ sources_processed, items_upserted, errors[] }`
  - **Why:** One function, one purpose. Separates fetching from scoring (which lives elsewhere).

### Cron Strategy

- **D-03:** Two trigger paths matching the v1.5 generator cron pattern:
  - Local/non-Vercel: `setInterval` in `server/cron.ts` runs `fetchAllRssSources()` every 60 minutes (Vercel-guarded with `process.env.VERCEL` check)
  - Vercel: dedicated endpoint `POST /api/blog/cron/fetch-rss` authenticated with `CRON_SECRET` Bearer token, scheduled via `vercel.json`
  - **Why:** Mirrors the existing `/api/blog/cron/generate` pattern from v1.5 — admin already understands this contract.

### Items Per Fetch

- **D-04:** Cap each fetch at the 20 most recent items per source. Skip items where `published_at < source.last_fetched_at` (only ingest items newer than last successful fetch).
  - **Why:** Caps DB writes per fetch (worst case: 20 sources × 20 items = 400 upserts per cron tick). The `last_fetched_at` filter avoids re-processing the same items every hour.

### GUID Determination

- **D-05:** Item GUID resolution chain (first non-empty value wins):
  1. `<guid>` element from RSS / `<id>` from Atom
  2. The `link` URL
  3. SHA-256 hash of `${source_id}|${title}|${pub_date}`
  - **Why:** Some feeds omit `<guid>`; fallback to URL, then a synthesized hash. The DB-level UNIQUE `(source_id, guid)` constraint is the final dedup safeguard.

### Item Summary Storage

- **D-06:** Strip HTML from RSS `<description>` / Atom `<summary>` and store the first 1000 characters of plain text in `blog_rss_items.summary`.
  - **Why:** RSS feeds often have ad-laden HTML descriptions. Plain text is sufficient for keyword scoring and as Gemini prompt context. 1000 chars is plenty for both purposes.

### Source-Level Error Handling

- **D-07:** If a source's feed fails to fetch/parse:
  - Set `last_fetched_status = 'error'`
  - Set `error_message = String(err).slice(0, 500)`
  - Do NOT disable the source automatically
  - Continue to the next source (one bad feed doesn't break the run)
  - **Why:** Transient failures (DNS, 503, malformed XML) shouldn't permanently disable a source. The admin sees the error in the UI (Phase 37) and decides whether to fix or disable.

### Scoring Algorithm

- **D-08:** A pure function `scoreItem(item, settings): number` that returns a numeric score. Linear combination:
  - **Keyword overlap (60% weight):** count of `seoKeywords` from `blog_settings` appearing in `title + summary` (case-insensitive). Normalized to `[0, 1]` by dividing by `seoKeywords.length`.
  - **Recency (40% weight):** `1 - clamp((now - published_at) / 14days, 0, 1)`. A post from today scores 1.0; a 2-week-old post scores 0.0.
  - Final score: `0.6 * keywordScore + 0.4 * recencyScore`
  - **Why:** Two interpretable signals. Easy to tune later. No ML, no training data needed for v1.9.

### Topic Selection Integration

- **D-09:** New helper `selectNextRssItem(settings): Promise<BlogRssItem | null>` in `server/lib/blog-generator.ts` (or a sibling file `rssTopicSelector.ts`):
  1. `listPendingRssItems(50)` — get top 50 most recent pending items
  2. Score each via `scoreItem(item, settings)`
  3. Return the top-scored item, or `null` if list is empty
  - The generator's `generate()` method calls this BEFORE the Gemini topic prompt. If `null`, return `{ skipped: true, reason: 'no_rss_items' }` (RSS-08).
  - After post creation succeeds, call `markRssItemUsed(item.id, post.id)`.
  - **Why:** Replaces the v1.5 "invent a generic topic" step with a real RSS-driven topic. Items become `used` only when generation succeeds — failures leave the item `pending` for retry.

### Generator Skip Path

- **D-10:** When `selectNextRssItem` returns `null`:
  - Insert a `blog_generation_jobs` row with `status = 'skipped'`, `reason = 'no_rss_items'`
  - Return `{ skipped: true, reason: 'no_rss_items' }` from `generate()`
  - Do NOT call Gemini at all (no API spend on empty queue)
  - **Why:** Honors RSS-08. The admin sees the `no_rss_items` reason in job history (Phase 37) and knows to add more RSS sources.

### File Layout

- **D-11:** New files:
  - `server/lib/rssFetcher.ts` — feed parsing + upsert pipeline
  - `server/lib/rssTopicSelector.ts` — scoring + selection logic (kept separate from fetcher for testability)
  - `server/routes/blogAutomation.ts` (modified) — add `POST /api/blog/cron/fetch-rss` route alongside existing `/cron/generate`
  - `server/cron.ts` (modified) — add second `setInterval` for fetcher (60min, Vercel-guarded)
  - `server/lib/blog-generator.ts` (modified) — call `selectNextRssItem` before topic prompt; mark item used on success
  - **Why:** Separates concerns. Each file does one thing.

### Auth on Fetcher Endpoint

- **D-12:** `POST /api/blog/cron/fetch-rss` uses Bearer-token auth checking `Authorization: Bearer ${process.env.CRON_SECRET}`. Same pattern as `/api/blog/cron/generate`.
  - **Why:** Vercel cron sends fixed headers; CRON_SECRET is the standard project pattern for cron-only endpoints.

### Race-Condition Handling

- **D-13:** The fetcher does NOT take a global lock. It's idempotent — `upsertRssItem` uses `onConflictDoUpdate` on `(source_id, guid)`, so concurrent runs cannot create duplicates. Worst case: two cron runs fetch the same items at the same time and the second run is a no-op for already-upserted items.
  - **Why:** Locks add complexity. The DB constraint is the source of truth.

### Concurrency Within a Fetch Run

- **D-14:** Sources are processed SEQUENTIALLY within a single fetcher run (not in parallel).
  - **Why:** Predictable ordering, predictable error handling, easier logs. Parallelism is irrelevant at expected scale (≤20 sources).

### Claude's Discretion

- Internal types (e.g., `RssParsedItem` interface) and intermediate data shapes
- Whether to factor scoring into smaller helpers (`scoreKeywordOverlap`, `scoreRecency`)
- Log prefix style — recommend `[rss-fetcher]` and `[rss-selector]` matching existing `[cron]` style
- Whether to add a `User-Agent` header on RSS HTTP requests — recommended yes (`Skale Club RSS Fetcher/1.0`) for politeness/compliance

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project-Level
- `.planning/PROJECT.md` — vision, AI provider stack, additive constraint
- `.planning/REQUIREMENTS.md` — RSS-05..08 mapped to this phase
- `.planning/ROADMAP.md` §"Phase 35" — phase goal and success criteria
- `.planning/phases/34-rss-sources-foundation/34-CONTEXT.md` — schema decisions this phase relies on (cascade FK, status text+CHECK, two indexes, no score column)
- `.planning/phases/34-rss-sources-foundation/34-01-SUMMARY.md` — schema/migration deliverables
- `.planning/phases/34-rss-sources-foundation/34-02-SUMMARY.md` — storage methods now available

### Existing Patterns
- `server/lib/blog-generator.ts` — current generator, will be modified to call `selectNextRssItem`
- `server/cron.ts` — existing 60-min `setInterval` with Vercel guard (D-03 mirrors this pattern)
- `server/routes/blogAutomation.ts` — existing `POST /api/blog/cron/generate` endpoint (D-12 mirrors this Bearer-token pattern)
- `shared/schema/blog.ts` §RSS — `blogRssSources`, `blogRssItems` tables and types
- `server/storage.ts` — IStorage RSS methods: `listRssSources`, `upsertRssItem`, `listPendingRssItems`, `markRssItemUsed`, `markRssItemSkipped`, `updateRssSource`
- `package.json` — verify `rss-parser` is added as a runtime dep

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `storage.upsertRssItem(item)` — race-safe upsert by `(source_id, guid)` from Phase 34
- `storage.listPendingRssItems(limit?)` — already orders by `published_at DESC NULLS LAST`
- `storage.markRssItemUsed(itemId, postId)` and `storage.markRssItemSkipped(itemId, reason)`
- `storage.updateRssSource(id, patch)` — for updating `last_fetched_at`, `last_fetched_status`, `error_message`
- `BlogGenerator.generate({ manual })` in `server/lib/blog-generator.ts` — current generator entry point
- `process.env.VERCEL` guard pattern in `server/cron.ts`
- `Authorization: Bearer ${CRON_SECRET}` middleware in `server/routes/blogAutomation.ts`

### Established Patterns
- All blog services live in `server/lib/blog-*.ts` (single file per concern)
- Cron endpoints under `/api/blog/cron/*` with CRON_SECRET auth
- Generator returns structured `{ skipped, reason }` or `{ post, jobId }`
- `blog_generation_jobs` rows record every run including skips with reasons

### Integration Points
- `server/cron.ts` gets a second `setInterval` for the fetcher (Vercel-guarded)
- `server/routes/blogAutomation.ts` gets a new `POST /api/blog/cron/fetch-rss` route
- `server/lib/blog-generator.ts` `generate()` gets a pre-Gemini call to `selectNextRssItem`

</code_context>

<specifics>
## Specific Ideas

- The fetcher writes `error_message` truncated to 500 chars — long stack traces shouldn't bloat the source row.
- The scorer's recency window of 14 days is a knob — items older than 2 weeks contribute 0 to recency but can still be picked if their keyword score is high enough.
- The generator's existing skip-validation chain (`no_settings`, `disabled`, `posts_per_day_zero`, `too_soon`, `locked`) gets a NEW skip reason `no_rss_items` ahead of the Gemini call.
- HTTP requests inside `rss-parser` should pass a `User-Agent: Skale Club RSS Fetcher/1.0` header (configurable via `Parser` constructor options).

</specifics>

<deferred>
## Deferred Ideas

- **Parallel source fetching** — Sequential is fine at current scale. Add `Promise.all` later if 20+ sources push fetch latency over a few seconds.
- **Rate-limiting per host** — Multiple feeds on the same domain don't get throttled in v1.9. Add if a publisher rate-limits us.
- **Conditional GET (ETag / If-Modified-Since)** — Saves bandwidth on unchanged feeds. Defer to v1.10 polish.
- **Auto-disable on N consecutive errors** — Manual disable via admin UI is enough for v1.9.
- **Score weight tuning UI** — Hardcoded 60/40 split for v1.9. Settings UI for the weights is future work.
- **Source-level priority boost** — All sources scored equally for v1.9.

</deferred>

---

*Phase: 35-rss-fetcher-and-topic-selection*
*Context gathered: 2026-05-04 (auto mode — recommended defaults)*
