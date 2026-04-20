# Requirements: Skale Club Web Platform — v1.3 Links Page Upgrade

**Defined:** 2026-04-20
**Core Value:** Admin manages a rich Linktree-style page with real file uploads, per-link icons, click analytics, and a live-preview editor.

## v1.3 Requirements

### Schema & Storage — Links Page Config + Uploads

- [x] **LINKS-01**: `linksPageConfig` JSONB on `company_settings` extended to support per-link `iconType` ('lucide' | 'upload' | 'auto'), `iconValue` (lucide name OR uploaded file URL), `visible` boolean, `clickCount` integer, and a `theme` sub-object (primaryColor, backgroundColor, backgroundGradient, backgroundImageUrl). Existing `links` and `socialLinks` arrays remain backward-compatible.
- [x] **LINKS-02**: File uploads for avatar, background image, and per-link icons route to Supabase Storage bucket `uploads` under path prefix `links-page/{type}/{timestamp}-{hash}.{ext}`. Uploaded URLs returned to admin and persisted in linksPageConfig.
- [x] **LINKS-03**: Each link has a stable `id` (UUID) assigned at create time so click analytics and reordering survive edits.

### Click Analytics API

- [x] **LINKS-04**: `POST /api/links-page/click/:linkId` increments `clickCount` for that link id in `company_settings.linksPageConfig.links` — unauthenticated (public page calls it), rate-limited by IP (max 1 click per link per IP per minute).
- [x] **LINKS-05**: Admin list displays `clickCount` next to each link (read from the same config, no extra endpoint). — data surface delivered by Phase 10-01 normalizer; UI badge render is Phase 12 (LINKS-07/-10).

### File Upload Endpoint

- [x] **LINKS-06**: `POST /api/uploads/links-page` accepts multipart file upload (image types only, max 2 MB), uploads to Supabase Storage `uploads` bucket under `links-page/`, returns `{ url }`. Admin-auth required.

### Admin UI — Redesign + Uploads + Icon Picker

- [x] **LINKS-07**: Admin Links section is redesigned with three clear zones — Profile (left), Live Preview (center), Links + Social (right) — responsive to smaller screens by stacking. Visual polish matches the design tokens used by other admin sections (AdminCard/SectionHeader/FormGrid).
- [ ] **LINKS-08**: Profile zone replaces URL text inputs for Avatar and Background Image with drag-and-drop file uploaders that call `/api/uploads/links-page`, show a spinner during upload, a "Uploaded ✓" confirmation, and render a thumbnail preview of the uploaded asset.
- [ ] **LINKS-09**: Each link row exposes an **Icon Picker** that lets admin either (a) search and select from a searchable Lucide icon library (~1000 icons, debounced text search) OR (b) upload a custom SVG/PNG that becomes the link's icon. Selected icon is previewed at its final rendering size.
- [x] **LINKS-10**: Each link row has a visible/hidden toggle (Switch component) that controls whether the link renders on the public page; hidden links stay in the admin list with reduced opacity.
- [x] **LINKS-11**: Admin can drag-and-drop reorder links; order persists to `linksPageConfig.links[].order` and is reflected on the next public-page load.
- [ ] **LINKS-12**: Theme editor (part of Profile zone or separate accordion) lets admin pick primary color (color picker), background color or gradient, and optionally upload a background image. Changes persist to `linksPageConfig.theme`.
- [ ] **LINKS-13**: Live Preview pane renders `/links` in an `<iframe>` or direct component embed that re-queries company settings after each save so admin sees changes within ~1s without leaving the page.

### Public Page — Rendering + Click Tracking

- [ ] **LINKS-14**: Public `/links` page renders per-link icons from Lucide (by name) or from uploaded URL (as `<img>`), falling back to a generic link icon when neither is set.
- [ ] **LINKS-15**: Public `/links` respects `visible=false` — hidden links are not rendered.
- [ ] **LINKS-16**: Public `/links` applies `linksPageConfig.theme` — primaryColor used for hover/focus accents, backgroundColor/backgroundGradient applied to page root, backgroundImageUrl rendered as a fixed-position background layer behind the ambient glow.
- [ ] **LINKS-17**: Clicking a link triggers `POST /api/links-page/click/:linkId` as a fire-and-forget `navigator.sendBeacon` call before the navigation proceeds, so the click count increments reliably even on external navigation.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Multiple `/l/:slug` pages (multi-page) | Single `/links` page is sufficient for v1.3; per-campaign pages are future scope (can reuse vcards pattern if needed) |
| Pinned / featured link styling | Deferred — visible/hidden + ordering covers primary curation needs |
| Inline email capture form | Deferred — can be added as a link type in a future milestone |
| A/B testing / scheduled links | Future — not a current business need |
| QR code for the page | Already available via VCards feature; can be reused |
| Per-link analytics beyond click count (geo, device, referrer) | Click count alone is enough for v1.3 signal |
| Simple Icons (brand logo library) | Lucide + custom upload is enough; avoids external runtime dep |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| LINKS-01 | Phase 10 | Complete |
| LINKS-02 | Phase 10 | Complete |
| LINKS-03 | Phase 10 | Complete |
| LINKS-04 | Phase 11 | Complete |
| LINKS-05 | Phase 11 | Complete |
| LINKS-06 | Phase 10 | Complete |
| LINKS-07 | Phase 12 | Complete |
| LINKS-08 | Phase 12 | Pending |
| LINKS-09 | Phase 13 | Pending |
| LINKS-10 | Phase 12 | Complete |
| LINKS-11 | Phase 12 | Complete |
| LINKS-12 | Phase 13 | Pending |
| LINKS-13 | Phase 13 | Pending |
| LINKS-14 | Phase 14 | Pending |
| LINKS-15 | Phase 14 | Pending |
| LINKS-16 | Phase 14 | Pending |
| LINKS-17 | Phase 14 | Pending |

**Coverage:**
- v1.3 requirements: 17 total
- Mapped to phases: 17/17 ✓ (100%)

**Phase distribution:**
- Phase 10 (Schema & Upload Foundation): 4 reqs — LINKS-01, -02, -03, -06
- Phase 11 (Click Analytics API): 2 reqs — LINKS-04, -05
- Phase 12 (Admin Redesign + Core Editing): 4 reqs — LINKS-07, -08, -10, -11
- Phase 13 (Icon Picker, Theme & Live Preview): 3 reqs — LINKS-09, -12, -13
- Phase 14 (Public Page Rendering + Click Tracking): 4 reqs — LINKS-14, -15, -16, -17

---
*Requirements defined: 2026-04-20 — traceability mapped 2026-04-20*
