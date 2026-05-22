# Skale Club Web Platform

## What This Is

Skale Club is an agency web platform combining a public marketing site, an admin dashboard, and a field sales CRM (Xpot). The platform ships four client-facing experiences: branded service proposals at `/e/:slug` (Estimates), immersive bilingual slide decks at `/p/:slug` (Presentations), a themed personal link page at `/links`, and a public blog. The admin controls all four from a single dashboard, including a Gemini-powered blog post generator that runs on schedule or on-demand.

## Current Milestone: v1.7 Voice-Enabled Form Builder & Groq Provider

**Goal:** Upgrade lead capture forms into a branch-capable engine where leads can explain projects by text or voice, audio is transcribed through Groq/OpenRouter, and admins receive clean summaries.

**Target features:**
- Groq as a first-class chat provider alongside OpenAI, Gemini, and OpenRouter
- Form voice transcription provider selector (Groq Whisper or OpenRouter STT)
- Form engine hardening: publish validation, dynamic scoring, no hidden `nome` dependency, safer custom-answer handling
- New form question types: `textarea` and `voice`
- Branch-ready conditional model via `conditionalFields`
- Public form voice recorder with visual recording feedback, transcription, and summary persistence
- Admin lead detail improvements for transcript summaries and future project brief review
- UAT pass for real Groq/OpenRouter transcription and branch text-vs-voice flow

## Core Value

Leads can qualify themselves through smarter forms that support branching, text or voice project explanations, AI transcription, and admin-ready summaries.

## Requirements

### Validated

- âœ“ **DEBT-01**: Route file splitting â€” v1.0 (1,042 lines â†’ 13 focused files)
- âœ“ **DEBT-02**: Schema organization â€” v1.0 (1,004 lines â†’ 6 domain files + barrel)
- âœ“ **DEBT-03**: Context refactoring â€” v1.0 (729 lines â†’ 8 focused hooks + GeoContext)
- âœ“ **DEBT-04**: Error handling standardization â€” v1.0 (crash bug fixed, ZodError handling added)
- âœ“ **FORMS-01 â†’ FORMS-05**: Multi-forms support (forms table, admin editor, public `/f/:slug`, leads scoped by form, cleanup) â€” v1.1 (2026-04-15)
- âœ“ **EST-01 â†’ EST-18**: Full Estimates System (table, CRUD API, admin UI, public scroll-snap viewer, view tracking, access code gate) â€” v1.2 (2026-04-20)
- âœ“ **LINKS-01 â†’ LINKS-17**: Full Links Page Upgrade (upload foundation, click analytics, admin redesign, icon picker, theme editor, live preview, public rendering) â€” v1.3 (2026-04-20)
- âœ“ **PRES-01 â†’ PRES-22**: Full Admin Presentations Page (schema, CRUD API, brand guidelines, AI SSE authoring, admin editor, public bilingual viewer) â€” v1.4 (2026-04-22)
- âœ“ **BLOG-01 â†’ BLOG-19**: Full Blog Post Automation (blog tables, Gemini generator engine, REST API + cron, admin automation UI) â€” v1.5 (2026-04-24)
- ✓ **HUB-01 → HUB-18**: Full Skale Hub Weekly Live Gate (weekly live page, registration gate, live unlock/access tracking, admin live management, participant analytics) — v1.6 (2026-05-02)

### Active

- [x] **AI-01 → AI-02, STT-01 → STT-03**: Groq provider + form transcription selector foundation - v1.7 (Phase 30, 2026-05-22)
- [x] **FORM-01 → FORM-10**: Form engine hardening, validation, dynamic scoring, textarea/voice types, custom answer preservation - v1.7 (Phase 31, 2026-05-22)
- [x] **VOICE-01 → VOICE-04, BRANCH-01, LEAD-01 → LEAD-02**: Public voice capture/transcription + basic admin summary display - v1.7 (Phase 32, 2026-05-22)
- [ ] **BRANCH-02 → BRANCH-05, VOICE-05 → VOICE-06, LEAD-03 → LEAD-05, VERIFY-03 → VERIFY-06**: Remaining branch UX, voice review, lead brief, and provider UAT - v1.7 (Phases 33-35)

### Out of Scope

- Estimate acceptance / e-signature â€” future milestone
- PDF export â€” future milestone
- Client login / per-estimate access control â€” public link + optional access code sufficient
- Automated testing â€” no test framework in project
- Automatic blog publish (autoPublish) â€” human review required; draft-only workflow maintained
- Real trend analysis (internet scraping) â€” prompt instruction for Gemini considers seasonality; not real-time data
- Blog post review UI â€” existing BlogSection editor handles draft review/publish
- Per-post AI regeneration â€” manual edit via existing admin editor sufficient
- Visitor login/password accounts for Skale Hub â€” lightweight gate preferred over full membership
- Course portal or member library for Skale Hub â€” not part of the weekly live scope

## Context

