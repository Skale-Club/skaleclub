# Skale Club Web Platform

## What This Is

Skale Club is an agency web platform combining a public marketing site, an admin dashboard, and a field sales CRM (Xpot). The Estimates System (v1.2) lets admins compose branded service proposals from the portfolio catalog and share them as immersive fullscreen scroll-snap experiences at a private `/e/:slug` link — with optional access code protection and view tracking.

## Current Milestone: v1.4 Admin Presentations Page

**Goal:** Admin builds branded slide decks by conversing with Claude — no WYSIWYG — and shares them as fullscreen bilingual experiences at `/p/:slug`.

**Target features:**
- Presentations DB schema (slides JSONB, language, version, access code)
- Brand guidelines document — admin-authored, consumed as Claude's system prompt (logo, colors, fonts, tone, "always include / never include")
- Conversational admin editor: chat with Claude to create/edit slides; Claude outputs structured JSON blocks (title, body, bullets, image)
- Public fullscreen viewer `/p/:slug` — scroll-snap, isolated from Navbar/Footer, language via `?lang=en|pt-BR`
- Bilingual authoring: admin generates EN + PT-BR versions
- View tracking (mirrors estimate_views pattern)

## Core Value

Clients receive a proposal link and experience Skale Club services as an immersive, professional presentation — not a PDF.

## Requirements

### Validated

- ✓ **DEBT-01**: Route file splitting — v1.0 (1,042 lines → 13 focused files)
- ✓ **DEBT-02**: Schema organization — v1.0 (1,004 lines → 6 domain files + barrel)
- ✓ **DEBT-03**: Context refactoring — v1.0 (729 lines → 8 focused hooks + GeoContext)
- ✓ **DEBT-04**: Error handling standardization — v1.0 (crash bug fixed, ZodError handling added)
- ✓ **FORMS-01 → FORMS-05**: Multi-forms support (forms table, admin editor, public `/f/:slug`, leads scoped by form, cleanup) — v1.1 (2026-04-15)
- ✓ **EST-01**: estimates table with JSONB snapshot schema, UUID slug, SQL migration — v1.2
- ✓ **EST-02**: Storage layer — 6 typed CRUD methods, immutable snapshots — v1.2
- ✓ **EST-03**: GET /api/estimates (admin list, auth required) — v1.2
- ✓ **EST-04**: POST/PUT/DELETE /api/estimates (admin CRUD, auth required) — v1.2
- ✓ **EST-05**: GET /api/estimates/slug/:slug (public lookup, no auth) — v1.2
- ✓ **EST-06**: Admin Estimates tab — list with copy-link button — v1.2
- ✓ **EST-07**: Create/edit dialog with portfolio catalog picker — v1.2
- ✓ **EST-08**: Custom freeform service rows — v1.2
- ✓ **EST-09**: Drag-reorder service rows, order persisted on save — v1.2
- ✓ **EST-10**: Delete estimate from list — v1.2
- ✓ **EST-11**: View tracking — estimate_views event-log table, admin view count badges + last-seen — v1.2
- ✓ **EST-12**: Access code gate — optional plain-text code, public viewer gate UI, admin dialog field — v1.2
- ✓ **EST-13**: /e/:slug isolated from Navbar/Footer/ChatWidget via isEstimateRoute guard — v1.2
- ✓ **EST-14**: Cover section with client name + Skale Club branding — v1.2
- ✓ **EST-15**: Fixed Skale Club introduction section — v1.2
- ✓ **EST-16**: Per-service fullscreen sections (title, description, price, features) — v1.2
- ✓ **EST-17**: Closing section (no acceptance CTA) — v1.2
- ✓ **EST-18**: Graceful 404 for unknown slug — v1.2

### Active

- **PRES-14 → PRES-22**: v1.4 Admin Presentations Page — phases 19–20 remaining (see REQUIREMENTS.md)

### Validated (v1.4 Phase 18)

