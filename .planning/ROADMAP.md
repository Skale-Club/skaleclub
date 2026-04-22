# Roadmap: Skale Club Web Platform

## Milestones

- ✅ **v1.0 Xpot Tech Debt** — Phases 1-4 (shipped 2026-03-30)
- ✅ **v1.1 Multi-Forms Support** — Phase 5 / M3 (shipped 2026-04-15)
- ✅ **v1.2 Estimates System** — Phases 6-9 (shipped 2026-04-20)
- ✅ **v1.3 Links Page Upgrade** — Phases 10-14 (shipped 2026-04-20)
- 🔄 **v1.4 Admin Presentations Page** — Phases 15-20 (active)

## Active

**v1.4 Admin Presentations Page** — Phases 15-20

- [ ] **Phase 15: Schema & Foundation** — DB tables, raw SQL migration, Anthropic SDK singleton
- [ ] **Phase 16: Admin CRUD API** — Storage layer + all non-AI presentations endpoints
- [ ] **Phase 17: Brand Guidelines** — Guidelines singleton endpoints + admin editor UI
- [ ] **Phase 18: AI Authoring Endpoint** — SSE streaming endpoint with Claude tool_use + SlideBlock Zod schema
- [ ] **Phase 19: Admin Chat Editor** — Split-view chat panel + slide preview panel in admin
- [ ] **Phase 20: Public Viewer** — `/p/:slug` fullscreen viewer, access code gate, language switcher, view tracking

## Phases

<details>
<summary>✅ v1.3 Links Page Upgrade (Phases 10-14) — SHIPPED 2026-04-20</summary>

- [x] Phase 10: Schema & Upload Foundation — completed 2026-04-20
- [x] Phase 11: Click Analytics API — completed 2026-04-20
- [x] Phase 12: Admin Redesign + Core Editing — completed 2026-04-20
- [x] Phase 13: Icon Picker, Theme Editor & Live Preview — completed 2026-04-20
- [x] Phase 14: Public Page Rendering + Click Tracking — completed 2026-04-20

_Archive: `.planning/milestones/v1.3-ROADMAP.md`_

</details>

<details>
<summary>✅ v1.0 Xpot Tech Debt (Phases 1-4) — SHIPPED 2026-03-30</summary>

- [x] Phase 1: Error Handling Standardization (1/1 plans) — completed 2026-03-30
- [x] Phase 2: Route File Splitting (3/3 plans) — completed 2026-03-30
- [x] Phase 3: Schema Organization (3/3 plans) — completed 2026-03-30
- [x] Phase 4: Context Refactoring (3/3 plans) — completed 2026-03-30

_Archive: `.planning/milestones/v1.0-ROADMAP.md`_

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

<details>
<summary>✅ v1.2 Estimates System (Phases 6-9) — SHIPPED 2026-04-20</summary>

- [x] Phase 6: DB Schema + Storage Layer (2/2 plans) — completed 2026-04-19
- [x] Phase 7: Admin API Routes (1/1 plans) — completed 2026-04-19
- [x] Phase 8: Admin UI (EstimatesSection) (2/2 plans) — completed 2026-04-19
- [x] Phase 9: Public Viewer (3/3 plans) — completed 2026-04-20

_Archive: `.planning/milestones/v1.2-ROADMAP.md`_

</details>

## Phase Details

### Phase 10: Schema & Upload Foundation
**Goal**: The backend can persist a richer links-page config and accept real file uploads to Supabase Storage, with every link carrying a stable identity that survives edits.
**Depends on**: Nothing (first phase of v1.3)
**Requirements**: LINKS-01, LINKS-02, LINKS-03, LINKS-06
**Plans:** 2/2 plans complete
**Success Criteria** (what must be TRUE):
  1. Admin can `POST /api/uploads/links-page` with an image (≤2 MB) and receives a Supabase `uploads/links-page/...` URL that is publicly retrievable.
  2. `linksPageConfig` persists per-link `iconType`, `iconValue`, `visible`, `clickCount`, stable `id`, and a `theme` sub-object — existing `links` and `socialLinks` read/write paths still work unchanged.
  3. Each existing link is backfilled with a UUID `id` on first save, and every newly-created link receives a UUID `id` automatically.
  4. Non-image and oversized uploads are rejected with a 4xx error and a human-readable message.
