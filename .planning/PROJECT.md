# Skale Club Web Platform

## What This Is

Skale Club is an agency web platform combining a public marketing site, an admin dashboard, and a field sales CRM (Xpot). v1.2 adds an Estimates System: admins compose branded service proposals from the portfolio catalog, and clients view them as polished fullscreen scroll-snap experiences at a private `/e/:slug` link.

## Core Value

Clients receive a proposal link and experience Skale Club services as an immersive, professional presentation — not a PDF.

## Requirements

### Validated

- ✓ **DEBT-01**: Route file splitting — v1.0 (1,042 lines → 13 focused files)
- ✓ **DEBT-02**: Schema organization — v1.0 (1,004 lines → 6 domain files + barrel)
- ✓ **DEBT-03**: Context refactoring — v1.0 (729 lines → 8 focused hooks + GeoContext)
- ✓ **DEBT-04**: Error handling standardization — v1.0 (crash bug fixed, ZodError handling added)
- ✓ **FORMS-01 → FORMS-05**: Multi-forms support (forms table, admin editor, public `/f/:slug`, leads scoped by form, cleanup) — v1.1 (2026-04-15)

### Active (v1.2)

- [x] **EST-01**: estimates table with JSONB snapshot schema, UUID slug, SQL migration — Phase 6 ✓
- [x] **EST-02**: Storage layer — 6 typed CRUD methods, immutable snapshots — Phase 6 ✓
- [ ] **EST-03**: GET /api/estimates (admin list, auth required)
- [ ] **EST-04**: POST/PUT/DELETE /api/estimates (admin CRUD, auth required)
- [ ] **EST-05**: GET /api/estimates/slug/:slug (public lookup, no auth)
- [ ] **EST-06**: Admin Estimates tab — list with copy-link button
- [ ] **EST-07**: Create/edit dialog with portfolio catalog picker
- [ ] **EST-08**: Custom freeform service rows
- [ ] **EST-09**: Drag-reorder service rows, order persisted on save
- [ ] **EST-10**: Delete estimate from list
- [ ] **EST-11**: /e/:slug fullscreen scroll-snap (no Navbar/Footer/ChatWidget)
- [ ] **EST-12**: Cover section with client name + Skale Club branding
- [ ] **EST-13**: Fixed Skale Club introduction section
- [ ] **EST-14**: Per-service fullscreen sections (title, description, price, features)
- [ ] **EST-15**: Closing section (no acceptance CTA)
- [ ] **EST-16**: Graceful 404 for unknown slug

### Out of Scope

- Estimate acceptance / e-signature — future milestone
- PDF export — future milestone
- Client login / per-estimate access control — public link sufficient for v1.2
- Automated testing — no test framework in project

## Context

- v1.0 shipped 2026-03-30: Xpot tech debt remediation (64 files, 4 phases)
- v1.1 shipped 2026-04-15: Multi-forms support (5 sub-phases, tracked in PAUL then synced to GSD)
- v1.2 in progress: Estimates System (Phases 6–9)
- Stack: TypeScript/React + Express + Drizzle ORM + PostgreSQL + Supabase Auth + Vercel
- Existing portfolio services at `portfolio_services` table — estimates snapshot from this catalog
- Admin dashboard at `/admin` — Estimates tab will be added to AdminSidebar
- Public site routing via Wouter — `/e/:slug` requires isEstimateRoute guard to suppress layout chrome

## Constraints

- **No DB breaking changes**: New `estimates` table only — no modifications to existing tables
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
| JSONB snapshot for estimate services (v1.2) | Immutability — edits to catalog don't corrupt sent proposals | — Pending |
| UUID slug for estimate public links (v1.2) | Unguessable public URL without auth | — Pending |

---
*Last updated: 2026-04-19 after Phase 6 complete (DB Schema + Storage Layer)*
