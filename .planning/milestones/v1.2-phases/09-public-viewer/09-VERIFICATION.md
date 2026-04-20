---
phase: 09-public-viewer
verified: 2026-04-19T00:00:00Z
status: passed
score: 15/15 must-haves verified
re_verification: false
human_verification:
  - test: "Navigate to /e/:slug in browser with a real estimate"
    expected: "Fullscreen scroll-snap viewer renders — no Navbar, Footer, or ChatWidget visible. Cover shows client name. Scroll through intro, service sections, closing section. Navigation dots highlight active section as you scroll."
    why_human: "Visual layout, scroll-snap behavior, and IntersectionObserver dot tracking cannot be verified programmatically"
  - test: "Set access_code on an estimate via admin dialog, open the viewer link"
    expected: "Access code gate appears before content. Wrong code shows inline 'Incorrect code' error (no toast). Correct code unlocks the viewer and fires POST /api/estimates/:id/view once."
    why_human: "Gate unlock flow and view tracking fire-once behavior requires browser interaction"
  - test: "Navigate to /e/nonexistent-slug"
    expected: "Styled 404 screen appears ('This link may have expired or been removed.') — no JavaScript crash"
    why_human: "404 rendering path requires a real browser request to a missing slug"
---

# Phase 9: Public Viewer Verification Report

**Phase Goal:** A client who receives an estimate link can open /e/:slug and see a polished fullscreen proposal with their name, a Skale Club introduction, and one immersive section per service — without any site navigation or footer interfering
**Verified:** 2026-04-19
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|---------|
| 1  | estimate_views table defined in schema with cascade FK | ✓ VERIFIED | `shared/schema/estimates.ts` lines 46–51: `estimateViews` pgTable with `onDelete("cascade")` |
| 2  | estimates table has access_code text column (nullable) | ✓ VERIFIED | `shared/schema/estimates.ts` line 43: `accessCode: text("access_code")` |
| 3  | storage.listEstimates() returns viewCount and lastViewedAt aggregated via LEFT JOIN | ✓ VERIFIED | `server/storage.ts` lines 1778–1797: LEFT JOIN + `count()` + `max()` SQL aggregation |
| 4  | storage.recordEstimateView(estimateId, ipAddress?) inserts into estimate_views | ✓ VERIFIED | `server/storage.ts` lines 1826–1830: `db.insert(estimateViews).values(...)` |
| 5  | POST /api/estimates/:id/view records a view event (no auth required) | ✓ VERIFIED | `server/routes/estimates.ts` lines 21–32: no `requireAdmin` middleware |
| 6  | POST /api/estimates/:id/verify-code returns 200 for correct code, 401 for wrong | ✓ VERIFIED | `server/routes/estimates.ts` lines 34–48: plain-text comparison, 401 on mismatch |
| 7  | GET /api/estimates/slug/:slug redacts accessCode, returns hasAccessCode boolean | ✓ VERIFIED | `server/routes/estimates.ts` lines 13–15: destructures `accessCode` out, returns `hasAccessCode: Boolean(accessCode)` |
| 8  | GET /api/estimates returns viewCount and lastViewedAt per estimate row | ✓ VERIFIED | `server/storage.ts` listEstimates returns `EstimateWithStats[]` with aggregated fields |
| 9  | EstimateWithStats type exported from shared/schema/estimates.ts | ✓ VERIFIED | `shared/schema/estimates.ts` lines 67–70 |
| 10 | /e/:slug renders in isolation — no Navbar, Footer, or ChatWidget | ✓ VERIFIED | `client/src/App.tsx` lines 120, 232–241: `isEstimateRoute` branch returns before Navbar (line 247) |
| 11 | All 4 section types render (cover + intro + services + closing) | ✓ VERIFIED | `client/src/pages/EstimateViewer.tsx` lines 179–259: cover, intro, service map, closing sections |
| 12 | Access code gate shown when hasAccessCode=true; inline error on wrong code | ✓ VERIFIED | `EstimateViewer.tsx` lines 42–84, 136–138: `AccessCodeGate` component with inline `{error && ...}` |
| 13 | View tracking fires once per mount via useRef(false) guard | ✓ VERIFIED | `EstimateViewer.tsx` lines 88, 100–111: `hasTrackedView = useRef(false)`, guard in useEffect |
| 14 | /e/unknown-slug shows graceful 404 — no crash | ✓ VERIFIED | `EstimateViewer.tsx` lines 30–40, 135: `NotFoundScreen` component, rendered when `!data` |
| 15 | Admin list shows Eye badge with viewCount and last-seen relative date | ✓ VERIFIED | `client/src/components/admin/EstimatesSection.tsx` lines 439–444: `<Eye>` + `viewCount ?? 0` + `formatDistanceToNow` |

