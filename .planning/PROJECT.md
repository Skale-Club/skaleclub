# Skale Club Web Platform

## What This Is

Skale Club is an agency web platform combining a public marketing site, an admin dashboard, and a field sales CRM (Xpot). The platform ships four client-facing experiences: branded service proposals at `/e/:slug` (Estimates), immersive bilingual slide decks at `/p/:slug` (Presentations), a themed personal link page at `/links`, and a public blog. The admin controls all four from a single dashboard — including a Gemini-powered blog post generator, weekly live event gate (Skale Hub), and a multi-channel notification system (SMS + Telegram) with DB-editable templates.

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
- ✓ **HUB-01 → HUB-18**: Skale Hub Weekly Live Gate (schema, public page, admin CRUD, analytics) — v1.6 (2026-05-02)
- ✓ **TRX-01 → TRX-11**: Translation System Overhaul (100% PT coverage, TypeScript-enforced keys) — v1.7 (2026-05-03)
- ✓ **NOTIF-01 → NOTIF-14**: Notification Templates System (DB-stored templates, dispatchNotification, Telegram integration, admin Notifications panel) — v1.8 (2026-05-04)

### Active

_(No active milestone — run `/gsd:new-milestone` to define the next one)_

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
- Notification delivery history / logs — future milestone
- Email notification channel — separate infrastructure, future milestone
- Per-admin recipient routing — all notifications go to configured recipients

## Context

- v1.0 shipped 2026-03-30: Xpot tech debt remediation (64 files, 4 phases, +9,106 LOC)
- v1.1 shipped 2026-04-15: Multi-forms support (5 sub-phases, tracked in PAUL then synced to GSD)
- v1.2 shipped 2026-04-20: Estimates System (4 phases, 8 plans, 62 files, +10,263 LOC)
- v1.3 shipped 2026-04-20: Links Page Upgrade (5 phases, 10 plans, 17/17 requirements)
- v1.4 shipped 2026-04-22: Admin Presentations Page (6 phases, 22/22 requirements)
- v1.5 shipped 2026-04-24: Blog Post Automation (4 phases, 6 plans, 45 files, +6,343 LOC, 19/19 requirements)
- v1.6 shipped 2026-05-02: Skale Hub Weekly Live Gate (5 phases, 18/18 requirements)
- v1.7 shipped 2026-05-03: Translation System Overhaul (1 phase, 4 plans, 11/11 requirements)
- v1.8 shipped 2026-05-04: Notification Templates System (3 phases, 6 plans, 53 files, +5,894 LOC, 14/14 NOTIF requirements)
- Stack: TypeScript/React + Express + Drizzle ORM + PostgreSQL + Supabase Auth + Vercel
- DB migration pattern: raw SQL via tsx script OR `npx supabase db push` (Supabase CLI preferred going forward)
- AI providers: Gemini (blog automation via `@google/genai`), Anthropic Claude (presentations via `@anthropic-ai/sdk`), OpenAI/Groq/OpenRouter (chat via `getActiveAIClient()` shim)
- Notification channels: Twilio SMS + Telegram Bot API (native fetch) — both routed through shared dispatcher

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
| Raw SQL tsx migration pattern (v1.2) | drizzle-kit CJS can't resolve .js ESM imports | ✅ Reusable pattern; `supabase db push` preferred for remote |
| estimate_views event-log table, not counter column (v1.2) | Queryable history, cascade delete, no UPDATE contention | ✅ Validated |
| isEstimateRoute guard before Navbar in App.tsx (v1.2) | Structural isolation — no conditional rendering inside layout | ✅ Validated |
| `client.messages.stream()` for Anthropic SSE (v1.4) | MessageStream helper accumulates inputJson deltas | ✅ Phase 18 |
| `tool_choice: {type:"tool"}` forced (v1.4) | Prevents Claude returning plain text for casual messages | ✅ Phase 18 |
| Dedicated `@google/genai` singleton for blog (v1.5) | Blog Gemini pipeline decoupled from chat Gemini helper | ✅ Phase 22 |
| `registerBlogAutomationRoutes` before `registerBlogRoutes` (v1.5) | Prevents wildcard from intercepting `/api/blog/settings` | ✅ Phase 23 |
| Phone-first participant identity for Skale Hub (v1.6) | Phone is primary business identifier | ✅ Phase 25 |
| No visitor auth for Skale Hub (v1.6) | Weekly live access must stay simple and fast | ✅ Phase 26 |
| text columns (not enum) for event_key and channel (v1.8) | ALTER TABLE not needed for new event types | ✅ Phase 31 |
| dispatchNotification() single entry point (v1.8) | Callers never deal with message text or channel routing | ✅ Phase 31-32 |
| notifyOnNewChat guard at call site, not dispatcher (v1.8) | Dispatcher is channel-agnostic; per-event toggles stay at call site | ✅ Phase 31 |
| Native fetch for Telegram Bot API (v1.8) | No SDK needed; single POST to sendMessage endpoint | ✅ Phase 32 |
| chatId stored as TEXT not INTEGER (v1.8) | Telegram channel IDs use -100 prefix, overflow safe integer | ✅ Phase 32 |
| Per-channel individual save in Notifications panel (v1.8) | Prevents accidental overwrites when editing multiple channels | ✅ Phase 33 |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---

*Last updated: 2026-05-04 — v1.8 Notification Templates System shipped; all NOTIF-01–14 validated*
