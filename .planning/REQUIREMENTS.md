# Requirements: Skale Club — v1.2 Estimates System

**Defined:** 2026-04-19
**Core Value:** Convert leads into clients — personalized service proposals delivered as a shareable link.

## v1.2 Requirements

### Core Data

- [ ] **EST-01**: Admin can create an estimate with client name, UUID-based slug, and optional internal note
- [ ] **EST-02**: Estimate services are stored as a JSONB snapshot (title, description, price, features — immutable after save; serviceId kept as reference only)

### Admin Management

- [ ] **EST-03**: Admin can list all estimates with client name, slug, creation date, and a copy-link action
- [ ] **EST-04**: Admin can edit an existing estimate (client info, services, prices, note)
- [ ] **EST-05**: Admin can delete an estimate permanently

### Service Editor

- [ ] **EST-06**: Admin can pick services from the portfolio catalog; price and description are pre-filled and overridable
- [ ] **EST-07**: Admin can override the display price of any catalog service within an estimate
- [ ] **EST-08**: Admin can add custom service rows (freeform title, description, price — not linked to catalog)
- [ ] **EST-09**: Admin can reorder services via drag-and-drop
- [ ] **EST-10**: Admin can remove any service row from the estimate

### Public Viewer

- [ ] **EST-11**: Client can view a proposal at `/e/:slug` with fullscreen CSS scroll-snap sections (min-h-[100dvh])
- [ ] **EST-12**: Viewer shows a cover section with client name and Skale Club branding
- [ ] **EST-13**: Viewer shows a Skale Club intro section (fixed content, same on every estimate)
- [ ] **EST-14**: Viewer shows one fullscreen section per service (title, description, price, features list)
- [ ] **EST-15**: Viewer shows a visual closing section as the final screen (no CTA button)
- [ ] **EST-16**: Viewer returns a graceful 404 page for unknown or deleted slugs

## Future Requirements

### Automation

- **EST-AUTO-01**: Auto-create estimate when a form lead is submitted (GHL handles dispatch — trigger only)
- **EST-AUTO-02**: Track estimate "viewed" timestamp for analytics

### Enhanced Viewer

- **EST-VIEW-01**: Acceptance CTA button (configurable URL per estimate — WhatsApp, email, call)
- **EST-VIEW-02**: Digital signature / e-sign capability
- **EST-VIEW-03**: PDF export of the proposal

## Out of Scope

| Feature | Reason |
|---------|--------|
| SMS/email dispatch | Handled by GHL automation — not in platform |
| Auto-create from form (v1.2) | Deferred — manual flow must be proven first |
| Digital signature | Heavy complexity; viewer-only is sufficient for v1.2 |
| Status tracking (viewed/accepted) | Not needed for v1.2 viewer |
| PDF export | Out of scope per PROJECT.md |
| Human-readable slugs | Security risk — proposals contain sensitive pricing |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| EST-01 | Phase 6 | Pending |
| EST-02 | Phase 6 | Pending |
| EST-03 | Phase 8 | Pending |
| EST-04 | Phase 8 | Pending |
| EST-05 | Phase 8 | Pending |
| EST-06 | Phase 8 | Pending |
| EST-07 | Phase 8 | Pending |
| EST-08 | Phase 8 | Pending |
| EST-09 | Phase 8 | Pending |
| EST-10 | Phase 8 | Pending |
| EST-11 | Phase 9 | Pending |
| EST-12 | Phase 9 | Pending |
| EST-13 | Phase 9 | Pending |
| EST-14 | Phase 9 | Pending |
| EST-15 | Phase 9 | Pending |
| EST-16 | Phase 9 | Pending |

**Coverage:**
- v1.2 requirements: 16 total
- Mapped to phases: 16
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-19*
*Last updated: 2026-04-19 after initial definition*
