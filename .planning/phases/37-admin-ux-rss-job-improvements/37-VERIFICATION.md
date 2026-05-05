---
phase: 37-admin-ux-rss-job-improvements
verified: 2026-05-05T15:30:00Z
status: human_needed
score: 7/7 must-haves verified (automated); 7 items routed for manual UAT
human_verification:
  - test: "Open /admin → Blog → RSS tab and verify three sub-tabs (Sources / Queue / Jobs) render under the AutomationStatusBanners"
    expected: "Sub-tabs are visible and switchable; Banners pinned above"
    why_human: "Visual layout and tab interaction cannot be verified programmatically without running the app"
  - test: "In RSS Sources, click Add Source → fill name/URL → Save; toggle the Switch; click Edit; click Delete → confirm"
    expected: "Source appears, Switch auto-saves via PATCH, Edit dialog round-trips, Delete confirmation appears"
    why_human: "End-to-end CRUD flow requires server + DB; the manual QA constraint applies (no test framework)"
  - test: "In RSS Queue, switch among Pending / Used / Skipped sub-tabs, verify pagination next/prev, verify pending rows show numeric score badge"
    expected: "Each sub-tab paginates 50 items; pending rows show two-decimal score badge; Used rows show 'View resulting post' link"
    why_human: "Requires real RSS items in DB; pagination edge cases need real data"
  - test: "Click Generate Now in Automation tab — preview modal opens, generates a draft, then click Save as Draft (or Discard)"
    expected: "Save creates a blog_post (draft) + marks rss_item used; Discard does NOT write to DB; Posts list invalidates"
    why_human: "Requires real Gemini API call; preview content quality and image rendering need visual review"
  - test: "Force a stuck job (lockAcquiredAt > 10min ago, job.status='running') and verify Cancel button appears + works"
    expected: "Cancel button appears in JobHistoryPanel for stale-running rows; clicking it releases the lock and marks job 'cancelled_by_admin'"
    why_human: "Requires intentional DB manipulation to create the stale-lock condition"
  - test: "Unset BLOG_GEMINI_API_KEY (or disable Gemini integration) and reload the RSS tab"
    expected: "Red banner appears with text about Gemini integration unavailable; 'Open Integrations' link visible"
    why_human: "Requires env var change + restart; visual banner appearance"
  - test: "Verify next-run countdown chip reflects (lastRunAt + 24h/postsPerDay) and cost chip computes from postsPerDay"
    expected: "Chips show relative time and dollar amount; tooltip explains 'approximate, based on Gemini list pricing'"
    why_human: "Visual formatting + tooltip behavior + relative time accuracy needs human review"
---

# Phase 37: Admin UX (RSS + Job Improvements, Auto Mode) Verification Report

**Phase Goal:** "The admin can manage RSS sources, see the items queue, preview drafts before they land in Posts, and operate the system (retry, cancel, configure) without touching the database."

**Verified:** 2026-05-05T15:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (mapped to Success Criteria)

