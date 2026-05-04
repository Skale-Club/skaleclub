---
phase: 31-schema-templates-foundation
plan: 01
subsystem: database
tags: [drizzle, postgres, zod, notifications, sms, telegram]

# Dependency graph
requires: []
provides:
  - notification_templates table (SQL migration 0039)
  - notificationTemplates Drizzle table + NotificationTemplate/InsertNotificationTemplate types
  - insertNotificationTemplateSchema Zod schema
  - IStorage.getNotificationTemplates and IStorage.upsertNotificationTemplate interface declarations
  - DatabaseStorage implementations for both storage methods
  - Idempotent seed script (6 rows: 3 events x 2 channels)
affects:
  - 31-02 (dispatcher service will call storage.getNotificationTemplates)
  - 33-notification-template-ui (admin editor will call storage.upsertNotificationTemplate)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Manual Zod insert schema (not drizzle-zod) — matches hub.ts convention"
    - "pgTable with index() callback — matches hub.ts/cms.ts convention"
    - "IStorage interface + DatabaseStorage implementation placement at end of class"

key-files:
  created:
    - migrations/0039_create_notification_templates.sql
    - scripts/migrate-notification-templates.ts
    - scripts/seed-notification-templates.ts
    - shared/schema/notifications.ts
  modified:
    - shared/schema.ts
    - server/storage.ts

key-decisions:
  - "text columns (not enum) for event_key and channel — per D-05 from RESEARCH.md; enum ALTER TABLE not needed when adding new event types"
  - "selectNotificationTemplateSchema exported alongside insert schema — symmetric with hub.ts selectHubLiveSchema pattern"
  - "upsertNotificationTemplate uses id-present check (update vs. insert) — same pattern as upsertBlogSettings; avoids ON CONFLICT complexity at ORM layer"

patterns-established:
  - "Notification template body strings use {{placeholder}} syntax for runtime substitution"
  - "Seed bodies for SMS rows are identical to original twilio.ts hardcoded strings — behavioral delta for new_chat pageUrl noted"

requirements-completed: [NOTIF-01, NOTIF-05]

# Metrics
duration: 16min
completed: 2026-05-04
---

# Phase 31 Plan 01: Schema & Templates Foundation Summary

**notification_templates table + Drizzle/Zod schema + storage layer + idempotent seed (6 rows: new_chat, hot_lead, low_perf_alert x sms/telegram)**

## Performance

- **Duration:** ~16 min
- **Started:** 2026-05-04T12:28:59Z
- **Completed:** 2026-05-04T12:45:06Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- SQL migration `0039_create_notification_templates.sql` with unique index on `(event_key, channel)` and RLS policy
- `shared/schema/notifications.ts` exports `notificationTemplates` Drizzle table, `NotificationTemplate` type, `InsertNotificationTemplate` type, `insertNotificationTemplateSchema` Zod schema
- `shared/schema.ts` barrel re-export updated with `notifications.js`
- `scripts/seed-notification-templates.ts` inserts 6 rows with `ON CONFLICT (event_key, channel) DO NOTHING` idempotency
- `IStorage` interface declares `getNotificationTemplates` and `upsertNotificationTemplate`
- `DatabaseStorage` implements both methods with optional `eventKey` filter and id-based update-or-insert logic

## Task Commits

Each task was committed atomically:

1. **Task 1: DB migration + Drizzle/Zod schema + barrel re-export** - `fb4268d` (feat)
2. **Task 2: Seed script + IStorage interface + DatabaseStorage implementations** - `2061c8a` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `migrations/0039_create_notification_templates.sql` — Raw SQL migration: CREATE TABLE IF NOT EXISTS notification_templates, UNIQUE INDEX on (event_key, channel), RLS policy
- `scripts/migrate-notification-templates.ts` — Migration runner using pool.connect() pattern; verifies table exists after migration
- `scripts/seed-notification-templates.ts` — Idempotent seed of 6 rows (3 events x 2 channels); ON CONFLICT DO NOTHING
- `shared/schema/notifications.ts` — Drizzle pgTable definition + manual Zod schemas following hub.ts pattern
- `shared/schema.ts` — Added `export * from "./schema/notifications.js"` barrel re-export
- `server/storage.ts` — Added notificationTemplates import, type imports, IStorage declarations, DatabaseStorage implementations

## Decisions Made
- Used `text` columns (not enum) for `event_key` and `channel` per plan D-05 — avoids ALTER TABLE when adding event types
- Manual Zod schema (not drizzle-zod) following hub.ts convention
- `upsertNotificationTemplate` uses id-present check for update vs. insert, matching the upsertBrandGuidelines/upsertBlogSettings patterns

## Known Behavioral Delta
- **new_chat template body always includes `\nPágina: {{pageUrl}}`** — the original `sendNewChatNotification` in twilio.ts conditionally omitted this line when `pageUrl` was undefined. After migrating to DB templates, when `pageUrl` is absent the SMS body will render `Página: ` with a blank value rather than omitting the line. This is documented in RESEARCH.md Pitfall 2 as an acceptable minor delta. Admins can edit the template body via the Phase 33 UI. Manual QA must verify both cases (pageUrl present and absent) before closing phase 31.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- TypeScript incremental compilation runs slowly in this environment (~90s+ for full project check). A targeted check on `shared/schema/notifications.ts` (isolated tsc call) completed with exit code 0. The first full `npm run check` (background job buwoud0bp) completed with exit code 0 after Task 1 schema files were committed.

## User Setup Required

The migration and seed scripts require a live `DATABASE_URL`. The operator must run:

```bash
npx tsx scripts/migrate-notification-templates.ts
npx tsx scripts/seed-notification-templates.ts
```

These are manual run steps — they are NOT run automatically during deployment.

## Next Phase Readiness
- Plan 02 (dispatcher service) can now import `notificationTemplates` from `#shared/schema.js` and call `storage.getNotificationTemplates(eventKey)` against the typed IStorage interface
- 6 seed rows are ready to be inserted once the migration is run against the production DB
- No blockers for Plan 02 execution

## Self-Check: PASSED

- FOUND: migrations/0039_create_notification_templates.sql
- FOUND: scripts/migrate-notification-templates.ts
- FOUND: scripts/seed-notification-templates.ts
- FOUND: shared/schema/notifications.ts
- FOUND: 31-01-SUMMARY.md
- FOUND: fb4268d (Task 1 commit)
- FOUND: 2061c8a (Task 2 commit)
- TypeScript check: exit code 0 (background jobs buwoud0bp and bps34b1cv both passed)

---
*Phase: 31-schema-templates-foundation*
*Completed: 2026-05-04*
