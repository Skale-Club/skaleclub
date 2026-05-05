# Roadmap: Skale Club Web Platform

## Milestones

- ✅ **v1.0 Xpot Tech Debt** — Phases 1-4 (shipped 2026-03-30)
- ✅ **v1.1 Multi-Forms Support** — Phase 5 / M3 (shipped 2026-04-15)
- ✅ **v1.2 Estimates System** — Phases 6-9 (shipped 2026-04-20)
- ✅ **v1.3 Links Page Upgrade** — Phases 10-14 (shipped 2026-04-20)
- ✅ **v1.4 Admin Presentations Page** — Phases 15-20 (shipped 2026-04-22)
- ✅ **v1.5 Blog Post Automation** — Phases 21-24 (shipped 2026-04-24)
- ✅ **v1.6 Skale Hub Weekly Live Gate** — Phases 25-29 (shipped 2026-05-02)
- ✅ **v1.7 Translation System Completeness** — Phase 30 (shipped 2026-05-03)
- ✅ **v1.8 Notification Templates System** — Phases 31-33 (shipped 2026-05-04)
- 🔄 **v1.9 Blog Intelligence & RSS Sources** — Phases 34-38 (active)

## Active

**v1.9 Blog Intelligence & RSS Sources** — Phases 34-38

- [ ] **Phase 34: RSS Sources Foundation** — schema for `blog_rss_sources` and `blog_rss_items`, Drizzle/Zod contracts, storage CRUD
- [ ] **Phase 35: RSS Fetcher & Topic Selection** — RSS parser, hourly fetch cron, scoring algorithm to pick the best unused item, mark-as-used after generation
- [ ] **Phase 36: Generator Quality Overhaul** — pt-BR prompts, strict HTML validation, slug normalization, length bounds, Gemini timeout + retry, env-overridable models
- [ ] **Phase 37: Admin UX (RSS + Job Improvements)** — RSS sources panel, items queue view, draft preview modal, job history with retry, cancel stuck jobs, API-key warning, next-run countdown + cost estimate
- [ ] **Phase 38: Dynamic Cron & Observability** — frequency from `postsPerDay`, structured per-stage `durationMs` logs, exponential-backoff retries

### Phase 34: RSS Sources Foundation

**Goal:** The database has additive tables for RSS sources and RSS items, with typed Drizzle/Zod contracts and a storage interface that downstream phases can call without raw SQL.
**Depends on:** Nothing (first phase of v1.9)
**Requirements:** RSS-01, RSS-02, RSS-03, RSS-04
**Plans:** 2 plans
**Success Criteria** (what must be TRUE):
  1. SQL migration runs without error and creates `blog_rss_sources` and `blog_rss_items` tables with the columns, defaults, and FK from `blog_rss_items.source_id` → `blog_rss_sources.id` (cascade delete).
  2. `shared/schema/blog.ts` exports Drizzle tables, Zod insert/select schemas, and TypeScript types for both new entities.
  3. `IStorage` declares and `DatabaseStorage` implements: `listRssSources`, `getRssSource`, `createRssSource`, `updateRssSource`, `deleteRssSource`, `upsertRssItem(sourceId, guid, …)`, `listPendingRssItems`, `markRssItemUsed(itemId, postId)`.
  4. `npm run check` passes cleanly.

Plans:
- [x] 34-01-PLAN.md — SQL migration (raw + Supabase mirror) for blog_rss_sources/blog_rss_items + Drizzle/Zod contracts in shared/schema/blog.ts (RSS-01, RSS-02, RSS-03)
- [x] 34-02-PLAN.md — IStorage RSS method declarations + DatabaseStorage implementations (9 methods including upsertRssItem with onConflictDoUpdate, markRssItemUsed/Skipped) (RSS-04)

### Phase 35: RSS Fetcher & Topic Selection

**Goal:** A scheduled fetcher pulls items from every enabled RSS source and the generator picks the highest-scored unused item per run instead of inventing a generic topic.
**Depends on:** Phase 34 (tables and storage must exist)
**Requirements:** RSS-05, RSS-06, RSS-07, RSS-08
**Plans:** 3 plans
**Success Criteria** (what must be TRUE):
  1. A server-side fetcher iterates each `enabled` source, parses the feed, and upserts items by `guid` so the same item is never duplicated even after multiple fetches.
  2. The fetcher cron runs hourly outside Vercel (and via `/api/blog/cron/fetch-rss` on Vercel) and writes `last_fetched_at` plus a status/error message per source.
  3. The generator, before calling Gemini, queries pending items, scores them by SEO-keyword overlap and recency, picks the top one, and marks it `used` with the resulting `postId` after the post is created.
  4. When zero pending items exist, the generator skips the run with `reason: 'no_rss_items'` and does not call Gemini.

