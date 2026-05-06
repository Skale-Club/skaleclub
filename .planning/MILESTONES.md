# Milestones

## v1.9 Blog Intelligence & RSS Sources (Shipped: 2026-05-06)

**Phases completed:** 11 phases, 26 plans, 57 tasks

**Key accomplishments:**

- Not executed in this shell.
- Live curl matrix not executed in this shell.
- Not executed in this shell.
- Three-zone admin grid (Profile | Live Preview placeholder | Main Links) with per-link Radix Switch visibility toggle and click-count Badge, wired to existing PUT /api/company-settings auto-save
- Reusable drag-drop image uploader component (DragDropUploader) wired into the Profile zone Avatar and Background Image slots, replacing text inputs with a base64-JSON POST to `/api/uploads/links-page` (admin-auth cookie, 6-MIME allowlist, 2 MB cap), showing idle/uploading/success/error states and persisting URLs through the existing saveSettings path.
- @dnd-kit-powered drag reorder on admin Main Links card with 6px pointer activation, keyboard sensor, arrayMove + order-reindex persistence, and PT aria-label — wired through existing updateConfig auto-save.
- Reusable IconPicker (Popover + Tabs: Lucide search / Upload / Auto) wired per-link-row in admin LinksSection, persisting iconType + iconValue through the existing saveSettings → PUT /api/company-settings path.
- ThemeEditor component mounted in admin Profile zone with native color pickers + hex inputs + free-form CSS gradient + reset-to-defaults button, persisting through existing 400ms-debounced saveSettings path.
- Phone-framed `<iframe>` LivePreview mounted in admin Zone 2 rendering `/links` same-origin, auto-refreshing via React Query `dataUpdatedAt` cache-bust within ~1s of each save, with a manual Refresh button as belt-and-suspenders.
- 1. [Rule 3 — Blocking] Fallback seed data missing `order` field triggered TS2339/TS2345
- Foundation tables and typed contracts for admin-curated RSS feeds + parsed item ledger, ready for Phase 34-02 storage layer to implement IStorage methods.
- 9 IStorage methods declared and implemented on DatabaseStorage so Phase 35's fetcher and Phase 37's admin UI can persist RSS sources and items through typed Drizzle queries — no raw SQL, no generic update paths.
- Pure RSS ingestion module — fetchAllRssSources() iterates enabled blog_rss_sources sequentially, parses feeds via rss-parser@^3.13.0, upserts items by (source_id, guid) UNIQUE index, and records per-source success/error state. Plan 35-03 wires this into cron and the /api/blog/cron/fetch-rss endpoint.
- Wires Wave 1 (rssFetcher.ts) and Wave 2 (rssTopicSelector.ts) into the running system — hourly setInterval, POST /api/blog/cron/fetch-rss endpoint, and a BlogGenerator pipeline that picks an RSS item before Gemini and marks it used after createBlogPost succeeds.
- Pure HTML sanitizer + slug generator + typed Gemini error classes shipped as a dependency-free module ready for Plan 36-03 to consume.
- Three env-var-overridable constants exported from blog-gemini.ts (BLOG_CONTENT_MODEL, BLOG_IMAGE_MODEL, BLOG_GEMINI_TIMEOUT_MS) with defensive `||` fallbacks, ready for Plan 36-03 AbortController integration.
- BlogGenerator now ships with pt-BR brand voice prompts, 30s AbortController timeout on every Gemini call, strict HTML sanitization with 600..4000 plain-text length gate, NFD-normalized slugs, and four new failure reasons mapped from typed errors — all delivered in one file under the 600-line CLAUDE.md cap.

---

## v1.8 Notification Templates System (Shipped: 2026-05-04)

**Phases completed:** 6 phases, 12 plans, 21 tasks

**Key accomplishments:**

- Admin Notifications panel with 3 event cards (new_chat, hot_lead, low_perf_alert) x 2 channel rows (SMS, Telegram), per-row draft state, clipboard variable badges, and full admin sidebar/router wiring.

---

## v1.7 Translation System Completeness (Shipped: 2026-05-04)

**Phases completed:** 1 phase (Phase 30), 4 plans
**Timeline:** 2026-05-03 (single-day sprint)

**Key accomplishments:**

- `t()` typed as `TranslationKey` via TypeScript overload cast — compile-time error for undefined keys, zero runtime overhead; 18 dead keys removed, correct 404 key added
- 7 translation keys wired into PresentationsSection, LeadsSection, SEOSection, NewFormDialog, LinksSection — all "Back to X" variants covered
- `useTranslation` added to DashboardSection and EstimatesSection from scratch — both had zero t() usage before; all visible strings wrapped
- ~104 static keys added for PrivacyPolicy and TermsOfService — legal copy is now deterministic, zero API fallbacks
- `translations.ts` at exactly 599 lines; `npm run check` green; 11/11 TRX requirements delivered

---

## v1.5 Blog Post Automation (Shipped: 2026-04-24)

**Phases completed:** 4 phases, 6 plans, 13 tasks
**Files modified:** 45 | **Lines:** +6,343 / -84
**Git range:** 3877653 → HEAD | **Timeline:** 2026-04-22 (single-day sprint)

**Key accomplishments:**

- `blog_settings` + `blog_generation_jobs` SQL tables with typed Drizzle/Zod schemas and 4 IStorage stubs — full foundation for the automation pipeline
- `BlogGenerator.generate()` with deterministic skip validation (no-settings, disabled, cadence, locked) and guarded global DB lock preventing duplicate runs across Vercel workers
- Full Gemini pipeline: topic → structured JSON draft (title, HTML, excerpt, meta, tags) → optional feature image → Supabase Storage upload → draft blog post creation
- Feature-image best-effort fallback — draft created with `featureImageUrl: null` when Gemini image fails; pipeline never blocked
- REST API: `GET/PUT /api/blog/settings`, `POST /api/blog/generate` (admin-auth), `POST /api/blog/cron/generate` (CRON_SECRET) — registered before blog wildcard to prevent route interception
- `server/cron.ts` hourly runner with Vercel guard + `BlogAutomationPanel` with 5 settings fields, Generate Now button (spinner + toasts), `lastRunAt` status bar, and Posts/Automation tab strip

---

## v1.2 Estimates System (Shipped: 2026-04-20)

**Phases completed:** 4 phases, 8 plans, 9 tasks

**Key accomplishments:**

- Drizzle estimates table + discriminatedUnion Zod types for JSONB service snapshot, wired into shared barrel
- Six typed DatabaseStorage CRUD methods for estimates + estimates table created in PostgreSQL via idempotent SQL migration
- One-liner:
- Estimates tab wired into the admin dashboard — AdminSection union extended, sidebar menu item added with Receipt icon, both slug maps updated, and /admin/estimates renders EstimatesSection
- Fullscreen scroll-snap estimate viewer at /e/:slug with access code gate, view tracking, IntersectionObserver nav dots, and graceful 404 — isolated from Navbar/Footer/ChatWidget

---
