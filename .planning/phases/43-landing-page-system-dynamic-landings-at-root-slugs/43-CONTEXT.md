# Phase 43: Landing Page System (dynamic landings at root slugs) - Context

**Gathered:** 2026-05-17
**Status:** Ready for planning
**Mode:** Direct context — user specified scope explicitly, autonomous workflow

<domain>
## Phase Boundary

Build a managed landing-page system: admins create N landings via the admin
panel, each addressable at a clean root URL like `/websites`, `/grupo`, etc.
The renderer composes from a `type → component` registry. Existing
`client/src/components/home/*` primitives are wired into the registry first
(homepage-style sections). The hand-rolled `pages/SkaleHubGroup.tsx` is
migrated into the new system as a `whatsappGroup` section type, preserving
its visual design verbatim — only the plumbing changes.

In scope:
- `landing_pages` table + raw-SQL migration following the project's
  established migration pattern (`scripts/migrate-*.ts`).
- Server CRUD at `/api/landing-pages` (admin-only) + public lookup at
  `/api/landing-pages/slug/:slug`.
- `pages/DynamicLanding.tsx` public renderer.
- Catch-all `/:slug` route in `App.tsx` registered LAST.
- Reserved-slug guard (admin, blog, contact, etc.) rejecting POST/PUT
  with HTTP 409.
- Admin "Landings" section: list + create dialog + JSON editor for
  sections (textarea + Zod validate-on-save).
- Section component registry initially populated with: `hero`,
  `trustBadges`, `services`, `reviews`, `blog`, `about`, `areasServed`,
  `leadFormCta`, `whatsappGroup` (new — extracted from SkaleHubGroup).
- Migration of the existing Skale Hub group landing into a managed
  landing record with the `whatsappGroup` section type. Old hardcoded
  routes (`<hub>/grupo`, `<hub>/group`, plus legacy fallbacks)
  permanently redirect (HTTP 301) to the new managed URL.

Out of scope (deferred to Phase 44 or later):
- Net-new section components beyond `whatsappGroup` extraction.
- The /websites landing itself (Phase 44).
- Visual drag-and-drop editor — JSON editor is the v1 UX.
- Landing analytics / view tracking — could be a future phase.
- A/B testing infrastructure.

</domain>

<decisions>
## Implementation Decisions

### Database
- Single `landing_pages` table — no separate `landing_sections` join table.
  Sections live as JSONB array on the landing row. Matches the project's
  pattern (estimates, presentations, hub all use JSONB for composable
  content).
- UUID primary key for portability across environments (matches presentations).
- Unique constraint on `slug` (text). Validation that rejects reserved
  slugs happens in the route handler, not the DB — keeps the DB layer
  unopinionated and makes the reserved list editable in code.

### Section schema (Zod)
- A section is `{ type: string, props: Record<string, unknown> }`.
- A per-type Zod schema validates `props`. The registry exports both the
  React component AND the props schema. Save handler runs the per-type
  schema against every section in the array; rejects with 422 on any
  failure (includes the index of the failing section in the error).
- Unknown section types reject with 422 ("unknown section type 'XYZ'").

