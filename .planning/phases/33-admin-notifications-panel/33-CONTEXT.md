# Phase 33: Admin Notifications Panel - Context

**Gathered:** 2026-05-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Add a `Notifications` section to the admin dashboard where admins can view all notification events, edit template body text per channel, toggle channels active/inactive, and save. A `PUT /api/notifications/templates/:id` route persists changes to the `notification_templates` table — no server restart required. A `GET /api/notifications/templates` route returns all rows for the section to render.

This phase does NOT include: Telegram bot config UI (done in Phase 32), any new notification events, notification history/delivery logs.

</domain>

<decisions>
## Implementation Decisions

### D-01: Event Card Layout — One card per event, channel rows stacked inside
Three cards total (one per `eventKey`: `new_chat`, `hot_lead`, `low_perf_alert`). Each card shows:
- Event name + description header
- Active channel badges (SMS / Telegram) derived from the rows' `active` field
- Two stacked channel rows (SMS, then Telegram) — each row contains:
  - Channel label + active Toggle (Switch)
  - Textarea for template `body`
  - Variable reference badge list (see D-03)
  - Per-channel Save button

Pattern: Co-located in `NotificationsSection.tsx` (single file, consistent with BlogSection + IntegrationsSection patterns).

### D-02: Admin Section Registration — Follow skaleHub pattern exactly
Four changes needed in parallel:
1. `client/src/components/admin/shared/types.ts` — add `'notifications'` to `AdminSection` union
2. `client/src/components/admin/shared/constants.ts` — add entry to `SIDEBAR_MENU_ITEMS` (id: 'notifications', icon: Bell from lucide-react)
3. `client/src/pages/Admin.tsx` — add to both `slugMap` objects (`notifications: 'notifications'` both directions) and add render condition
4. `client/src/components/admin/AdminSidebar.tsx` — add `'notifications'` to `sectionsWithOwnHeader` array (line ~203)

TypeScript exhaustiveness: `Record<AdminSection, string>` on the second slugMap — both slugMaps MUST be updated simultaneously (Phase 8 lesson: partial update causes TS error).

### D-03: Variable Reference — Badge list below each channel textarea
Per-event variable map (hardcoded in component, not from API):
- `new_chat`: `{{company}}`, `{{conversationId}}`, `{{pageUrl}}`
- `hot_lead`: `{{company}}`, `{{name}}`, `{{phone}}`, `{{classification}}`
- `low_perf_alert`: `{{company}}`, `{{avgTime}}`, `{{samples}}`