Plans:
- [x] 35-01-PLAN.md — server/lib/rssFetcher.ts (fetchAllRssSources orchestrator + GUID fallback + per-source error isolation) + add rss-parser dep (RSS-05)
- [x] 35-02-PLAN.md — server/lib/rssTopicSelector.ts (scoreItem + selectNextRssItem helpers; 0.6*keywords + 0.4*recency; 14-day window) (RSS-07)
- [x] 35-03-PLAN.md — Wire fetcher into cron.ts + POST /api/blog/cron/fetch-rss + BlogGenerator selectNextRssItem integration with no_rss_items skip path (RSS-06, RSS-07, RSS-08)

### Phase 36: Generator Quality Overhaul

**Goal:** Generated posts are reliably Brazilian Portuguese, valid HTML only, well-formed slugs, length-bounded, and resilient to slow/flaky Gemini responses.
**Depends on:** Phase 35 (the source item title/summary feeds the prompt)
**Requirements:** BLOG2-01, BLOG2-02, BLOG2-03, BLOG2-04, BLOG2-05, BLOG2-06
**Plans:** TBD
**Success Criteria** (what must be TRUE):
  1. The topic and content prompts explicitly target pt-BR, ingest the chosen RSS item title + summary as context, and instruct allowed HTML tags only — drafts saved to `blog_posts.content` parse cleanly with no `<script>`, `<iframe>`, `<form>`, `<style>`, or `<link>` tags.
  2. A server-side HTML sanitizer removes disallowed tags before insert; a malformed AI response triggers a failed job with reason `invalid_html`.
  3. Slugs from titles with Portuguese accents are normalized (NFD strip + lowercase + hyphenate) — "Análise de CRM em 2026" → `analise-de-crm-em-2026`.
  4. Body content shorter than 600 chars or longer than 4000 chars marks the job failed with reason `content_length_out_of_bounds`.
  5. Every Gemini call uses an `AbortController` (default 30s timeout); empty `candidates` arrays throw a typed error caught by the job runner.
  6. `BLOG_CONTENT_MODEL` and `BLOG_IMAGE_MODEL` env vars override the hardcoded model IDs; defaults are documented in `.env.example`.

### Phase 37: Admin UX (RSS + Job Improvements)

**Goal:** The admin can manage RSS sources, see the items queue, preview drafts before they land in Posts, and operate the system (retry, cancel, configure) without touching the database.
**Depends on:** Phase 34 (sources/items API), Phase 36 (preview content quality)
**Requirements:** BLOG2-07, BLOG2-08, BLOG2-09, BLOG2-10, BLOG2-11, BLOG2-12, BLOG2-13
**Plans:** TBD
**UI hint:** yes
**Success Criteria** (what must be TRUE):
  1. Within the Blog section, the admin sees an "RSS Sources" tab/panel where they can list, add, edit, enable/disable, and delete feeds, with last-fetched-at and last error visible per row.
  2. An "RSS Queue" view lists items grouped by status (pending/used/skipped) with source name, published date, and (when used) a clickable link to the resulting post.
  3. Clicking "Generate Now" opens a preview modal with title, excerpt, feature image, and the first ~200 words of body; the admin can Save as Draft or Discard before the post is committed.
  4. A "Job History" panel shows the last N jobs with timestamps, status badge, source item, error (if any), and a Retry button on failed rows.
  5. Stuck jobs (lock older than the configured staleness) can be cancelled from the UI; the lock is force-released and the job marked failed with reason `cancelled_by_admin`.
  6. A red banner in the Blog automation panel warns when the active Gemini integration is disabled or `BLOG_GEMINI_API_KEY` is missing.
  7. The admin sees the next scheduled run countdown (`lastRunAt + 24h/postsPerDay`) plus an estimated monthly Gemini cost (posts per month × per-run model price).

### Phase 38: Dynamic Cron & Observability

**Goal:** The cron firing rate adapts to `postsPerDay`, every job records per-stage timing for observability, and transient Gemini failures auto-retry instead of being lost.
**Depends on:** Phase 36 (Gemini call sites need to wrap timing + retry)
**Requirements:** BLOG2-14, BLOG2-15, BLOG2-16
**Plans:** TBD
**Success Criteria** (what must be TRUE):
  1. `startCron()` reads `postsPerDay` from settings and sets the interval to `24h / postsPerDay` (clamped to a minimum of 60min); changing settings updates the schedule on the next tick without redeploy.
  2. `blog_generation_jobs` gains a `durationsMs` JSONB column with `{ topic, content, image, upload, total }` populated for every completed job; admin job history surfaces the breakdown.
  3. Transient Gemini errors (timeouts, 5xx, network) retry with backoff `[1s, 5s, 30s]` per call site; only a final failure after the third attempt marks the job failed.

<details>
<summary>✅ v1.8 Notification Templates System (Phases 31-33) — SHIPPED 2026-05-04</summary>

- [x] Phase 31: Schema & Templates Foundation (2/2 plans) — completed 2026-05-04
- [x] Phase 32: Telegram Integration (2/2 plans) — completed 2026-05-04
- [x] Phase 33: Admin Notifications Panel (2/2 plans) — completed 2026-05-04

