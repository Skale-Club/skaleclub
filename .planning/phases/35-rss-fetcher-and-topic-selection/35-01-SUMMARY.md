---
phase: 35-rss-fetcher-and-topic-selection
plan: 01
subsystem: blog-automation
tags: [rss, rss-parser, ingestion, blog, cron-foundation, gemini-blog-pipeline]

# Dependency graph
requires:
  - phase: 34-rss-sources-foundation
    provides: blogRssSources/blogRssItems tables, storage methods (listRssSources, upsertRssItem, updateRssSource), insertBlogRssItemSchema with z.url() URL constraint
provides:
  - Pure RSS ingestion module — fetchAllRssSources() orchestrator
  - FetchSummary { sourcesProcessed, itemsUpserted, errors[] } return shape
  - Sequential per-source processing with try/catch error isolation
  - GUID fallback chain (guid -> link -> sha256)
  - HTML-stripping + 1000-char summary truncation
  - 20-item-per-source cap; lastFetchedAt skip filter
  - rss-parser@^3.13.0 as a runtime dependency
affects: [35-02-rss-topic-selector, 35-03-cron-and-generator-integration, 37-rss-admin-ui, blog-generator]

# Tech tracking
tech-stack:
  added: [rss-parser@^3.13.0]
  patterns:
    - "Single-purpose lib module under server/lib/ — no cron wiring, no route handler"
    - "Per-source try/catch with summary aggregation (mirrors blog-generator job pattern)"
    - "[rss-fetcher] log prefix matching existing [cron] / [rss-selector] convention"

key-files:
  created:
    - server/lib/rssFetcher.ts
  modified:
    - package.json
    - package-lock.json

key-decisions:
  - "rss-parser@^3.13.0 chosen as canonical RSS lib (D-01) — battle-tested RSS 2.0 + Atom, ships own types"
  - "Single fetchAllRssSources() entry point returning { sourcesProcessed, itemsUpserted, errors[] } (D-02)"
  - "Sequential for...of over enabled sources — never Promise.all (D-14)"
  - "Per-source try/catch isolates failures; never auto-disables a source (D-07)"
  - "Items lacking a valid http(s) link are skipped to avoid violating insertBlogRssItemSchema's z.string().url() constraint — synthesized SHA-256 GUID hashes are not URLs"
  - "15s parser timeout per feed (FETCH_TIMEOUT_MS) — well under any cron run window"
  - "Decimal numeric HTML entities (&#NNN;) decoded via String.fromCodePoint to keep stripped summaries readable without pulling in a new dep"

patterns-established:
  - "Module-level Parser singleton with User-Agent header — reused on every fetch tick"
  - "FetchSummary contract for cron + admin observability — mirrors blog-generator's structured return"
  - "Per-source updateRssSource patch on success AND error — last_fetched_at is always advanced even on failure"

requirements-completed: [RSS-05]

# Metrics
duration: 3min
completed: 2026-05-05
---

# Phase 35 Plan 01: RSS Fetcher Engine Summary

**Pure RSS ingestion module — fetchAllRssSources() iterates enabled blog_rss_sources sequentially, parses feeds via rss-parser@^3.13.0, upserts items by (source_id, guid) UNIQUE index, and records per-source success/error state. Plan 35-03 wires this into cron and the /api/blog/cron/fetch-rss endpoint.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-05-05T02:35:14Z
- **Completed:** 2026-05-05T02:37:14Z
- **Tasks:** 2
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- `server/lib/rssFetcher.ts` (254 lines) — orchestrator + processSource + resolveGuid + parsePublishedAt + stripHtml + isHttpUrl helpers
- `rss-parser@^3.13.0` added as a runtime dependency (npm-managed, lockfile updated)
- Sequential per-source processing with try/catch isolation — one bad feed never stops later sources
- GUID fallback chain (guid → link URL → SHA-256 of `${sourceId}|${title}|${pubDate}`) implemented
- HTML stripped + decimal numeric entity decoder + collapse-whitespace pipeline; summary capped at 1000 chars plain text
- Per-source row stamped with `last_fetched_at` + `last_fetched_status` + `error_message` after every pass (success or error)
- Items where `published_at < source.lastFetchedAt` skipped; cap of 20 items/source/run enforced
- `User-Agent: Skale Club RSS Fetcher/1.0` header + 15s timeout passed to Parser constructor
- Error path truncates `error_message` to ≤500 chars and **never** mutates `enabled` (admin intent preserved)
- Idempotent across runs via `storage.upsertRssItem` ON CONFLICT(source_id, guid) — second run on the same feed is a no-op for already-ingested items

## Task Commits

1. **Task 1: Add rss-parser dependency** — `14950d1` (chore)
2. **Task 2: Implement fetchAllRssSources() in server/lib/rssFetcher.ts** — `4e07888` (feat)

**Plan metadata:** _pending_ (final docs commit recorded after this SUMMARY)

## Files Created/Modified

- `server/lib/rssFetcher.ts` — **NEW** (254 lines). Exports `fetchAllRssSources(): Promise<FetchSummary>` and the `FetchSummary` interface. All other helpers (`processSource`, `resolveGuid`, `parsePublishedAt`, `stripHtml`, `isHttpUrl`) are file-local.
- `package.json` — Added `"rss-parser": "^3.13.0"` to dependencies.
- `package-lock.json` — Regenerated (5 packages added by `npm install`).