- ✓ **PRES-11**: `POST /api/presentations/:id/chat` SSE streaming endpoint — loads brand guidelines as system prompt, streams data: events, saves slides+guidelinesSnapshot+version+1 — Validated in Phase 18: AI Authoring Endpoint
- ✓ **PRES-12**: SlideBlock JSON schema — 8 layout variants with bilingual fields, Zod-validated on every DB write — Validated in Phase 18: AI Authoring Endpoint
- ✓ **PRES-13**: Per-slide edits via chat — full slides array injected as Claude context, only targeted slides change — Validated in Phase 18: AI Authoring Endpoint

### Validated (v1.4 Phase 17)

- ✓ **PRES-09**: `GET /api/brand-guidelines` (public) and `PUT /api/brand-guidelines` (admin-auth, Zod max 2000) — Validated in Phase 17: Brand Guidelines
- ✓ **PRES-10**: Admin Brand Guidelines UI — textarea editor with char counter, loads/saves via API — Validated in Phase 17: Brand Guidelines

### Validated (v1.4 Phase 16)

- ✓ **PRES-05**: `GET /api/presentations` admin list with slideCount/viewCount derived — Validated in Phase 16: Admin CRUD API
- ✓ **PRES-06**: `POST /api/presentations` creates with empty slides, returns {id, slug} — Validated in Phase 16: Admin CRUD API
- ✓ **PRES-07**: `PUT /api/presentations/:id` updates fields + auto-increments version — Validated in Phase 16: Admin CRUD API
- ✓ **PRES-08**: `DELETE /api/presentations/:id` cascades presentation_views — Validated in Phase 16: Admin CRUD API

### Validated (v1.4 Phase 15)

- ✓ **PRES-01**: `presentations` table — UUID PK/slug, JSONB slides, TEXT guidelines_snapshot, version, accessCode — Validated in Phase 15: Schema & Foundation
- ✓ **PRES-02**: `presentation_views` event-log — UUID FK → presentations cascade delete, ip_hash TEXT — Validated in Phase 15: Schema & Foundation
- ✓ **PRES-03**: `brand_guidelines` singleton table — id, content (text), updatedAt — Validated in Phase 15: Schema & Foundation
- ✓ **PRES-04**: `@anthropic-ai/sdk` installed + `getAnthropicClient()` lazy-init singleton separate from OpenAI/Groq shim — Validated in Phase 15: Schema & Foundation

### Out of Scope

- Estimate acceptance / e-signature — future milestone
- PDF export — future milestone
- Client login / per-estimate access control — public link + optional access code sufficient
- Automated testing — no test framework in project

## Context

- v1.0 shipped 2026-03-30: Xpot tech debt remediation (64 files, 4 phases)
- v1.1 shipped 2026-04-15: Multi-forms support (5 sub-phases, tracked in PAUL then synced to GSD)
- v1.2 shipped 2026-04-20: Estimates System (4 phases, 8 plans, 62 files, +10,263 LOC)
- v1.4 in progress 2026-04-21: Admin Presentations Page — Phases 15–18 complete (schema, CRUD API, brand guidelines, AI authoring endpoint); Phases 19–20 pending (admin chat editor, public viewer)
- Stack: TypeScript/React + Express + Drizzle ORM + PostgreSQL + Supabase Auth + Vercel
- DB migration pattern: raw SQL via tsx script (drizzle-kit CJS can't resolve .js ESM imports)
- Public viewer uses IntersectionObserver for scroll-spy nav dots + framer-motion for section animations

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
| `client.messages.stream()` not `.create({stream:true})` for Anthropic SSE (v1.4) | MessageStream helper accumulates inputJson deltas and fires named events; raw iterator would require reimplementation | ✅ Phase 18 |
| `tool_choice: {type:"tool",name:"update_slides"}` forced (v1.4) | Prevents Claude returning plain text for casual messages | ✅ Phase 18 |
| `Anthropic.Tool` namespace access not named import (v1.4) | SDK doesn't export `Tool` at top-level index; must use default import namespace | ✅ Phase 18 |

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
- v1.3 shipped 2026-04-20: Links Page Upgrade (5 phases, 10 plans, 17/17 requirements — Supabase uploads, icon picker, click analytics, drag-reorder, theme editor, live preview, public rendering)

*Last updated: 2026-04-21 — Phase 16 complete; all 4 admin CRUD endpoints live, IStorage gap closed*