_Archive: `.planning/milestones/v1.8-ROADMAP.md`_

</details>

### Phase 33: Admin Notifications Panel

**Goal:** Admin has a dedicated Notifications section in the dashboard listing all notification events. Each event shows active channels and an inline editor to modify template body per channel, toggle channels on/off, and see available variables.
**Requirements:** NOTIF-10, NOTIF-11, NOTIF-12, NOTIF-13
**Depends on:** Phase 31 (schema + storage), Phase 32 (dispatcher + routes)
**Plans:** 2 plans

Plans:
- [x] 33-01-PLAN.md — GET + PUT /api/notifications/templates routes + registration in server/routes.ts (NOTIF-10, NOTIF-13)
- [x] 33-02-PLAN.md — NotificationsSection.tsx + 4-file admin wiring (NOTIF-10, NOTIF-11, NOTIF-12, NOTIF-13)

## Shipped Milestones

<details>
<summary>✅ v1.7 Translation System Completeness (Phase 30) — SHIPPED 2026-05-04</summary>

- [x] Phase 30: Translation System Overhaul (4/4 plans) — completed 2026-05-03

_Archive: `.planning/milestones/v1.7-ROADMAP.md`_

</details>

<details>
<summary>✅ v1.6 Skale Hub Weekly Live Gate (Phases 25-29) — SHIPPED 2026-05-02</summary>

- [x] Phase 25: Foundation (1/1 plans) — completed 2026-05-02
- [x] Phase 26: API & Tracking (1/1 plans) — completed 2026-05-02
- [x] Phase 27: Public Experience (1/1 plans) — completed 2026-05-02
- [x] Phase 28: Admin Management (1/1 plans) — completed 2026-05-02
- [x] Phase 29: Analytics & Reporting (1/1 plans) — completed 2026-05-02

_Archive: `.planning/milestones/v1.6-ROADMAP.md`_

</details>

<details>
<summary>✅ v1.5 Blog Post Automation (Phases 21-24) — SHIPPED 2026-04-24</summary>

- [x] Phase 21: Schema & Storage Foundation (1/1 plans) — completed 2026-04-22
- [x] Phase 22: Blog Generator Engine (2/2 plans) — completed 2026-04-22
- [x] Phase 23: API Endpoints + Cron (1/1 plans) — completed 2026-04-22
- [x] Phase 24: Admin UI — Automation Settings (2/2 plans) — completed 2026-04-22

_Archive: `.planning/milestones/v1.5-ROADMAP.md`_

</details>

<details>
<summary>✅ v1.4 Admin Presentations Page (Phases 15-20) — SHIPPED 2026-04-22</summary>

- [x] Phase 15: Schema & Foundation (2/2 plans) — completed 2026-04-21
- [x] Phase 16: Admin CRUD API (1/1 plans) — completed 2026-04-21
- [x] Phase 17: Brand Guidelines (1/1 plans) — completed 2026-04-21
- [x] Phase 18: AI Authoring Endpoint (2/2 plans) — completed 2026-04-22
- [x] Phase 19: Admin Presentations Editor (1/1 plans) — completed 2026-04-22
- [x] Phase 20: Public Viewer (2/2 plans) — completed 2026-04-22

</details>

<details>
<summary>✅ v1.3 Links Page Upgrade (Phases 10-14) — SHIPPED 2026-04-20</summary>

- [x] Phase 10: Schema & Upload Foundation (2/2 plans) — completed 2026-04-20
- [x] Phase 11: Click Analytics API (1/1 plans) — completed 2026-04-20
- [x] Phase 12: Admin Redesign + Core Editing (3/3 plans) — completed 2026-04-20
- [x] Phase 13: Icon Picker, Theme Editor & Live Preview (3/3 plans) — completed 2026-04-20
- [x] Phase 14: Public Page Rendering + Click Tracking (1/1 plans) — completed 2026-04-20

</details>

<details>
<summary>✅ v1.2 Estimates System (Phases 6-9) — SHIPPED 2026-04-20</summary>

- [x] Phase 6: DB Schema + Storage Layer (2/2 plans) — completed 2026-04-19
- [x] Phase 7: Admin API Routes (1/1 plans) — completed 2026-04-19
- [x] Phase 8: Admin UI (EstimatesSection) (2/2 plans) — completed 2026-04-19
- [x] Phase 9: Public Viewer (3/3 plans) — completed 2026-04-20

_Archive: `.planning/milestones/v1.2-ROADMAP.md`_

</details>

<details>
<summary>✅ v1.1 Multi-Forms Support (Phase 5) — SHIPPED 2026-04-15</summary>

- [x] Phase 5: Multi-Forms Support (1/1 plans) — completed 2026-04-15
  - M3-01: forms table + compat shim
  - M3-02: admin forms list + editor rewire
  - M3-03: public /f/:slug route + chat form selector
  - M3-04: leads + dashboard scoped by form
  - M3-05: cleanup — drop legacy endpoints + form_config column

