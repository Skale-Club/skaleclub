---
phase: 37-admin-ux-rss-job-improvements
plan: 01
subsystem: api
tags: [drizzle, postgres, rss, blog-automation, storage-layer, leftJoin]

requires:
  - phase: 34-rss-sources-foundation
    provides: blog_rss_sources + blog_rss_items tables (FK + status enum) and RSS storage primitives (listPendingRssItems, markRssItemUsed/Skipped)
  - phase: 35-rss-fetcher-and-topic-selection
    provides: scoreItem() pure ranker reused for D-05 real-time relevance score
  - phase: 22-blog-generator-engine
    provides: blog_generation_jobs schema and getLatestBlogGenerationJob method that the new joined readers extend
provides:
  - listRssItemsByStatus(status, limit, offset) — paginated RSS items joined with source name + per-row pending score
  - listBlogGenerationJobs(limit) — recent jobs joined with the title of the RSS item that produced them (via postId -> usedPostId chain)
  - getBlogGenerationJob(id) — single-row read for cancel/retry handlers
  - getBlogGenerationJobWithRssItem(id) — single-row joined variant (Info-9, avoids O(N) scan in retry handler)
  - GET /api/blog/health — admin-auth booleans { apiKeyConfigured, integrationEnabled } for the red warning banner
  - Two exported result-row interfaces (RssItemWithSource, BlogGenerationJobWithRssItem) for Plan 02 + Plan 03 imports
affects: [37-02-rest-endpoints, 37-03-frontend-panels]

tech-stack:
  added: []
  patterns:
    - Joined read methods land in storage layer (not raw SQL in routes) — extends Phase 34 RSS storage convention
    - Pending-row score attached at storage layer via scoreItem() so queue display ranking is byte-identical to the cron picker (D-05 contract)
    - Joined single-row variant alongside list variant to keep retry/cancel handlers O(1) (Info-9)
    - leftJoin on blog_generation_jobs.postId === blog_rss_items.usedPostId (no rssItemId FK column added — schema migration out of scope per phase boundary)

key-files:
  created: []
  modified:
    - server/storage.ts
    - server/routes/blogAutomation.ts

key-decisions:
  - "Reuse scoreItem from rssTopicSelector (no re-implementation) so queue ranking matches the cron picker byte-for-byte (D-05 contract)"
  - "postId-based join for job history — there is no rssItemId column on blog_generation_jobs; the only reliable link is blog_generation_jobs.postId === blog_rss_items.usedPostId. Skipped/failed jobs correctly return rssItemTitle=null"
  - "Added getBlogGenerationJobWithRssItem(id) joined single-row variant to honor Info-9 — keeps the retry handler in Plan 02 from doing a 200-row scan to recover rssItemId"
  - "GET /api/blog/health stays pure (booleans only, no secret leak) and reuses the existing 'gemini' chat_integrations row — no new provider key, no divergent integration state"

patterns-established:
  - "Joined-read pattern in storage.ts: explicit column select to keep return shape stable when adding joined fields (vs spread-from-table that breaks under sub-select changes)"
  - "Single-row joined variant alongside list variant when handlers need O(1) lookups (Info-9 — getBlogGenerationJobWithRssItem)"

requirements-completed: [BLOG2-08, BLOG2-10, BLOG2-12]

duration: 4min
completed: 2026-05-05
---

# Phase 37 Plan 01: Backend Storage Foundation Summary

**4 joined-read storage methods + GET /api/blog/health endpoint that unblock the Phase 37 admin UI by surfacing source-name + item-title joins through the IStorage interface and providing the single source of truth for the API-key warning banner.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-05-05T13:26:01Z
- **Completed:** 2026-05-05T13:30:19Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Two new exported result-row interfaces (`RssItemWithSource`, `BlogGenerationJobWithRssItem`) ready for Plan 02 + Plan 03 to import
- Four IStorage methods declared and implemented on DatabaseStorage with Drizzle `leftJoin` queries
- `listRssItemsByStatus` attaches a real-time relevance score to every pending row via `scoreItem` (D-05) and `null` for used/skipped
- `listBlogGenerationJobs` joins through the `postId` -> `usedPostId` chain — no schema migration needed
- `GET /api/blog/health` admin endpoint returns booleans only (no secret leak), reusing the existing `gemini` chat-integration row
- Both `npm run check` runs after each task confirmed no NEW TypeScript errors introduced (pre-existing module errors logged to deferred-items.md)

## Task Commits

1. **Task 1: Add 3+1 read methods to IStorage + DatabaseStorage with joins** — `043986a` (feat)
2. **Task 2: Add GET /api/blog/health endpoint** — `42e2419` (feat)

## Files Created/Modified

- `server/storage.ts` — +144 lines
  - Line 2: `import { scoreItem } from "./lib/rssTopicSelector.js";` (new local import)
  - Line 113: `type BlogRssItemStatus,` added to schema type imports
  - Lines 146–156: Two new exported interfaces (`RssItemWithSource`, `BlogGenerationJobWithRssItem`)
  - Lines 736–745: Four new IStorage method declarations (after `markRssItemSkipped`, before `getHubLives`)
  - Lines 2181–2291: Four new DatabaseStorage method implementations (after `markRssItemSkipped`, before `getHubLives`)
