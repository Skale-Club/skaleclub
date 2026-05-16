# Roadmap: Skale Club Web Platform

## Milestones

- ✅ **v1.0 Xpot Tech Debt** — Phases 1-4 (shipped 2026-03-30)
- ✅ **v1.1 Multi-Forms Support** — Phase 5 / M3 (shipped 2026-04-15)
- ✅ **v1.2 Estimates System** — Phases 6-9 (shipped 2026-04-20)
- ✅ **v1.3 Links Page Upgrade** — Phases 10-14 (shipped 2026-04-20)
- ✅ **v1.4 Admin Presentations Page** — Phases 15-20 (shipped 2026-04-22)
- ✅ **v1.5 Blog Post Automation** — Phases 21-24 (shipped 2026-04-24)
- ✅ **v1.6 Skale Hub Weekly Live Gate** — Phases 25-29 (shipped 2026-05-02)
- ✅ **v1.7 Translation System Completeness** — Phase 30 (shipped 2026-05-04)
- ✅ **v1.8 Notification Templates System** — Phases 31-33 (shipped 2026-05-04)
- ✅ **v1.9 Blog Intelligence & RSS Sources** — Phases 34-38 (shipped 2026-05-05)
- 🚧 **v2.0 Presentations 2.0** — Phases 39-40 (in progress)

## Active

**v2.0 Presentations 2.0** — Phases 39-40

**Goal:** Elevate the presentation experience: richer slide design capabilities and an AI-powered presentation generator accessible from the admin, with per-slide editing controls in the viewer.

- [ ] **Phase 39: Slide Design System v2** — Extend the SlideBlock schema with per-element alignment, custom colors, background images/videos, and additional layout primitives (image-left, image-right, full-bleed). Update the public viewer to render all new properties. No breaking change to existing slides.

- [ ] **Phase 40: AI Presentation Generator** — Admin UI button (+ text input + audio recording) that calls Gemini to generate a full presentation from scratch. Viewer gains per-slide controls: delete individual slide, AI-redo individual slide (regenerate via Gemini), inline text edit for quick corrections.

### Phase 39: Slide Design System v2

**Goal:** The SlideBlock schema supports rich visual properties — per-element alignment, custom background/text colors, background images and video URLs, and new layout variants (image-left, image-right, full-bleed-image). The public viewer renders all new properties. Existing slides continue to render without modification.
**Depends on:** Phases 15-20 (Presentations v1.4)
**Requirements:** PRES2-01, PRES2-02, PRES2-03, PRES2-04
**Plans:** 2 plans

Plans:
- [x] 39-01-PLAN.md — Extend SlideBlock schema: style sub-object + 4 new layouts + attribution fields
- [x] 39-02-PLAN.md — Viewer new layout cases + style rendering + tool schema sync

### Phase 40: AI Presentation Generator

**Goal:** Admin has a generator button that accepts a text prompt and/or a recorded audio clip to create a full presentation from scratch via Gemini. The public viewer gains per-slide controls: delete slide, AI-redo single slide, inline text edit for quick corrections.
**Depends on:** Phase 39 (new schema fields available for generation)
**Requirements:** PRES2-05, PRES2-06, PRES2-07, PRES2-08, PRES2-09
**Plans:** 3 plans

Plans:
- [ ] 40-01-PLAN.md — Generator backend: POST /api/presentations/transcribe (Groq Whisper) + POST /api/presentations/generate (Gemini tool-forced)
- [ ] 40-02-PLAN.md — Generator modal UI in PresentationsSection: "Generate with AI" button + title/text/audio modal
- [ ] 40-03-PLAN.md — Per-slide viewer toolbar in PresentationViewer: delete, AI-redo, inline text edit (edit mode only)

## Shipped Milestones

<details>
<summary>✅ v1.9 Blog Intelligence & RSS Sources (Phases 34-38) — SHIPPED 2026-05-05</summary>

- [x] Phase 34: RSS Sources Foundation (2/2 plans) — completed 2026-05-05
- [x] Phase 35: RSS Fetcher & Topic Selection (3/3 plans) — completed 2026-05-05
- [x] Phase 36: Generator Quality Overhaul (3/3 plans) — completed 2026-05-05
- [x] Phase 37: Admin UX (RSS + Job Improvements) (3/3 plans) — completed 2026-05-05
- [x] Phase 38: Dynamic Cron & Observability (3/3 plans) — completed 2026-05-05

_Archive: `.planning/milestones/v1.9-ROADMAP.md`_

</details>