</details>

<details>
<summary>✅ v1.0 Xpot Tech Debt (Phases 1-4) — SHIPPED 2026-03-30</summary>

- [x] Phase 1: Error Handling Standardization (1/1 plans) — completed 2026-03-30
- [x] Phase 2: Route File Splitting (3/3 plans) — completed 2026-03-30
- [x] Phase 3: Schema Organization (3/3 plans) — completed 2026-03-30
- [x] Phase 4: Context Refactoring (3/3 plans) — completed 2026-03-30

_Archive: `.planning/milestones/v1.0-ROADMAP.md`_

</details>

---

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Error Handling Standardization | v1.0 | 1/1 | Complete | 2026-03-30 |
| 2. Route File Splitting | v1.0 | 3/3 | Complete | 2026-03-30 |
| 3. Schema Organization | v1.0 | 3/3 | Complete | 2026-03-30 |
| 4. Context Refactoring | v1.0 | 3/3 | Complete | 2026-03-30 |
| 5. Multi-Forms Support | v1.1 | 1/1 | Complete | 2026-04-15 |
| 6. DB Schema + Storage Layer | v1.2 | 2/2 | Complete | 2026-04-19 |
| 7. Admin API Routes | v1.2 | 1/1 | Complete | 2026-04-19 |
| 8. Admin UI (EstimatesSection) | v1.2 | 2/2 | Complete | 2026-04-19 |
| 9. Public Viewer | v1.2 | 3/3 | Complete | 2026-04-20 |
| 10. Schema & Upload Foundation | v1.3 | 2/2 | Complete | 2026-04-20 |
| 11. Click Analytics API | v1.3 | 1/1 | Complete | 2026-04-20 |
| 12. Admin Redesign + Core Editing | v1.3 | 3/3 | Complete | 2026-04-20 |
| 13. Icon Picker, Theme Editor & Live Preview | v1.3 | 3/3 | Complete | 2026-04-20 |
| 14. Public Page Rendering + Click Tracking | v1.3 | 1/1 | Complete | 2026-04-20 |
| 15. Schema & Foundation | v1.4 | 2/2 | Complete | 2026-04-21 |
| 16. Admin CRUD API | v1.4 | 1/1 | Complete | 2026-04-21 |
| 17. Brand Guidelines | v1.4 | 1/1 | Complete | 2026-04-21 |
| 18. AI Authoring Endpoint | v1.4 | 2/2 | Complete | 2026-04-22 |
| 19. Admin Presentations Editor | v1.4 | 1/1 | Complete | 2026-04-22 |
| 20. Public Viewer | v1.4 | 2/2 | Complete | 2026-04-22 |
| 21. Schema & Storage Foundation | v1.5 | 1/1 | Complete | 2026-04-22 |
| 22. Blog Generator Engine | v1.5 | 2/2 | Complete | 2026-04-22 |
| 23. API Endpoints + Cron | v1.5 | 1/1 | Complete | 2026-04-22 |
| 24. Admin UI — Automation Settings | v1.5 | 2/2 | Complete | 2026-04-22 |
| 25. Foundation | v1.6 | 1/1 | Complete | 2026-05-02 |
| 26. API & Tracking | v1.6 | 1/1 | Complete | 2026-05-02 |
| 27. Public Experience | v1.6 | 1/1 | Complete | 2026-05-02 |
| 28. Admin Management | v1.6 | 1/1 | Complete | 2026-05-02 |
| 29. Analytics & Reporting | v1.6 | 1/1 | Complete | 2026-05-02 |
| 30. Translation System Overhaul | v1.7 | 4/4 | Complete    | 2026-05-03 |
| 31. Schema & Templates Foundation | v1.8 | 2/2 | Complete | 2026-05-04 |
| 32. Telegram Integration | v1.8 | 2/2 | Complete | 2026-05-04 |
| 33. Admin Notifications Panel | v1.8 | 2/2 | Complete | 2026-05-04 |
| 34. RSS Sources Foundation | v1.9 | 2/2 | Complete    | 2026-05-05 |
| 35. RSS Fetcher & Topic Selection | v1.9 | 3/3 | Complete   | 2026-05-05 |
| 36. Generator Quality Overhaul | v1.9 | 0/0 | Not started | - |
| 37. Admin UX (RSS + Job Improvements) | v1.9 | 0/0 | Not started | - |
| 38. Dynamic Cron & Observability | v1.9 | 0/0 | Not started | - |
| 31. Schema & Templates Foundation | v1.8 | 2/2 | Complete | 2026-05-04 |
| 32. Telegram Integration | v1.8 | 2/2 | Complete | 2026-05-04 |
| 33. Admin Notifications Panel | v1.8 | 2/2 | Complete | 2026-05-04 |

---