### Section registry
- Lives at `client/src/components/landings/sectionRegistry.ts`.
- Shape: `{ [type: string]: { component: React.ComponentType<any>, propsSchema: ZodSchema } }`.
- Components import existing home/* primitives as-is (no copying, no
  duplication). For example, `services: { component: ServicesSection, propsSchema: z.object({...}) }`.

### Routing
- Catch-all `<Route path="/:slug">` registered AFTER every known route in
  `App.tsx` Switch. Wouter matches top-to-bottom, so this is safe.
- DynamicLanding component fetches by slug. If 404, renders the
  existing NotFound page (lazy import already present).
- Reserved slug list lives in a shared module so server (validation) and
  client (defensive check) read the same source: `shared/reservedSlugs.ts`.

### SkaleHubGroup migration strategy
- Step 1: extract the SkaleHubGroup JSX/CSS into a new component
  `client/src/components/landings/WhatsAppGroupSection.tsx`. Same look,
  same behavior — pure code move + prop-ifying any hard-coded values.
- Step 2: register `whatsappGroup` in the section registry pointing at
  the new component.
- Step 3: seed the existing Skale Hub landing into `landing_pages` with
  `slug='grupo'` (or whatever the current `pagePaths.hub` resolves to)
  and a single `whatsappGroup` section.
- Step 4: register HTTP 301 redirects from the legacy `App.tsx` routes
  to the new managed URL. Keep redirects in `vercel.json` for production
  + a small middleware in `server/static.ts` for local dev parity.
- Step 5: delete `pages/SkaleHubGroup.tsx` ONLY after the new managed
  landing is verified working in a smoke test.

### Server endpoints
- `GET    /api/landing-pages`             (admin-only) — list all
- `POST   /api/landing-pages`             (admin-only) — create
- `GET    /api/landing-pages/:id`         (admin-only) — get by id (for edit view)
- `PUT    /api/landing-pages/:id`         (admin-only) — update
- `DELETE /api/landing-pages/:id`         (admin-only) — delete
- `GET    /api/landing-pages/slug/:slug`  (public)     — for the renderer
- Public endpoint omits internal fields (`createdAt`, `updatedAt`, `id`)
  to keep the response tight.

### Admin UI
- New section "Landings" added to `client/src/components/admin/` plus
  the sidebar/router map in `Admin.tsx`.
- Naming: `LandingsSection.tsx` follows the existing per-area folder
  convention. Sub-files under `admin/landings/`: `LandingsList.tsx`,
  `CreateLandingDialog.tsx`, `LandingEditor.tsx`.
- JSON editor for sections is a `<textarea>` with a Save button that
  parses + validates the JSON server-side. No live preview in v1.
- Lazy load via the Phase 42 pattern already in `Admin.tsx`.

### Claude's Discretion
- Internal naming of helper functions, exact shape of admin list view,
  styling micro-choices.
- Whether to keep `whatsappGroup` props strictly identical to
  SkaleHubGroup's current state, or to expose more knobs (headline,
  WhatsApp invite URL, etc.) for future Skale Hub variants. Lean toward
  exposing knobs.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `client/src/components/home/*` — Hero, TrustBadges, Services, Reviews,
  Blog. All take props, all reusable.
- `client/src/components/AboutSection.tsx`, `AreasServedMap.tsx` — also
  prop-driven, reusable.
- `client/src/components/LeadFormModal.tsx` — accepts `formSlug` prop,
  so `leadFormCta` section just passes its configured slug through.
- `client/src/components/ui/PhoneCountrySelect.tsx` (155 LOC) — country
  selector with flags. Used by SkaleHubGroup today, reused by
  `whatsappGroup` section verbatim.
- `client/src/lib/phoneCountries.ts` (88 LOC) — helpers
  (detectDefaultPhoneCountry, formatPhoneForCountry, etc.).
- `client/src/pages/SkaleHubGroup.tsx` (241 LOC) — the source for the
  whatsappGroup section extraction.
- `client/src/pages/not-found.tsx` — existing 404 to render for unknown
  slugs in the catch-all route.

### Established Patterns
- Raw-SQL migrations via `scripts/migrate-*.ts` + idempotent
  `CREATE TABLE IF NOT EXISTS` (see `scripts/migrate-presentations.ts`).
- JSONB for composable content (slides on presentations, services on
  estimates).
- Domain folders under `client/src/components/admin/<area>/` (after
  Phase 41 split).
- React Query for server state; UI updates via `queryClient.invalidateQueries`.
- Lazy admin sections registered in `Admin.tsx` (Phase 42 pattern).
- Public routes registered in `App.tsx` Switch, top-down matching.

### Integration Points
- `App.tsx` — Switch (where the catch-all `/:slug` Route lands LAST).
- `Admin.tsx` — admin section router (add new lazy import for `LandingsSection`).
- `server/routes.ts` — registers route modules; need a new
  `registerLandingPagesRoutes(app)` to mount.
- `shared/schema.ts` (barrel) — re-export the new `landingPages` table.
- `shared/reservedSlugs.ts` (new) — shared reserved slug list.
- `vercel.json` rewrites — already excludes `/assets/`; no change needed
  for `/:slug` because the SPA catch-all hits index.html, which mounts
  React, which then renders DynamicLanding via Wouter.

</code_context>

<specifics>
## Specific Ideas

- The JSON editor for sections should pre-fill a sensible template on
  "Create Landing" (an empty array `[]`) and the Save handler should
  give a clear error message when the array is empty (i.e., "a landing
  must have at least one section").
- Reserved slug list (initial): `admin`, `blog`, `portfolio`, `contact`,
  `faq`, `privacy`, `terms`, `e`, `p`, `f`, `links`, `vcard`, `xpot`,
  `sites`, `api`, `assets`. Easy to extend in `shared/reservedSlugs.ts`.
- The existing Hub group landing slug should be `grupo` (Portuguese,
  matching the current production URL `<hub>/grupo`). Phase 43 keeps
  this slug.
- After migration, the old `<hub>/grupo` and `<hub>/group` URLs MUST
  301-redirect to the new managed URL — preserve SEO + bookmarks.

</specifics>

<deferred>
## Deferred Ideas

- A visual page builder (drag-drop sections, inline content editing,
  live preview) — deferred to a future milestone. JSON editor is the
  v1 contract.
- Per-landing analytics / view tracking. Add a `landing_page_views`
  table later if needed.
- A/B testing (multiple versions of the same slug). Out of scope.
- The `/websites` landing itself, with its own custom hero and form —
  that is Phase 44.

</deferred>