**Plans:**
- [x] 10-01-PLAN.md — Extend linksPageConfig schema with real Zod + lazy UUID/theme normalization in storage read path (LINKS-01, LINKS-03)
- [x] 10-02-PLAN.md — POST /api/uploads/links-page admin endpoint with MIME allowlist, 2 MB cap, Supabase scoped path (LINKS-02, LINKS-06)

### Phase 11: Click Analytics API
**Goal**: Public clicks on `/links` links produce reliable, abuse-resistant per-link counts that admins can see at a glance.
**Depends on**: Phase 10 (needs stable `linkId` + `clickCount` field)
**Requirements**: LINKS-04, LINKS-05
**Plans:** 1/1 plans complete
**Success Criteria** (what must be TRUE):
  1. Anyone (unauthenticated) calling `POST /api/links-page/click/:linkId` increments `clickCount` for that specific link in `linksPageConfig`.
  2. The same IP calling the same `linkId` more than once within 60 seconds is rate-limited (count does not double-increment).
  3. Admin Links section shows a click-count badge next to each link, reflecting the current stored value after reload.
  4. A click to an unknown `linkId` returns a 404 without crashing or creating stray records.
**Plans:**
- [x] 11-01-PLAN.md — Public IP-rate-limited POST /api/links-page/click/:linkId + admin click-count data surface (LINKS-04, LINKS-05)

### Phase 12: Admin Redesign + Core Editing
**Goal**: Admin opens the Links section and immediately sees a polished three-zone editor where they can upload profile/background assets, toggle link visibility, and reorder links by drag.
**Depends on**: Phase 10 (needs upload endpoint + stable link IDs)
**Requirements**: LINKS-07, LINKS-08, LINKS-10, LINKS-11
**Success Criteria** (what must be TRUE):
  1. Admin sees a three-zone layout — Profile (left), Live Preview placeholder (center), Links + Social (right) — that stacks cleanly on narrow screens and uses the existing `AdminCard`/`SectionHeader`/`FormGrid` primitives.
  2. Admin can drag-and-drop an image onto the Avatar or Background uploader, sees a spinner, then a thumbnail + "Uploaded ✓" confirmation, and the URL is persisted to `linksPageConfig`.
  3. Admin can toggle a link's visibility switch; hidden links render at reduced opacity in the admin list and are not displayed on the public page.
  4. Admin can drag links to reorder them; the new order persists on save and is reflected on the next public-page load.
**Plans:**
3/3 plans executed
- [x] 12-02-PLAN.md — DragDropUploader for avatar/background (LINKS-08)
- [x] 12-03-PLAN.md — Drag-reorder links (LINKS-11)
**UI hint**: yes

### Phase 13: Icon Picker, Theme Editor & Live Preview
**Goal**: Admin can fully brand each link (icon + theme) and see their edits reflected inside the admin page within ~1 second — no round-trip to `/links` required.
**Depends on**: Phase 12 (needs the three-zone layout + link rows to host the picker)
**Requirements**: LINKS-09, LINKS-12, LINKS-13
**Success Criteria** (what must be TRUE):
  1. Each link row has an Icon Picker where the admin can either search the full Lucide icon library (debounced text search, ~1000 icons) and select one, or upload a custom SVG/PNG that becomes the link's icon — the selected icon renders at its final display size in the picker preview.
  2. Admin can pick a primary color, a background color or gradient, and optionally upload a background image; all values persist into `linksPageConfig.theme`.
  3. The Live Preview pane renders `/links` inline (iframe or direct embed) and re-fetches company settings after each save so admin-side edits appear in the preview within ~1 second.
  4. Switching between Lucide, custom upload, and auto icon modes on a link updates the preview without requiring a page reload.