_Last updated: 2026-05-04 — v1.8 Notification Templates System shipped (Phases 31-33)_

---

## Phase Details (v1.3 and earlier)

### Phase 10: Schema & Upload Foundation
**Goal**: The backend can persist a richer links-page config and accept real file uploads to Supabase Storage, with every link carrying a stable identity that survives edits.
**Depends on**: Nothing (first phase of v1.3)
**Requirements**: LINKS-01, LINKS-02, LINKS-03, LINKS-06
**Plans:** 2/2 plans complete
**Success Criteria** (what must be TRUE):
  1. Admin can `POST /api/uploads/links-page` with an image (≤2 MB) and receives a Supabase `uploads/links-page/...` URL that is publicly retrievable.
  2. `linksPageConfig` persists per-link `iconType`, `iconValue`, `visible`, `clickCount`, stable `id`, and a `theme` sub-object — existing `links` and `socialLinks` read/write paths still work unchanged.
  3. Each existing link is backfilled with a UUID `id` on first save, and every newly-created link receives a UUID `id` automatically.
  4. Non-image and oversized uploads are rejected with a 4xx error and a human-readable message.
**Plans:**
- [x] 10-01-PLAN.md — Extend linksPageConfig schema with real Zod + lazy UUID/theme normalization in storage read path (LINKS-01, LINKS-03)
- [x] 10-02-PLAN.md — POST /api/uploads/links-page admin endpoint with MIME allowlist, 2 MB cap, Supabase scoped path (LINKS-02, LINKS-06)

### Phase 11: Click Analytics API
**Goal**: Public clicks on `/links` links produce reliable, abuse-resistant per-link counts that admins can see at a glance.
**Depends on**: Phase 10 (needs stable `linkId` + `clickCount` field)
**Requirements**: LINKS-04, LINKS-05
**Plans:** 1/1 plans complete
**Success Criteria** (what must be TRUE):
  1. Anyone (unauthenticated) calling `POST /api/links-page/click/:linkId` increments `clickCount` for that specific link in `linksPageConfig`.
  2. The same IP calling the same `linkId` more than once within 60 seconds is rate-limited (count does not double-increment).
  3. Admin Links section shows a click-count badge next to each link, reflecting the current stored value after reload.
  4. A click to an unknown `linkId` returns a 404 without crashing or creating stray records.
**Plans:**
- [x] 11-01-PLAN.md — Public IP-rate-limited POST /api/links-page/click/:linkId + admin click-count data surface (LINKS-04, LINKS-05)

### Phase 12: Admin Redesign + Core Editing
**Goal**: Admin opens the Links section and immediately sees a polished three-zone editor where they can upload profile/background assets, toggle link visibility, and reorder links by drag.
**Depends on**: Phase 10 (needs upload endpoint + stable link IDs)
**Requirements**: LINKS-07, LINKS-08, LINKS-10, LINKS-11
**Success Criteria** (what must be TRUE):
  1. Admin sees a three-zone layout — Profile (left), Live Preview placeholder (center), Links + Social (right) — that stacks cleanly on narrow screens and uses the existing `AdminCard`/`SectionHeader`/`FormGrid` primitives.
  2. Admin can drag-and-drop an image onto the Avatar or Background uploader, sees a spinner, then a thumbnail + "Uploaded ✓" confirmation, and the URL is persisted to `linksPageConfig`.
  3. Admin can toggle a link's visibility switch; hidden links render at reduced opacity in the admin list and are not displayed on the public page.
  4. Admin can drag links to reorder them; the new order persists on save and is reflected on the next public-page load.
**Plans:**
3/3 plans executed
- [x] 12-02-PLAN.md — DragDropUploader for avatar/background (LINKS-08)
- [x] 12-03-PLAN.md — Drag-reorder links (LINKS-11)
**UI hint**: yes

### Phase 13: Icon Picker, Theme Editor & Live Preview
**Goal**: Admin can fully brand each link (icon + theme) and see their edits reflected inside the admin page within ~1 second — no round-trip to `/links` required.
**Depends on**: Phase 12 (needs the three-zone layout + link rows to host the picker)
**Requirements**: LINKS-09, LINKS-12, LINKS-13
**Success Criteria** (what must be TRUE):
  1. Each link row has an Icon Picker where the admin can either search the full Lucide icon library (debounced text search, ~1000 icons) and select one, or upload a custom SVG/PNG that becomes the link's icon — the selected icon renders at its final display size in the picker preview.
  2. Admin can pick a primary color, a background color or gradient, and optionally upload a background image; all values persist into `linksPageConfig.theme`.
  3. The Live Preview pane renders `/links` inline (iframe or direct embed) and re-fetches company settings after each save so admin-side edits appear in the preview within ~1 second.
  4. Switching between Lucide, custom upload, and auto icon modes on a link updates the preview without requiring a page reload.
