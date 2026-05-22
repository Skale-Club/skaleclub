# Milestones

## v1.9 Blog Intelligence & RSS Sources (Shipped: 2026-05-06)

**Phases completed:** 11 phases, 26 plans, 57 tasks

---

## v1.8 Notification Templates System (Shipped: 2026-05-04)

**Phases completed:** 6 phases, 12 plans, 21 tasks

---

## v1.7 Voice-Enabled Form Builder & Groq Provider (Active: 2026-05-22)

**Phases:** 6 phases (30-35)
**Progress:** 3/6 complete

- Phase 30: AI Provider + Transcription Settings
- Phase 31: Form Engine Hardening
- Phase 32: Public Voice Capture + Basic Lead Summary
- Phase 33: Branch Builder UX (pending)
- Phase 34: Voice Review + Lead Brief UX (pending)
- Phase 35: UAT + Provider Verification (pending)

---

## v1.7 Translation System Completeness (Shipped: 2026-05-04)

**Phases completed:** 1 phase (Phase 30), 4 plans

---

## v1.6 Skale Hub Weekly Live Gate (Shipped: 2026-05-02)

**Phases completed:** 5 phases, 5 plans

---

## v1.5 Blog Post Automation (Shipped: 2026-04-24)

**Phases completed:** 4 phases, 6 plans, 13 tasks
**Files modified:** 45 | **Lines:** +6,343 / -84
**Git range:** 3877653 â†’ HEAD | **Timeline:** 2026-04-22 (single-day sprint)

**Key accomplishments:**

- `blog_settings` + `blog_generation_jobs` SQL tables with typed Drizzle/Zod schemas and 4 IStorage stubs â€” full foundation for the automation pipeline
- `BlogGenerator.generate()` with deterministic skip validation (no-settings, disabled, cadence, locked) and guarded global DB lock preventing duplicate runs across Vercel workers
- Full Gemini pipeline: topic â†’ structured JSON draft (title, HTML, excerpt, meta, tags) â†’ optional feature image â†’ Supabase Storage upload â†’ draft blog post creation
- Feature-image best-effort fallback â€” draft created with `featureImageUrl: null` when Gemini image fails; pipeline never blocked
- REST API: `GET/PUT /api/blog/settings`, `POST /api/blog/generate` (admin-auth), `POST /api/blog/cron/generate` (CRON_SECRET) â€” registered before blog wildcard to prevent route interception
- `server/cron.ts` hourly runner with Vercel guard + `BlogAutomationPanel` with 5 settings fields, Generate Now button (spinner + toasts), `lastRunAt` status bar, and Posts/Automation tab strip

---

## v1.2 Estimates System (Shipped: 2026-04-20)

**Phases completed:** 4 phases, 8 plans, 9 tasks

**Key accomplishments:**

- Drizzle estimates table + discriminatedUnion Zod types for JSONB service snapshot, wired into shared barrel
- Six typed DatabaseStorage CRUD methods for estimates + estimates table created in PostgreSQL via idempotent SQL migration
- One-liner:
- Estimates tab wired into the admin dashboard â€” AdminSection union extended, sidebar menu item added with Receipt icon, both slug maps updated, and /admin/estimates renders EstimatesSection
- Fullscreen scroll-snap estimate viewer at /e/:slug with access code gate, view tracking, IntersectionObserver nav dots, and graceful 404 â€” isolated from Navbar/Footer/ChatWidget

---
