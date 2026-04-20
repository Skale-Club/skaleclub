# Skale Club Web Platform

## What This Is

Skale Club is an agency web platform combining a public marketing site, an admin dashboard, and a field sales CRM (Xpot). The Estimates System (v1.2) lets admins compose branded service proposals from the portfolio catalog and share them as immersive fullscreen scroll-snap experiences at a private `/e/:slug` link — with optional access code protection and view tracking.

## Current Milestone: v1.3 Links Page Upgrade

**Goal:** Transform the public Links page and its admin surface into a Linktree-class experience — real file uploads to Supabase Storage, per-link icons, click analytics, theming, and a redesigned admin with live preview.

**Target features:**
- Per-link icon (pick from Lucide library or upload custom SVG/PNG)
- File upload for avatar / background / link icons to Supabase Storage (replacing URL text fields), with visible upload feedback
- Toggle visible/hidden per link (soft-show, no delete)
- Drag-and-drop reordering of links in admin
- Click analytics per link (increment on public click, displayed in admin)
- Theme customization: primary color, background color/gradient, optional background image
- Admin redesign with live preview pane — admin edits reflect in a `/links` preview embed
- Redesigned admin layout (Profile / Preview / Links+Social zones)

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

- **LINKS-01 → LINKS-XX**: v1.3 Links Page Upgrade (see REQUIREMENTS.md)

### Out of Scope

- Estimate acceptance / e-signature — future milestone
- PDF export — future milestone
- Client login / per-estimate access control — public link + optional access code sufficient
- Automated testing — no test framework in project

## Context

- v1.0 shipped 2026-03-30: Xpot tech debt remediation (64 files, 4 phases)
- v1.1 shipped 2026-04-15: Multi-forms support (5 sub-phases, tracked in PAUL then synced to GSD)
- v1.2 shipped 2026-04-20: Estimates System (4 phases, 8 plans, 62 files, +10,263 LOC)
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
*Last updated: 2026-04-20 — milestone v1.3 Links Page Upgrade started*
