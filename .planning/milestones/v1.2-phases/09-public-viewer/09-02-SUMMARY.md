---
phase: 09-public-viewer
plan: "02"
subsystem: ui
tags: [react, wouter, framer-motion, tanstack-query, shadcn, scroll-snap, intersection-observer]

# Dependency graph
requires:
  - phase: 09-01
    provides: View tracking and access code backend endpoints (POST /api/estimates/:id/view, POST /api/estimates/:id/verify-code, GET /api/estimates/slug/:slug with hasAccessCode field)
provides:
  - EstimateViewer.tsx full public viewer page at /e/:slug
  - App.tsx isEstimateRoute isolation (no Navbar/Footer/ChatWidget for /e/* routes)
  - Scroll-snap fullscreen proposal presentation with cover, intro, service, and closing sections
  - Navigation dots with IntersectionObserver active tracking
  - Access code gate with inline error feedback
  - View tracking via useMutation + useRef(false) guard (once per mount)
  - Graceful 404 screen for unknown slugs
affects: [phase-10, estimates-system, public-viewer]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - isEstimateRoute guard in App.tsx: location.startsWith('/e/') before main Navbar/Footer return
    - Lazy import with PageWrapper for isolated route branches
    - useRef(false) + useMutation view tracking guard (same as VCard.tsx)
    - IntersectionObserver at threshold 0.5 for scroll-snap active section tracking
    - Render guard sequence: isLoading → !data → hasAccessCode && !isUnlocked → viewer

key-files:
  created:
    - client/src/pages/EstimateViewer.tsx
  modified:
    - client/src/App.tsx

key-decisions:
  - "isEstimateRoute isolated branch renders before main Navbar/Footer return — structural isolation, not CSS hiding"
  - "isUnlocked starts as false; when hasAccessCode=false, gate condition (data.hasAccessCode && !isUnlocked) is false so viewer renders immediately and view tracking fires"
  - "View tracking fires once per mount via useRef(false) guard — consistent with VCard.tsx pattern"
  - "Navigation dot touch targets use min-w-[44px] min-h-[44px] containers (WCAG 2.5.5) with smaller visual dots"

patterns-established:
  - "Isolated route branch: if (isRoute) return <Suspense><Switch>...</Switch></Suspense> — no layout shell"
  - "PublicEstimate interface: local interface matching server response shape, accessCode excluded, hasAccessCode boolean added"
  - "Scroll-snap viewer: h-screen overflow-y-scroll snap-y snap-mandatory on outer div; each section is h-screen snap-start"

requirements-completed: [EST-13, EST-14, EST-15, EST-16, EST-17, EST-18, EST-11, EST-12]

# Metrics
duration: 3min
completed: 2026-04-20
---

# Phase 9 Plan 02: Public Viewer Summary

**Fullscreen scroll-snap estimate viewer at /e/:slug with access code gate, view tracking, IntersectionObserver nav dots, and graceful 404 — isolated from Navbar/Footer/ChatWidget**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-04-20T00:48:53Z
- **Completed:** 2026-04-20T00:51:03Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- App.tsx updated with isEstimateRoute guard: lazy EstimateViewer import + isolated Suspense/Switch branch at /e/:slug, structurally preventing Navbar, Footer, and ChatWidget from rendering on viewer routes (EST-13, D-20)
- EstimateViewer.tsx created (262 lines): covers all required sections — Cover (EST-14), Introduction (EST-15), per-service sections (EST-16), Closing (EST-17) — with scroll-snap layout, framer-motion entrance animations, and navigation dots
- Access code gate (EST-12): fullscreen gate screen, POST /api/estimates/:id/verify-code, inline "Incorrect code" error (D-09), Enter key submit, unlock triggers view tracking
- View tracking (EST-11): useMutation + useRef(false) guard fires POST /api/estimates/:id/view exactly once per page load after data and access are confirmed
- Graceful 404 for unknown slugs (EST-18): NotFoundScreen rendered when useQuery returns no data; retry: false prevents spinner loop

## Task Commits

1. **Task 1: Add isEstimateRoute isolation to App.tsx** - `cd5b31c` (feat)
2. **Task 2: Create EstimateViewer.tsx** - `80ae242` (feat)

## Files Created/Modified

- `client/src/pages/EstimateViewer.tsx` — Full public estimate viewer (new, 262 lines): LoadingScreen, NotFoundScreen, AccessCodeGate, and EstimateViewer default export with scroll-snap sections, nav dots, and view tracking
- `client/src/App.tsx` — Added lazy EstimateViewer import, isEstimateRoute variable, and isolated route branch before main layout return

## Decisions Made

- `isUnlocked` initializes to `false` always; when `data.hasAccessCode = false`, the gate condition (`data.hasAccessCode && !isUnlocked`) evaluates to false, so the viewer renders normally and view tracking fires — no special case needed for non-gated estimates
- Navigation dot buttons use `min-w-[44px] min-h-[44px]` container with a smaller visual `span` inside — meets WCAG 2.5.5 touch target without oversized visual dots
- gradientOverlay defined as a JSX variable and reused across all sections to avoid repetition

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None — TypeScript check exits 0 on first attempt.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Public viewer is complete and functional — all EST-11 through EST-18 requirements delivered
- Phase 9 Plan 03 (if any) can proceed with the viewer as its foundation
- Manual QA checklist from plan's `<verification>` block should be run against a live estimate with and without access_code set
- Known: `npm run check` will show the EstimateViewer import as valid only once the file exists in the compiled bundle (already confirmed: exits 0)

---
*Phase: 09-public-viewer*
*Completed: 2026-04-20*