- v1.0 shipped 2026-03-30: Xpot tech debt remediation (64 files, 4 phases, +9,106 LOC)
- v1.1 shipped 2026-04-15: Multi-forms support (5 sub-phases, tracked in PAUL then synced to GSD)
- v1.2 shipped 2026-04-20: Estimates System (4 phases, 8 plans, 62 files, +10,263 LOC)
- v1.3 shipped 2026-04-20: Links Page Upgrade (5 phases, 10 plans, 17/17 requirements)
- v1.4 shipped 2026-04-22: Admin Presentations Page (6 phases, 22/22 requirements â€” schema, CRUD API, brand guidelines, AI authoring SSE, admin chat editor, public bilingual viewer)
- v1.5 shipped 2026-04-24: Blog Post Automation (4 phases, 6 plans, 45 files, +6,343 LOC, 19/19 requirements)
- v1.6 planned 2026-05-02: Skale Hub Weekly Live Gate (5 phases, 18 requirements - schema, tracking APIs, public page, admin management, analytics)
- v1.6 shipped 2026-05-02: Skale Hub Weekly Live Gate (5 phases, 18/18 requirements complete)
- v1.7 active 2026-05-22: Voice-Enabled Form Builder & Groq Provider - Phases 30-35
- Stack: TypeScript/React + Express + Drizzle ORM + PostgreSQL + Supabase Auth + Vercel
- DB migration pattern: raw SQL via tsx script (drizzle-kit CJS can't resolve .js ESM imports)
- AI providers: Gemini (blog automation via `@google/genai`), Anthropic Claude (presentations via `@anthropic-ai/sdk`), OpenAI/Groq/OpenRouter (chat via `getActiveAIClient()` shim)
- Public viewer pattern: IntersectionObserver for scroll-spy nav dots + framer-motion for section animations

## Constraints

- **No DB breaking changes**: Additive tables/columns only â€” no modifications to existing tables
- **API stability**: All existing `/api/*` signatures unchanged
- **No test framework**: Manual QA only
- **Snapshot immutability**: Estimate services must be a deep copy at save time, not a FK reference

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Surgical refactoring, not deep refactor (v1.0) | Minimize risk, preserve behavior | âœ… All API contracts preserved |
| Barrel re-export pattern for schema split (v1.0) | Zero consumer changes | âœ… 64 import sites unchanged |
| GeoContext for shared geoState (v1.0) | useState-per-call creates isolated state | âœ… Single instance via React Context |
| `/f/:slug` route not `?form=` param (v1.1) | Cleaner shareable public form URL | âœ… |
| `hasMultipleForms` gate (v1.1) | Single-form workspaces see no UI change | âœ… |
| Soft-delete for forms with leads (v1.1) | Default form always protected | âœ… |
| JSONB snapshot for estimate services (v1.2) | Immutability â€” edits to catalog don't corrupt sent proposals | âœ… Validated |
| UUID slug for estimate public links (v1.2) | Unguessable public URL without auth | âœ… Validated |
| Plain-text access_code, not bcrypt (v1.2) | GHL automation must read and inject codes into links | âœ… Validated |
| Raw SQL tsx migration pattern (v1.2) | drizzle-kit CJS can't resolve .js ESM imports | âœ… Reusable pattern established |
| estimate_views event-log table, not counter column (v1.2) | Queryable history, cascade delete, no UPDATE contention | âœ… Validated |
| isEstimateRoute guard before Navbar in App.tsx (v1.2) | Structural isolation â€” no conditional rendering inside layout | âœ… Validated |
| `client.messages.stream()` not `.create({stream:true})` for Anthropic SSE (v1.4) | MessageStream helper accumulates inputJson deltas and fires named events | âœ… Phase 18 |
| `tool_choice: {type:"tool",name:"update_slides"}` forced (v1.4) | Prevents Claude returning plain text for casual messages | âœ… Phase 18 |
| `Anthropic.Tool` namespace access not named import (v1.4) | SDK doesn't export `Tool` at top-level index | âœ… Phase 18 |
| Dedicated `@google/genai` singleton for blog (v1.5) | Blog Gemini pipeline decoupled from existing chat Gemini helper | âœ… Phase 22 |
| `blog_generation_jobs.postId` nullable int, no FK (v1.5) | Job row can exist before draft post is created | âœ… Phase 21 |
| Feature-image failure is non-blocking (v1.5) | Draft creation must succeed even when Gemini image API fails | âœ… Phase 22 |
| `registerBlogAutomationRoutes` before `registerBlogRoutes` (v1.5) | Prevents `GET /api/blog/:idOrSlug` wildcard from intercepting `/api/blog/settings` | âœ… Phase 23 |
| `startCron()` with `process.env.VERCEL` guard (v1.5) | Vercel serverless uses cron endpoint instead; avoid double-firing | âœ… Phase 23 |
| BlogAutomationPanel co-located in BlogSection.tsx (v1.5) | Matches EstimatesSection + IntegrationsSection co-location patterns | âœ… Phase 24 |
| Phone-first participant identity for Skale Hub (v1.6) | Phone is the primary business identifier; email strengthens matching and CRM value | âœ… Phase 25 |
| Track unlock and access as separate events for Skale Hub (v1.6) | Admin needs to distinguish gate completion from actual click-through | âœ… Phase 25 foundation via event-log table |
| No visitor auth for Skale Hub (v1.6) | Weekly live access must stay simple and fast | âœ… Phase 26 API contract |

| Form voice is an engine upgrade, not just a recorder (v1.7) | Branching, validation, dynamic fields, scoring, and lead display must move together | Active |
| New forms start inactive/draft (v1.7) | Prevents empty public `/f/:slug` flows while admins build questions | Active |
| `conditionalFields` plural keeps compatibility with legacy `conditionalField` (v1.7) | Enables future multi-branch UI without breaking existing forms | Active |
## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? â†’ Move to Out of Scope with reason
2. Requirements validated? â†’ Move to Validated with phase reference
3. New requirements emerged? â†’ Add to Active
4. Decisions to log? â†’ Add to Key Decisions
5. "What This Is" still accurate? â†’ Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check â€” still the right priority?
3. Audit Out of Scope â€” reasons still valid?
4. Update Context with current state

---

*Last updated: 2026-05-22 - v1.7 Voice-Enabled Form Builder & Groq Provider active; phases 30-32 implemented, phases 33-35 remaining*
