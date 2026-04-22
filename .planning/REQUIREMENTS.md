# Requirements: Skale Club Web Platform — v1.4 Admin Presentations Page

**Defined:** 2026-04-20
**Core Value:** Admin builds branded slide decks by conversing with Claude — no WYSIWYG — and shares them as fullscreen bilingual experiences at `/p/:slug`.

## v1.4 Requirements

### Schema & Storage

- [x] **PRES-01**: `presentations` table — `id` (UUID PK), `slug` (UUID, unique, public URL), `title` (text), `slides` (JSONB array of SlideBlock), `guidelinesSnapshot` (JSONB copy of guidelines at generation time), `accessCode` (optional plain text), `version` (int, auto-increments on each PUT save), `createdAt`, `updatedAt`.
- [x] **PRES-02**: `presentation_views` event-log table — `id`, `presentationId` (FK → presentations, cascade delete), `viewedAt`, `ipHash` (SHA-256 of client IP). Mirrors `estimate_views` pattern.
- [x] **PRES-03**: `brand_guidelines` singleton table — `id`, `content` (text, markdown), `updatedAt`. One row per tenant; upsert on save.
- [x] **PRES-04**: `@anthropic-ai/sdk` installed; `server/lib/anthropic.ts` singleton created with `getAnthropicClient()` (separate from existing `getActiveAIClient()` OpenAI/Groq shim).

### Admin CRUD API

- [x] **PRES-05**: `GET /api/presentations` returns admin list — id, slug, title, slideCount (derived), viewCount (derived), createdAt — sorted by createdAt desc. Admin-auth required.
- [x] **PRES-06**: `POST /api/presentations` creates a new presentation with title and empty `slides: []`; returns `{ id, slug }`. Admin-auth required.
- [x] **PRES-07**: `PUT /api/presentations/:id` updates title, slides, and/or accessCode; auto-increments `version`. Admin-auth required.
- [x] **PRES-08**: `DELETE /api/presentations/:id` deletes the presentation and cascades `presentation_views`. Admin-auth required.

### Brand Guidelines

- [x] **PRES-09**: `GET /api/brand-guidelines` returns current guidelines content (no auth — needed by AI endpoint server-side). `PUT /api/brand-guidelines` saves content (admin-auth required).
- [x] **PRES-10**: Admin **Brand Guidelines** sub-section (within Presentations tab or separate accordion) — plain textarea/markdown editor that saves to `brand_guidelines` table via `PUT /api/brand-guidelines`.

### AI Authoring

- [x] **PRES-11**: `POST /api/presentations/:id/chat` — SSE streaming endpoint; accepts `{ message: string }`; loads current `brand_guidelines.content` as Claude system prompt; sends current `slides` as context; calls Claude via `tool_use` for structured `SlideBlock[]` output; streams `data:` progress events to client; saves final slides + `guidelinesSnapshot` to DB after stream ends. Admin-auth required.
- [x] **PRES-12**: SlideBlock JSON schema supports 8 layout variants (`cover`, `section-break`, `title-body`, `bullets`, `stats`, `two-column`, `image-focus`, `closing`) with bilingual fields: `heading`/`headingPt`, `body`/`bodyPt`, `bullets: string[]`/`bulletsPt: string[]`. Schema validated via Zod on every DB write.
- [x] **PRES-13**: Admin can request per-slide edits in chat (e.g. "edit slide 3 — shorten the body") — the AI receives the full current `SlideBlock[]` context and returns an updated array with only the targeted slide(s) changed; other slides are preserved verbatim.

### Admin Presentations Editor

- [x] **PRES-14**: Admin **Presentations** tab shows list of all presentations with title, slide count, view count badge, copy-link button, delete button, and an "Open Editor" button per row.
- [x] **PRES-15**: Presentation editor opens showing: a monospace JSON textarea with the current `SlideBlock[]` (editable); a Save button that calls `PUT /api/presentations/:id`; and a slide preview panel showing current slides as mini cards.
- [x] **PRES-16**: Slide preview panel shows each `SlideBlock` as a mini card with its layout type and heading visible; the JSON textarea reflects the saved state; admin edits JSON and saves to update slides.

