# Roadmap: Skale Club Web Platform

## Milestones

- ✅ **v1.0 Xpot Tech Debt** — Phases 1-4 (shipped 2026-03-30)
- ✅ **v1.1 Multi-Forms Support** — Phase 5 / M3 (shipped 2026-04-15)
- ✅ **v1.2 Estimates System** — Phases 6-9 (shipped 2026-04-20)
- 🚧 **v1.3 Links Page Upgrade** — Phases 10-14 (in progress)

## Active

### v1.3 Links Page Upgrade

- [ ] **Phase 10: Schema & Upload Foundation** — Extend `linksPageConfig`, wire Supabase Storage uploads, assign stable per-link IDs
- [ ] **Phase 11: Click Analytics API** — Public click-increment endpoint with IP rate limiting + admin display
- [ ] **Phase 12: Admin Redesign + Core Editing** — Three-zone admin layout, profile/background uploaders, visibility toggle, drag-reorder
- [ ] **Phase 13: Icon Picker, Theme Editor & Live Preview** — Lucide + custom icon picker, theme controls, `/links` live preview pane
- [x] **Phase 14: Public Page Rendering + Click Tracking** — Icons, visibility, theming, and `sendBeacon` click tracking on `/links`

## Phases

<details open>
<summary>🚧 v1.3 Links Page Upgrade (Phases 10-14) — IN PROGRESS</summary>

- [ ] Phase 10: Schema & Upload Foundation (0/2 plans)
- [ ] Phase 11: Click Analytics API (1/1 plans)
- [ ] Phase 12: Admin Redesign + Core Editing (3/3 plans)
- [ ] Phase 13: Icon Picker, Theme Editor & Live Preview (0/3 plans)
- [x] Phase 14: Public Page Rendering + Click Tracking (1/1 plans)

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

_Last updated: 2026-04-20 — Phase 14 executed (1/1 plans shipped: public /links visible filter + icon render + theme + sendBeacon); v1.3 feature-complete 17/17 reqs; ready for /gsd:verify-work_