<details>
<summary>✅ v1.8 Notification Templates System (Phases 31-33) — SHIPPED 2026-05-04</summary>

- [x] Phase 31: Schema & Templates Foundation (2/2 plans) — completed 2026-05-04
- [x] Phase 32: Telegram Integration (2/2 plans) — completed 2026-05-04
- [x] Phase 33: Admin Notifications Panel (2/2 plans) — completed 2026-05-04

_Archive: `.planning/milestones/v1.8-ROADMAP.md`_

</details>

<details>
<summary>✅ v1.7 Translation System Completeness (Phase 30) — SHIPPED 2026-05-04</summary>

- [x] Phase 30: Translation System Overhaul (4/4 plans) — completed 2026-05-03

_Archive: `.planning/milestones/v1.7-ROADMAP.md`_

</details>

<details>
<summary>✅ v1.6 Skale Hub Weekly Live Gate (Phases 25-29) — SHIPPED 2026-05-02</summary>

- [x] Phase 25: Foundation (1/1 plans) — completed 2026-05-02
- [x] Phase 26: API & Tracking (1/1 plans) — completed 2026-05-02
- [x] Phase 27: Public Experience (1/1 plans) — completed 2026-05-02
- [x] Phase 28: Admin Management (1/1 plans) — completed 2026-05-02
- [x] Phase 29: Analytics & Reporting (1/1 plans) — completed 2026-05-02

_Archive: `.planning/milestones/v1.6-ROADMAP.md`_

</details>

<details>
<summary>✅ v1.5 Blog Post Automation (Phases 21-24) — SHIPPED 2026-04-24</summary>

- [x] Phase 21: Schema & Storage Foundation (1/1 plans) — completed 2026-04-22
- [x] Phase 22: Blog Generator Engine (2/2 plans) — completed 2026-04-22
- [x] Phase 23: API Endpoints + Cron (1/1 plans) — completed 2026-04-22
- [x] Phase 24: Admin UI — Automation Settings (2/2 plans) — completed 2026-04-22

_Archive: `.planning/milestones/v1.5-ROADMAP.md`_

</details>

<details>
<summary>✅ v1.4 Admin Presentations Page (Phases 15-20) — SHIPPED 2026-04-22</summary>

- [x] Phase 15: Schema & Foundation (2/2 plans) — completed 2026-04-21
- [x] Phase 16: Admin CRUD API (1/1 plans) — completed 2026-04-21
- [x] Phase 17: Brand Guidelines (1/1 plans) — completed 2026-04-21
- [x] Phase 18: AI Authoring Endpoint (2/2 plans) — completed 2026-04-22
- [x] Phase 19: Admin Presentations Editor (1/1 plans) — completed 2026-04-22
- [x] Phase 20: Public Viewer (2/2 plans) — completed 2026-04-22

</details>

<details>
<summary>✅ v1.3 Links Page Upgrade (Phases 10-14) — SHIPPED 2026-04-20</summary>

- [x] Phase 10: Schema & Upload Foundation (2/2 plans) — completed 2026-04-20
- [x] Phase 11: Click Analytics API (1/1 plans) — completed 2026-04-20
- [x] Phase 12: Admin Redesign + Core Editing (3/3 plans) — completed 2026-04-20
- [x] Phase 13: Icon Picker, Theme Editor & Live Preview (3/3 plans) — completed 2026-04-20
- [x] Phase 14: Public Page Rendering + Click Tracking (1/1 plans) — completed 2026-04-20

</details>

<details>
<summary>✅ v1.2 Estimates System (Phases 6-9) — SHIPPED 2026-04-20</summary>

- [x] Phase 6: DB Schema + Storage Layer (2/2 plans) — completed 2026-04-19
- [x] Phase 7: Admin API Routes (1/1 plans) — completed 2026-04-19
- [x] Phase 8: Admin UI (EstimatesSection) (2/2 plans) — completed 2026-04-19
- [x] Phase 9: Public Viewer (3/3 plans) — completed 2026-04-20

_Archive: `.planning/milestones/v1.2-ROADMAP.md`_

</details>

<details>
<summary>✅ v1.1 Multi-Forms Support (Phase 5) — SHIPPED 2026-04-15</summary>

- [x] Phase 5: Multi-Forms Support (1/1 plans) — completed 2026-04-15

</details>

<details>
<summary>✅ v1.0 Xpot Tech Debt (Phases 1-4) — SHIPPED 2026-03-30</summary>

