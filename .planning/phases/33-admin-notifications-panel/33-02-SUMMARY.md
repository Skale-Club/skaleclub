---
phase: 33-admin-notifications-panel
plan: 02
subsystem: ui
tags: [react, tanstack-query, notifications, admin, sms, telegram]

# Dependency graph
requires:
  - phase: 33-01
    provides: notification_templates DB table, seed data (6 rows), PUT /api/notifications/templates/:id endpoint
provides:
  - NotificationsSection.tsx component with 3 event cards x 2 channel rows
  - AdminSection union extended with 'notifications' member
  - SIDEBAR_MENU_ITEMS extended with Notifications entry (Bell icon)
  - Admin.tsx wired: both slugMaps, sectionsWithOwnHeader, import, render condition
affects: [admin-sidebar, admin-routing]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Per-id draft+saving state pattern (Record<number, T>) for multi-row forms where each row saves independently
    - useEffect initialization from React Query data into local draft state
    - navigator.clipboard.writeText for variable badge copy-to-clipboard

key-files:
  created:
    - client/src/components/admin/NotificationsSection.tsx
  modified:
    - client/src/components/admin/shared/types.ts
    - client/src/components/admin/shared/constants.ts
    - client/src/pages/Admin.tsx

key-decisions:
  - "Per-id saving state (Record<number, boolean>) not a single isSaving boolean — 6 Save buttons must be independently enabled/disabled"
  - "Guarded 'not configured' row render when grouped[eventKey][channel] is undefined — prevents crash with incomplete seed data"
  - "EVENT_VARIABLES, EVENT_LABELS, EVENT_DESCRIPTIONS declared as module-level constants before the component — readable, testable, zero React dependency"

patterns-established:
  - "Per-row draft + saving maps (Record<number, T>) for multi-entity admin panels with independent save buttons"

requirements-completed: [NOTIF-10, NOTIF-11, NOTIF-12, NOTIF-13]

# Metrics
duration: 2min
completed: 2026-05-04
---

# Phase 33 Plan 02: Admin Notifications Section — Summary

**Admin Notifications panel with 3 event cards (new_chat, hot_lead, low_perf_alert) x 2 channel rows (SMS, Telegram), per-row draft state, clipboard variable badges, and full admin sidebar/router wiring.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-05-04T17:09:06Z
- **Completed:** 2026-05-04T17:11:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Created NotificationsSection.tsx with per-id draft state (`Record<number, DraftState>`) and per-id saving state (`Record<number, boolean>`) so saving one channel row never disables other Save buttons
- Variable badges with `navigator.clipboard.writeText` on click; each event shows its specific variables
- Wired Notifications into admin: AdminSection union, SIDEBAR_MENU_ITEMS (Bell icon), both Admin.tsx slugMaps, sectionsWithOwnHeader, import, and render condition — `npm run check` passes with no TS errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Create NotificationsSection.tsx** - `40308db` (feat)
2. **Task 2: Wire Notifications into admin (4 files)** - `e396b0b` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified

- `client/src/components/admin/NotificationsSection.tsx` - Notifications panel component; 3 event cards x 2 channel rows; per-id draft/saving state; PUT /api/notifications/templates/:id; clipboard variable badges
- `client/src/components/admin/shared/types.ts` - Added 'notifications' to AdminSection union
- `client/src/components/admin/shared/constants.ts` - Added Bell icon import; added Notifications entry to SIDEBAR_MENU_ITEMS
- `client/src/pages/Admin.tsx` - Both slugMaps, sectionsWithOwnHeader, import, and render condition added

## Decisions Made

- Per-id saving state (`Record<number, boolean>`) instead of a single `isSaving` boolean — the plan explicitly flagged this as critical for 6 independent Save buttons
- Guarded "Not configured" fallback row when a template is missing for a channel — prevents crash with incomplete seed data
- Module-level constants (`EVENT_LABELS`, `EVENT_VARIABLES`, etc.) declared before the component for readability and to avoid React dependency

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- NOTIF-10 through NOTIF-13 complete: admin can navigate to /admin/notifications, view all 3 event cards with 2 channel rows each, edit templates, save via PUT endpoint, and copy variable badges to clipboard
- Phase 33 complete — all 2 plans shipped

---
*Phase: 33-admin-notifications-panel*
*Completed: 2026-05-04*