## Decisions Made

- **Skip items without a valid http(s) URL** rather than synthesize a fake one. The schema's `z.string().url()` rejects non-URL GUIDs (intentional per Phase 34), and feeds without a `<link>` are vanishingly rare in practice. The synthesized SHA-256 GUID still uniquely identifies the item if it later reappears with a real URL.
- **Plain `String.split().join()` for HTML entity replacement** instead of regex — simpler, avoids escape edge cases on entities like `&amp;` (which would otherwise need lookahead). Single decimal-numeric regex pass handles the remaining `&#NNN;` cases.
- **`finally { summary.sourcesProcessed += 1 }`** — counter advances whether the source succeeded or errored, so `sourcesProcessed === sources.length` is always true on return. `errors.length` reports the failure count separately.
- **No `Parser<T, U>` generics** — the loose `ParsedItem` type alias (intersects `Parser.Item` with optional `id`/`summary`) is sufficient since we read fields defensively with `??` chains.

## Deviations from Plan

None — plan executed exactly as written. Every acceptance criterion from `35-01-PLAN.md` is satisfied:

- ✅ `rss-parser` added with `^3.x` semver range; `package-lock.json` regenerated
- ✅ `npm run check` clean after both tasks
- ✅ `fetchAllRssSources` + `FetchSummary` exported (helpers stay file-local)
- ✅ Imports: `Parser` from `rss-parser`, `storage` from `../storage.js`, types from `#shared/schema.js`
- ✅ All three tunables present: `MAX_ITEMS_PER_SOURCE=20`, `MAX_SUMMARY_CHARS=1000`, `MAX_ERROR_MESSAGE_CHARS=500`
- ✅ `User-Agent: "Skale Club RSS Fetcher/1.0"` on Parser
- ✅ GUID resolution: guid → link → sha256
- ✅ Sequential `for (const source of sources)` — no `Promise.all`
- ✅ Per-source try/catch sets `last_fetched_status` to `"ok"` or `"error"` and never re-throws
- ✅ Error path never sets `enabled` (preserves admin intent — D-07)
- ✅ `published_at < source.lastFetchedAt` filter applied before `upsertRssItem`
- ✅ Items missing valid http(s) URL skipped (avoids Zod URL violation)
- ✅ File at 254 lines (well under 600-line CLAUDE.md cap)
- ✅ No imports from `blog-generator.ts` or `cron.ts` (pure module)

## Issues Encountered

None. `npm install rss-parser@^3.13.0` resolved cleanly to `3.13.0`, both task verifications passed on first compile, and the established storage interface from Phase 34-02 (`listRssSources`, `upsertRssItem`, `updateRssSource`) accepted every call shape without adapter code.

## User Setup Required

None — no external service configuration required. The fetcher reads source URLs from the existing `blog_rss_sources` table (which the admin UI in Phase 37 will populate). No new env vars introduced; the existing `CRON_SECRET` (already in v1.5) will protect the cron endpoint added by Plan 35-03.

## Notes for Plan 35-03 (Cron + Generator Integration)

- **Call site (cron):** Inside the second `setInterval` in `server/cron.ts` (Vercel-guarded), wrap `await fetchAllRssSources()` in try/catch and log the returned `FetchSummary`. Mirror the existing blog-generator pattern (lazy import inside the callback to preserve startup-time guarantees).
- **Call site (route):** `POST /api/blog/cron/fetch-rss` in `server/routes/blogAutomation.ts` — Bearer-token auth via `CRON_SECRET`; respond with the `FetchSummary` JSON. Pattern mirrors `/api/blog/cron/generate`.
- **Generator hand-off (Plan 35-02 owns `selectNextRssItem`):** The generator's `generate()` should call `selectNextRssItem(settings)` BEFORE the Gemini topic prompt. If `null`, insert a `blog_generation_jobs` row with `status='skipped'`, `reason='no_rss_items'` and return `{ skipped: true, reason: 'no_rss_items' }` (RSS-08).
- **Race-safety reminder:** No global lock on the fetcher — concurrent runs are safe because of `(source_id, guid)` UNIQUE index + `onConflictDoUpdate`. Plan 35-03 should NOT add lock plumbing for the fetcher.

## Next Phase Readiness

- ✅ Plan 35-02 (rssTopicSelector) can run in parallel — no shared file, no shared symbol.
- ✅ Plan 35-03 (cron + endpoint + generator wiring) has a stable, exported orchestrator and structured return type to import.
- ✅ No outstanding blockers. Phase 37 (admin UI) can rely on `last_fetched_status` + `error_message` columns being populated as soon as Plan 35-03 ships the cron tick.

## Self-Check: PASSED

- ✅ FOUND: `server/lib/rssFetcher.ts` (254 lines)
- ✅ FOUND: commit `14950d1` (Task 1 — add rss-parser)
- ✅ FOUND: commit `4e07888` (Task 2 — implement fetchAllRssSources)
- ✅ FOUND: `rss-parser@3.13.0` in `package.json` dependencies
- ✅ `npm run check` clean

---
*Phase: 35-rss-fetcher-and-topic-selection*
*Plan: 01*
*Completed: 2026-05-05*