**Plans:** 3/3 plans complete
- [x] 13-01-PLAN.md — IconPicker component (Popover+Tabs, Lucide search, Upload, Auto) wired per link row (LINKS-09)
- [x] 13-02-PLAN.md — ThemeEditor for primary/background/gradient + Reset to defaults in Profile zone (LINKS-12)
- [x] 13-03-PLAN.md — LivePreview iframe in Zone 2 with auto-refresh on save + manual refresh (LINKS-13)
**UI hint**: yes

### Phase 14: Public Page Rendering + Click Tracking
**Goal**: Visitors to `/links` see a themed, icon-rich page that only shows visible links, and every outbound click increments the admin-visible counter reliably — even when the browser immediately navigates away.
**Depends on**: Phase 10 (schema), Phase 11 (click endpoint), Phase 13 (theme values to render)
**Requirements**: LINKS-14, LINKS-15, LINKS-16, LINKS-17
**Plans:** 1/1 plans complete
**Success Criteria** (what must be TRUE):
  1. `/links` renders each link's icon from Lucide (by name) or from an uploaded URL (as `<img>`), and falls back to a generic link icon when neither is set.
  2. Links with `visible=false` do not appear on `/links`; hiding a link in admin and reloading the public page removes it from the list.
  3. `/links` reflects the saved theme — primary color on hover/focus accents, background color or gradient on the page root, and optional background image rendered behind the ambient glow layer.
  4. Clicking any link fires `POST /api/links-page/click/:linkId` via `navigator.sendBeacon` before navigation, and the admin click-count badge reflects the new count after reload.
**Plans:**
- [x] 14-01-PLAN.md — Visible filter + per-link icons + theme application + sendBeacon click tracking in client/src/pages/Links.tsx (LINKS-14, LINKS-15, LINKS-16, LINKS-17)
**UI hint**: yes

---

## v1.4 Admin Presentations Page

### Phase 15: Schema & Foundation
**Goal**: The database schema for presentations exists, `@anthropic-ai/sdk` is installed and reachable from the server, and every downstream phase has a typed foundation to build on.
**Depends on**: Nothing (first phase of v1.4)
**Requirements**: PRES-01, PRES-02, PRES-03, PRES-04
**Plans:** 2/2 plans complete
**Success Criteria** (what must be TRUE):
  1. A raw SQL migration script runs without error and creates `presentations`, `presentation_views`, and `brand_guidelines` tables with the correct columns, constraints, and cascade-delete rules — `SELECT * FROM presentations LIMIT 1` returns an empty result set, not an error.
  2. `shared/schema/presentations.ts` exports Drizzle table definitions and Zod validators (`insertPresentationSchema`, `selectPresentationSchema`, `slideBlockSchema`) that TypeScript compiles against without errors.
  3. `server/lib/anthropic.ts` exports `getAnthropicClient()` and calling it with `ANTHROPIC_API_KEY` set returns a live client that can reach the Anthropic API — it is not wired through the existing `getActiveAIClient()` OpenAI/Groq shim.
  4. `package.json` lists `@anthropic-ai/sdk` as a production dependency and `npm run check` passes cleanly.
**Plans:**
- [ ] 15-01-PLAN.md — SQL migration (3 tables) + Drizzle/Zod schema + barrel re-export + storage stubs (PRES-01, PRES-02, PRES-03)
- [ ] 15-02-PLAN.md — @anthropic-ai/sdk install + getAnthropicClient() singleton in server/lib/anthropic.ts (PRES-04)

### Phase 16: Admin CRUD API
**Goal**: Admins can create, list, update, and delete presentations through a typed REST API with no AI involvement — the data layer is fully operational before any UI or AI work begins.
**Depends on**: Phase 15 (tables and storage interface must exist)
**Requirements**: PRES-05, PRES-06, PRES-07, PRES-08
**Plans:** 1/1 plans complete
**Success Criteria** (what must be TRUE):
  1. `GET /api/presentations` (admin-auth required) returns a JSON array sorted by `createdAt` desc; each item includes `id`, `slug`, `title`, derived `slideCount`, derived `viewCount`, and `createdAt` — an unauthenticated request returns 401.
  2. `POST /api/presentations` (admin-auth required) accepts `{ title }` and returns `{ id, slug }` with an empty `slides: []`; a second `POST` with the same title creates a distinct record with a different `id` and `slug`.
  3. `PUT /api/presentations/:id` (admin-auth required) updates `title`, `slides`, and/or `accessCode`, and the `version` field increments by 1 on each successful call.
  4. `DELETE /api/presentations/:id` (admin-auth required) removes the presentation row and all associated `presentation_views` rows; a subsequent `GET /api/presentations` no longer includes that `id`.
**Plans:**
- [x] 16-01-PLAN.md — registerPresentationsRoutes (GET list, POST create, PUT update, DELETE delete) + IStorage interface declarations (PRES-05, PRES-06, PRES-07, PRES-08)

