---
phase: 20-public-viewer
plan: 01
subsystem: api
tags: [express, react, typescript, presentations, routing, translations]

# Dependency graph
requires:
  - phase: 19-admin-chat-editor
    provides: presentations routes file with stub slug endpoint and storage.recordPresentationView
  - phase: 16-admin-crud-api
    provides: storage.getPresentation, storage.getPresentationBySlug, storage.recordPresentationView

provides:
  - GET /api/presentations/slug/:slug strips accessCode, returns hasAccessCode boolean + empty slides when gated
  - POST /api/presentations/:id/verify-code with 401 on wrong code
  - POST /api/presentations/:id/view with SHA-256 hashed IP via crypto
  - isPresentationRoute guard in App.tsx isolating /p/* from Navbar/Footer/ChatWidget
  - /p/:slug route registration with lazy PresentationViewer component
  - PT translation keys for all 9 viewer copy strings in translations.ts

affects: [20-02-public-viewer, plan-02, PresentationViewer]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - isPresentationRoute guard mirrors isEstimateRoute pattern — structural isolation for public viewer routes
    - SHA-256 IP hashing in view endpoint matches presentation_views.ip_hash column intent
    - accessCode always stripped from public slug response via destructuring spread

key-files:
  created:
    - client/src/pages/PresentationViewer.tsx (stub — Plan 02 replaces with full implementation)
  modified:
    - server/routes/presentations.ts
    - client/src/App.tsx
    - client/src/lib/translations.ts

key-decisions:
  - "PresentationViewer.tsx stub created for TS module resolution — lazy() does not defer tsc path checking; stub satisfies compiler without implementation"
  - "isPresentationRoute if-branch placed BEFORE default return in Router() — no AuthProvider wrap; presentations are public"
  - "SHA-256 IP hash on view endpoint matches ip_hash column design (mirrors estimate_views pattern but adds hashing)"

patterns-established:
  - "Public viewer route isolation: isPresentationRoute boolean + isolated if-branch + lazy import + Suspense/Switch/Route"

requirements-completed: [PRES-17, PRES-18, PRES-22]

# Metrics
duration: 12min
completed: 2026-04-22
---

# Phase 20 Plan 01: Public Viewer Infrastructure Summary

**Three public presentation endpoints (augmented slug, verify-code, view tracking) + isPresentationRoute App.tsx guard + 9 PT translation keys — Plan 02 unblocked to build PresentationViewer component**

## Performance

- **Duration:** 12 min
- **Started:** 2026-04-22T00:00:00Z
- **Completed:** 2026-04-22T00:12:00Z
- **Tasks:** 3
- **Files modified:** 4 (3 modified + 1 created stub)

## Accomplishments
- Augmented `GET /api/presentations/slug/:slug`: strips `accessCode` from response, returns `hasAccessCode` boolean, returns `slides:[]` for gated presentations
- Added `POST /api/presentations/:id/verify-code` (401 on wrong code, 200 on correct/no-gate)
- Added `POST /api/presentations/:id/view` with SHA-256 IP hashing via Node.js `crypto`
- `isPresentationRoute` guard in App.tsx provides structural isolation for `/p/*` routes (no Navbar/Footer/ChatWidget)
- 9 PT translation keys pre-seeded per CLAUDE.md translation rule

## Task Commits

Each task was committed atomically:

1. **Task 1: Augment slug endpoint + add verify-code and view endpoints** - `06c976a` (feat)
2. **Task 2: Add isPresentationRoute guard and /p/:slug route in App.tsx** - `c517f41` (feat)
3. **Task 3: Add PT translation keys for all viewer copy strings** - `932bad0` (feat)

## Files Created/Modified
- `server/routes/presentations.ts` - Augmented slug GET + two new public POST endpoints + crypto import
- `client/src/App.tsx` - PresentationViewer lazy import, isPresentationRoute boolean, isolated if-branch
- `client/src/pages/PresentationViewer.tsx` - Stub (returns null) for TS module resolution; Plan 02 replaces
- `client/src/lib/translations.ts` - 9 new PT keys under `// Presentation Viewer (Phase 20)` section

## Decisions Made
- PresentationViewer.tsx stub created: `lazy()` does NOT defer TypeScript path resolution; tsc fails with TS2307 if the module file is absent. A minimal stub (`export default function PresentationViewer() { return null; }`) satisfies the compiler. Plan 02 replaces it with full implementation.
- isPresentationRoute if-branch placed BEFORE the default `return (` in `Router()` — no AuthProvider wrap; presentations are fully public.
- SHA-256 hash applied before storing IP in view endpoint — aligns with `ip_hash` column naming intent established in Phase 15.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created PresentationViewer.tsx stub to unblock TypeScript module resolution**
- **Found during:** Task 2 (App.tsx route guard)
- **Issue:** Plan stated "TypeScript accepts the lazy import even though PresentationViewer.tsx does not yet exist — lazy() defers type resolution." This is incorrect — `tsc` resolves module paths statically and fails with TS2307 when the file is absent.
- **Fix:** Created `client/src/pages/PresentationViewer.tsx` as a minimal stub (`export default function PresentationViewer() { return null; }`). Plan 02 will replace this with the full component.
- **Files modified:** `client/src/pages/PresentationViewer.tsx` (new)
- **Verification:** `npm run check` exits 0 after stub creation
- **Committed in:** `c517f41` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 Rule 3 blocking)
**Impact on plan:** Auto-fix necessary for TypeScript compilation. Stub is intentional placeholder; Plan 02 replaces it.

## Known Stubs
- `client/src/pages/PresentationViewer.tsx` — returns `null`; intentional stub. Plan 02 (20-02-PLAN.md) replaces with full PresentationViewer component. Does not block this plan's goal (infrastructure endpoints + routing isolation).

## Issues Encountered
- TypeScript does not defer module path resolution for `lazy()` imports contrary to plan assumption. Resolved via stub creation (documented as deviation above).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 02 (20-02-PLAN.md) is fully unblocked: all three endpoints exist, isPresentationRoute guard is active, /p/:slug route is registered, PT translations are seeded.
- PresentationViewer.tsx stub at `client/src/pages/PresentationViewer.tsx` is the replacement target for Plan 02.

---
*Phase: 20-public-viewer*
*Completed: 2026-04-22*
