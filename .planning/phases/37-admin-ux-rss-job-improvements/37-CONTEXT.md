# Phase 37: Admin UX (RSS + Job Improvements) - Context

**Gathered:** 2026-05-05
**Status:** Ready for planning
**Mode:** Auto (`--auto`) — all gray areas resolved with recommended defaults

<domain>
## Phase Boundary

Admin-facing UI to operate the v1.9 blog automation pipeline:
- Manage RSS sources (CRUD)
- Inspect the RSS items queue (pending / used / skipped)
- Preview a generated draft before it commits to the Posts list
- Review job history with retry / cancel actions
- See API-key warnings, next-run countdown, monthly cost estimate

Plus the supporting REST endpoints for everything above.

OUT OF SCOPE: dynamic cron frequency / per-stage durationMs logging / retry-with-backoff (Phase 38), changes to the generator's content pipeline (Phase 36 owns that), public-site changes.

</domain>

<decisions>
## Implementation Decisions

### File Layout — Split, Don't Bloat

- **D-01:** New directory `client/src/components/admin/blog/` for the new sub-components. Each file ≤ 600 lines. Existing `BlogSection.tsx` (1351 lines — already over the limit, treat as legacy) gets a single new tab entry pointing to the new RSS components, but is NOT refactored in this phase (would balloon scope).
  - Files (new):
    - `client/src/components/admin/blog/RssSourcesPanel.tsx` — sources list + add/edit modal
    - `client/src/components/admin/blog/RssQueuePanel.tsx` — items queue with status filters + pagination
    - `client/src/components/admin/blog/JobHistoryPanel.tsx` — last N jobs + retry/cancel
    - `client/src/components/admin/blog/RssAutomationTab.tsx` — composes the three panels under sub-tabs
    - `client/src/components/admin/blog/PreviewDraftDialog.tsx` — modal that shows generated content before commit
    - `client/src/components/admin/blog/AutomationStatusBanners.tsx` — API-key warning + countdown + cost estimate
  - **Why:** Each panel is independently testable, fits the 600-line cap, and can evolve without touching the legacy 1351-line BlogSection. Co-located in `blog/` keeps the domain together.

### Tab Structure

- **D-02:** Top-level tabs in BlogSection: **Posts | Automation | RSS** (rename "Automation" → keep as is; add a third top-level tab "RSS" that mounts `RssAutomationTab`). Inside the RSS tab, sub-tabs: **Sources | Queue | Jobs**.
  - Banners (API-key warning, countdown, cost estimate) are pinned at the top of the RSS tab, above the sub-tabs — visible no matter which sub-tab is open.
  - **Why:** Keeps the existing Posts/Automation flow untouched. Three top-level tabs is the project ceiling — sub-tabbing the RSS work avoids a five-tab strip.

### CRUD UX Pattern

- **D-03:** RSS Sources use the **modal dialog** pattern (matches `FaqsSection` and `NewFormDialog`):
  - List rendered as `AdminCard` rows with name, URL (truncated), enabled toggle (Switch), "Edit" button, "Delete" button (with confirmation `AlertDialog`)
  - "Add Source" button at the top of the panel opens an empty `Dialog` with name + url + enabled fields
  - Edit reuses the same dialog component pre-populated
  - **Why:** Project pattern; the design system has all primitives ready (`Dialog`, `AlertDialog`, `Switch`).

### Field Surface

- **D-04:** RSS Source row visible fields:
  - `name` (large)
  - `url` (truncated with `Tooltip` to show full)
  - `enabled` (Switch — saves immediately on toggle, no Save button)
  - `last_fetched_at` (relative — `formatDistanceToNow`)
  - `last_fetched_status` (badge: green=success, red=error, gray=never)
  - `error_message` (collapsed, expandable on click — only visible if status=error)
  - **Why:** Operationally what admin needs at a glance. Keeps the row compact — error details on demand.

### Queue Display

