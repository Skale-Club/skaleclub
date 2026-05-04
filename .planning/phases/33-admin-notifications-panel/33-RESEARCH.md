# Phase 33: Admin Notifications Panel - Research

**Researched:** 2026-05-04
**Domain:** Admin dashboard section wiring + Express route file + React state management for per-row template editing
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01: Event Card Layout — One card per event, channel rows stacked inside**
Three cards total (one per `eventKey`: `new_chat`, `hot_lead`, `low_perf_alert`). Each card shows:
- Event name + description header
- Active channel badges (SMS / Telegram) derived from the rows' `active` field
- Two stacked channel rows (SMS, then Telegram) — each row contains:
  - Channel label + active Toggle (Switch)
  - Textarea for template `body`
  - Variable reference badge list (see D-03)
  - Per-channel Save button

Pattern: Co-located in `NotificationsSection.tsx` (single file, consistent with BlogSection + IntegrationsSection patterns).

**D-02: Admin Section Registration — Follow skaleHub pattern exactly**
Four changes needed in parallel:
1. `client/src/components/admin/shared/types.ts` — add `'notifications'` to `AdminSection` union
2. `client/src/components/admin/shared/constants.ts` — add entry to `SIDEBAR_MENU_ITEMS` (id: 'notifications', icon: Bell from lucide-react)
3. `client/src/pages/Admin.tsx` — add to both `slugMap` objects (`notifications: 'notifications'` both directions) and add render condition
4. `client/src/components/admin/AdminSidebar.tsx` — add `'notifications'` to `sectionsWithOwnHeader` array

TypeScript exhaustiveness: `Record<AdminSection, string>` on the second slugMap — both slugMaps MUST be updated simultaneously (Phase 8 lesson: partial update causes TS error).

**D-03: Variable Reference — Badge list below each channel textarea**
Per-event variable map (hardcoded in component, not from API):
- `new_chat`: `{{company}}`, `{{conversationId}}`, `{{pageUrl}}`
- `hot_lead`: `{{company}}`, `{{name}}`, `{{phone}}`, `{{classification}}`
- `low_perf_alert`: `{{company}}`, `{{avgTime}}`, `{{samples}}`

