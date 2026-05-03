# Skale Club Web Platform

## What This Is

Skale Club is an agency web platform combining a public marketing site, an admin dashboard, and a field sales CRM (Xpot). The platform ships four client-facing experiences: branded service proposals at `/e/:slug` (Estimates), immersive bilingual slide decks at `/p/:slug` (Presentations), a themed personal link page at `/links`, and a public blog. The admin controls all four from a single dashboard, including a Gemini-powered blog post generator that runs on schedule or on-demand.

## Core Value

Clients receive a proposal link and experience Skale Club services as an immersive, professional presentation — not a PDF.

## Requirements

### Validated

- ✓ **DEBT-01**: Route file splitting — v1.0 (1,042 lines → 13 focused files)
- ✓ **DEBT-02**: Schema organization — v1.0 (1,004 lines → 6 domain files + barrel)
- ✓ **DEBT-03**: Context refactoring — v1.0 (729 lines → 8 focused hooks + GeoContext)
- ✓ **DEBT-04**: Error handling standardization — v1.0 (crash bug fixed, ZodError handling added)
- ✓ **FORMS-01 → FORMS-05**: Multi-forms support (forms table, admin editor, public `/f/:slug`, leads scoped by form, cleanup) — v1.1 (2026-04-15)
- ✓ **EST-01 → EST-18**: Full Estimates System (table, CRUD API, admin UI, public scroll-snap viewer, view tracking, access code gate) — v1.2 (2026-04-20)
- ✓ **LINKS-01 → LINKS-17**: Full Links Page Upgrade (upload foundation, click analytics, admin redesign, icon picker, theme editor, live preview, public rendering) — v1.3 (2026-04-20)
- ✓ **PRES-01 → PRES-22**: Full Admin Presentations Page (schema, CRUD API, brand guidelines, AI SSE authoring, admin editor, public bilingual viewer) — v1.4 (2026-04-22)
- ✓ **BLOG-01 → BLOG-19**: Full Blog Post Automation (blog tables, Gemini generator engine, REST API + cron, admin automation UI) — v1.5 (2026-04-24)

### Active

- **HUB-01 → HUB-18**: Skale Hub Weekly Live Gate (v1.6, planned 2026-05-02) - weekly live page, registration gate, live unlock/access tracking, admin live management, participant analytics

### Out of Scope

- Estimate acceptance / e-signature — future milestone
- PDF export — future milestone
- Client login / per-estimate access control — public link + optional access code sufficient
- Automated testing — no test framework in project
- Automatic blog publish (autoPublish) — human review required; draft-only workflow maintained
- Real trend analysis (internet scraping) — prompt instruction for Gemini considers seasonality; not real-time data
- Blog post review UI — existing BlogSection editor handles draft review/publish
- Per-post AI regeneration — manual edit via existing admin editor sufficient
- Visitor login/password accounts for Skale Hub — lightweight gate preferred over full membership
- Course portal or member library for Skale Hub — not part of the weekly live scope

## Context