**Score:** 15/15 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `shared/schema/estimates.ts` | access_code column, estimateViews table, EstimateWithStats type | ✓ VERIFIED | 71 lines — all three additions present; barrel re-exported via `shared/schema.ts` line 7 |
| `server/storage.ts` | recordEstimateView method, listEstimates with aggregation | ✓ VERIFIED | Both methods implemented; LEFT JOIN aggregation at lines 1793–1794 |
| `server/routes/estimates.ts` | POST /view, POST /verify-code, redacted GET /slug/:slug | ✓ VERIFIED | All three route changes present; no auth on public endpoints |
| `client/src/pages/EstimateViewer.tsx` | Full viewer page (min 150 lines) | ✓ VERIFIED | 262 lines — all required components: LoadingScreen, NotFoundScreen, AccessCodeGate, main viewer |
| `client/src/App.tsx` | isEstimateRoute guard + lazy import + isolated Route | ✓ VERIFIED | Lines 72, 120, 232–241 |
| `client/src/components/admin/EstimatesSection.tsx` | View badges + access code dialog field + EstimateWithStats type | ✓ VERIFIED | All items confirmed at lines 4, 6, 33, 127, 229, 237, 332, 439–444 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `server/routes/estimates.ts` | `server/storage.ts` | `storage.recordEstimateView(id, ipAddress)` | ✓ WIRED | Line 27 in routes calls method verified at line 1826 in storage |
| `server/routes/estimates.ts` | estimate.accessCode comparison | plain text `!==` comparison | ✓ WIRED | Line 43: `estimate.accessCode !== code` returns 401 |
| `server/storage.ts` | estimate_views table | leftJoin + count() in listEstimates | ✓ WIRED | Lines 1793–1794 |
| `client/src/App.tsx` | `client/src/pages/EstimateViewer.tsx` | lazy import + isEstimateRoute branch | ✓ WIRED | Lines 72 (import) and 232–241 (route) |
| `client/src/pages/EstimateViewer.tsx` | `/api/estimates/slug/${slug}` | useQuery queryKey — default queryFn fetches from key | ✓ WIRED | Line 91; default queryFn in queryClient.ts does `fetch(queryKey.join("/"))` |
| `client/src/pages/EstimateViewer.tsx` | `/api/estimates/:id/view` | useMutation + useRef(false) guard | ✓ WIRED | Lines 100–111 |
| `client/src/pages/EstimateViewer.tsx` | `/api/estimates/:id/verify-code` | AccessCodeGate useMutation | ✓ WIRED | Lines 47–55 |
| `client/src/components/admin/EstimatesSection.tsx` | `/api/estimates` | useQuery<EstimateWithStats[]> | ✓ WIRED | Line 332 |
| `EstimateDialogForm` | PUT /api/estimates/:id | updateMutation with accessCode field | ✓ WIRED | Lines 352–358 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `EstimateViewer.tsx` | `data` (PublicEstimate) | Default queryFn → `GET /api/estimates/slug/:slug` → `storage.getEstimateBySlug()` → DB query | Yes — Drizzle `db.select().from(estimates).where(eq(...))` | ✓ FLOWING |
| `EstimatesSection.tsx` | `estimates` (EstimateWithStats[]) | `GET /api/estimates` → `storage.listEstimates()` → LEFT JOIN aggregation | Yes — real SQL with count + max aggregation | ✓ FLOWING |
| `EstimateViewer.tsx` | view tracking (useMutation) | `POST /api/estimates/:id/view` → `storage.recordEstimateView()` → `db.insert(estimateViews)` | Yes — inserts real rows | ✓ FLOWING |

### Behavioral Spot-Checks