- [x] Phase 1: Error Handling Standardization (1/1 plans) — completed 2026-03-30
- [x] Phase 2: Route File Splitting (3/3 plans) — completed 2026-03-30
- [x] Phase 3: Schema Organization (3/3 plans) — completed 2026-03-30
- [x] Phase 4: Context Refactoring (3/3 plans) — completed 2026-03-30

_Archive: `.planning/milestones/v1.0-ROADMAP.md`_

</details>

---

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Error Handling Standardization | v1.0 | 1/1 | Complete | 2026-03-30 |
| 2. Route File Splitting | v1.0 | 3/3 | Complete | 2026-03-30 |
| 3. Schema Organization | v1.0 | 3/3 | Complete | 2026-03-30 |
| 4. Context Refactoring | v1.0 | 3/3 | Complete | 2026-03-30 |
| 5. Multi-Forms Support | v1.1 | 1/1 | Complete | 2026-04-15 |
| 6. DB Schema + Storage Layer | v1.2 | 2/2 | Complete | 2026-04-19 |
| 7. Admin API Routes | v1.2 | 1/1 | Complete | 2026-04-19 |
| 8. Admin UI (EstimatesSection) | v1.2 | 2/2 | Complete | 2026-04-19 |
| 9. Public Viewer | v1.2 | 3/3 | Complete | 2026-04-20 |
| 10. Schema & Upload Foundation | v1.3 | 2/2 | Complete | 2026-04-20 |
| 11. Click Analytics API | v1.3 | 1/1 | Complete | 2026-04-20 |
| 12. Admin Redesign + Core Editing | v1.3 | 3/3 | Complete | 2026-04-20 |
| 13. Icon Picker, Theme Editor & Live Preview | v1.3 | 3/3 | Complete | 2026-04-20 |
| 14. Public Page Rendering + Click Tracking | v1.3 | 1/1 | Complete | 2026-04-20 |
| 15. Schema & Foundation | v1.4 | 2/2 | Complete | 2026-04-21 |
| 16. Admin CRUD API | v1.4 | 1/1 | Complete | 2026-04-21 |
| 17. Brand Guidelines | v1.4 | 1/1 | Complete | 2026-04-21 |
| 18. AI Authoring Endpoint | v1.4 | 2/2 | Complete | 2026-04-22 |
| 19. Admin Presentations Editor | v1.4 | 1/1 | Complete | 2026-04-22 |
| 20. Public Viewer | v1.4 | 2/2 | Complete | 2026-04-22 |
| 21. Schema & Storage Foundation | v1.5 | 1/1 | Complete | 2026-04-22 |
| 22. Blog Generator Engine | v1.5 | 2/2 | Complete | 2026-04-22 |
| 23. API Endpoints + Cron | v1.5 | 1/1 | Complete | 2026-04-22 |
| 24. Admin UI — Automation Settings | v1.5 | 2/2 | Complete | 2026-04-22 |
| 25. Foundation | v1.6 | 1/1 | Complete | 2026-05-02 |
| 26. API & Tracking | v1.6 | 1/1 | Complete | 2026-05-02 |
| 27. Public Experience | v1.6 | 1/1 | Complete | 2026-05-02 |
| 28. Admin Management | v1.6 | 1/1 | Complete | 2026-05-02 |
| 29. Analytics & Reporting | v1.6 | 1/1 | Complete | 2026-05-02 |
| 30. Translation System Overhaul | v1.7 | 4/4 | Complete | 2026-05-03 |
| 31. Schema & Templates Foundation | v1.8 | 2/2 | Complete | 2026-05-04 |
| 32. Telegram Integration | v1.8 | 2/2 | Complete | 2026-05-04 |
| 33. Admin Notifications Panel | v1.8 | 2/2 | Complete | 2026-05-04 |
| 34. RSS Sources Foundation | v1.9 | 2/2 | Complete | 2026-05-05 |
| 35. RSS Fetcher & Topic Selection | v1.9 | 3/3 | Complete | 2026-05-05 |
| 36. Generator Quality Overhaul | v1.9 | 3/3 | Complete | 2026-05-05 |
| 37. Admin UX (RSS + Job Improvements) | v1.9 | 3/3 | Complete | 2026-05-05 |
| 38. Dynamic Cron & Observability | v1.9 | 3/3 | Complete | 2026-05-05 |
| 39. Slide Design System v2 | v2.0 | 2/2 | Complete | 2026-05-16 |
| 40. AI Presentation Generator | v2.0 | 0/3 | Planned    |  |

---

_Last updated: 2026-05-16 — Phase 40 plans created (3 plans, 2 waves)_