| #   | Truth                                                                                                                                                                                                                | Status     | Evidence                                                                                                                                                                                                                          |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Within the Blog section, the admin sees an "RSS Sources" tab/panel — list, add, edit, enable/disable, delete feeds, with last-fetched-at and last error visible per row                                              | ✓ VERIFIED | `BlogSection.tsx:231` adds `'rss'` to `BLOG_TABS`; `RssSourcesPanel.tsx` renders list + Add/Edit Dialog + Delete AlertDialog + auto-save Switch; rows display `Last fetched`, `Never fetched`, and `Fetch error` (lines 174–194)   |
| 2   | An "RSS Queue" view lists items grouped by status (pending/used/skipped) with source name, published date, and (when used) a clickable link to the resulting post                                                    | ✓ VERIFIED | `RssQueuePanel.tsx` renders three status sub-tabs (line 64), source name badge (line 97), publishedAt relative time (line 109), and `/admin?section=blog&postId=` link on Used rows (line 138)                                    |
| 3   | Clicking "Generate Now" opens a preview modal with title, excerpt, feature image, and the first ~200 words of body; admin can Save as Draft or Discard                                                               | ✓ VERIFIED | `BlogSection.tsx:106` "Generate Now" button now calls `setIsPreviewOpen(true)`; `PreviewDraftDialog.tsx` renders title, feature image, excerpt, body preview via `stripHtmlTo200Words`, with Save-as-Draft + Discard buttons       |
| 4   | A "Job History" panel shows last N jobs with timestamps, status badge, source item, error (if any), and a Retry button on failed rows                                                                                | ✓ VERIFIED | `JobHistoryPanel.tsx` queries `/api/blog/jobs?limit=50`, renders status badge (line 151), startedAt/completedAt (lines 161/169), rssItemTitle (line 178), error text (line 186), and Retry button on `status === 'failed'` (194)  |
| 5   | Stuck jobs (lock older than configured staleness) can be cancelled from the UI; lock is force-released and marked failed with reason `cancelled_by_admin`                                                            | ✓ VERIFIED | UI: `JobHistoryPanel.tsx:111` `isStaleRunning` gate uses `settings.lockAcquiredAt`; Server: `blogAutomation.ts:214-250` cancel handler enforces 10-min staleness, releases lock via `upsertBlogSettings({ lockAcquiredAt: null })`, marks job `failed` with `reason: "cancelled_by_admin"` |
| 6   | A red banner warns when Gemini integration is disabled or `BLOG_GEMINI_API_KEY` is missing                                                                                                                            | ✓ VERIFIED | `AutomationStatusBanners.tsx:43-55` queries `/api/blog/health` and renders red banner when `!apiKeyConfigured \|\| !integrationEnabled`; backend `blogAutomation.ts:94-99` returns `{apiKeyConfigured, integrationEnabled}` booleans |
| 7   | Admin sees next scheduled run countdown (`lastRunAt + 24h/postsPerDay`) + estimated monthly Gemini cost                                                                                                              | ✓ VERIFIED | `AutomationStatusBanners.tsx:31-35` `computeNextRun` adds `24/postsPerDay` hours; `computeMonthlyCost` (line 22) multiplies content + image cost × postsPerDay × 30; both rendered as chips at lines 90-123                       |

**Score:** 7/7 truths verified at the artifact + wiring level. Behavioral end-to-end (real Gemini calls, real DB rows) routed to human verification per CLAUDE.md "manual QA only" constraint.

### Required Artifacts

| Artifact                                                          | Expected                                          | Status     | Details                                                                                                          |
| ----------------------------------------------------------------- | ------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------- |
| `server/storage.ts`                                               | 4 new methods + 2 exported interfaces             | ✓ VERIFIED | `listRssItemsByStatus` (line 2181), `listBlogGenerationJobs` (2229), `getBlogGenerationJobWithRssItem` (2266), `RssItemWithSource` + `BlogGenerationJobWithRssItem` exported (lines 146/152) |
| `server/lib/blog-generator.ts`                                    | runPreview helper + rssItemId option              | ✓ VERIFIED | `runPreview` exported (line 427), `PreviewResult` interface (411), `RunPreviewResponse` type (423), `BlogGenerator.generate` accepts `rssItemId?` (489); 588 lines (≤600 cap) |
| `server/routes/blogAutomation.ts`                                 | 11 admin endpoints (1 health + 10 phase 37)       | ✓ VERIFIED | health + 4 sources + 1 items + 3 jobs (list/retry/cancel) + 2 preview = 11 routes, all guarded by `requireAdmin`; 339 lines |
| `client/src/components/admin/blog/RssAutomationTab.tsx`           | Composes 3 panels under sub-tabs + Banners on top | ✓ VERIFIED | 48 lines; mounts `AutomationStatusBanners` + sub-tab buttons + 3 panels                                          |
| `client/src/components/admin/blog/RssSourcesPanel.tsx`            | Sources CRUD + auto-save Switch                   | ✓ VERIFIED | 306 lines; uses `apiRequest` for POST/PATCH/DELETE; Switch onCheckedChange triggers PATCH                        |
| `client/src/components/admin/blog/RssQueuePanel.tsx`              | Queue with status sub-tabs + pagination           | ✓ VERIFIED | 178 lines; 3 status sub-tabs + 50/page pagination + score badge on pending + linked-post link on used            |
| `client/src/components/admin/blog/JobHistoryPanel.tsx`            | Last-50 jobs + retry/cancel + 5s polling          | ✓ VERIFIED | 225 lines; `refetchInterval` gated by `data[0]?.status === 'running'`; `isStaleRunning` reads `settings.lockAcquiredAt` (B-2 contract) |
| `client/src/components/admin/blog/PreviewDraftDialog.tsx`         | Modal: preview → Save / Discard                   | ✓ VERIFIED | 224 lines; calls `/api/blog/preview` on open, `/api/blog/posts/from-preview` on Save, closes without write on Discard |
| `client/src/components/admin/blog/AutomationStatusBanners.tsx`    | Red banner + countdown + cost chips               | ✓ VERIFIED | 127 lines; `BLOG_COST_PRICING` exported; banner gated by `/api/blog/health` booleans                              |
| `client/src/components/admin/BlogSection.tsx`                     | RSS tab added; Generate Now opens dialog          | ✓ VERIFIED | Tab `'rss'` added (line 231); `RssAutomationTab` mounted (line 1325); `PreviewDraftDialog` mounted (line 223); `generateMutation` removed (0 references) |
| `client/src/lib/translations.ts`                                  | New PT-BR keys + ≤600 lines                       | ✓ VERIFIED | "Admin — Blog RSS (Phase 37)" section at line 411; 443 lines (157 line headroom)                                  |

