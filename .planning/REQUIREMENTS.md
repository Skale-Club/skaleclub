# Requirements: Skale Club Web Platform — v1.2 Estimates System

**Defined:** 2026-04-19
**Core Value:** Admin creates branded proposal estimates; clients view them as polished fullscreen proposals at a private link

## v1.2 Requirements

### Schema & Storage — Phase 6

- [x] **EST-01**: `estimates` table exists in the database with clientName, UUID slug, optional note, and a JSONB `services` array; `npm run db:push` completes without error
- [x] **EST-02**: Storage layer exposes six typed CRUD methods (create, getById, getBySlug, list, update, delete) callable from route handlers without TypeScript errors; a catalog service snapshot is immutable even after editing the source `portfolio_services` row

### Admin API — Phase 7

- [x] **EST-03**: `GET /api/estimates` returns all estimates (clientName, slug, createdAt) — requires admin auth
- [x] **EST-04**: `POST /api/estimates` creates an estimate with UUID slug; `PUT /api/estimates/:id` updates it; `DELETE /api/estimates/:id` removes it permanently — all require admin auth
- [x] **EST-05**: `GET /api/estimates/slug/:slug` returns estimate data without authentication (for the public viewer)

### Admin UI — Phase 8

- [x] **EST-06**: Admin sees an "Estimates" tab in the sidebar with a list showing client name, slug, creation date, and a copy-link button
- [x] **EST-07**: Admin can open a create/edit dialog, pick services from the portfolio catalog with title/description/price pre-filled and editable before saving
- [x] **EST-08**: Admin can add freeform custom service rows (title, description, price entered manually — not linked to catalog) alongside catalog items
- [x] **EST-09**: Admin can drag service rows to reorder them; order is preserved on save and re-edit
- [x] **EST-10**: Admin can delete any estimate from the list

### Public Viewer — Phase 9

- [ ] **EST-11**: View tracking — every time the public estimate viewer (/e/:slug) is loaded, record a view event. The admin list view must display view_count and last_viewed_at per estimate. Implementation: new `estimate_views` table (id, estimate_id, viewed_at, ip_address optional) — event log approach, not a counter column.
- [ ] **EST-12**: Password protection — an estimate can optionally have a password (stored as bcrypt hash in a new `password_hash text` column on estimates). If set, the public viewer shows a password gate before rendering. The admin create/edit dialog must allow setting/clearing the password.
- [ ] **EST-13**: Navigating to `/e/:slug` renders fullscreen scroll-snap sections with no Navbar, Footer, or ChatWidget present
- [ ] **EST-14**: First section shows a cover with the client name and Skale Club branding
- [ ] **EST-15**: Second section shows a fixed Skale Club introduction
- [ ] **EST-16**: Each service in the estimate renders as its own fullscreen section showing title, description, price, and features list
- [ ] **EST-17**: A final visual closing section appears after all service sections with no acceptance CTA button
- [ ] **EST-18**: Navigating to `/e/unknown-slug` renders a graceful 404 page rather than crashing or showing a blank screen

## Out of Scope

| Feature | Reason |
|---------|--------|
| Estimate acceptance / e-signature | Scope for future milestone |
| PDF export of proposals | Scope for future milestone |
| Client login / per-user access control per estimate | Password protection (EST-12) is sufficient for v1.2; per-user auth is future scope |
| Estimate templates | Manual composition is sufficient for v1.2 |
| Estimate expiry / status tracking | Future milestone |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| EST-01 | Phase 6 | Complete |
| EST-02 | Phase 6 | Complete |
| EST-03 | Phase 7 | Complete |
| EST-04 | Phase 7 | Complete |
| EST-05 | Phase 7 | Complete |
| EST-06 | Phase 8 | Complete |
| EST-07 | Phase 8 | Complete |
| EST-08 | Phase 8 | Complete |
| EST-09 | Phase 8 | Complete |
| EST-10 | Phase 8 | Complete |
| EST-11 | Phase 9 | Pending |
| EST-12 | Phase 9 | Pending |
| EST-13 | Phase 9 | Pending |
| EST-14 | Phase 9 | Pending |
| EST-15 | Phase 9 | Pending |
| EST-16 | Phase 9 | Pending |
| EST-17 | Phase 9 | Pending |
| EST-18 | Phase 9 | Pending |

**Coverage:**
- v1.2 requirements: 18 total
- Mapped to phases: 18
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-19*
*Last updated: 2026-04-19 after EST-11 and EST-12 added*
