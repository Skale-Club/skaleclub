# Requirements: Skale Club Web Platform — v1.5 Blog Post Automation

**Defined:** 2026-04-22
**Core Value:** Admin configures a Gemini-powered blog post generator that runs on schedule and creates SEO-optimized draft posts — with cover image generation — ready for human review and publish.

## v1.5 Requirements

### Schema & Storage

- [x] **BLOG-01**: `blog_settings` singleton table — `id`, `enabled` (boolean, default false), `postsPerDay` (int 0–4, default 0), `seoKeywords` (text), `enableTrendAnalysis` (boolean, default false), `promptStyle` (text), `lastRunAt` (timestamp nullable), `lockAcquiredAt` (timestamp nullable, global lock field), `updatedAt`. Upsert on save.
- [x] **BLOG-02**: `blog_generation_jobs` event-log table — `id` (serial PK), `status` (text: pending/running/completed/failed/skipped), `reason` (text nullable, skip reason), `postId` (int nullable, NO FK constraint — set after post is created), `startedAt` (timestamp), `completedAt` (timestamp nullable), `error` (text nullable).
- [x] **BLOG-03**: Drizzle table definitions + Zod schemas (`insertBlogSettingsSchema`, `selectBlogSettingsSchema`) in `shared/schema/blog.ts`, barrel re-export via `shared/schema.ts`.
- [x] **BLOG-04**: Storage stubs in `IStorage` + `DatabaseStorage` — `getBlogSettings()`, `upsertBlogSettings(data)`, `createBlogGenerationJob(data)`, `updateBlogGenerationJob(id, data)`.

### Blog Generator Engine

- [x] **BLOG-05**: `BlogGenerator` class in `server/lib/blog-generator.ts` — static method `generate({ manual: boolean })` that encapsulates the full pipeline. Returns `{ skipped, reason, jobId?, postId?, post? }`.
- [x] **BLOG-06**: Pre-generation validation — if `manual: false`, checks: settings row exists in DB, `enabled === true`, `postsPerDay > 0`, elapsed time since `lastRunAt` ≥ `24h / postsPerDay`. Returns `{ skipped: true, reason }` without throwing.
- [x] **BLOG-07**: Global DB lock — before running, sets `blog_settings.lockAcquiredAt = NOW()` where `lockAcquiredAt IS NULL OR lockAcquiredAt < NOW() - interval '10 minutes'`. If update affects 0 rows, returns `{ skipped: true, reason: "locked" }`. Clears lock on completion or error.
- [x] **BLOG-08**: Content generation via Gemini — generates a topic then structured JSON: `{ title, content (HTML), excerpt, metaDescription, focusKeyword, tags: string[] }`. Model: `gemini-1.5-flash`. API key resolved in order: `BLOG_GEMINI_API_KEY` → `GEMINI_API_KEY` → `GOOGLE_API_KEY`.
- [x] **BLOG-09**: Image generation via Gemini image model (`gemini-2.0-flash-exp` or available image model). If image generation fails for any reason (API error, model unavailable, quota), pipeline continues without image — post is created with `featureImageUrl: null`.
- [x] **BLOG-10**: Generated image uploaded to Supabase Storage — bucket `images`, path `blog-images/{timestamp}-{uuid}.jpg`. Uses existing `getSupabaseAdmin()`. Returns public URL stored in post.
- [x] **BLOG-11**: Post created BEFORE job is updated with `postId` — `blog_posts` row inserted with `status: "draft"`, `authorName: "AI Assistant"`, unique slug (title-based + timestamp suffix). Job record updated with `postId` only after successful insert.
- [x] **BLOG-12**: `blog_settings.lastRunAt` updated and lock cleared atomically on successful job completion. On failure, lock is cleared but `lastRunAt` is NOT updated (allows retry).

### API Endpoints