### Public Viewer

- [x] **PRES-17**: `GET /api/presentations/slug/:slug` — public endpoint (no auth); returns full presentation including slides; validates access code if `accessCode` is set (400 if wrong/missing); records a row in `presentation_views` on every successful load.
- [x] **PRES-18**: `/p/:slug` route in App.tsx is isolated from Navbar/Footer/ChatWidget via `isPresentationRoute` guard (symmetric to `isEstimateRoute` pattern).
- [ ] **PRES-19**: `PresentationViewer` renders slides as fullscreen scroll-snap sections (one slide per viewport height), framer-motion enter animations per section, layout-specific rendering for each `SlideBlock.layout` variant.
- [ ] **PRES-20**: Language switcher in the viewer — `?lang=en` (default) or `?lang=pt-BR`; each slide renders the appropriate bilingual fields (`heading` vs `headingPt`, etc.).
- [ ] **PRES-21**: Access code gate — if `accessCode` is set on the presentation, viewer shows a code-entry form before revealing slides (same UX pattern as `EstimateViewer`).
- [x] **PRES-22**: Admin Presentations list shows view count badge per presentation, sourced from `presentation_views` count query.

## Out of Scope

| Feature | Reason |
|---------|--------|
| In-app chat panel calling Anthropic API | Slides authored via Claude Code IDE; admin panel only needs JSON editor + preview |
| WYSIWYG / drag-drop slide editor | Editing via JSON paste from Claude Code session |
| PPTX / PDF export | Future milestone (v1.5 candidate); requires Playwright on serverless — Vercel blocker |
| Per-slide image generation (DALL-E / Stable Diffusion) | Deferred — admin can paste image URLs; AI-generated imagery is v1.5 scope |
| Slide templates library | Deferred — 8 layout variants cover agency needs; template picker is additive |
| Multi-tenant brand guidelines (per-presentation override) | One tenant-wide document is sufficient for v1.4; per-deck branching is v1.5 |
| slides-grab / Playwright integration | Blocked on Vercel serverless; native scroll-snap viewer is superior for v1.4 |
| Undo / slide version history | Deferred — `version` field tracks generation count; full undo is a distinct milestone |
| Team collaboration / comments on slides | Future scope |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PRES-01 | Phase 15 | Complete |
| PRES-02 | Phase 15 | Complete |
| PRES-03 | Phase 15 | Complete |
| PRES-04 | Phase 15 | Complete |
| PRES-05 | Phase 16 | Complete |
| PRES-06 | Phase 16 | Complete |
| PRES-07 | Phase 16 | Complete |
| PRES-08 | Phase 16 | Complete |
| PRES-09 | Phase 17 | Complete |
| PRES-10 | Phase 17 | Complete |
| PRES-11 | Phase 18 | Complete |
| PRES-12 | Phase 18 | Complete |
| PRES-13 | Phase 18 | Complete |
| PRES-14 | Phase 19 | Complete |
| PRES-15 | Phase 19 | Complete |
| PRES-16 | Phase 19 | Complete |
| PRES-17 | Phase 20 | Complete |
| PRES-18 | Phase 20 | Complete |
| PRES-19 | Phase 20 | Pending |
| PRES-20 | Phase 20 | Pending |
| PRES-21 | Phase 20 | Pending |
| PRES-22 | Phase 20 | Complete |

**Coverage:**
- v1.4 requirements: 22 total
- Mapped to phases: 22/22 ✓ (100%)

**Phase distribution:**
- Phase 15 (Schema & Foundation): 4 reqs — PRES-01, -02, -03, -04
- Phase 16 (Admin CRUD API): 4 reqs — PRES-05, -06, -07, -08
- Phase 17 (Brand Guidelines): 2 reqs — PRES-09, -10
- Phase 18 (AI Authoring Endpoint): 3 reqs — PRES-11, -12, -13
- Phase 19 (Admin Chat Editor): 3 reqs — PRES-14, -15, -16
- Phase 20 (Public Viewer): 6 reqs — PRES-17, -18, -19, -20, -21, -22

---
*Requirements defined: 2026-04-20*
