---
phase: 09-public-viewer
plan: "03"
subsystem: ui
tags: [react, admin, estimates, view-tracking, access-code, tanstack-query]

# Dependency graph
requires:
  - phase: 09-01
    provides: EstimateWithStats type, access_code column, estimate_views table and LEFT JOIN aggregation in listEstimates
  - phase: 08-01
    provides: EstimatesSection.tsx base component with list, dialog, and mutation wiring
provides:
  - EstimatesSection.tsx updated with view count badge (Eye icon + number) in list rows
  - EstimatesSection.tsx with last-seen relative date conditional in list rows
  - EstimatesSection.tsx with access code optional input in create/edit dialog
  - EstimateWithStats[] type used throughout (useQuery, state, handlers)
affects: [09-public-viewer, admin-ui, estimates-admin]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "EstimateWithStats extends Estimate with viewCount + lastViewedAt — server joins stats, client reads without casting"
    - "formatDistanceToNow from date-fns for relative time display"

key-files:
  created: []
  modified:
    - client/src/components/admin/EstimatesSection.tsx

key-decisions:
  - "No new npm dependencies — formatDistanceToNow already in date-fns, Eye already in lucide-react"
  - "viewCount ?? 0 fallback ensures 0 displays for new estimates without needing conditional render"

patterns-established:
  - "Badge with icon pattern: <Badge variant='secondary' className='text-xs gap-1 shrink-0'><Icon className='w-3 h-3' />{value}</Badge>"

requirements-completed: [EST-11, EST-12]

# Metrics
duration: 12min
completed: 2026-04-19
---

# Phase 09 Plan 03: EstimatesSection View Badges and Access Code Field Summary

**Admin estimate list augmented with Eye/viewCount badge + last-seen relative date, and create/edit dialog extended with optional access code text field — all TypeScript-clean using EstimateWithStats[]**

## Performance

- **Duration:** 12 min
- **Started:** 2026-04-19T00:00:00Z
- **Completed:** 2026-04-19T00:12:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Updated useQuery generic from `Estimate[]` to `EstimateWithStats[]` — no TypeScript casting needed anywhere
- Added view count badge (Eye icon + count, shows 0 for unviewed estimates) between creation date and action buttons in list rows
- Added conditional last-seen text showing relative time when `lastViewedAt` is not null
- Extended `EstimateDialogForm` with accessCode state, input field (label + placeholder + helper text), and propagation through onSave → mutations

## Task Commits

Each task was committed atomically:

1. **Task 1: Update EstimatesSection.tsx — useQuery type, view badges, access code field, and mutation payload** - `f969306` (feat)

## Files Created/Modified
- `client/src/components/admin/EstimatesSection.tsx` - Added Eye+viewCount badge, lastViewedAt conditional text, accessCode dialog field, EstimateWithStats type, formatDistanceToNow import

## Decisions Made
- No new npm dependencies — `formatDistanceToNow` already part of `date-fns` and `Eye` already in `lucide-react`
- Used `est.viewCount ?? 0` fallback so badge always renders (never hidden for 0 views)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 09 (plans 01-03) is now complete: backend (01), public viewer (02), and admin UI (03) all shipped
- Admin list shows live view stats; access code gate is wired end-to-end (backend verifies, viewer prompts, admin sets/clears)
- EST-11 and EST-12 requirements fully satisfied

---
*Phase: 09-public-viewer*
*Completed: 2026-04-19*
