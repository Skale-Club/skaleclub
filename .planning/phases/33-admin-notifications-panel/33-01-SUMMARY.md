---
phase: 33-admin-notifications-panel
plan: 01
subsystem: api
tags: [express, notifications, templates, zod, admin]

# Dependency graph
requires:
  - phase: 31-schema-templates-foundation
    provides: notificationTemplates table, IStorage methods (getNotificationTemplates/upsertNotificationTemplate), insertNotificationTemplateSchema
provides:
  - GET /api/notifications/templates — admin-protected endpoint returning all template rows
  - PUT /api/notifications/templates/:id — admin-protected endpoint for partial template updates
affects:
  - 33-02 (frontend depends on these endpoints)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "registerNotificationRoutes(app) pattern — new route module following skaleHub.ts conventions"
    - "insertNotificationTemplateSchema.partial() for PUT partial updates with type assertion to bridge storage type gap"

key-files:
  created:
    - server/routes/notifications.ts
  modified:
    - server/routes.ts

key-decisions:
  - "Use insertNotificationTemplateSchema.partial() + type assertion (Parameters<typeof storage.upsertNotificationTemplate>[0]) to bridge partial Zod type to required storage type without unsafe any"
  - "Register notification routes after registerIntegrationRoutes (per CONTEXT.md D-04 placement)"

patterns-established:
  - "Route file follows skaleHub.ts canonical pattern: import type Express, import z from zod, requireAdmin from ./_shared.js, try/catch in each handler"

requirements-completed: [NOTIF-10, NOTIF-13]

# Metrics
duration: 2min
completed: 2026-05-04
---

# Phase 33 Plan 01: Admin Notifications Panel — API Routes Summary

**Express notification routes wired: GET + PUT /api/notifications/templates endpoints admin-protected via requireAdmin, persisted via storage.upsertNotificationTemplate**

## Performance

- **Duration:** 2min
- **Started:** 2026-05-04T17:03:01Z
- **Completed:** 2026-05-04T17:05:32Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Created `server/routes/notifications.ts` with `registerNotificationRoutes(app)` exporting GET + PUT handlers
- GET `/api/notifications/templates` returns all template rows via `storage.getNotificationTemplates()`
- PUT `/api/notifications/templates/:id` validates partial body via `insertNotificationTemplateSchema.partial()`, rejects non-integer ids (400) and empty body (400), persists via `storage.upsertNotificationTemplate`
- Registered notification routes in `server/routes.ts` after `registerIntegrationRoutes`
- `npm run check` passes with zero errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Create server/routes/notifications.ts** - `38255e5` (feat)
2. **Task 2: Register notification routes in server/routes.ts** - `69b8134` (feat)

**Plan metadata:** (created in final commit below)

## Files Created/Modified

- `server/routes/notifications.ts` - New route file with GET + PUT /api/notifications/templates handlers
- `server/routes.ts` - Added import and registration call for registerNotificationRoutes

## Decisions Made

- Used `insertNotificationTemplateSchema.partial()` for PUT handler (only `body` and `active` needed; `channel` and `eventKey` already set in DB row). Type assertion required because `.partial()` makes required fields optional, causing TS type mismatch with storage interface — resolved with `Parameters<typeof storage.upsertNotificationTemplate>[0]` cast (avoids unsafe `any`).
- Registered after `registerIntegrationRoutes` per CONTEXT.md D-04 decision.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Worktree missing phase 31 prerequisites**
- **Found during:** Pre-task setup
- **Issue:** The worktree branch (`worktree-agent-ac561b6d46487cb5a`) was at `0a3b010`, 20 commits behind `main`. `shared/schema/notifications.ts`, `server/storage.ts` notification methods, and the barrel export were all missing.
- **Fix:** `git merge main` (fast-forward) brought in all phase 31 + 32 work without conflicts.
- **Files modified:** All phase 31/32 files (fast-forward merge — no file conflicts)
- **Verification:** `shared/schema/notifications.ts` exists; `server/storage.ts` has `getNotificationTemplates` and `upsertNotificationTemplate`; `shared/schema.ts` exports `./schema/notifications.js`
- **Committed in:** Part of merge fast-forward (not a new commit)

**2. [Rule 1 - Bug] Type assertion needed for insertNotificationTemplateSchema.partial() result**
- **Found during:** Task 1 (npm run check)
- **Issue:** `insertNotificationTemplateSchema.partial()` makes all fields optional including `body`, `eventKey`, `channel`. Spreading `{ ...parsed.data, id }` into `storage.upsertNotificationTemplate` fails TypeScript because `body: string | undefined` is not assignable to `body: string` in `InsertNotificationTemplate`.
- **Fix:** Added type assertion `as Parameters<typeof storage.upsertNotificationTemplate>[0]` to bridge the Zod partial output to the storage method's expected type. Runtime behavior is correct — the storage UPDATE path only sets the provided fields.
- **Files modified:** `server/routes/notifications.ts`
- **Verification:** `npm run check` exits 0
- **Committed in:** `38255e5`

---

**Total deviations:** 2 auto-fixed (1 blocking prerequisite, 1 type fix)
**Impact on plan:** Both fixes necessary for compilation and execution. No scope creep.

## Issues Encountered

None beyond the two deviations documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 33-02 (frontend admin UI) can proceed — both endpoints are live
- `GET /api/notifications/templates` will return data once `notification_templates` table is seeded (seed script exists at `scripts/seed-notification-templates.ts` from phase 31)
- No blockers for Plan 33-02

---
*Phase: 33-admin-notifications-panel*
*Completed: 2026-05-04*