- **D-05:** RSS Queue uses **status sub-tabs** (Pending | Used | Skipped) with item counts, and **pagination at 50/page**:
  - Each item row: source name (badge), title, summary (truncated to 2 lines), `published_at` (relative), action column
  - "Used" rows include a clickable link to the resulting post (`/admin/blog/posts/:id`)
  - "Skipped" rows show the skip reason
  - "Pending" rows show the current relevance score (computed in real-time using the same `scoreItem` from Phase 35)
  - **Why:** Three buckets are operationally distinct — admin wants to see backlog (pending), validate output (used), and triage skipped items separately. 50/page is the v1.5 estimates pagination ceiling.

### Generate Now Flow (Critical UX)

- **D-06:** "Generate Now" opens a **PreviewDraftDialog** that:
  1. Calls `POST /api/blog/preview` (NEW endpoint — runs the generator pipeline but does NOT call `createBlogPost`; returns the generated content inline)
  2. Shows a loading state with the same dots loader pattern as the rest of the admin
  3. On success, displays: title, excerpt, feature image preview, the first ~250 words of body content, and the source RSS item used
  4. Two action buttons: **"Save as Draft"** (calls `POST /api/blog/posts` to commit + marks RSS item used + closes dialog with success toast) and **"Discard"** (closes dialog, no DB write — RSS item remains `pending`)
  5. On generator error, shows the failure reason inline (no toast — user is right there reading)
  - **Why:** Honors the BLOG2-09 acceptance criterion ("admin can keep, edit, or discard before it lands in the Posts list"). Generating-then-saving is a two-step transaction. "Edit" is deferred to the existing Posts editor after Save (admin clicks the post in Posts list → existing editor).

### Preview Endpoint Contract

- **D-07:** New endpoint `POST /api/blog/preview` (admin-auth):
  - Body: `{ rssItemId?: number }` — optional override; if omitted, picks via `selectNextRssItem` like generate does
  - Behavior: runs the generator pipeline up to AND INCLUDING sanitization/validation, but instead of calling `createBlogPost` returns `{ generatedPost: { title, slug, content, excerpt, metaDescription, focusKeyword, tags, featureImageUrl }, rssItemId }`
  - On skip/failure: returns `{ skipped: true, reason }` — same shape as generate
  - Does NOT acquire the lock (preview is parallel-safe with the cron generator — both will pick different items because Pending/Used is DB-mediated)
  - Does NOT write to `blog_generation_jobs` (preview is throwaway — no audit row)
  - Companion endpoint `POST /api/blog/posts/from-preview` accepts the preview payload + rssItemId, calls `createBlogPost` + `markRssItemUsed` atomically, returns the saved post
  - **Why:** Preview without commit. The "from-preview" companion is what the "Save as Draft" button calls — keeps the commit transaction in one place.

### Job History

- **D-08:** Job History panel:
  - Last 50 jobs from `blog_generation_jobs`, ordered by `createdAt desc`
  - Columns: status badge, started, completed, source RSS item title (link to queue), error/reason
  - Failed rows have a **"Retry"** button → calls `POST /api/blog/jobs/:id/retry`
  - "Running" rows older than 10 minutes show a **"Cancel"** button → calls `POST /api/blog/jobs/:id/cancel`
  - Auto-refresh every 5s WHILE the most recent job has `status=running` (matches v1.5 BlogAutomationPanel pattern); manual refresh button always available
  - Empty state via `EmptyState` primitive
  - **Why:** Matches established refresh pattern, keeps DB read load low (one query per 5s only when active).

### Retry Semantics

- **D-09:** `POST /api/blog/jobs/:id/retry`:
  - Reads the failed job's `sourceItemId`
  - If the RSS item still exists and has status `pending` (or was just marked `used` but the post failed afterwards — admin manually un-marked) → triggers a new generator run scoped to THAT item (bypassing `selectNextRssItem`)
  - If the source item is gone or unavailable → returns 409 with a message "Source item no longer available — generate a new run instead"
  - Inserts a new `blog_generation_jobs` row (does NOT mutate the original failed row)
  - **Why:** Re-attempting the SAME content avoids "we'll never know if it could've worked" outcomes. New job row preserves audit trail.