- v1.0 shipped 2026-03-30: Xpot tech debt remediation (64 files, 4 phases, +9,106 LOC)
- v1.1 shipped 2026-04-15: Multi-forms support (5 sub-phases, tracked in PAUL then synced to GSD)
- v1.2 shipped 2026-04-20: Estimates System (4 phases, 8 plans, 62 files, +10,263 LOC)
- v1.3 shipped 2026-04-20: Links Page Upgrade (5 phases, 10 plans, 17/17 requirements)
- v1.4 shipped 2026-04-22: Admin Presentations Page (6 phases, 22/22 requirements — schema, CRUD API, brand guidelines, AI authoring SSE, admin chat editor, public bilingual viewer)
- v1.5 shipped 2026-04-24: Blog Post Automation (4 phases, 6 plans, 45 files, +6,343 LOC, 19/19 requirements)
- v1.6 planned 2026-05-02: Skale Hub Weekly Live Gate (5 phases, 18 requirements - schema, tracking APIs, public page, admin management, analytics)
- v1.6 shipped 2026-05-02: Skale Hub Weekly Live Gate (5 phases, 18/18 requirements complete)
- Stack: TypeScript/React + Express + Drizzle ORM + PostgreSQL + Supabase Auth + Vercel
- DB migration pattern: raw SQL via tsx script (drizzle-kit CJS can't resolve .js ESM imports)
- AI providers: Gemini (blog automation via `@google/genai`), Anthropic Claude (presentations via `@anthropic-ai/sdk`), OpenAI/Groq/OpenRouter (chat via `getActiveAIClient()` shim)
- Public viewer pattern: IntersectionObserver for scroll-spy nav dots + framer-motion for section animations

## Constraints

- **No DB breaking changes**: Additive tables/columns only — no modifications to existing tables
- **API stability**: All existing `/api/*` signatures unchanged
- **No test framework**: Manual QA only
- **Snapshot immutability**: Estimate services must be a deep copy at save time, not a FK reference

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Surgical refactoring, not deep refactor (v1.0) | Minimize risk, preserve behavior | ✅ All API contracts preserved |
| Barrel re-export pattern for schema split (v1.0) | Zero consumer changes | ✅ 64 import sites unchanged |
| GeoContext for shared geoState (v1.0) | useState-per-call creates isolated state | ✅ Single instance via React Context |
| `/f/:slug` route not `?form=` param (v1.1) | Cleaner shareable public form URL | ✅ |
| `hasMultipleForms` gate (v1.1) | Single-form workspaces see no UI change | ✅ |
| Soft-delete for forms with leads (v1.1) | Default form always protected | ✅ |
| JSONB snapshot for estimate services (v1.2) | Immutability — edits to catalog don't corrupt sent proposals | ✅ Validated |
| UUID slug for estimate public links (v1.2) | Unguessable public URL without auth | ✅ Validated |
| Plain-text access_code, not bcrypt (v1.2) | GHL automation must read and inject codes into links | ✅ Validated |
| Raw SQL tsx migration pattern (v1.2) | drizzle-kit CJS can't resolve .js ESM imports | ✅ Reusable pattern established |
| estimate_views event-log table, not counter column (v1.2) | Queryable history, cascade delete, no UPDATE contention | ✅ Validated |
| isEstimateRoute guard before Navbar in App.tsx (v1.2) | Structural isolation — no conditional rendering inside layout | ✅ Validated |
| `client.messages.stream()` not `.create({stream:true})` for Anthropic SSE (v1.4) | MessageStream helper accumulates inputJson deltas and fires named events | ✅ Phase 18 |
| `tool_choice: {type:"tool",name:"update_slides"}` forced (v1.4) | Prevents Claude returning plain text for casual messages | ✅ Phase 18 |
| `Anthropic.Tool` namespace access not named import (v1.4) | SDK doesn't export `Tool` at top-level index | ✅ Phase 18 |
| Dedicated `@google/genai` singleton for blog (v1.5) | Blog Gemini pipeline decoupled from existing chat Gemini helper | ✅ Phase 22 |
| `blog_generation_jobs.postId` nullable int, no FK (v1.5) | Job row can exist before draft post is created | ✅ Phase 21 |
| Feature-image failure is non-blocking (v1.5) | Draft creation must succeed even when Gemini image API fails | ✅ Phase 22 |
| `registerBlogAutomationRoutes` before `registerBlogRoutes` (v1.5) | Prevents `GET /api/blog/:idOrSlug` wildcard from intercepting `/api/blog/settings` | ✅ Phase 23 |
| `startCron()` with `process.env.VERCEL` guard (v1.5) | Vercel serverless uses cron endpoint instead; avoid double-firing | ✅ Phase 23 |
| BlogAutomationPanel co-located in BlogSection.tsx (v1.5) | Matches EstimatesSection + IntegrationsSection co-location patterns | ✅ Phase 24 |
| Phone-first participant identity for Skale Hub (v1.6) | Phone is the primary business identifier; email strengthens matching and CRM value | ✅ Phase 25 |
| Track unlock and access as separate events for Skale Hub (v1.6) | Admin needs to distinguish gate completion from actual click-through | ✅ Phase 25 foundation via event-log table |
| No visitor auth for Skale Hub (v1.6) | Weekly live access must stay simple and fast | ✅ Phase 26 API contract |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---

*Last updated: 2026-05-02 - v1.6 Skale Hub Weekly Live Gate planned; active milestone initialized*