**Plans:** 3/3 plans complete
- [x] 13-01-PLAN.md — IconPicker component (Popover+Tabs, Lucide search, Upload, Auto) wired per link row (LINKS-09)
- [x] 13-02-PLAN.md — ThemeEditor for primary/background/gradient + Reset to defaults in Profile zone (LINKS-12)
- [x] 13-03-PLAN.md — LivePreview iframe in Zone 2 with auto-refresh on save + manual refresh (LINKS-13)
**UI hint**: yes

### Phase 14: Public Page Rendering + Click Tracking
**Goal**: Visitors to `/links` see a themed, icon-rich page that only shows visible links, and every outbound click increments the admin-visible counter reliably — even when the browser immediately navigates away.
**Depends on**: Phase 10 (schema), Phase 11 (click endpoint), Phase 13 (theme values to render)
**Requirements**: LINKS-14, LINKS-15, LINKS-16, LINKS-17
**Plans:** 1/1 plans complete
**Success Criteria** (what must be TRUE):
  1. `/links` renders each link's icon from Lucide (by name) or from an uploaded URL (as `<img>`), and falls back to a generic link icon when neither is set.
  2. Links with `visible=false` do not appear on `/links`; hiding a link in admin and reloading the public page removes it from the list.
  3. `/links` reflects the saved theme — primary color on hover/focus accents, background color or gradient on the page root, and optional background image rendered behind the ambient glow layer.
  4. Clicking any link fires `POST /api/links-page/click/:linkId` via `navigator.sendBeacon` before navigation, and the admin click-count badge reflects the new count after reload.
**Plans:**
- [x] 14-01-PLAN.md — Visible filter + per-link icons + theme application + sendBeacon click tracking in client/src/pages/Links.tsx (LINKS-14, LINKS-15, LINKS-16, LINKS-17)
**UI hint**: yes

---

## v1.4 Admin Presentations Page

### Phase 15: Schema & Foundation
**Goal**: The database schema for presentations exists, `@anthropic-ai/sdk` is installed and reachable from the server, and every downstream phase has a typed foundation to build on.
**Depends on**: Nothing (first phase of v1.4)
**Requirements**: PRES-01, PRES-02, PRES-03, PRES-04
**Plans:** 2/2 plans complete
**Success Criteria** (what must be TRUE):
  1. A raw SQL migration script runs without error and creates `presentations`, `presentation_views`, and `brand_guidelines` tables with the correct columns, constraints, and cascade-delete rules — `SELECT * FROM presentations LIMIT 1` returns an empty result set, not an error.
  2. `shared/schema/presentations.ts` exports Drizzle table definitions and Zod validators (`insertPresentationSchema`, `selectPresentationSchema`, `slideBlockSchema`) that TypeScript compiles against without errors.
  3. `server/lib/anthropic.ts` exports `getAnthropicClient()` and calling it with `ANTHROPIC_API_KEY` set returns a live client that can reach the Anthropic API — it is not wired through the existing `getActiveAIClient()` OpenAI/Groq shim.
  4. `package.json` lists `@anthropic-ai/sdk` as a production dependency and `npm run check` passes cleanly.
**Plans:**
- [ ] 15-01-PLAN.md — SQL migration (3 tables) + Drizzle/Zod schema + barrel re-export + storage stubs (PRES-01, PRES-02, PRES-03)
- [ ] 15-02-PLAN.md — @anthropic-ai/sdk install + getAnthropicClient() singleton in server/lib/anthropic.ts (PRES-04)

