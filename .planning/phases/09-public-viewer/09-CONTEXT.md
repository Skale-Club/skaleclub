# Phase 9: Public Viewer - Context

**Gathered:** 2026-04-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 9 delivers the public-facing estimate viewer at `/e/:slug` — a fullscreen, scroll-snapped proposal presentation with no site navigation, Navbar, Footer, or ChatWidget. It also adds view tracking (EST-11), access code protection (EST-12), and the admin-side display of those features. The viewer is the client-facing product of the entire Estimates System milestone.

</domain>

<decisions>
## Implementation Decisions

### Viewer Visual Treatment
- **D-01:** Dark immersive theme — `bg-zinc-950` (or `#0a0a0a`) as the base background. Each section fills 100vh with scroll-snap alignment.
- **D-02:** Subtle gradient overlay per section — keeps sections visually distinct without per-service color variations.
- **D-03:** No per-service color schemes — consistent dark treatment across all service sections for a professional, unified look.
- **D-04:** Service content is centered vertically in each section with a clean card-style layout (title, description, price, features list).

### Section Navigation
- **D-05:** Fixed navigation dots on the right side — one dot per section, active dot highlighted. No arrow buttons.
- **D-06:** Primary navigation is native scroll/touch (scroll-snap handles it). Dots are visual indicators and click targets for direct section jump.

### Access Code Gate (EST-12)
- **D-07:** `access_code` stored as **plain text** in a new `access_code text` column on the `estimates` table — NOT bcrypt hashed. Rationale: codes are simple (e.g., date like "20260419" or last 4 digits of phone), need to be readable/sendable via GHL automation.
- **D-08:** Minimal centered gate screen — logo + "Enter access code" heading + input + submit button. Matches the dark viewer theme.
- **D-09:** Wrong code shows an **inline error** directly under the input ("Incorrect code") — no toast, no redirect.
- **D-10:** Admin create/edit dialog in `EstimatesSection.tsx` gets a new optional "Access code" text field — plain text input, clearable. No toggle needed (empty = no gate).

### View Tracking (EST-11)
- **D-11:** New `estimate_views` table: `id` (serial PK), `estimate_id` (integer FK → estimates.id), `viewed_at` (timestamp, defaultNow), `ip_address` (text, nullable). Event log approach — no counter column on estimates.
- **D-12:** View event fired once per page load via `useMutation` with `useRef(false)` guard (same pattern as `VCard.tsx` — `POST /api/estimates/:id/view`).
- **D-13:** Admin list in `EstimatesSection.tsx` shows two new inline badges per row: view count ("👁 N") and last seen relative date ("last seen 2 days ago"). These are computed from the `estimate_views` table via a new storage method.
- **D-14:** `GET /api/estimates` response must include `viewCount` and `lastViewedAt` fields (aggregated from `estimate_views`) so the admin list can display them without a second request.

### DB Schema Additions
- **D-15:** Add `access_code text` column to `estimates` table (nullable, no default). Migration via `npm run db:push`.
- **D-16:** New `estimate_views` table in `shared/schema/estimates.ts` — follows existing domain-file pattern.
- **D-17:** New storage method `recordEstimateView(estimateId, ipAddress?)` on `DatabaseStorage`.
- **D-18:** `listEstimates` storage method updated to JOIN/aggregate view counts — returns `viewCount: number` and `lastViewedAt: Date | null` per estimate.

### Route Addition
- **D-19:** New Wouter route `<Route path="/e/:slug" component={EstimateViewer} />` added in `App.tsx` — same pattern as `<Route path="/f/:slug" component={PublicForm} />` (line 239).
- **D-20:** The viewer route bypasses Navbar/Footer/ChatWidget — uses the same isolation approach as admin/xpot/links routes in App.tsx (branch on `location.startsWith('/e/')`).

### 404 Handling
- **D-21:** Unknown slug renders a graceful centered 404 message within the dark viewer theme — no crash, no blank screen (EST-18).

### Claude's Discretion
- Exact gradient CSS values per section (any subtle dark gradient works)
- Dot size, spacing, and active state styling
- Loading spinner while estimate data fetches
- Framer-motion entrance animations per section (available in stack)
- Whether to show a "Powered by Skale Club" footer inside the viewer

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Routing Pattern
- `client/src/App.tsx` lines 106–288 — Wouter routing structure; line 239 shows `/f/:slug` pattern to replicate for `/e/:slug`; lines 115–117 show how to detect route prefix for conditional layout isolation

### View Tracking Pattern (canonical reference)
- `client/src/pages/VCard.tsx` lines 39–75 — `useMutation` + `useRef(false)` guard for once-per-mount view tracking via POST endpoint

### Public Route Pattern
- `client/src/pages/PublicForm.tsx` — pattern for a public route that fetches by slug, handles loading/404 states, and renders without site navigation

### Estimates Schema
- `shared/schema/estimates.ts` — current estimates table definition; `access_code` column and `estimate_views` table must be added here

### Existing Estimates Storage
- `server/storage.ts` lines 1776–1807 — existing CRUD methods for estimates; `listEstimates`, `recordEstimateView`, and view aggregation must follow this pattern

### Admin UI (Phase 8 — needs update for EST-11/EST-12)
- `client/src/components/admin/EstimatesSection.tsx` — existing admin component; needs `access_code` field in dialog and view count badges in list

### Phase 6 Decisions
- `.planning/phases/06-db-schema-storage-layer/06-CONTEXT.md` — original schema decisions (D-07: no forward-compat columns; note EST-11/EST-12 are explicit scope additions, not forward-compat columns)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `framer-motion` (installed) — available for section entrance animations and smooth transitions
- `useToast` hook — available but not used for wrong-code feedback (inline error preferred per D-09)
- Wouter `useParams` — for extracting `:slug` from `/e/:slug`
- TanStack `useQuery` + `useMutation` — for fetching estimate data and recording views
- `Loader2` from lucide-react — standard loading spinner used throughout codebase

### Established Patterns
- Public route isolation: App.tsx detects route prefix (e.g., `location.startsWith('/admin')`) and renders a completely separate layout tree — same approach for `/e/`
- View tracking: VCard.tsx fires `POST /api/vcards/:username/view` once on mount via `useMutation` + `useRef(false)` guard
- 404 state: PublicForm.tsx shows a centered error card when `data === null` after fetch

### Integration Points
- `App.tsx` — add `/e/` prefix detection + `<Route path="/e/:slug">` in the main public router block
- `shared/schema/estimates.ts` — add `access_code` column + `estimate_views` table + new Zod schemas
- `server/storage.ts` — add `recordEstimateView` method + update `listEstimates` to aggregate view counts
- `server/routes.ts` — add `POST /api/estimates/:id/view` endpoint + `GET /api/estimates/slug/:slug` already exists (EST-05)
- `client/src/components/admin/EstimatesSection.tsx` — update list row JSX for view badges, update dialog for access_code field

</code_context>

<specifics>
## Specific Ideas

- Access codes sent via GHL automation — must be plain text, readable, not hashed. Examples: "20260419" (date) or "9134" (last 4 of phone). The `access_code` field in the admin dialog should be a simple text input.
- Navigation dots: fixed right side, subtle styling that doesn't compete with proposal content

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 09-public-viewer*
*Context gathered: 2026-04-19*