### Key Link Verification

| From                                              | To                                                  | Via                                       | Status   | Details                                                                                                |
| ------------------------------------------------- | --------------------------------------------------- | ----------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------ |
| `BlogSection.tsx` BLOG_TABS                       | `RssAutomationTab`                                  | Third entry + conditional render          | ✓ WIRED  | Line 231 (`{ id: 'rss' as const, label: 'RSS', icon: Rss }`); line 1325 conditional render             |
| `RssAutomationTab`                                | Banners + 3 panels                                  | Single component composition              | ✓ WIRED  | Lines 22, 43–45 of `RssAutomationTab.tsx`                                                              |
| `BlogAutomationPanel` "Generate Now"              | `PreviewDraftDialog`                                | useState toggle replaces direct mutation  | ✓ WIRED  | `BlogSection.tsx:106` opens dialog; `generateMutation` removed                                         |
| `JobHistoryPanel` 5s polling                      | useQuery `refetchInterval`                          | Conditional `jobs[0]?.status === 'running'` | ✓ WIRED  | Line 55–60: returns `5000` only while latest job running, else `false`                                |
| `JobHistoryPanel` cancel-button gate              | `GET /api/blog/settings` (lockAcquiredAt)           | `isStaleRunning(job, settings)`           | ✓ WIRED  | Lines 67–70 useQuery; lines 111–119 staleness check matches server's same `lockAcquiredAt` field      |
| `AutomationStatusBanners`                         | `/api/blog/health` + `/api/blog/settings`           | Two useQuery hooks + boolean derivation   | ✓ WIRED  | Lines 43–55 (`showBanner = !apiKeyConfigured \|\| !integrationEnabled`)                                |
| `POST /api/blog/preview`                          | `runPreview()`                                      | Direct module call (no lock, no jobs row) | ✓ WIRED  | `blogAutomation.ts:267` `await runPreview({ rssItemId })`                                              |
| `POST /api/blog/posts/from-preview`               | `createBlogPost` + `markRssItemUsed`                | Atomic two-step inside one route handler  | ✓ WIRED  | Lines 315–328 — both calls inside one handler; markRssItemUsed best-effort behind try/catch (D-07)     |
| `POST /api/blog/jobs/:id/retry`                   | `BlogGenerator.generate({ manual:true, rssItemId })`| Joined single-row read + new run          | ✓ WIRED  | `blogAutomation.ts:201` invokes generator with explicit `rssItemId`; 409 if no postId                  |
| `POST /api/blog/jobs/:id/cancel`                  | `upsertBlogSettings({lockAcquiredAt:null})` + `updateBlogGenerationJob` | 10-min staleness gate then dual write | ✓ WIRED | Lines 224–249; reason value exactly `"cancelled_by_admin"` |
| `storage.listRssItemsByStatus`                    | `blogRssSources` table                              | Drizzle leftJoin on `sourceId`            | ✓ WIRED  | `storage.ts:2207` `leftJoin(blogRssSources, eq(blogRssItems.sourceId, blogRssSources.id))`             |
| `storage.listBlogGenerationJobs`                  | `blogRssItems.title`                                | Drizzle leftJoin on `usedPostId`          | ✓ WIRED  | `storage.ts` (around 2244) `leftJoin(blogRssItems, eq(blogGenerationJobs.postId, blogRssItems.usedPostId))` |
| `GET /api/blog/health`                            | env `BLOG_GEMINI_API_KEY` + `getChatIntegration('gemini')` | Boolean derivation in handler        | ✓ WIRED  | Lines 95–98                                                                                            |

### Data-Flow Trace (Level 4)