- `server/routes/blogAutomation.ts` — +9 lines (94 total, well under 600-line cap)
  - Lines 86–93: New `app.get("/api/blog/health", requireAdmin, ...)` block

## Exported Interfaces (Plan 02 / Plan 03 import targets)

```typescript
// from "../storage.js"
export interface RssItemWithSource extends BlogRssItem {
  sourceName: string | null;  // null if source was deleted
  score: number | null;       // D-05: real-time score for pending rows; null for used/skipped
}

export interface BlogGenerationJobWithRssItem extends BlogGenerationJob {
  rssItemTitle: string | null;  // null when job has no postId or no item linked to that postId
  rssItemId: number | null;     // null when not linked
}
```

## Verification

All grep checks pass against the committed code:

| Symbol | Count | Notes |
|---|---|---|
| `listRssItemsByStatus` | 2 | 1 IStorage decl + 1 DatabaseStorage impl |
| `listBlogGenerationJobs` | 4 | decl + impl + 2 internal references |
| `getBlogGenerationJob` | 2 | decl + impl |
| `getBlogGenerationJobWithRssItem` | 2 | decl + impl |
| `scoreItem` | 3 | import + 2 usages in pending-row score path |
| `RssItemWithSource` | 6 | export + interface body + IStorage decl + 3 implementation casts |
| `BlogGenerationJobWithRssItem` | 8 | export + body + 2 decls + 4 implementation references |
| `leftJoin(blogRssSources` | 1 | source-name join in `listRssItemsByStatus` |
| `blogRssItems.usedPostId` | 4 | item-title join in both `listBlogGenerationJobs` and `getBlogGenerationJobWithRssItem` |
| `/api/blog/health` | 1 | route registered |
| `BLOG_GEMINI_API_KEY` | 1 | env probe |
| `getChatIntegration("gemini")` | 1 | integration probe |

## Decisions Made

- **postId-based join (no schema migration):** `blog_generation_jobs` has no `rssItemId` column. The only reliable link is through the post the job produced (`blog_generation_jobs.postId === blog_rss_items.usedPostId`). Skipped/failed jobs that never created a post correctly return `rssItemTitle: null`; the admin UI shows the reason (e.g. `no_rss_items`, `gemini_timeout`) for those rows.
- **Reuse scoreItem (don't reimplement):** Importing `scoreItem` from `./lib/rssTopicSelector.js` keeps queue-display ranking byte-identical to the cron picker, which is the D-05 contract.
- **Added getBlogGenerationJobWithRssItem (Info-9):** Plan as written had only `getBlogGenerationJob(id)`; Info-9 in the must_haves block called for a joined single-row variant so the retry handler in Plan 02 doesn't have to do an O(200) scan over `listBlogGenerationJobs(200).find(...)`. Added per the must_haves contract.
- **No new provider key for /api/blog/health:** Reuses the existing `'gemini'` `chat_integrations` row from Phase 22-23 instead of introducing a divergent provider key.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

**Pre-existing TypeScript errors (out of scope):** `npm run check` reports 4 errors in `server/lib/blogContentValidator.ts` and `server/lib/rssFetcher.ts` related to missing `sanitize-html` and `rss-parser` modules. Verified pre-existing on main HEAD via `git stash && npm run check`. Logged to `.planning/phases/37-admin-ux-rss-job-improvements/deferred-items.md`. No Phase 37 file imports these modules; my own edits compile clean (no new errors introduced).

## User Setup Required

None — no external service configuration required. The new `/api/blog/health` endpoint reads existing `BLOG_GEMINI_API_KEY` env and existing `chat_integrations` row.

## Next Phase Readiness

- Plan 02 (REST endpoints) can `import { RssItemWithSource, BlogGenerationJobWithRssItem } from "../storage.js"` and call all 4 new storage methods directly
- Plan 03 (frontend panels) has a stable response shape contract for `RssQueuePanel` (joined source name + score) and `JobHistoryPanel` (joined item title)
- Health endpoint is ready for `AutomationStatusBanners.tsx` to consume in Plan 03

## Self-Check: PASSED

- File `server/storage.ts` exists and contains all 4 new methods + 2 exported interfaces (verified via Grep on lines 146/152/736/741/742/745/2181/2229/2257/2266)
- File `server/routes/blogAutomation.ts` exists and contains the health route (line 88)
- Commit `043986a` exists in git log (`feat(37-01): add joined RSS read methods to storage layer`)
- Commit `42e2419` exists in git log (`feat(37-01): add GET /api/blog/health admin endpoint`)
- `npm run check` introduces no NEW errors vs. main HEAD baseline

---
*Phase: 37-admin-ux-rss-job-improvements*
*Completed: 2026-05-05*