Display as small monospace badge pills below the textarea. Clicking a badge copies `{{variable}}` to clipboard (nice-to-have, Claude's discretion).

**D-04: API Routes — New `server/routes/notifications.ts` file**
Two routes, registered via `registerNotificationRoutes(app)` in `server/routes.ts`:
- `GET /api/notifications/templates` — calls `storage.getNotificationTemplates()` (no filter), returns all rows. Requires `requireAdmin`.
- `PUT /api/notifications/templates/:id` — updates `body` and/or `active` for a single template row via `storage.upsertNotificationTemplate({ id, ...fields })`. Requires `requireAdmin`. Zod-validates body with `insertNotificationTemplateSchema` extended with optional `id`.

Registration order: after `registerIntegrationRoutes` (line ~137 in server/routes.ts).

**D-05: Frontend Data Strategy — GET all, group by eventKey on client**
`useQuery` with key `['/api/notifications/templates']` fetches all rows. Client groups by `eventKey`.

**D-06: Save Semantics — Per-channel individual save**
Each channel row has its own Save button that calls `PUT /api/notifications/templates/:id` with that row's updated `body` and `active` — invalidates `['/api/notifications/templates']` query on success.

### Claude's Discretion
- Exact card styling (use existing Card/CardContent primitives, SectionHeader pattern)
- Event display names (e.g., "new_chat" → "New Chat", "hot_lead" → "Hot Lead", "low_perf_alert" → "Low Performance Alert")
- Whether clicking a variable badge copies it to clipboard — include if trivial
- Error state display within each channel row

### Deferred Ideas (OUT OF SCOPE)
- Notification delivery history/log — explicitly out of scope in v1.8 requirements
- Per-admin recipient routing — out of scope
- Email channel — separate integration, future milestone
- Preview/test send from the Notifications panel — useful but not in NOTIF-10–13
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| NOTIF-10 | Admin dashboard gains a `Notifications` section listing all notification events, each showing: event name, active channels (SMS / Telegram badges), and an Edit button | Section registration pattern in 4 files confirmed; badge derivation from `active` field on each row |
| NOTIF-11 | Clicking Edit opens an inline editor showing template body per channel — admin can edit text, toggle active, and save | Per-channel inline editor within each card; Switch + Textarea + Save pattern confirmed from TelegramSection |
| NOTIF-12 | Template editor displays available variables for each event as a reference list | Hardcoded `EVENT_VARIABLES` map in component; monospace badge pills below textarea |
| NOTIF-13 | Saving a template persists to DB and the next triggered notification uses the new text without server restart | `PUT /api/notifications/templates/:id` → `storage.upsertNotificationTemplate({id, ...})` → update path confirmed in storage.ts lines 2854–2870 |
</phase_requirements>

---

## Summary

Phase 33 adds a `Notifications` section to the admin dashboard. All prerequisite infrastructure is already built (DB table, storage methods, dispatcher). This phase is purely additive: one new route file, one new React section component, and wiring changes across four existing files.

The work splits cleanly into two tracks: (1) server — new `server/routes/notifications.ts` with two endpoints, registered in `server/routes.ts`; (2) client — new `NotificationsSection.tsx` with three event cards, each containing two channel rows (SMS + Telegram), plus the four-file admin section registration.

The most critical pitfall is the TypeScript exhaustiveness trap: the second `slugMap` in `Admin.tsx` is typed `Record<AdminSection, string>`, so adding `'notifications'` to the union without simultaneously adding it to that map will cause a compile error. All four registration files must be updated atomically.

**Primary recommendation:** Implement as two sequential plans — Plan 01: server route + registration; Plan 02: client section component + all four wiring files.

---

## Standard Stack

### Core (all already present in project)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Express | 4.21.2 | HTTP routing for `registerNotificationRoutes` | Project framework |
| Drizzle ORM | 0.39.3 | DB access via `storage.getNotificationTemplates` / `upsertNotificationTemplate` | Project ORM |
| Zod | 3.24.2 | Route-layer validation on PUT body | Project validation standard |
| TanStack React Query | 5.60.5 | `useQuery` fetch + `queryClient.invalidateQueries` on save | Project data-fetching standard |
| shadcn/ui | — | `Card`, `Switch`, `Textarea`, `Button`, `Badge` | Project UI system |
| lucide-react | 0.453.0 | `Bell` icon for sidebar entry | Project icon library |

### No New Dependencies
All required primitives are already installed. The `Bell` icon is available from `lucide-react` (confirmed in imports across the codebase). `Textarea` component confirmed at `client/src/components/ui/textarea.tsx`.

---

## Architecture Patterns

### Route File Pattern (from `server/routes/skaleHub.ts`)

The canonical route file structure is:

```typescript
// server/routes/notifications.ts
import type { Express } from "express";
import { storage } from "../storage.js";
import { insertNotificationTemplateSchema } from "#shared/schema.js";
import { requireAdmin } from "./_shared.js";

export function registerNotificationRoutes(app: Express) {
  app.get("/api/notifications/templates", requireAdmin, async (_req, res) => {
    try {
      const templates = await storage.getNotificationTemplates();
      return res.json(templates);
    } catch (err) {
      return res.status(500).json({ message: (err as Error).message });
    }
  });

  app.put("/api/notifications/templates/:id", requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ message: "Invalid template id" });
      }
      const updateSchema = insertNotificationTemplateSchema.partial().extend({
        id: z.number().int().positive(),
      });
      const parsed = updateSchema.safeParse({ ...req.body, id });
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0].message });
      }
      const updated = await storage.upsertNotificationTemplate(parsed.data);
      return res.json(updated);
    } catch (err) {
      return res.status(500).json({ message: (err as Error).message });
    }
  });
}
```

Key observations from skaleHub.ts:
- `import type { Express } from "express"` (not `Request` unless needed)
- `requireAdmin` imported from `./_shared.js`
- `storage` imported from `../storage.js`
- Schema imported from `#shared/schema.js`
- `try/catch` on every handler, returns `res.status(500).json({ message: (err as Error).message })`
- `safeParse` pattern with early return on failure (not `parse` which throws)
- Exported as named function `registerXxxRoutes(app: Express)`

### Route Registration in `server/routes.ts`

Current registration order (lines 125–142):
```
registerXpotRoutes → registerPortfolioRoutes → ... → registerIntegrationRoutes →
registerEstimatesRoutes → registerSkaleHubRoutes → registerPresentationsRoutes → ...
```

The decision (D-04) is to register `registerNotificationRoutes` after `registerIntegrationRoutes`. Looking at the actual file, `registerIntegrationRoutes` is at line 137. The new line goes between line 137 and 138:

```typescript
// Line 24 area — import:
import { registerNotificationRoutes } from "./routes/notifications.js";

// Line 137 area — call:
registerIntegrationRoutes(app);
registerNotificationRoutes(app);   // ← insert here
registerEstimatesRoutes(app);
```

### Admin Section Registration (4 files, all at once)

**File 1: `client/src/components/admin/shared/types.ts`**
Add `'notifications'` to the `AdminSection` union (line 22, after `'skaleHub'`):
```typescript
| 'skaleHub'
| 'notifications';
```

**File 2: `client/src/components/admin/shared/constants.ts`**
Import `Bell` and add entry to `SIDEBAR_MENU_ITEMS` array. Current last entry is `skaleHub`. Add after it:
```typescript
import { ..., Bell } from 'lucide-react';
// In SIDEBAR_MENU_ITEMS array:
{ id: 'notifications', title: 'Notifications', description: 'Configure notification templates for SMS and Telegram alerts', icon: Bell },
```

**File 3: `client/src/pages/Admin.tsx` — TWO slugMaps**

SlugMap 1 (line ~43, `Record<string, AdminSection>` — no exhaustiveness, just add the entry):
```typescript
notifications: 'notifications',
```

SlugMap 2 (line ~99, `Record<AdminSection, string>` — EXHAUSTIVE, TS error if missing):
```typescript
notifications: 'notifications',
```

Render condition (after line 230, `{activeSection === 'skaleHub' && <SkaleHubSection />}`):
```typescript
{activeSection === 'notifications' && <NotificationsSection />}
```

Import at top:
```typescript
import { NotificationsSection } from '@/components/admin/NotificationsSection';
```

**File 4: `client/src/pages/Admin.tsx` — `sectionsWithOwnHeader`**

CRITICAL LOCATION FINDING: `sectionsWithOwnHeader` is defined in `Admin.tsx` at line 203, NOT in `AdminSidebar.tsx`. The CONTEXT.md canonical reference to "AdminSidebar.tsx line ~203" is incorrect. The array is inline inside the `{activeSection !== 'chat' && ...}` block in `Admin.tsx`.

Add `'notifications'` to the array:
```typescript
const sectionsWithOwnHeader: AdminSection[] = [
  'leads', 'forms', 'faqs', 'users', 'blog', 'portfolio', 'links', 'vcards',
  'fieldSales', 'estimates', 'company', 'website', 'seo', 'integrations',
  'presentations', 'skaleHub', 'notifications'  // ← add here
];
```

### Frontend Component Pattern

Local state model per channel row (mirrors TelegramSection's controlled-state approach):

```typescript
// NotificationsSection.tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { SectionHeader } from './shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Loader2 } from '@/components/ui/loader';
import type { NotificationTemplate } from '@shared/schema';

// Grouping helper
const grouped = templates.reduce((acc, t) => {
  if (!acc[t.eventKey]) acc[t.eventKey] = [];
  acc[t.eventKey].push(t);
  return acc;
}, {} as Record<string, NotificationTemplate[]>);
```

Per-row save mutation follows TelegramSection pattern exactly:
```typescript
const handleSave = async (template: NotificationTemplate, body: string, active: boolean) => {
  setSaving(template.id, true);
  try {
    await apiRequest('PUT', `/api/notifications/templates/${template.id}`, { body, active });
    queryClient.invalidateQueries({ queryKey: ['/api/notifications/templates'] });
    toast({ title: 'Template saved' });
  } catch (err: any) {
    toast({ title: 'Failed to save', description: err.message, variant: 'destructive' });
  } finally {
    setSaving(template.id, false);
  }
};
```

### Handling Multiple `isSaving` States

Because there are 6 rows (3 events × 2 channels), each with its own Save button, a single `isSaving: boolean` is insufficient. Use a `Record<number, boolean>` keyed by template `id`:

```typescript
const [savingIds, setSavingIds] = useState<Record<number, boolean>>({});
const setSaving = (id: number, val: boolean) =>
  setSavingIds(prev => ({ ...prev, [id]: val }));
```

Similarly, local edits need a `Record<number, { body: string; active: boolean }>` draft state, initialized from query data via `useEffect`.

### Anti-Patterns to Avoid

- **Mutating query cache directly:** Always call `queryClient.invalidateQueries` after PUT — never set cache manually.
- **Single `isSaving` boolean:** With 6 save buttons on screen simultaneously, sharing a single boolean disables all of them when one is saving. Use per-id tracking.
- **Partial slugMap update:** Adding `'notifications'` only to the first slugMap but not the second causes TS2322 because the second is `Record<AdminSection, string>` (exhaustive). Both must be updated in the same edit.
- **Skipping `sectionsWithOwnHeader`:** If `'notifications'` is not added to this array in `Admin.tsx`, the generic `<SectionHeader>` renders twice — once from the array check and once from within `NotificationsSection.tsx` itself.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Admin auth check on routes | Custom session check | `requireAdmin` from `./_shared.js` | Shared middleware, already tested pattern |
| Zod validation in route | Manual `typeof` checks | `insertNotificationTemplateSchema.partial().extend({id})` | Schema already defined in `shared/schema/notifications.ts` |
| Toast notifications | Custom alert UI | `useToast` from `@/hooks/use-toast` | Project-wide pattern, handles variants |
| Query invalidation | Manual refetch | `queryClient.invalidateQueries` | TanStack Query standard; safe for concurrent updates |
| Active toggle | Custom checkbox | `Switch` from `@/components/ui/switch` | Already used in TelegramSection for same pattern |

---

## Storage Method Signatures (Verified)

From `server/storage.ts` lines 801–803 (IStorage interface) and 2846–2870 (DatabaseStorage):

```typescript
// Interface
getNotificationTemplates(eventKey?: string): Promise<NotificationTemplate[]>;
upsertNotificationTemplate(template: InsertNotificationTemplate & { id?: number }): Promise<NotificationTemplate>;

// Implementation — id-present check (update vs insert)
async upsertNotificationTemplate(template: InsertNotificationTemplate & { id?: number }) {
  if (template.id) {
    // UPDATE with .returning()
  } else {
    // INSERT with .returning()
  }
}
```

The PUT route sends `{ id, body, active }` — the `id` comes from `req.params.id` (parsed to number), not from the request body, then merged into the Zod-parsed object before calling storage. This matches the `upsertBrandGuidelines/upsertBlogSettings` patterns cited in STATE.md.

---

## Schema (Verified)

From `shared/schema/notifications.ts`:

```typescript
export type NotificationTemplate = typeof notificationTemplates.$inferSelect;
// Fields: id (number), eventKey (string), channel (string), body (string),
//         active (boolean), createdAt (Date|null), updatedAt (Date|null)

export const insertNotificationTemplateSchema = z.object({
  eventKey: z.string().min(1).max(100),
  channel: z.enum(["sms", "telegram"]),
  body: z.string().min(1),
  active: z.boolean().default(true),
});
```

The `NotificationTemplate` type is re-exported from `shared/schema.ts` via `export * from "./schema/notifications.js"`. Client imports from `@shared/schema` work without any barrel changes.

---

## Common Pitfalls

### Pitfall 1: TS Exhaustiveness on Second slugMap
**What goes wrong:** TypeScript error `TS2322: Type 'AdminSection' is not assignable to type 'never'` or property missing error on `Record<AdminSection, string>`.
**Why it happens:** The second `slugMap` in `Admin.tsx` (line ~99) is explicitly typed `Record<AdminSection, string>` — TypeScript enforces that every member of the union has a key.
**How to avoid:** Update BOTH slugMaps in the same edit. The first map (`Record<string, AdminSection>`) is not exhaustive and will not error if you miss it, but the second will.
**Warning signs:** `npm run check` fails with "Property 'notifications' is missing in type..." immediately after adding to the union.

### Pitfall 2: `sectionsWithOwnHeader` Is in Admin.tsx, Not AdminSidebar.tsx
**What goes wrong:** Developer searches AdminSidebar.tsx for `sectionsWithOwnHeader`, finds nothing, skips the step, and the section renders a duplicate header (generic SectionHeader above and NotificationsSection's own SectionHeader inside).
**Why it happens:** CONTEXT.md canonical refs mention "AdminSidebar.tsx line ~203" — this is incorrect. The array is defined inline in `Admin.tsx` at line 203.
**How to avoid:** Edit the `sectionsWithOwnHeader` array on line 203 of `Admin.tsx` (same file as the render conditions). Confirmed by codebase search.

### Pitfall 3: Single `isSaving` State for 6 Save Buttons
**What goes wrong:** Clicking Save on any channel disables all 6 Save buttons simultaneously; UX is broken.
**Why it happens:** Copying TelegramSection's `const [isSaving, setIsSaving] = useState(false)` pattern directly works for a single button but not for a grid.
**How to avoid:** Use `Record<number, boolean>` keyed by template id.

### Pitfall 4: `insertNotificationTemplateSchema` Requires `body: string().min(1)`
**What goes wrong:** PUT request with an empty `body` string passes the route but Zod rejects it, returning 400.
**Why it happens:** The schema has `.min(1)` on `body`. An accidental empty textarea triggers this.
**How to avoid:** Disable the Save button when `body.trim() === ''`. This is a client-side guard — the server-side Zod rejection is the safety net.

### Pitfall 5: `channel` Field Is `z.enum(["sms", "telegram"])` in insertSchema
**What goes wrong:** PUT body passes `channel` as part of the Zod validation, but the DB rows' channel field is already set and should not be overwritten by the PUT.
**Why it happens:** The full `insertNotificationTemplateSchema` includes `channel` — if you use `.parse(req.body)` instead of `.partial()`, the client must send `channel`.
**How to avoid:** Use `.partial()` on the schema for PUT — only `body` and `active` need to be accepted and updated. The `id` comes from route param, not body.

### Pitfall 6: `z` Import Missing in notifications.ts
**What goes wrong:** TypeScript compilation error in `server/routes/notifications.ts` — `z is not defined`.
**Why it happens:** The route file needs `import { z } from "zod"` if it uses `.extend()` or `.partial()` on the schema inline. skaleHub.ts doesn't use Zod inline (it imports full schemas), so it doesn't import `z` directly.
**How to avoid:** Add `import { z } from "zod";` to notifications.ts alongside the schema import.

---

## Code Examples

### Complete Route File Skeleton
```typescript
// server/routes/notifications.ts
import type { Express } from "express";
import { z } from "zod";
import { storage } from "../storage.js";
import { insertNotificationTemplateSchema } from "#shared/schema.js";
import { requireAdmin } from "./_shared.js";

export function registerNotificationRoutes(app: Express) {
  app.get("/api/notifications/templates", requireAdmin, async (_req, res) => {
    try {
      return res.json(await storage.getNotificationTemplates());
    } catch (err) {
      return res.status(500).json({ message: (err as Error).message });
    }
  });

  app.put("/api/notifications/templates/:id", requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ message: "Invalid template id" });
      }
      const updateSchema = insertNotificationTemplateSchema.partial();
      const parsed = updateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0].message });
      }
      const updated = await storage.upsertNotificationTemplate({ ...parsed.data, id });
      return res.json(updated);
    } catch (err) {
      return res.status(500).json({ message: (err as Error).message });
    }
  });
}
```

### Registration in `server/routes.ts`
```typescript
// Import (line ~32 area, after existing imports):
import { registerNotificationRoutes } from "./routes/notifications.js";

// Call (after registerIntegrationRoutes, line ~138):
registerIntegrationRoutes(app);
registerNotificationRoutes(app);
registerEstimatesRoutes(app);
```

### Client Draft State Pattern
```typescript
// NotificationsSection.tsx
type DraftState = { body: string; active: boolean };
const [drafts, setDrafts] = useState<Record<number, DraftState>>({});
const [savingIds, setSavingIds] = useState<Record<number, boolean>>({});

// Initialize drafts from query data
useEffect(() => {
  if (templates) {
    const initial: Record<number, DraftState> = {};
    templates.forEach(t => { initial[t.id] = { body: t.body, active: t.active }; });
    setDrafts(initial);
  }
}, [templates]);
```

### Variable Badge with Clipboard Copy
```typescript
const EVENT_VARIABLES: Record<string, string[]> = {
  new_chat: ['{{company}}', '{{conversationId}}', '{{pageUrl}}'],
  hot_lead: ['{{company}}', '{{name}}', '{{phone}}', '{{classification}}'],
  low_perf_alert: ['{{company}}', '{{avgTime}}', '{{samples}}'],
};

// Render:
{EVENT_VARIABLES[eventKey]?.map(v => (
  <button
    key={v}
    type="button"
    onClick={() => navigator.clipboard.writeText(v)}
    className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded border border-border hover:bg-muted/80 transition-colors"
    title="Click to copy"
  >
    {v}
  </button>
))}
```

---

## Environment Availability

Step 2.6: SKIPPED — this phase is purely code/config changes with no external CLI or service dependencies beyond what the project already uses.

---

## Validation Architecture

`nyquist_validation` not explicitly set to false in `.planning/config.json` — section included.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Manual QA only (CLAUDE.md: "Manual QA only — no test framework available") |
| Config file | None |
| Quick run command | `npm run check` (TypeScript only) |
| Full suite command | `npm run check` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | Notes |
|--------|----------|-----------|-------------------|-------|
| NOTIF-10 | Notifications section appears in sidebar, navigating to `/admin/notifications` renders section | manual | `npm run check` (TS) | Navigate in browser |
| NOTIF-11 | Each event card shows two channel rows; Switch toggles active; Textarea editable; Save button per channel | manual | `npm run check` (TS) | Edit body text + toggle + save |
| NOTIF-12 | Variable badges appear below textarea for each event | manual | `npm run check` (TS) | Visual inspection |
| NOTIF-13 | After save, next notification dispatch uses new template body | manual | — | Trigger a chat event, check SMS/Telegram |

### Wave 0 Gaps
None — no test infrastructure needed beyond `npm run check`.

---

## Open Questions

1. **Zod schema strictness for PUT body**
   - What we know: `insertNotificationTemplateSchema.partial()` accepts `body` and `active` as optional, plus `eventKey` and `channel` (also optional after `.partial()`).
   - What's unclear: Should the PUT route explicitly reject unexpected keys (use `.strict()`)? 
   - Recommendation: No `.strict()` needed — Express doesn't forward unknown body keys to the DB since we destructure only what storage needs.

2. **`Bell` icon availability in lucide-react 0.453.0**
   - What we know: `Bell` is a core lucide-react icon available since v0.1.
   - What's unclear: Nothing — this is well-established.
   - Recommendation: HIGH confidence, use `Bell` from `lucide-react`.

---

## Sources

### Primary (HIGH confidence — direct code read)
- `shared/schema/notifications.ts` — `NotificationTemplate` type, `insertNotificationTemplateSchema` (lines 1–38, read directly)
- `server/storage.ts` lines 801–803, 2846–2870 — storage interface + implementation (read directly)
- `server/routes/skaleHub.ts` — complete route file pattern (read directly)
- `server/routes.ts` lines 1–50, 125–149 — import/register pattern (read directly)
- `server/routes/_shared.ts` — `requireAdmin` signature (read directly)
- `client/src/components/admin/shared/types.ts` — `AdminSection` union (read directly)
- `client/src/components/admin/shared/constants.ts` — `SIDEBAR_MENU_ITEMS` (read directly)
- `client/src/pages/Admin.tsx` lines 1–250 — both slugMaps + `sectionsWithOwnHeader` + render conditions (read directly)
- `client/src/components/admin/AdminSidebar.tsx` — confirmed `sectionsWithOwnHeader` is NOT here
- `client/src/components/admin/TelegramSection.tsx` — Switch + Input + Save button pattern (read directly)
- `client/src/components/admin/SkaleHubSection.tsx` — SectionHeader + Card + Textarea usage (read directly)
- `client/src/components/ui/textarea.tsx` — confirmed component exists at correct path
- `client/src/components/admin/shared/index.ts` — confirmed `SectionHeader`, `AdminCard`, `FormGrid` barrel exports
- `shared/schema.ts` — confirmed `export * from "./schema/notifications.js"` barrel re-export

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified present via direct file reads; no new dependencies needed
- Architecture: HIGH — route file pattern, storage signatures, and wiring locations all verified from source files
- Pitfalls: HIGH — TypeScript exhaustiveness trap confirmed from STATE.md Phase 8 lesson and verified in Admin.tsx source; `sectionsWithOwnHeader` location corrected from CONTEXT.md via codebase search

**Research date:** 2026-05-04
**Valid until:** 2026-06-04 (stable project, 30-day window)

---

## Key Correction from Source Verification

**CONTEXT.md says:** `client/src/components/admin/AdminSidebar.tsx` line ~203 — `sectionsWithOwnHeader` array

**Source code shows:** `sectionsWithOwnHeader` is defined in `client/src/pages/Admin.tsx` at **line 203**, not in AdminSidebar.tsx at all. AdminSidebar.tsx has no such array — it is a pure rendering component that receives data via props. The planner must target `Admin.tsx` for this change, not `AdminSidebar.tsx`.