### Phase 17: Brand Guidelines
**Goal**: Admin can author and persist a tenant-wide brand guidelines document that subsequent AI calls will consume as their system prompt.
**Depends on**: Phase 15 (brand_guidelines table must exist)
**Requirements**: PRES-09, PRES-10
**Plans:** 1 plan
**Success Criteria** (what must be TRUE):
  1. `PUT /api/brand-guidelines` (admin-auth required) upserts a single row; a subsequent `GET /api/brand-guidelines` (no auth required) returns the saved `content` string — calling `GET` before any `PUT` returns a 200 with empty or null content rather than a 404.
  2. Admin sees a Brand Guidelines editor (textarea or markdown editor) within the Presentations tab; typing and saving updates the stored content and a "Saved" confirmation appears.
  3. The editor displays a live character count; the server rejects content exceeding 2,000 characters with a 400 and a human-readable message.
**Plans:**
- [ ] 17-01-PLAN.md — GET + PUT /api/brand-guidelines routes + PresentationsSection editor + AdminSection wiring (PRES-09, PRES-10)
**UI hint**: yes

### Phase 18: AI Authoring Endpoint
**Goal**: A single POST endpoint accepts a chat message and the current slide state, calls Claude via `tool_use` with brand guidelines as the system prompt, and streams structured `SlideBlock[]` JSON back to the client — the entire AI pipeline is exercisable before any admin UI is built.
**Depends on**: Phase 15 (Anthropic SDK singleton), Phase 16 (presentation storage, auth), Phase 17 (brand guidelines must exist as system prompt source)
**Requirements**: PRES-11, PRES-12, PRES-13
**Plans:** 2/2 plans complete
**Success Criteria** (what must be TRUE):
  1. `POST /api/presentations/:id/chat` (admin-auth required) accepts `{ message: string }`, loads the current `brand_guidelines.content` as Claude's system prompt, and returns a streaming `text/event-stream` response — calling it with `curl --no-buffer` shows `data:` events arriving progressively before the stream closes.
  2. When the stream completes successfully, the `presentations` row has updated `slides` (a valid `SlideBlock[]` matching the Zod schema) and `guidelinesSnapshot` set to the brand guidelines content that was active at generation time; `version` is incremented by 1.
  3. A `SlideBlock` covers all 8 layout variants (`cover`, `section-break`, `title-body`, `bullets`, `stats`, `two-column`, `image-focus`, `closing`) and contains bilingual fields (`heading`/`headingPt`, `body`/`bodyPt`, `bullets`/`bulletsPt`); a document containing one block of each variant passes Zod validation without errors.
  4. Sending "edit slide 3 — shorten the body" when there are 5 slides returns an updated array where only slide index 2 is modified and slides 0, 1, 3, 4 are byte-for-byte identical to the input; the DB write reflects this partial update.
**Plans:**
- [x] 18-01-PLAN.md — Wave 0: ANTHROPIC_API_KEY in .env.example + slideBlockSchema Zod unit test (PRES-12)
- [x] 18-02-PLAN.md — Wave 1: server/routes/presentationsChat.ts SSE endpoint + route registration (PRES-11, PRES-12, PRES-13)

### Phase 19: Admin Presentations Editor
**Goal**: Admin can manage presentations and edit their slides via a JSON editor with a live mini-preview — slides are authored by conversing with Claude Code (IDE) and pasting the resulting JSON.
**Depends on**: Phase 16 (CRUD API for list/create/delete)
**Requirements**: PRES-14, PRES-15, PRES-16
**Plans:** 1/1 plans complete
Plans:
- [ ] 19-01-PLAN.md — PresentationsSection list + JSON editor + slide mini-cards + Admin.tsx wire-up (PRES-14, PRES-15, PRES-16)
**Success Criteria** (what must be TRUE):
  1. Admin Presentations tab shows a list of all presentations with `title`, slide-count, view-count badge, a copy-link button, a delete button, and an "Open Editor" button per row; clicking delete shows a confirmation and removes the row without a page reload.
  2. Clicking "Open Editor" opens an editor view: a monospace JSON textarea showing the current `SlideBlock[]` (editable), a Save button that calls `PUT /api/presentations/:id`, and a slide preview panel showing current slides as mini cards.
  3. Admin edits the JSON (e.g. pastes Claude Code output), clicks Save, and the slide mini-cards update to reflect the new `SlideBlock[]`; invalid JSON shows an inline parse error without saving.
  4. Each slide mini-card shows the layout type and the `heading` field (or layout name as fallback); cards are visible at a glance without horizontal scrolling on desktop.
**UI hint**: yes