Display as small monospace badge pills below the textarea. Clicking a badge copies `{{variable}}` to clipboard (nice-to-have, Claude's discretion).

### D-04: API Routes — New `server/routes/notifications.ts` file
Two routes, registered via `registerNotificationRoutes(app)` in `server/routes.ts`:
- `GET /api/notifications/templates` — calls `storage.getNotificationTemplates()` (no filter), returns all rows. Requires `requireAdmin`.
- `PUT /api/notifications/templates/:id` — updates `body` and/or `active` for a single template row via `storage.upsertNotificationTemplate({ id, ...fields })`. Requires `requireAdmin`. Zod-validates body with `insertNotificationTemplateSchema` extended with optional `id`.

Registration order: after `registerIntegrationRoutes` (line ~137 in server/routes.ts).

### D-05: Frontend Data Strategy — GET all, group by eventKey on client
`useQuery` with key `['/api/notifications/templates']` fetches all rows. Client groups by `eventKey`:
```
const grouped = templates.reduce((acc, t) => {
  if (!acc[t.eventKey]) acc[t.eventKey] = [];
  acc[t.eventKey].push(t);
  return acc;
}, {} as Record<string, NotificationTemplate[]>);
```
Each event card iterates channels ['sms', 'telegram'] — finds matching row from grouped data. If no row exists for a channel, show disabled/grayed row (seed data guarantees all 6 rows exist, so this is a safety fallback only).

### D-06: Save Semantics — Per-channel individual save
Each channel row has its own Save button that calls `PUT /api/notifications/templates/:id` with that row's updated `body` and `active` — invalidates `['/api/notifications/templates']` query on success. No "save all" button.

Rationale: Independent saves prevent accidental overwrites when editing multiple channels. Matches existing admin pattern (EstimatesSection, TelegramSection all save individually).

### Claude's Discretion
- Exact card styling (use existing Card/CardContent primitives, SectionHeader pattern)
- Event display names (e.g., "new_chat" → "New Chat", "hot_lead" → "Hot Lead", "low_perf_alert" → "Low Performance Alert")
- Whether clicking a variable badge copies it to clipboard — include if trivial
- Error state display within each channel row

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Schema & Storage (already built — read before implementing API)
- `shared/schema/notifications.ts` — `notificationTemplates` table, `insertNotificationTemplateSchema`, `NotificationTemplate` type
- `server/storage.ts` lines 802–803 — IStorage: `getNotificationTemplates(eventKey?)`, `upsertNotificationTemplate(template)` signatures
- `server/storage.ts` lines 2846–2870 — DatabaseStorage implementations

### Route Registration Pattern
- `server/routes.ts` lines 19–32, 129–139 — import + register pattern for new route files
- `server/routes/skaleHub.ts` — recent route file example (mirrors structure to use for notifications.ts)
- `server/routes/integrations.ts` lines 619–695 — requireAdmin + Zod validation pattern

### Admin Section Registration Pattern (ALL four files must change together)
- `client/src/components/admin/shared/types.ts` — AdminSection union type (add 'notifications')
- `client/src/components/admin/shared/constants.ts` — SIDEBAR_MENU_ITEMS array (add entry)
- `client/src/pages/Admin.tsx` — both slugMaps + render condition (add 'notifications')
- `client/src/components/admin/AdminSidebar.tsx` line ~203 — sectionsWithOwnHeader array

### UI Component Patterns
- `client/src/components/admin/SkaleHubSection.tsx` — recent section example (SectionHeader + Card layout)
- `client/src/components/admin/TelegramSection.tsx` — Switch + Input + Save button pattern (just built)
- `client/src/components/admin/shared/` — SectionHeader, FormGrid, AdminCard primitives

### Requirements
- `.planning/milestones/v1.8-REQUIREMENTS.md` NOTIF-10, NOTIF-11, NOTIF-12, NOTIF-13

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SectionHeader` from `./shared` — title/description/icon header used in all sections
- `Card`, `CardContent`, `CardHeader`, `CardTitle` from `@/components/ui/card`
- `Switch` from `@/components/ui/switch` — active toggle (used in TelegramSection)
- `Textarea` from `@/components/ui/textarea` — for template body editing
- `Button` from `@/components/ui/button` — Save button per channel
- `useToast` — success/error feedback
- `apiRequest`, `queryClient` from `@/lib/queryClient` — data fetching + mutation + invalidation
- `Bell` icon from `lucide-react` — for the sidebar menu entry

### Established Patterns
- **Section co-location**: All components in single `NotificationsSection.tsx` file (consistent with BlogSection, EstimatesSection)
- **Query key = API path**: `queryKey: ['/api/notifications/templates']`
- **Individual row save**: Per-item save button (not "save all") — consistent with TelegramSection, EstimatesSection
- **requireAdmin middleware**: All admin-write routes gated (see integrations.ts)
- **Express route file**: Named `register*Routes(app)` function exported from `server/routes/`.

### Integration Points
- `server/routes.ts` — import + register `registerNotificationRoutes`
- `client/src/components/admin/shared/types.ts` — AdminSection union
- `client/src/components/admin/shared/constants.ts` — SIDEBAR_MENU_ITEMS
- `client/src/pages/Admin.tsx` — both slugMaps + render condition
- `client/src/components/admin/AdminSidebar.tsx` — sectionsWithOwnHeader

</code_context>

<specifics>
## Specific Ideas

- Event display name map (hardcode in component):
  ```ts
  const EVENT_LABELS: Record<string, string> = {
    new_chat: 'New Chat',
    hot_lead: 'Hot Lead',
    low_perf_alert: 'Low Performance Alert',
  };
  const EVENT_DESCRIPTIONS: Record<string, string> = {
    new_chat: 'Sent when a new visitor starts a chat conversation',
    hot_lead: 'Sent when a lead is classified as hot',
    low_perf_alert: 'Sent when chat response time exceeds threshold',
  };
  ```
- Channel display: `sms` → "SMS (Twilio)", `telegram` → "Telegram"
- Seed data guarantees 6 rows exist (3 events × 2 channels) — no empty-state needed for the rows themselves
- `NotificationTemplate` type already exported from `shared/schema/notifications.ts` via barrel in `shared/schema.ts`

</specifics>

<deferred>
## Deferred Ideas

- Notification delivery history/log — explicitly out of scope in v1.8 requirements
- Per-admin recipient routing — out of scope
- Email channel — separate integration, future milestone
- Preview/test send from the Notifications panel — useful but not in NOTIF-10–13; Claude's discretion to include a simple test button if trivial

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 33-admin-notifications-panel*
*Context gathered: 2026-05-04*