### Cancel Semantics

- **D-10:** `POST /api/blog/jobs/:id/cancel`:
  - Allowed only if `lockAcquiredAt` is older than 10 minutes (i.e., the lock is genuinely stale)
  - Force-releases the lock: `UPDATE blog_settings SET lockAcquiredAt = NULL`
  - Updates the target job row: `status='failed', reason='cancelled_by_admin'`
  - **Why:** Matches the existing 10-minute lock-staleness convention from v1.5. Hard-coded threshold — admin doesn't need to tune this.

### API-Key Warning Banner

- **D-11:** `AutomationStatusBanners` component shows a **single red banner** at the top of the RSS tab when ANY of:
  - `process.env.BLOG_GEMINI_API_KEY` is empty/missing (server-side check via existing settings or new lightweight `GET /api/blog/health` endpoint)
  - The Gemini chat integration row is `enabled=false`
  - The Gemini chat integration is missing entirely
  - Banner copy: "⚠️ Blog generator unavailable: configure Gemini integration to enable RSS-driven generation."
  - Link to Integrations section as remedy
  - **Why:** One banner, clear remedy, no ambiguity. Admin can't accidentally trigger generation when it's misconfigured.

### Next-Run Countdown + Cost Estimate

- **D-12:** Same `AutomationStatusBanners` component shows TWO info chips below the warning banner (or in lieu of it when no warning):
  - **Next run:** `lastRunAt + (24h / postsPerDay)` rendered relatively ("in 3h 15m") with `Tooltip` showing absolute time
  - **Estimated cost:** `~$X.XX/month` computed as:
    - Content: `postsPerDay × 30 × ~3000 tokens × $0.075/1M tokens = $0.0068 × postsPerDay × 30`
    - Image: `postsPerDay × 30 × $0.039/image`
    - Total: `Math.round(((0.0068 + 0.039) × postsPerDay × 30) × 100) / 100`
    - Hardcoded prices in a constant `BLOG_COST_PRICING` (commented with date and source link)
  - **Why:** Admin sees "this run will cost $X" before turning automation on. Hardcoded prices are explicitly documented — when Google updates pricing, swap one constant.

### REST Endpoint Catalog (NEW)