| Artifact                          | Data Variable | Source                                                | Produces Real Data | Status                                              |
| --------------------------------- | ------------- | ----------------------------------------------------- | ------------------ | --------------------------------------------------- |
| `RssSourcesPanel`                 | `sources`     | `useQuery(['/api/blog/rss-sources'])` → DB select     | Yes (DB query)     | ✓ FLOWING — `storage.listRssSources()` → DB         |
| `RssQueuePanel`                   | `items`       | `useQuery(['/api/blog/rss-items', ...])` → joined select | Yes              | ✓ FLOWING — `storage.listRssItemsByStatus()` with leftJoin + scoreItem |
| `JobHistoryPanel`                 | `jobs`        | `useQuery(['/api/blog/jobs', 50])` → joined select    | Yes                | ✓ FLOWING — `storage.listBlogGenerationJobs()` with leftJoin |
| `JobHistoryPanel`                 | `settings`    | `useQuery(['/api/blog/settings'])` → DB select        | Yes                | ✓ FLOWING — pre-existing endpoint                    |
| `AutomationStatusBanners`         | `health`      | `useQuery(['/api/blog/health'])` → env + DB           | Yes                | ✓ FLOWING — env probe + getChatIntegration         |
| `AutomationStatusBanners`         | `settings`    | `useQuery(['/api/blog/settings'])` → DB select        | Yes                | ✓ FLOWING                                           |
| `PreviewDraftDialog`              | `preview`     | `mutation` calls `/api/blog/preview` → `runPreview()` | Yes (Gemini call)  | ✓ FLOWING — pipeline reuses runPipeline deps        |

### Behavioral Spot-Checks

| Behavior                                | Command                                  | Result                                  | Status   |
| --------------------------------------- | ---------------------------------------- | --------------------------------------- | -------- |
| TypeScript compile (no NEW errors)      | `npm run check`                          | 4 pre-existing errors in `blogContentValidator.ts` + `rssFetcher.ts` (missing module types). No new errors. Documented in `deferred-items.md`. | ✓ PASS  |
| File line caps (CLAUDE.md ≤600)         | `wc -l`                                  | All Phase 37 files ≤600 (translations 443; blog-generator 588; blogAutomation 339; largest new component 306) | ✓ PASS  |
| All 11 admin routes registered          | `grep` route paths                       | health + 4 sources + 1 items + 3 jobs + 2 preview = 11 routes | ✓ PASS  |
| `requireAdmin` guards all new endpoints | `grep "requireAdmin"`                    | Every Phase 37 route uses `requireAdmin` middleware | ✓ PASS  |
| `cancelled_by_admin` reason matches contract | `grep`                              | Exact match at `blogAutomation.ts:246`  | ✓ PASS  |
| `runPreview` does NOT write to DB       | grep `createBlogPost\|markRssItemUsed\|acquireLock\|createBlogGenerationJob` inside runPreview body | None present (verified in lines 427–486) | ✓ PASS  |
| `generateMutation` removed from BlogSection | `grep "generateMutation"`            | 0 references in `BlogSection.tsx`       | ✓ PASS  |
| End-to-end UX flow (real DB + Gemini)   | manual server start + click-through      | n/a                                     | ? SKIP — routed to human_verification |

### Requirements Coverage

| Requirement | Source Plan(s)             | Description                                                                                                                                  | Status                | Evidence                                                                                                                              |
| ----------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| BLOG2-07    | 37-02, 37-03               | Admin manages RSS sources (list, add, edit, enable/disable, delete) within the Blog section                                                  | ✓ SATISFIED           | 4 REST endpoints + `RssSourcesPanel` with full CRUD + auto-save Switch                                                                |
| BLOG2-08    | 37-01, 37-02, 37-03        | Admin sees the RSS items queue (pending/used/skipped) with source name, published date, and resulting-post link                              | ✓ SATISFIED           | `listRssItemsByStatus` joined query + `GET /api/blog/rss-items` + `RssQueuePanel` with status sub-tabs + linked post URL              |
| BLOG2-09    | 37-02, 37-03               | Manual "Generate Now" opens a preview modal (title/excerpt/feature image/first paragraphs); keep, edit, or discard before posting             | ✓ SATISFIED (programmatic); ? UAT | `runPreview` + `POST /api/blog/preview` + `POST /api/blog/posts/from-preview` + `PreviewDraftDialog`; visual UX flow needs human review |
| BLOG2-10    | 37-01, 37-02, 37-03        | Admin sees a job history table (last N jobs) with status, started/completed timestamps, source item, error message, and per-row Retry button | ✓ SATISFIED           | `listBlogGenerationJobs` + `getBlogGenerationJobWithRssItem` + `GET /api/blog/jobs` + `POST /api/blog/jobs/:id/retry` + `JobHistoryPanel` |
| BLOG2-11    | 37-02, 37-03               | A stuck job (lock older than the configured staleness window) can be cancelled from the admin UI; lock is force-released                     | ✓ SATISFIED           | `POST /api/blog/jobs/:id/cancel` enforces 10-min stale gate; releases lock; UI gate matches via `lockAcquiredAt`                       |
| BLOG2-12    | 37-01, 37-03               | A visible warning banner appears when `BLOG_GEMINI_API_KEY` is missing or the active Gemini integration is disabled                          | ✓ SATISFIED           | `GET /api/blog/health` + `AutomationStatusBanners` red banner gated by booleans                                                       |
| BLOG2-13    | 37-03                      | The admin sees the next-run countdown and an estimated monthly Gemini cost based on `postsPerDay`                                            | ✓ SATISFIED           | `computeNextRun` + `computeMonthlyCost` + chip rendering in `AutomationStatusBanners`                                                 |