### Phase 16: Admin CRUD API
**Goal**: Admins can create, list, update, and delete presentations through a typed REST API with no AI involvement — the data layer is fully operational before any UI or AI work begins.
**Depends on**: Phase 15 (tables and storage interface must exist)
**Requirements**: PRES-05, PRES-06, PRES-07, PRES-08
**Plans:** 1/1 plans complete
**Success Criteria** (what must be TRUE):
  1. `GET /api/presentations` (admin-auth required) returns a JSON array sorted by `createdAt` desc; each item includes `id`, `slug`, `title`, derived `slideCount`, derived `viewCount`, and `createdAt` — an unauthenticated request returns 401.
  2. `POST /api/presentations` (admin-auth required) accepts `{ title }` and returns `{ id, slug }` with an empty `slides: []`; a second `POST` with the same title creates a distinct record with a different `id` and `slug`.
  3. `PUT /api/presentations/:id` (admin-auth required) updates `title`, `slides`, and/or `accessCode`, and the `version` field increments by 1 on each successful call.
  4. `DELETE /api/presentations/:id` (admin-auth required) removes the presentation row and all associated `presentation_views` rows; a subsequent `GET /api/presentations` no longer includes that `id`.
**Plans:**
- [x] 16-01-PLAN.md — registerPresentationsRoutes (GET list, POST create, PUT update, DELETE delete) + IStorage interface declarations (PRES-05, PRES-06, PRES-07, PRES-08)

### Phase 17: Brand Guidelines
**Goal**: Admin can author and persist a tenant-wide brand guidelines document that subsequent AI calls will consume as their system prompt.
**Depends on**: Phase 15 (brand_guidelines table must exist)
**Requirements**: PRES-09, PRES-10
**Plans:** 1 plan
**Success Criteria** (what must be TRUE):
  1. `PUT /api/brand-guidelines` (admin-auth required) upserts a single row; a subsequent `GET /api/brand-guidelines` (no auth required) returns the saved `content` string — calling `GET` before any `PUT` returns a 200 with empty or null content rather than a 404.
  2. Admin sees a Brand Guidelines editor (textarea or markdown editor) within the Presentations tab; typing and saving updates the stored content and a "Saved" confirmation appears.
  3. The editor displays a live character count; the server rejects content exceeding 2,000 characters with a 400 and a human-readable message.
**Plans:**
- [ ] 17-01-PLAN.md — GET + PUT /api/brand-guidelines routes + PresentationsSection editor + AdminSection wiring (PRES-09, PRES-10)
**UI hint**: yes

### Phase 18: AI Authoring Endpoint
**Goal**: A single POST endpoint accepts a chat message and the current slide state, calls Claude via `tool_use` with brand guidelines as the system prompt, and streams structured `SlideBlock[]` JSON back to the client — the entire AI pipeline is exercisable before any admin UI is built.
**Depends on**: Phase 15 (Anthropic SDK singleton), Phase 16 (presentation storage, auth), Phase 17 (brand guidelines must exist as system prompt source)
**Requirements**: PRES-11, PRES-12, PRES-13
**Plans:** 1/2 plans executed
**Success Criteria** (what must be TRUE):
  1. `POST /api/presentations/:id/chat` (admin-auth required) accepts `{ message: string }`, loads the current `brand_guidelines.content` as Claude's system prompt, and returns a streaming `text/event-stream` response — calling it with `curl --no-buffer` shows `data:` events arriving progressively before the stream closes.
  2. When the stream completes successfully, the `presentations` row has updated `slides` (a valid `SlideBlock[]` matching the Zod schema) and `guidelinesSnapshot` set to the brand guidelines content that was active at generation time; `version` is incremented by 1.
  3. A `SlideBlock` covers all 8 layout variants (`cover`, `section-break`, `title-body`, `bullets`, `stats`, `two-column`, `image-focus`, `closing`) and contains bilingual fields (`heading`/`headingPt`, `body`/`bodyPt`, `bullets`/`bulletsPt`); a document containing one block of each variant passes Zod validation without errors.
  4. Sending "edit slide 3 — shorten the body" when there are 5 slides returns an updated array where only slide index 2 is modified and slides 0, 1, 3, 4 are byte-for-byte identical to the input; the DB write reflects this partial update.
**Plans:**
- [x] 18-01-PLAN.md — Wave 0: ANTHROPIC_API_KEY in .env.example + slideBlockSchema Zod unit test (PRES-12)
- [ ] 18-02-PLAN.md — Wave 1: server/routes/presentationsChat.ts SSE endpoint + route registration (PRES-11, PRES-12, PRES-13)