- [x] **BLOG-13**: `GET /api/blog/settings` (no auth required) — returns current `blog_settings` row or safe defaults `{ enabled: false, postsPerDay: 0, seoKeywords: "", enableTrendAnalysis: false, promptStyle: "" }` if no row exists. `PUT /api/blog/settings` (admin-auth required) — upserts settings, returns saved row.
- [x] **BLOG-14**: `POST /api/blog/generate` (admin-auth required) — triggers manual generation (`manual: true`). Returns `{ jobId, postId, post }` on success, `{ skipped, reason }` if skipped, `{ error }` on failure. Does NOT require `enabled: true` (manual bypasses the enabled check but still requires settings to exist in DB).
- [x] **BLOG-15**: `POST /api/blog/cron/generate` (no session auth) — validates `Authorization: Bearer {CRON_SECRET}` header against `process.env.CRON_SECRET`. Returns 401 if missing/wrong. Calls `BlogGenerator.generate({ manual: false })`. Returns `{ skipped, reason }` or `{ jobId, postId }`.

### Cron (Persistent Environments)

- [x] **BLOG-16**: `server/cron.ts` — starts a `setInterval` (every 60 minutes) that calls `BlogGenerator.generate({ manual: false })` only when `process.env.VERCEL` is falsy. Exported as `startCron()`, called from `server/index.ts` startup.

### Admin UI

- [x] **BLOG-17**: Admin Blog section (`client/src/components/admin/BlogSection.tsx`) gains an "Automation" tab or accordion — fields: enabled toggle, postsPerDay select (0/1/2/3/4), seoKeywords textarea, enableTrendAnalysis toggle, promptStyle textarea. Save button calls `PUT /api/blog/settings`.
- [x] **BLOG-18**: "Generate Now" button in Automation UI — calls `POST /api/blog/generate`, shows loading spinner during request, shows success toast with link to the draft post on success, shows error toast on failure or skip reason.
- [x] **BLOG-19**: Automation UI shows "Last generated: {relative time}" sourced from `blog_settings.lastRunAt`, and status of last job (completed/failed/skipped) from `blog_generation_jobs` latest row.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Automatic publish (autoPublish) | Human review required before posts go live; draft-only workflow maintained |
| Real trend analysis (internet scraping) | Prompt instruction for Gemini to consider seasonality — not real-time data |
| Blog post review UI | Existing BlogSection editor already handles draft review/publish |
| Per-post AI regeneration | Manual edit via existing admin editor is sufficient for v1.5 |
| Multiple AI providers for blog | Gemini dedicated pipeline; decoupled from `getActiveAIClient()` shim |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| BLOG-01 | Phase 21 | Complete |
| BLOG-02 | Phase 21 | Complete |
| BLOG-03 | Phase 21 | Complete |
| BLOG-04 | Phase 21 | Complete |
| BLOG-05 | Phase 22 | Complete |
| BLOG-06 | Phase 22 | Complete |
| BLOG-07 | Phase 22 | Complete |
| BLOG-08 | Phase 22 | Complete |
| BLOG-09 | Phase 22 | Complete |
| BLOG-10 | Phase 22 | Complete |
| BLOG-11 | Phase 22 | Complete |
| BLOG-12 | Phase 22 | Complete |
| BLOG-13 | Phase 23 | Complete |
| BLOG-14 | Phase 23 | Complete |
| BLOG-15 | Phase 23 | Complete |
| BLOG-16 | Phase 23 | Complete |
| BLOG-17 | Phase 24 | Complete |
| BLOG-18 | Phase 24 | Complete |
| BLOG-19 | Phase 24 | Complete |

**Coverage:**
- v1.5 requirements: 19 total
- Mapped to phases: 19/19 ✓ (100%)

**Phase distribution:**
- Phase 21 (Schema & Storage): 4 reqs — BLOG-01–04
- Phase 22 (Generator Engine): 8 reqs — BLOG-05–12
- Phase 23 (API + Cron): 4 reqs — BLOG-13–16
- Phase 24 (Admin UI): 3 reqs — BLOG-17–19

---
*Requirements defined: 2026-04-22*