All 7 BLOG2-07..13 IDs declared in PLAN frontmatters match REQUIREMENTS.md mappings to Phase 37. **No orphans** — every requirement has at least one plan claiming it and concrete artifact evidence in the codebase.

### Anti-Patterns Found

| File                              | Line | Pattern                                                                                            | Severity | Impact                                                                                                                                 |
| --------------------------------- | ---- | -------------------------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `server/lib/blogContentValidator.ts` | 16   | `Cannot find module 'sanitize-html'` (TypeScript error)                                          | ℹ️ Info  | Pre-existing on main HEAD before Phase 37; unrelated to this phase's work; logged in `deferred-items.md`. No Phase 37 file imports this module. |
| `server/lib/rssFetcher.ts`        | 26   | `Cannot find module 'rss-parser'` (TypeScript error)                                               | ℹ️ Info  | Pre-existing on main HEAD before Phase 37; same reasoning as above.                                                                    |
| `server/routes/blogAutomation.ts` | 326  | `tags: data.tags.join(", ")` — array converted to comma-string for storage                         | ℹ️ Info  | Matches existing schema convention (`tags` column is a string in `blog_posts`); not a stub.                                            |
| `server/routes/blogAutomation.ts` | 327–331 | `markRssItemUsed` failure swallowed with console.warn after `createBlogPost` succeeds          | ℹ️ Info  | Documented contract (D-07): "post creation is the source of truth"; not a stub but worth noting for future operational triage.        |
| `client/src/components/admin/blog/PreviewDraftDialog.tsx` | 113 | `eslint-disable-next-line react-hooks/exhaustive-deps` on the open-trigger effect | ℹ️ Info | Intentional — `previewMutation` is intentionally excluded from deps; inclusion would re-trigger every render. Consistent with existing admin patterns. |

No blocker anti-patterns. No stubs. No hollow components. No hardcoded empty data flowing to render.

### Human Verification Required

Per CLAUDE.md "Manual QA only — verify critical flows manually," the following 7 end-to-end flows are routed to human verification rather than failed:

1. **RSS tab navigation** — Open `/admin` → Blog → click "RSS" tab; verify three sub-tabs render under banners.
2. **RSS Sources CRUD round-trip** — Add Source dialog → Switch toggle (PATCH) → Edit → Delete confirmation.
3. **RSS Queue browsing** — Switch among Pending/Used/Skipped; verify pagination; verify pending rows show numeric score badge; verify "View resulting post" link on Used rows.
4. **Generate Now → preview → Save/Discard** — Click Generate Now in Automation tab; verify preview modal opens with title/feature image/excerpt/200-word body preview; verify Save creates a draft + invalidates caches; verify Discard does NOT write.
5. **Stuck job cancellation** — Manually create a stale-lock condition (`lockAcquiredAt > 10min ago`, `job.status='running'`); verify Cancel button appears in JobHistoryPanel and works.
6. **Red banner trigger** — Unset `BLOG_GEMINI_API_KEY` (or disable Gemini integration); reload RSS tab; verify red banner with "Open Integrations" link appears.
7. **Next-run countdown + cost chips** — Verify chips show relative time and dollar amount; verify tooltip explains "approximate, based on Gemini list pricing"; verify chips update when `postsPerDay` changes.

### Gaps Summary

**No automated gaps.** All 7 success criteria, all 7 phase requirement IDs, all key links, and all data-flow traces verify successfully against the codebase. The 4 pre-existing TypeScript module-resolution errors are documented in `deferred-items.md` and unrelated to Phase 37 work.

The phase has `auto_advance=true` per workflow config. Per the project's "manual QA only" constraint (CLAUDE.md), seven end-to-end UX flows are routed to `human_verification` for the user to walk through before declaring the phase fully done.

---

_Verified: 2026-05-05T15:30:00Z_
_Verifier: Claude (gsd-verifier)_