### Phase 20: Public Viewer
**Goal**: Anyone with a presentation link can experience the deck as a fullscreen bilingual scroll-snap presentation — isolated from the site's Navbar and Footer — with an access code gate if one is set, and every successful view is recorded for admin analytics.
**Depends on**: Phase 15 (schema for view tracking), Phase 16 (public slug lookup API)
**Requirements**: PRES-17, PRES-18, PRES-19, PRES-20, PRES-21, PRES-22
**Plans:** 2/2 plans executed
Plans:
- [x] 20-01-PLAN.md — Server endpoints (slug augment + verify-code + view POST) + App.tsx isPresentationRoute guard + translations (PRES-17, PRES-18, PRES-22)
- [x] 20-02-PLAN.md — PresentationViewer.tsx — scroll-snap, 8 layout renderers, language switcher, access gate, view tracking (PRES-19, PRES-20, PRES-21)
**Success Criteria** (what must be TRUE):
  1. `GET /api/presentations/slug/:slug` (no auth) returns the full presentation including slides; each successful response creates a new row in `presentation_views` — the admin view-count badge for that presentation increments by 1 after reload.
  2. `/p/:slug` renders with no Navbar, Footer, or ChatWidget visible; opening Dev Tools confirms `isPresentationRoute` is true for the route and the standard site layout branch is skipped.
  3. `PresentationViewer` renders each slide as a fullscreen scroll-snap section (one slide fills the viewport); scrolling to a new slide triggers a framer-motion enter animation; all 8 `SlideBlock.layout` variants render without a blank or broken section.
  4. Appending `?lang=pt-BR` to the URL switches all slide text to the `headingPt`, `bodyPt`, and `bulletsPt` fields; appending `?lang=en` (or no param) shows the English fields — switching does not reload the page or restart the scroll position.
  5. If `accessCode` is set on a presentation, `/p/:slug` shows a code-entry form before any slides are visible; entering the correct code reveals the deck and entering a wrong code shows an inline error without navigating away.
**UI hint**: yes

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 10. Schema & Upload Foundation | 2/2 | Done | 2026-04-20 |
| 11. Click Analytics API | 1/1 | Done | 2026-04-20 |
| 12. Admin Redesign + Core Editing | 3/3 | Done | 2026-04-20 |
| 13. Icon Picker, Theme Editor & Live Preview | 3/3 | Done | 2026-04-20 |
| 14. Public Page Rendering + Click Tracking | 1/1 | Done | 2026-04-20 |
| 15. Schema & Foundation | 0/2 | Complete    | 2026-04-21 |
| 16. Admin CRUD API | 1/1 | Complete    | 2026-04-21 |
| 17. Brand Guidelines | 0/1 | Not started | - |
| 18. AI Authoring Endpoint | 2/2 | Complete    | 2026-04-22 |
| 19. Admin Chat Editor | 0/1 | Complete    | 2026-04-22 |
| 20. Public Viewer | 2/2 | Complete | 2026-04-22 |

### Phase 25: Services Carousel Polish ✅ COMPLETE (2026-04-29)

**Goal:** Soft-edge fade masks (replace hard white side blocks), restore portfolio service modal open-on-click (drag-vs-click threshold so pointer capture doesn't swallow clicks), and lock body + carousel auto-scroll while modal is open.
**Requirements:** No formal REQ-IDs — polish phase added post-milestone
**Depends on:** Phase 24
**Plans:** 2 plans

Plans:
- [x] 25-01: ServicesCarousel — fade mask + click threshold + paused prop (commit `1c723f6`)
- [x] 25-02: ServiceDetailModal → shadcn Dialog + carousel pause on open (commit `1423e5e`)

---

_Last updated: 2026-04-22 — Phase 20 complete (2/2 plans); PRES-17–22 all delivered; v1.4 feature-complete_
_Last updated: 2026-05-02 - v1.6 Skale Hub Weekly Live Gate shipped (Phases 25-29)_
_Last updated: 2026-05-04 - Phase 33 planned (2 plans, 2 waves); Phases 31-32 complete_

### Phase 30: Translation System Overhaul

**Goal:** Every visible string in the site (public pages and admin panel) is covered by a static key in `translations.ts` — zero hardcoded strings, zero missing keys, zero dead keys, and TypeScript-enforced key safety. PT coverage is 100% with no API fallbacks.
**Requirements:** TRX-01, TRX-02, TRX-03, TRX-04, TRX-05, TRX-06, TRX-07, TRX-08, TRX-09, TRX-10, TRX-11
**Depends on:** None (standalone polish phase)
**Plans:** 4/4 plans complete

Plans:
- [x] 30-01-PLAN.md — TypeScript enforcement + dead key removal + 404 page fix (TRX-07, TRX-08, TRX-09, TRX-10)
- [x] 30-02-PLAN.md — PresentationsSection missing keys + LeadsSection/SEOSection/NewFormDialog/LinksSection t() wiring (TRX-01, TRX-02, TRX-03, TRX-04, TRX-05)
- [x] 30-03-PLAN.md — DashboardSection + EstimatesSection — add useTranslation from scratch (TRX-01, TRX-04, TRX-05)
- [x] 30-04-PLAN.md — PrivacyPolicy + TermsOfService static key coverage + final audit (TRX-01, TRX-06, TRX-09, TRX-11)
