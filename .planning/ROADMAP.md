# Roadmap: Skale Club Web Platform

## Milestones

- ✅ **v1.0 Xpot Tech Debt** — Phases 1-4 (shipped 2026-03-30)
- ✅ **v1.1 Multi-Forms Support** — Phase 5 / M3 (shipped 2026-04-15)
- 🔄 **v1.2 Estimates System** — Phases 6-9 (in progress)

## Phases

<details>
<summary>✅ v1.0 Xpot Tech Debt (Phases 1-4) — SHIPPED 2026-03-30</summary>

- [x] Phase 1: Error Handling Standardization (1/1 plans) — completed 2026-03-30
- [x] Phase 2: Route File Splitting (3/3 plans) — completed 2026-03-30
- [x] Phase 3: Schema Organization (3/3 plans) — completed 2026-03-30
- [x] Phase 4: Context Refactoring (3/3 plans) — completed 2026-03-30

</details>

<details>
<summary>✅ v1.1 Multi-Forms Support (Phase 5) — SHIPPED 2026-04-15</summary>

- [x] Phase 5: Multi-Forms Support (1/1 plans) — completed 2026-04-15
  - M3-01: forms table + compat shim
  - M3-02: admin forms list + editor rewire
  - M3-03: public /f/:slug route + chat form selector
  - M3-04: leads + dashboard scoped by form
  - M3-05: cleanup — drop legacy endpoints + form_config column

</details>

### v1.2 Estimates System

- [ ] **Phase 6: DB Schema + Storage Layer** — Estimates table, JSONB snapshot schema, Zod types, storage methods, Drizzle migration
- [ ] **Phase 7: Admin API Routes** — CRUD endpoints for estimates (list, create, read, update, delete) + public slug lookup
- [ ] **Phase 8: Admin UI (EstimatesSection)** — Estimates list, create/edit dialog, service picker, drag-reorder, price override, custom line items
- [ ] **Phase 9: Public Viewer** — /e/:slug fullscreen scroll-snap proposal page, isEstimateRoute guard, 404 handling

---

## Phase Details

### Phase 6: DB Schema + Storage Layer
**Goal**: The estimates table exists in the database with the correct schema, and the storage layer exposes typed CRUD methods that all other phases can depend on
**Depends on**: Nothing (foundation)
**Requirements**: EST-01, EST-02
**Success Criteria** (what must be TRUE):
  1. `npm run db:push` completes without error and the `estimates` table appears in the database
  2. An estimate record can be created with clientName, UUID slug, optional note, and a services JSONB array containing at minimum title, description, price, features, and item type discriminator
  3. A catalog service saved to an estimate retains its snapshot data even after the portfolio_services row is edited — the estimate is immutable
  4. All six storage methods (create, get by id, get by slug, list, update, delete) are callable from route handlers without TypeScript errors
**Plans**: 2 plans

Plans:
- [ ] 06-01-PLAN.md — Drizzle table definition, Zod schemas, TypeScript types, barrel export
- [ ] 06-02-PLAN.md — Storage CRUD methods + Drizzle migration (db:push)

### Phase 7: Admin API Routes
**Goal**: The admin can perform full CRUD on estimates via authenticated HTTP endpoints, and the public can fetch a single estimate by slug without authentication
**Depends on**: Phase 6
**Requirements**: EST-03, EST-04, EST-05
**Success Criteria** (what must be TRUE):
  1. `GET /api/estimates` returns a list of all estimates with clientName, slug, createdAt — requires admin auth
  2. `POST /api/estimates` creates a new estimate and returns it with a UUID slug — requires admin auth
  3. `PUT /api/estimates/:id` updates client info, services, or note and persists the change — requires admin auth
  4. `DELETE /api/estimates/:id` removes the record permanently — requires admin auth
  5. `GET /api/estimates/slug/:slug` returns estimate data without authentication (for the public viewer)
**Plans**: TBD

### Phase 8: Admin UI (EstimatesSection)
**Goal**: The admin can create, edit, and delete estimates from within the admin dashboard, composing service line items from the portfolio catalog or as custom rows, with full drag-reorder and price override support
**Depends on**: Phase 7
**Requirements**: EST-06, EST-07, EST-08, EST-09, EST-10
**Success Criteria** (what must be TRUE):
  1. Admin sees an "Estimates" tab in the sidebar and can view all estimates in a list with client name, slug, creation date, and a copy-link button
  2. Admin can open a dialog, pick services from the portfolio catalog, and have title/description/price pre-filled and editable before saving
  3. Admin can add a freeform custom service row (title, description, price entered manually — not linked to catalog) alongside catalog items
  4. Admin can drag service rows to reorder them and the order is preserved on save and re-edit
  5. Admin can delete any estimate from the list
**Plans**: TBD
**UI hint**: yes

### Phase 9: Public Viewer
**Goal**: A client who receives an estimate link can open /e/:slug and see a polished fullscreen proposal with their name, a Skale Club introduction, and one immersive section per service — without any site navigation or footer interfering
**Depends on**: Phase 7
**Requirements**: EST-11, EST-12, EST-13, EST-14, EST-15, EST-16
**Success Criteria** (what must be TRUE):
  1. Navigating to `/e/:slug` renders fullscreen scroll-snap sections with no Navbar, Footer, or ChatWidget present
  2. The first section shows a cover with the client name and Skale Club branding; the second section shows a fixed Skale Club introduction
  3. Each service in the estimate renders as its own fullscreen section showing title, description, price, and features list
  4. A final visual closing section appears after all service sections with no acceptance CTA button
  5. Navigating to `/e/unknown-slug` renders a graceful 404 page rather than crashing or showing a blank screen
**Plans**: TBD
**UI hint**: yes

---

## Progress Table

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 6. DB Schema + Storage Layer | 0/2 | Not started | - |
| 7. Admin API Routes | 0/? | Not started | - |
| 8. Admin UI (EstimatesSection) | 0/? | Not started | - |
| 9. Public Viewer | 0/? | Not started | - |

---

_Archive: `.planning/milestones/v1.0-ROADMAP.md`_
_Last updated: 2026-04-19 — Phase 6 plans created (06-01, 06-02)_
