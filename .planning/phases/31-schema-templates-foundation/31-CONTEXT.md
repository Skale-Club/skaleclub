# Phase 31: Schema & Templates Foundation - Context

**Gathered:** 2026-05-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Create the `notification_templates` DB table, migrate the 3 existing hardcoded Twilio notification messages into DB-stored seed rows (6 rows: 3 events × 2 channels), and build a shared dispatcher service (`server/lib/notifications.ts`) that replaces 4 direct Twilio call sites. After this phase, callers never deal with message text — they call `dispatchNotification(storage, eventKey, vars)`.

</domain>

<decisions>
## Implementation Decisions

### Seeding Strategy
- **D-01:** Use a raw SQL migration script (`script/seed-notification-templates.ts`) to insert the 6 initial template rows — matches the Phase 6/9 pattern, explicit and prod-safe. Requires a one-time manual run step documented in the plan.

### Dispatcher Storage Access
- **D-02:** Inject `storage` as the first parameter — `dispatchNotification(storage, eventKey, vars)`. Clean, testable, consistent with how routes already call `storage.getTwilioSettings()` inline.

### Caller Refactor Depth
- **D-03:** Full replacement at all 4 call sites (3 in `server/routes.ts`, 1 in `server/lib/lead-processing.ts`). All sites switch from `sendHotLeadNotification(twilioSettings, lead)` style to `dispatchNotification(storage, 'hot_lead', vars)`. The existing 3 Twilio export functions in `server/integrations/twilio.ts` are kept internally but no longer called directly by routes.

### Template Variable Sets (locked per event)
- **D-04:** Variable tokens per event key:
  - `new_chat`: `{{company}}`, `{{conversationId}}`, `{{pageUrl}}`
  - `hot_lead`: `{{company}}`, `{{name}}`, `{{phone}}`, `{{classification}}`
  - `low_perf_alert`: `{{company}}`, `{{avgTime}}`, `{{samples}}`
- Unknown tokens render as empty string — no crash.

### Channel Values
- **D-05:** `channel` column is `text` constrained to `'sms'` | `'telegram'` — no enum type (matches settings.ts conventions, avoids migration complexity on future channel additions).

### Claude's Discretion
- Template body text for the 6 seed rows: preserve current hardcoded message text from `server/integrations/twilio.ts` exactly. Telegram rows can use the same text initially with Markdown formatting (`*bold*`) added where appropriate.
- Whether to add a `name` column to `notification_templates` for display in Phase 33 UI — planner decides based on what Phase 33 needs.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/milestones/v1.8-REQUIREMENTS.md` — NOTIF-01 through NOTIF-05 define what this phase must deliver

### Existing Notification Code (to be replaced)
- `server/integrations/twilio.ts` — 3 functions with hardcoded message bodies; lines 95-169
- `server/routes.ts:417-421` — hot_lead Twilio call site
- `server/routes.ts:715-720` — low_perf_alert Twilio call site
- `server/routes.ts:930-933` — new_chat Twilio call site (fire-and-forget pattern)
- `server/lib/lead-processing.ts:32-35` — hot_lead second call site

### Schema Patterns to Follow
- `shared/schema/settings.ts:20-31` — TwilioSettings table definition pattern
- `shared/schema/hub.ts` — most recent schema file; follow same import/export conventions
- `shared/schema.ts` — barrel re-export; Phase 31 must add `notifications.ts` to it

### Migration Script Pattern
- `.planning/phases/06-db-schema-storage-layer/` — Phase 6 raw SQL migration approach (tsx script + drizzle-kit push alternative)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `storage.getTwilioSettings()` — called by dispatcher to get SMS config; already exists in `server/storage.ts:902`
- `storage.getCompanySettings()` — called by dispatcher to get `companyName` for `{{company}}` variable
- `server/integrations/twilio.ts:sendSms()` — internal function dispatcher calls for SMS channel; keep this, just stop exporting the 3 high-level functions to routes

### Established Patterns
- Settings tables use `serial` PK, `boolean enabled`, timestamps — follow for `notification_templates`
- All `shared/schema/` files use named exports + type exports; barrel re-exported from `shared/schema.ts`
- Route files in `server/routes/` use `registerXRoutes(app, storage)` signature — dispatcher follows same injection pattern

### Integration Points
- `server/lib/notifications.ts` (new file) — dispatcher lives here, imported by routes and lead-processing
- `shared/schema/notifications.ts` (new file) — Drizzle table + Zod schemas
- `server/storage.ts` — add `getNotificationTemplates(eventKey?)` and `upsertNotificationTemplate()` methods to `IStorage` interface + `DatabaseStorage` class

</code_context>

<specifics>
## Specific Notes

- The fire-and-forget pattern at `routes.ts:932` (`sendNewChatNotification(...).catch(...)`) must be preserved for the `new_chat` event — dispatcher call wraps in the same `.catch()` pattern.
- Seed script inserts all 6 rows with `active = true` — admins can deactivate channels via Phase 33 UI later.
- Telegram seed rows are created now (Phase 31) but the Telegram channel dispatcher branch is a no-op stub until Phase 32 wires up `server/integrations/telegram.ts`.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 31-schema-templates-foundation*
*Context gathered: 2026-05-04*