### Phase 19: Admin Chat Editor
**Goal**: Admin can open a presentation's editor, converse with Claude to build or refine slides, and see a live mini-preview of the current deck — all within the admin dashboard.
**Depends on**: Phase 16 (CRUD API for list/create/delete), Phase 18 (SSE streaming endpoint must exist)
**Requirements**: PRES-14, PRES-15, PRES-16
**Plans**: TBD
**Success Criteria** (what must be TRUE):
  1. Admin Presentations tab shows a list of all presentations with `title`, slide-count, view-count badge, a copy-link button, a delete button, and an "Open Editor" button per row; clicking delete shows a confirmation and removes the row without a page reload.
  2. Clicking "Open Editor" opens a split-view panel: chat panel on the left with a scrollable message history and a text input, slide preview panel on the right showing current slides as mini cards — both panels are visible simultaneously on desktop without horizontal scrolling.
  3. Submitting a chat message streams the AI response into the chat panel in real time (tokens appear as they arrive); when the stream ends, the slide preview panel automatically refreshes to show the updated `SlideBlock[]`.
  4. Clicking any slide mini card in the preview panel inserts a reference to that slide number (e.g. "Slide 3:") into the chat input field, allowing targeted follow-up edits without manual typing of the slide number.
**UI hint**: yes

### Phase 20: Public Viewer
**Goal**: Anyone with a presentation link can experience the deck as a fullscreen bilingual scroll-snap presentation — isolated from the site's Navbar and Footer — with an access code gate if one is set, and every successful view is recorded for admin analytics.
**Depends on**: Phase 15 (schema for view tracking), Phase 16 (public slug lookup API)
**Requirements**: PRES-17, PRES-18, PRES-19, PRES-20, PRES-21, PRES-22
**Plans**: TBD
**Success Criteria** (what must be TRUE):
  1. `GET /api/presentations/slug/:slug` (no auth) returns the full presentation including slides; each successful response creates a new row in `presentation_views` — the admin view-count badge for that presentation increments by 1 after reload.
  2. `/p/:slug` renders with no Navbar, Footer, or ChatWidget visible; opening Dev Tools confirms `isPresentationRoute` is true for the route and the standard site layout branch is skipped.
  3. `PresentationViewer` renders each slide as a fullscreen scroll-snap section (one slide fills the viewport); scrolling to a new slide triggers a framer-motion enter animation; all 8 `SlideBlock.layout` variants render without a blank or broken section.
  4. Appending `?lang=pt-BR` to the URL switches all slide text to the `headingPt`, `bodyPt`, and `bulletsPt` fields; appending `?lang=en` (or no param) shows the English fields — switching does not reload the page or restart the scroll position.
  5. If `accessCode` is set on a presentation, `/p/:slug` shows a code-entry form before any slides are visible; entering the correct code reveals the deck and entering a wrong code shows an inline error without navigating away.
**UI hint**: yes

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 10. Schema & Upload Foundation | 2/2 | Done | 2026-04-20 |
| 11. Click Analytics API | 1/1 | Done | 2026-04-20 |
| 12. Admin Redesign + Core Editing | 3/3 | Done | 2026-04-20 |
| 13. Icon Picker, Theme Editor & Live Preview | 3/3 | Done | 2026-04-20 |
| 14. Public Page Rendering + Click Tracking | 1/1 | Done | 2026-04-20 |
| 15. Schema & Foundation | 0/2 | Complete    | 2026-04-21 |
| 16. Admin CRUD API | 1/1 | Complete    | 2026-04-21 |
| 17. Brand Guidelines | 0/1 | Not started | - |
| 18. AI Authoring Endpoint | 1/2 | In Progress|  |
| 19. Admin Chat Editor | 0/? | Not started | - |
| 20. Public Viewer | 0/? | Not started | - |

---

_Last updated: 2026-04-21 — Phase 18 planned; 2 plans (18-01, 18-02); PRES-11–13 mapped_