Step 7b: SKIPPED — server requires a running DB connection and active session; cannot test API endpoints without starting the server. Visual rendering requires a browser.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| EST-11 | 09-01, 09-02, 09-03 | View tracking: record view event on public load; admin shows view_count and last_viewed_at | ✓ SATISFIED | estimate_views table, recordEstimateView, POST /view route, Eye badge in admin list |
| EST-12 | 09-01, 09-02, 09-03 | Access code gate: optional plain-text code (D-07 overrides REQUIREMENTS.md "bcrypt hash" spec); viewer shows gate; admin dialog has field | ✓ SATISFIED (with documented deviation) | access_code column, verify-code route, AccessCodeGate component, admin dialog field |
| EST-13 | 09-02 | /e/:slug renders with no Navbar, Footer, or ChatWidget | ✓ SATISFIED | isEstimateRoute branch in App.tsx returns before any layout shell |
| EST-14 | 09-02 | Cover section shows client name and Skale Club branding | ✓ SATISFIED | "Proposal for" eyebrow + `{data.clientName}` heading at EstimateViewer.tsx lines 189–192 |
| EST-15 | 09-02 | Second section shows fixed Skale Club introduction | ✓ SATISFIED | "About Skale Club" eyebrow + fixed body copy at lines 205–210 |
| EST-16 | 09-02 | Each service renders as its own fullscreen section (title, description, price, features) | ✓ SATISFIED | `data.services.map()` at lines 214–243 renders all four fields |
| EST-17 | 09-02 | Final closing section after services, no CTA button | ✓ SATISFIED | Closing section at lines 245–259 — no `<Button>` or link element present |
| EST-18 | 09-02 | /e/unknown-slug renders graceful 404 rather than crash | ✓ SATISFIED | `retry: false` on query + `if (!data) return <NotFoundScreen />` guard |

**EST-12 Deviation Note:** REQUIREMENTS.md specifies "bcrypt hash in a `password_hash text` column." The implementation uses `access_code text` (plain text). This was explicitly resolved in VALIDATION.md (D-07): plain text chosen because codes must be readable for GHL automation. The deviation is intentional and documented — not a gap.

### Anti-Patterns Found

No anti-patterns detected. Scanned:
- `client/src/pages/EstimateViewer.tsx` — no TODO/FIXME, no stub returns, data variables all populated from real API
- `server/routes/estimates.ts` — no empty handlers, all routes have real implementations
- `shared/schema/estimates.ts` — no placeholder types
- `client/src/components/admin/EstimatesSection.tsx` — accessCode state initialized from `editingEstimate?.accessCode ?? ''` (legitimate initial state, overwritten by user input and persisted on save — not a stub)

### Human Verification Required

#### 1. Scroll-snap viewer visual rendering

**Test:** With a real estimate that has 2–3 services, open `/e/<slug>` in a browser.
**Expected:** Fullscreen dark viewer — no Navbar, Footer, or ChatWidget visible. Each scroll snaps to the next section (cover, intro, each service, closing). Navigation dots on the right side highlight the active section as the user scrolls.
**Why human:** Visual appearance, scroll-snap behavior, and IntersectionObserver-driven dot activation cannot be verified programmatically.

#### 2. Access code gate end-to-end flow

**Test:** In admin, create or edit an estimate with an access code. Open the viewer link. Enter a wrong code. Enter the correct code.
**Expected:** Gate appears on load. Wrong code shows inline "Incorrect code" text beneath the input (no toast). Correct code dismisses the gate and shows the full viewer. Network tab shows POST /api/estimates/:id/view fired exactly once after unlock.
**Why human:** Gate unlock interaction, inline error display without toast, and fire-once view tracking confirmation require browser interaction and network inspection.

#### 3. 404 screen rendering

**Test:** Navigate to `/e/this-slug-does-not-exist`.
**Expected:** Styled 404 screen appears with "This link may have expired or been removed." — no JavaScript error in console, no blank screen.
**Why human:** 404 path requires a live request to a non-existent slug; cannot simulate without a running server.

### Gaps Summary

No gaps. All 15 must-have truths verified. All 6 key artifacts exist, are substantive, and are wired. All 8 requirement IDs (EST-11 through EST-18) are satisfied by the implementation. TypeScript check passes (`npm run check` exits 0). Three items require human verification for visual/interactive behaviors that cannot be confirmed programmatically.

---

_Verified: 2026-04-19_
_Verifier: Claude (gsd-verifier)_
