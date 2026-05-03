# Requirements: Skale Club Web Platform - v1.6 Skale Hub Weekly Live Gate

**Defined:** 2026-05-02
**Core Value:** Visitors discover the weekly Skale Hub live inside the existing Skale Club site, complete a lightweight registration gate, unlock the live link, and give the admin team clear visibility into registrations and access history over time.

## v1.6 Requirements

### Schema & Identity Foundation

- [x] **HUB-01**: Additive tables exist for Skale Hub lives, participants, registrations, and access events.
- [x] **HUB-02**: Shared Drizzle/Zod contracts exist in `shared/schema/hub.ts` and are re-exported from `shared/schema.ts`.
- [x] **HUB-03**: Storage layer supports live CRUD foundation, participant lookup/upsert, registration upsert, access-event logging, and analytics summary reads.
- [x] **HUB-04**: Participant identity stores raw + normalized phone/email values, uses phone-first matching with email fallback, and enforces one registration per participant per live.

### API & Tracking

- [x] **HUB-05**: `GET /api/skale-hub/active` returns the currently active live or a friendly empty payload when no live is active.
- [x] **HUB-06**: `POST /api/skale-hub/register` accepts name, phone, and email, upserts the participant, creates or updates the registration, and returns an unlocked state for the current live.
- [x] **HUB-07**: `POST /api/skale-hub/:liveId/access` records link unlock/access activity so admin can distinguish gate completion from actual live-link usage.
- [x] **HUB-08**: Admin API supports live list/create/update/detail flows and enforces only one active live at a time.
- [x] **HUB-09**: Admin API exposes dashboard summary, per-live participant summaries, and participant history views.

### Public Experience

- [x] **HUB-10**: Public `Skale Hub` page is integrated into the existing site routing and visual system without feeling like a separate product.
- [x] **HUB-11**: Public page shows headline, explanatory subtitle, active live card, date/time, short description, registration form, unlock CTA, and unlocked link area.
- [x] **HUB-12**: After successful registration, visitor sees clear confirmation copy: `Registration confirmed. You can now access the live.`
- [x] **HUB-13**: If no active live exists, the public page shows a friendly empty state explaining that the next live will be announced soon.

### Admin Management

- [x] **HUB-14**: Admin dashboard gains a `Skale Hub` section for creating, editing, listing, and activating lives.
- [x] **HUB-15**: Admin can manage title, description, date, time, external live link, and status (`active`, `inactive`, `ended`) for each live.

### Analytics & Reporting

- [x] **HUB-16**: Admin dashboard shows total participants, total registrations, and registrations/access counts per live.
- [x] **HUB-17**: Admin can view participant history including phone, email, registration date, lives accessed count, last live accessed, and last access date.
- [x] **HUB-18**: Admin can view per-live analytics including live title, live date, registrations count, unlocked/access count, and participant list.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Visitor login/password accounts | Registration gate must stay fast and lightweight |
| Course portal or member area | Skale Hub is a weekly live gateway, not a learning platform |
| Multi-session content library | Current scope is active weekly live + basic history only |
| Payment, billing, or subscriptions | No monetization workflow requested |
| Full CRM automation flows | Participant data should be capture-ready, but CRM automation is a later milestone |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| HUB-01 | Phase 25 | Complete |
| HUB-02 | Phase 25 | Complete |
| HUB-03 | Phase 25 | Complete |
| HUB-04 | Phase 25 | Complete |
| HUB-05 | Phase 26 | Complete |
| HUB-06 | Phase 26 | Complete |
| HUB-07 | Phase 26 | Complete |
| HUB-08 | Phase 26 | Complete |
| HUB-09 | Phase 26 | Complete |
| HUB-10 | Phase 27 | Complete |
| HUB-11 | Phase 27 | Complete |
| HUB-12 | Phase 27 | Complete |
| HUB-13 | Phase 27 | Complete |
| HUB-14 | Phase 28 | Complete |
| HUB-15 | Phase 28 | Complete |
| HUB-16 | Phase 29 | Complete |
| HUB-17 | Phase 29 | Complete |
| HUB-18 | Phase 29 | Complete |

**Coverage:**
- v1.6 requirements: 18 total
- Mapped to phases: 18/18 (100%)

**Phase distribution:**
- Phase 25 (Foundation): 4 reqs - HUB-01-HUB-04
- Phase 26 (API & Tracking): 5 reqs - HUB-05-HUB-09
- Phase 27 (Public Experience): 4 reqs - HUB-10-HUB-13
- Phase 28 (Admin Management): 2 reqs - HUB-14-HUB-15
- Phase 29 (Analytics & Reporting): 3 reqs - HUB-16-HUB-18

---
*Requirements defined: 2026-05-02*
