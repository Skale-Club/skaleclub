# Milestones

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