- **D-13:** New endpoints in `server/routes/blogAutomation.ts` (no new file — these belong with existing /api/blog/* routes):
  - `GET    /api/blog/rss-sources` (admin) → list
  - `POST   /api/blog/rss-sources` (admin) → create
  - `PATCH  /api/blog/rss-sources/:id` (admin) → update name/url/enabled
  - `DELETE /api/blog/rss-sources/:id` (admin) → cascade-deletes items
  - `GET    /api/blog/rss-items?status=pending|used|skipped&limit=50&offset=0` (admin) → paginated list with source name joined
  - `GET    /api/blog/jobs?limit=50` (admin) → recent jobs with source item title joined
  - `POST   /api/blog/jobs/:id/retry` (admin) → enqueue retry, returns new job row
  - `POST   /api/blog/jobs/:id/cancel` (admin) → 10-min staleness check, releases lock
  - `POST   /api/blog/preview` (admin) → generate-without-commit
  - `POST   /api/blog/posts/from-preview` (admin) → commit a previously generated payload
  - `GET    /api/blog/health` (admin) → `{ apiKeyConfigured: boolean, integrationEnabled: boolean }` for the warning banner
  - **Why:** All under the existing `/api/blog/*` namespace; existing CRON_SECRET routes untouched.

### Translations

- **D-14:** Every new `t()` string in the new components MUST have a PT entry added to `client/src/lib/translations.ts`. New section comment: `// Admin — Blog RSS (Phase 37)`. Hard cap on `translations.ts`: 600 lines (project rule).
  - **Why:** Project rule (CLAUDE.md). The TypeScript overload cast on `t()` will reject undefined keys — this is a compile-time gate.

### Storage Methods (Likely Additions)

- **D-15:** Likely IStorage / DatabaseStorage additions (planner to confirm):
  - `listRssItemsByStatus(status, limit, offset)` with source name join — for the queue panel
  - `listBlogGenerationJobs(limit)` with source item title join — for job history
  - `getBlogGenerationJob(id)` — for retry/cancel handlers
  - `updateBlogGenerationJob(id, patch)` — for cancel mutation
  - **Why:** Keeps query logic in storage layer per project pattern. Joins are read-side concerns; the RSS-item update verbs (markUsed/Skipped) already exist from Phase 34.

### Cost Pricing Constant Location

- **D-16:** `BLOG_COST_PRICING` constant lives in `client/src/components/admin/blog/AutomationStatusBanners.tsx` as a top-of-file constant:
  ```ts
  // Source: ai.google.dev/pricing (verified 2026-05-05)
  const BLOG_COST_PRICING = {
    contentTokensPerPost: 3000,
    contentPricePer1M: 0.075,   // gemini-2.5-flash, USD
    imagePricePerImage: 0.039,  // gemini-2.0-flash-exp image, USD
  } as const;
  ```
  - **Why:** Cost is a UI-side approximation, not a billing-grade calculation. Lives where it's displayed.

### Manual "Generate Now" — Where Does It Live?

- **D-17:** The existing v1.5 "Generate Now" button in `BlogAutomationPanel` continues to exist BUT now opens the new `PreviewDraftDialog` instead of immediately committing a draft. No second button is added; the behavior of the existing button is upgraded.
  - **Why:** Single source of truth for manual generation. Admin doesn't need two buttons that almost-do-the-same-thing.

### Refresh / Polling

- **D-18:** All read endpoints (rss-sources, rss-items, jobs, health) use React Query with `staleTime: 30s` for the "passive" panels. Job history switches to `refetchInterval: 5000` while `latestJob.status === 'running'`. Polling stops automatically when status leaves `running`.
  - **Why:** Polling only when there's something to see. Standard React Query pattern for live state.

### Claude's Discretion

- Internal component prop shapes
- Whether to add a `Card` wrapper inside `RssAutomationTab` for grouping (recommend yes — `AdminCard` per panel)
- Whether the "Add Source" dialog includes an immediate-fetch-on-save toggle (recommend NO for v1.9 — admin clicks a manual "Fetch Now" button if needed; defer that button if scope tightens)
- Exact relative-time strings ("just now" vs "moments ago" — use `date-fns formatDistanceToNow` defaults)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project-Level
- `.planning/PROJECT.md`
- `.planning/REQUIREMENTS.md` — BLOG2-07..13 mapped to this phase
- `.planning/ROADMAP.md` §"Phase 37"
- `.planning/phases/34..36-*/CONTEXT.md` and SUMMARY.md — schema/storage/integration foundation this UI sits on
- `CLAUDE.md` — Admin design system rules (SectionHeader, AdminCard, EmptyState, FormGrid, max 600 lines, hairline border token, neutral charcoal dark theme)

### Existing UI Patterns to Mirror
- `client/src/components/admin/BlogSection.tsx` — current Posts/Automation tabs (1351 lines — DO NOT touch except to add the third top-level tab entry)
- `client/src/components/admin/EstimatesSection.tsx` — modal CRUD pattern (Dialog, AlertDialog confirmation)
- `client/src/components/admin/FaqsSection.tsx` — list + edit-via-modal reference
- `client/src/components/admin/forms/NewFormDialog.tsx` — Dialog primitive usage
- `client/src/components/admin/leads/SortableQuestionItem.tsx` — Switch primitive + relative time
- `client/src/components/admin/shared/SectionHeader.tsx`, `AdminCard.tsx`, `EmptyState.tsx`, `FormGrid.tsx` — design system primitives

### Server-Side
- `server/routes/blogAutomation.ts` — where new endpoints attach
- `server/lib/blog-generator.ts` — preview path will reuse parts of `runPipeline` minus `createBlogPost`
- `server/lib/blogContentValidator.ts` — sanitizer + length validator (Phase 36)
- `server/lib/rssTopicSelector.ts` — `selectNextRssItem` (Phase 35) for default preview source
- `server/storage.ts` — existing IStorage interface, where new query methods land

### Translations
- `client/src/lib/translations.ts` — append new keys under `// Admin — Blog RSS (Phase 37)` section, stay under 600 lines

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Dialog`, `DialogContent`, `DialogHeader`, `DialogFooter` from `@/components/ui/dialog`
- `AlertDialog` family for delete confirmations
- `Switch` from `@/components/ui/switch`
- `Badge`, `Tooltip` from shadcn primitives
- `formatDistanceToNow` from `date-fns` (already used in EstimatesSection)
- React Query already wired with 30s default staleTime
- `apiRequest` helper from `@/lib/queryClient` for typed POST/PATCH/DELETE
- `useToast` for success/error toasts
- `t()` from `useTranslation` with TypeScript-enforced keys

### Established Patterns
- Modal CRUD via Dialog (used 7+ places)
- AdminCard rows with right-aligned action buttons
- EmptyState for zero-data panels
- React Query polling toggled by data state (BlogAutomationPanel does this for last job)
- Toasts for async outcomes; inline errors for synchronous validation
- `t()` everywhere for static strings; dynamic DB content also wrapped in `t()` for AI fallback (Phase v1.9 has preload)

### Integration Points
- BlogSection.tsx: add a single new tab entry pointing to `RssAutomationTab` — minimal touch
- server/routes/blogAutomation.ts: append 11 new route handlers
- server/storage.ts: add 4 new methods to IStorage + DatabaseStorage
- client/src/lib/translations.ts: add new section, stay ≤ 600 lines

</code_context>

<specifics>
## Specific Ideas

- The preview-then-commit two-step flow (`/api/blog/preview` → `/api/blog/posts/from-preview`) is the v1.9 contract — DO NOT collapse it to a single endpoint, even if it feels redundant. The two endpoints are what makes "Discard" feasible.
- Cancel is deliberately gated by 10-min staleness to prevent admins from killing healthy generation runs.
- Cost banner is a "directional" estimate — copy in tooltip should explicitly say "approximate, based on Gemini list pricing" so admin doesn't take it as a billing guarantee.

</specifics>

<deferred>
## Deferred Ideas

- **Editing the preview before save** — v1.9 keeps the dialog read-only. Admin edits via the existing Posts editor after Save. Inline editing is future work.
- **Bulk RSS source operations** — single-source enable/disable/delete for v1.9. Bulk select is future work.
- **RSS item search / filter beyond status** — single status filter for v1.9. Free-text search across titles is future.
- **Job history beyond 50** — last-50 cap with pagination is future. Most operational debug fits in 50.
- **Configurable cost pricing** — hardcoded for v1.9. Admin-tunable pricing is future.
- **Configurable retry policy** — single retry button per failed job for v1.9. Auto-retry-on-failure is Phase 38 territory.
- **Real-time push (WebSocket / SSE)** — polling is sufficient at admin scale.
- **CSV export of jobs / queue** — out of scope.
- **Per-source priority/weight in scoring** — Phase 35 deferred, still deferred here.
- **BlogSection.tsx refactor (1351 lines → split)** — explicitly out of scope; treated as legacy. Worth its own polish phase later.

</deferred>

---

*Phase: 37-admin-ux-rss-job-improvements*
*Context gathered: 2026-05-05 (auto mode — recommended defaults aligned to admin design system)*
