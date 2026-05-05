# Phase 35: RSS Fetcher & Topic Selection - Discussion Log

> **Audit trail only.** Decisions live in CONTEXT.md.

**Date:** 2026-05-04
**Phase:** 35-rss-fetcher-and-topic-selection
**Mode:** Auto (`--auto`) — all gray areas resolved with recommended defaults

---

## Auto-Selected Decisions

| Area | Choice | Rationale |
|------|--------|-----------|
| RSS Parser | `rss-parser` npm package | Battle-tested, RSS+Atom, ~50KB, no native deps |
| Fetcher Architecture | Single `fetchAllRssSources()` entry point | One function, one purpose |
| Cron Strategy | setInterval (local) + `/api/blog/cron/fetch-rss` (Vercel) | Mirrors v1.5 generator cron pattern |
| Items Per Fetch | Cap at 20 most recent + filter by `last_fetched_at` | Bounds DB writes per run |
| GUID Resolution | `<guid>` → URL → SHA-256 hash fallback | Graceful chain; UNIQUE constraint as final safeguard |
| Item Summary | Strip HTML, limit 1000 chars plain text | Sufficient for scoring + AI prompt |
| Error Handling | Set `last_fetched_status=error`, don't disable source | Transient failures shouldn't permanently kill sources |
| Scoring | 60% keyword overlap + 40% recency (14d window) | Two interpretable signals, easy to tune |
| Topic Selection | `selectNextRssItem(settings)` returns top-scored or null | Replaces v1.5 generic-topic AI call |
| Skip Path | Job row with `reason=no_rss_items`, no Gemini call | Honors RSS-08; saves API spend on empty queue |
| File Layout | rssFetcher.ts + rssTopicSelector.ts + modified blog-generator.ts | Separation of concerns |
| Auth | Bearer `${CRON_SECRET}` on cron endpoint | Matches existing v1.5 pattern |
| Concurrency | Idempotent (no global lock); sequential within run | DB UNIQUE constraint is source of truth |

## Claude's Discretion

- Internal type shapes (RssParsedItem)
- Helper decomposition for scoring
- Log prefix style (`[rss-fetcher]`, `[rss-selector]`)
- HTTP User-Agent header on RSS requests

## Deferred Ideas

- Parallel source fetching
- Per-host rate limiting
- Conditional GET (ETag/Last-Modified)
- Auto-disable on N consecutive errors
- Tunable score weights via settings UI
- Source-level priority boost
