# Phase 31: Schema & Templates Foundation - Research

**Researched:** 2026-05-04
**Domain:** Drizzle ORM schema definition, PostgreSQL migration, dispatcher service pattern, Twilio integration refactor
**Confidence:** HIGH

## Summary

Phase 31 introduces a `notification_templates` table as the single source of truth for all outbound notification bodies, replaces 4 direct Twilio call sites with a shared `dispatchNotification(storage, eventKey, vars)` dispatcher, and seeds 6 rows (3 events × 2 channels). The work is entirely server-side and schema-side — no client UI, no new API routes, no DB schema changes affecting existing tables.

The codebase already has a clear canonical path for this kind of work: a `.sql` migration committed to `migrations/`, run by a `scripts/migrate-*.ts` tsx script that uses `pool.connect()`. The Drizzle schema file goes in `shared/schema/notifications.ts` and is barrel-re-exported from `shared/schema.ts`. Storage methods follow the `IStorage` interface + `DatabaseStorage` class pattern established in `server/storage.ts`. The dispatcher lives in `server/lib/notifications.ts` and receives `storage` as its first parameter (matching how lead-processing.ts and routes.ts already access DB settings).

**Primary recommendation:** Follow the Skale Hub (Phase 25) migration+schema+storage pattern exactly — SQL migration file, tsx migration script, Drizzle schema file, IStorage declarations, DatabaseStorage implementations, then dispatcher. Do NOT use the in-process `ensureXSchema()` patch approach (that is reserved for additive column patches on existing tables, not new table creation with seed data).

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Use a raw SQL migration script (`script/seed-notification-templates.ts`) to insert the 6 initial template rows — matches the Phase 6/9 pattern, explicit and prod-safe. Requires a one-time manual run step documented in the plan.
- **D-02:** Inject `storage` as the first parameter — `dispatchNotification(storage, eventKey, vars)`. Clean, testable, consistent with how routes already call `storage.getTwilioSettings()` inline.
- **D-03:** Full replacement at all 4 call sites (3 in `server/routes.ts`, 1 in `server/lib/lead-processing.ts`). All sites switch from `sendHotLeadNotification(twilioSettings, lead)` style to `dispatchNotification(storage, 'hot_lead', vars)`. The existing 3 Twilio export functions in `server/integrations/twilio.ts` are kept internally but no longer called directly by routes.
- **D-04:** Variable tokens per event key:
  - `new_chat`: `{{company}}`, `{{conversationId}}`, `{{pageUrl}}`
  - `hot_lead`: `{{company}}`, `{{name}}`, `{{phone}}`, `{{classification}}`
  - `low_perf_alert`: `{{company}}`, `{{avgTime}}`, `{{samples}}`
  - Unknown tokens render as empty string — no crash.
- **D-05:** `channel` column is `text` constrained to `'sms'` | `'telegram'` — no enum type (matches settings.ts conventions, avoids migration complexity on future channel additions).

### Claude's Discretion

- Template body text for the 6 seed rows: preserve current hardcoded message text from `server/integrations/twilio.ts` exactly. Telegram rows can use the same text initially with Markdown formatting (`*bold*`) added where appropriate.
- Whether to add a `name` column to `notification_templates` for display in Phase 33 UI — planner decides based on what Phase 33 needs.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| NOTIF-01 | `notification_templates` table with fields: `id`, `event_key`, `channel`, `body`, `active`, `created_at`, `updated_at` | Drizzle `pgTable` with `serial`, `text`, `boolean`, `timestamp` columns. SQL migration + Drizzle schema file pattern confirmed. |
| NOTIF-02 | Shared dispatcher `server/lib/notifications.ts` accepts event key + variable map, fans out to active channels | Dispatcher queries storage for templates by event_key, substitutes `{{var}}` tokens, routes to `sendSms()` (SMS) or stub (telegram). |
| NOTIF-03 | 3 existing hardcoded Twilio messages migrated to DB seed templates, existing behavior preserved | Exact message bodies extracted from `twilio.ts` lines 106-113, 136-144, 162-163. Seed script inserts them as 6 rows. |
| NOTIF-04 | `{{variable}}` token substitution, unknown tokens render as empty string | Simple `String.replace()` with regex loop — no external library needed. |
| NOTIF-05 | Drizzle/Zod contracts in `shared/schema/notifications.ts`, re-exported from `shared/schema.ts` | Follow `hub.ts` import/export conventions. Add `export * from "./schema/notifications.js"` to `shared/schema.ts`. |
</phase_requirements>

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | 0.39.3 | Table definition and query builder | Already in use — `pgTable`, `serial`, `text`, `boolean`, `timestamp` |
| zod | 3.24.2 | Runtime validation schemas | Already in use for all insert/select schemas |
| drizzle-zod | 0.7.0 | `createInsertSchema` helper | Used in `settings.ts`; available but Phase 31 uses manual Zod (matches hub.ts pattern) |
| twilio | 5.11.2 | SMS send | Already in use via `server/integrations/twilio.ts` |

### No new dependencies required.

All necessary libraries are already installed. The dispatcher uses existing `storage.getTwilioSettings()` and the internal `sendSms()` helper from `twilio.ts`. The Telegram branch is a no-op stub — no `node-telegram-bot-api` or similar needed for Phase 31.

---

## Architecture Patterns

### Established Migration Pattern (Skale Hub / Phase 25)

The canonical approach used since Phase 25 is:

1. `migrations/NNNN_description.sql` — raw SQL with `BEGIN; ... COMMIT;`, `CREATE TABLE IF NOT EXISTS`, `ENABLE ROW LEVEL SECURITY`, and `service_role_all_access` policy.
2. `scripts/migrate-description.ts` — tsx script importing `pool` from `server/db.js`, reads SQL file, runs `client.query(sql)`, verifies table existence.
3. Seed data uses a **separate script**: `scripts/seed-notification-templates.ts` — inserts 6 rows with `ON CONFLICT DO NOTHING` or `INSERT INTO ... WHERE NOT EXISTS` for idempotency.

This is distinct from the `ensureXSchema()` in-process patch approach, which is reserved only for additive `ALTER TABLE ADD COLUMN IF NOT EXISTS` patches on already-deployed tables. New table creation always goes through the SQL migration file route.

### Drizzle Schema File Pattern (shared/schema/notifications.ts)

Follow `shared/schema/hub.ts` exactly:

```typescript
// Source: shared/schema/hub.ts (lines 1-2 imports, pgTable pattern)
import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod";

export const notificationTemplates = pgTable("notification_templates", {
  id: serial("id").primaryKey(),
  eventKey: text("event_key").notNull(),
  channel: text("channel").notNull(),  // 'sms' | 'telegram' (D-05: text not enum)
  body: text("body").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()),
});

export type NotificationTemplate = typeof notificationTemplates.$inferSelect;
export type InsertNotificationTemplate = typeof notificationTemplates.$inferInsert;

// Manual Zod schema (hub.ts pattern — not drizzle-zod)
export const insertNotificationTemplateSchema = z.object({
  eventKey: z.string().min(1).max(100),
  channel: z.enum(["sms", "telegram"]),
  body: z.string().min(1),
  active: z.boolean().default(true),
});
```

**Key detail:** `$onUpdate(() => new Date())` is confirmed in `hub.ts` line 64 and 84. Use it for `updatedAt`.

### Barrel Re-export (shared/schema.ts)

Current `shared/schema.ts` has 11 lines, one per schema file. Add:

```typescript
export * from "./schema/notifications.js";
```

Note the `.js` extension — all existing exports use `.js` (ESM + bundler moduleResolution convention, confirmed in `shared/schema.ts`).

### IStorage Interface + DatabaseStorage Pattern

Add to the `IStorage` interface (after `getTwilioSettings` section, around line 641):

```typescript
// Notification Templates (NOTIF-01)
getNotificationTemplates(eventKey?: string): Promise<NotificationTemplate[]>;
upsertNotificationTemplate(template: InsertNotificationTemplate & { id?: number }): Promise<NotificationTemplate>;
```

`DatabaseStorage` implementations follow the `upsertBlogSettings` pattern (check if exists → update or insert → return).

`getNotificationTemplates` with optional `eventKey` filter:

```typescript
async getNotificationTemplates(eventKey?: string): Promise<NotificationTemplate[]> {
  if (eventKey) {
    return db.select().from(notificationTemplates)
      .where(eq(notificationTemplates.eventKey, eventKey));
  }
  return db.select().from(notificationTemplates);
}
```

### Dispatcher: server/lib/notifications.ts

```typescript
// Signature (D-02 locked)
export async function dispatchNotification(
  storage: IStorage,
  eventKey: string,
  variables: Record<string, string>
): Promise<void>
```

Internal logic:
1. Query `storage.getNotificationTemplates(eventKey)` — returns all rows for this event
2. Filter to `active === true`
3. For each active template:
   - Apply variable substitution: `substituteVariables(template.body, variables)`
   - Route by `template.channel`:
     - `'sms'`: call `storage.getTwilioSettings()`, validate, call internal `sendSms(config, body)` from twilio.ts
     - `'telegram'`: stub (log + no-op until Phase 32)
4. Errors are swallowed per-channel (best-effort), not thrown to caller

**Variable substitution helper (NOTIF-04):**

```typescript
function substituteVariables(body: string, vars: Record<string, string>): string {
  return body.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}
```

No external library needed. The `?? ""` ensures unknown tokens render as empty string without throwing (D-04 locked).

### Call Site Refactors (D-03 locked)

**4 sites to replace:**

| File | Line | Old call | New call |
|------|------|----------|----------|
| `server/routes.ts` | ~420 | `sendHotLeadNotification(twilioSettings, lead, companyName)` | `dispatchNotification(storage, 'hot_lead', { company, name, phone, classification })` |
| `server/routes.ts` | ~719 | `sendLowPerformanceAlert(twilioSettings, avgSeconds, samples, companyName)` | `dispatchNotification(storage, 'low_perf_alert', { company, avgTime, samples: String(samples) })` |
| `server/routes.ts` | ~932 | `sendNewChatNotification(twilioSettings, conversationId, input.pageUrl, companyName).catch(...)` | `dispatchNotification(storage, 'new_chat', { company, conversationId, pageUrl }).catch(...)` |
| `server/lib/lead-processing.ts` | ~34 | `sendHotLeadNotification(twilioSettings, lead, companyName)` | `dispatchNotification(storage, 'hot_lead', { company, name, phone, classification })` |

**After refactor:** `routes.ts` import line 13 changes from:
```typescript
import { sendHotLeadNotification, sendLowPerformanceAlert, sendNewChatNotification } from "./integrations/twilio.js";
```
to:
```typescript
import { dispatchNotification } from "./lib/notifications.js";
```

The 3 functions in `twilio.ts` remain exported (they are still used internally by the dispatcher via `sendSms()`), but `sendHotLeadNotification`, `sendLowPerformanceAlert`, and `sendNewChatNotification` are no longer called directly from routes.

**CRITICAL: fire-and-forget pattern preserved** — `routes.ts:932` uses `.catch()` on the async call. The dispatcher call must be wrapped identically:
```typescript
dispatchNotification(storage, 'new_chat', { company, conversationId, pageUrl }).catch(err => {
  console.error('Failed to send new chat notification:', err);
});
```

### Seed Data: Exact Message Bodies

Extracted from `server/integrations/twilio.ts` (lines 106-113, 136-144, 162-163):

**new_chat (sms):**
```
🔔 Novo chat em {{company}}
Conversa: {{conversationId}}...
Página: {{pageUrl}}
```
Note: The original code omits the `pageUrl` line if `pageUrl` is undefined. The seed template should include `{{pageUrl}}` — substitution produces empty string for unknown vars. The line separator still appears. If this is a behavior concern, the template body can be `🔔 Novo chat em {{company}}\nConversa: {{conversationId}}...\nPágina: {{pageUrl}}` and the planner can decide on whitespace handling.

**hot_lead (sms):**
```
🧲 NEW LEAD | {{company}} | {{name}} | {{phone}}
```

**low_perf_alert (sms):**
```
⚠️ {{company}}: alerta de tempo de resposta
Média: {{avgTime}}
Amostras: {{samples}}
```
Note: The original formats `avgSeconds` into `Xm Ys` string at the call site. The `{{avgTime}}` variable receives the pre-formatted string. The dispatcher caller is responsible for formatting before passing variables.

**Telegram rows (D-discretion):** Same text with Markdown formatting added — e.g., `*{{company}}*`, `*{{name}}*`.

### SQL Migration File Pattern

```sql
-- migrations/0039_create_notification_templates.sql
BEGIN;

CREATE TABLE IF NOT EXISTS notification_templates (
  id          SERIAL PRIMARY KEY,
  event_key   TEXT NOT NULL,
  channel     TEXT NOT NULL,
  body        TEXT NOT NULL,
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notification_templates_event_key_idx
  ON notification_templates (event_key);

CREATE UNIQUE INDEX IF NOT EXISTS notification_templates_event_channel_unique
  ON notification_templates (event_key, channel);

ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_access" ON notification_templates;
CREATE POLICY "service_role_all_access"
  ON notification_templates FOR ALL TO service_role
  USING (true) WITH CHECK (true);

COMMIT;
```

The `UNIQUE INDEX` on `(event_key, channel)` enforces the one-row-per-pair constraint from NOTIF-01 and enables `ON CONFLICT (event_key, channel) DO UPDATE` in the seed script for idempotency.

### Seed Script Pattern

```typescript
// scripts/seed-notification-templates.ts
import "dotenv/config";
import { pool } from "../server/db.js";

async function seed() {
  const client = await pool.connect();
  try {
    // INSERT with ON CONFLICT DO NOTHING for idempotency
    await client.query(`
      INSERT INTO notification_templates (event_key, channel, body, active)
      VALUES
        ('new_chat',      'sms',      $1, true),
        ('new_chat',      'telegram', $2, true),
        ('hot_lead',      'sms',      $3, true),
        ('hot_lead',      'telegram', $4, true),
        ('low_perf_alert','sms',      $5, true),
        ('low_perf_alert','telegram', $6, true)
      ON CONFLICT (event_key, channel) DO NOTHING
    `, [smsNewChat, telegramNewChat, smsHotLead, telegramHotLead, smsPerfAlert, telegramPerfAlert]);
    console.log("Seeded 6 notification template rows.");
  } finally {
    client.release();
    await pool.end();
  }
}
seed().catch(err => { console.error(err); process.exit(1); });
```

### Anti-Patterns to Avoid

- **Don't use `ensureXSchema()` approach for new tables**: That pattern is for additive column patches on existing deployed tables. New tables need SQL migration files.
- **Don't remove twilio.ts exports prematurely**: The 3 high-level functions (`sendHotLeadNotification`, etc.) are no longer called by routes, but `sendSms()` (already internal, not exported) is called by the dispatcher. The dispatcher imports `sendSms` internally — but `sendSms` is not currently exported. The plan needs to either export `sendSms` or keep the dispatcher in the same module scope. Since the dispatcher is a separate file (`server/lib/notifications.ts`), it needs access to `sendSms`. Options: (a) export `sendSms` from `twilio.ts`, or (b) duplicate the Twilio send logic in the dispatcher. **Best approach:** export `sendSms` and the `validateConfig` helper from `twilio.ts` for use by the dispatcher.
- **Don't pass `twilioSettings` directly to dispatcher call sites**: The dispatcher fetches settings internally via `storage.getTwilioSettings()` — caller only passes `storage`, `eventKey`, and `vars`.
- **Don't crash on empty template rows**: If `getNotificationTemplates(eventKey)` returns zero active rows, dispatcher is a no-op (silent). No error thrown.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Variable substitution | Custom parser/AST | Simple `String.replace()` with `/\{\{(\w+)\}\}/g` | 3 event types, ≤5 vars each — zero complexity |
| SMS sending | Custom Twilio HTTP client | Existing `sendSms()` in `twilio.ts` | Already handles Twilio SDK, retries, error logging |
| Database migration | Inline `CREATE TABLE` in application startup | SQL file + tsx migration script | Matches Phase 25+ canonical pattern, explicitly runnable, prod-safe |
| Template storage | In-memory config / env vars | PostgreSQL `notification_templates` table | Phase 33 needs DB-editable templates via admin UI |

---

## Common Pitfalls

### Pitfall 1: twilio.ts sendSms not exported

**What goes wrong:** The dispatcher in `server/lib/notifications.ts` needs to call `sendSms(config, body)` from `twilio.ts`, but `sendSms` is currently a module-internal function (not exported). TypeScript compile error when importing it.

**Why it happens:** `sendSms` was designed as an internal helper; only the 3 high-level notification functions were exported.

**How to avoid:** Add `export` keyword to `sendSms` (and `validateConfig` + `TwilioConfig` type) in `twilio.ts` so the dispatcher can import them. Alternatively, export a single `sendTwilioSms(twilioSettings, body)` thin wrapper that combines validate+send, letting dispatcher skip the raw config types.

**Warning signs:** `TS2305: Module has no exported member 'sendSms'` during `npm run check`.

### Pitfall 2: new_chat pageUrl conditional rendering

**What goes wrong:** The original `sendNewChatNotification` omits the `Página: ${pageUrl}` line when `pageUrl` is undefined:
```typescript
pageUrl ? `Página: ${pageUrl}` : undefined
```
After migration, the template always contains `\nPágina: {{pageUrl}}`, and if `pageUrl` is not passed as a variable, `{{pageUrl}}` renders as `""` — leaving `\nPágina: ` in the SMS body.

**Why it happens:** Template bodies are static; the original function had conditional rendering logic.

**How to avoid:** Pass `pageUrl: pageUrl ?? ""` in the variable map. The template body will render `\nPágina: ` with an empty value — slightly different but acceptable (Phase 33 allows admin to edit the template). Document this minor behavioral delta in the plan.

**Warning signs:** SMS message contains trailing `Página: ` line with no URL.

### Pitfall 3: avgTime formatting responsibility

**What goes wrong:** `sendLowPerformanceAlert` formats `avgSeconds` into `Xm Ys` internally. After migration, the dispatcher receives a pre-formatted `{{avgTime}}` string. If the caller passes raw `avgSeconds` (a number), the template renders a number instead of `2m 35s`.

**Why it happens:** The formatting logic was inside the old function; the dispatcher is format-agnostic.

**How to avoid:** At the `routes.ts` low_perf_alert call site, pre-format `avgSeconds` before building the variables object:
```typescript
const minutes = Math.floor(avgSeconds / 60);
const seconds = avgSeconds % 60;
const avgTime = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
await dispatchNotification(storage, 'low_perf_alert', {
  company: companyName,
  avgTime,
  samples: String(samples),
});
```

### Pitfall 4: lead-processing.ts uses module-level `storage` import

**What goes wrong:** `server/lib/lead-processing.ts` imports `storage` at module level (line 6: `import { storage } from "../storage.js"`). When adding the dispatcher call, the function signature `runLeadPostProcessing(initialLead, formConfig, companyName)` does not currently accept `storage` as a parameter — it uses the singleton directly.

**Why it happens:** `lead-processing.ts` pre-dates the `dispatchNotification(storage, ...)` D-02 decision.

**How to avoid:** Two valid approaches:
- (a) Call `dispatchNotification(storage, ...)` using the already-imported module-level `storage` singleton — consistent with how the file currently calls `storage.getTwilioSettings()` at line 32.
- (b) Thread `storage` as a parameter.

Given D-02 says "inject storage as first parameter" for the dispatcher itself (not for `runLeadPostProcessing`), approach (a) is simpler and consistent with the existing module pattern. The dispatcher signature `dispatchNotification(storage, eventKey, vars)` is satisfied by passing the module singleton.

### Pitfall 5: migration number collision

**What goes wrong:** The next SQL migration file should be `0039_...`. But there are two `0036_*` files already (a naming collision in Phase 25). Double-check the highest numbered file before choosing a number.

**Why it happens:** Migration files are manually numbered.

**How to avoid:** Check `ls migrations/*.sql | sort` — highest current file is `0038_form_leads_tenant_default.sql`, so the next migration is `0039_create_notification_templates.sql`.

---

## Code Examples

### Pattern: Dispatcher structure

```typescript
// server/lib/notifications.ts
import type { IStorage } from "../storage.js";
import { validateConfig, sendSms } from "../integrations/twilio.js";

function substituteVariables(body: string, vars: Record<string, string>): string {
  return body.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}

export async function dispatchNotification(
  storage: IStorage,
  eventKey: string,
  variables: Record<string, string>
): Promise<void> {
  const templates = await storage.getNotificationTemplates(eventKey);
  const active = templates.filter(t => t.active);

  for (const template of active) {
    const body = substituteVariables(template.body, variables);
    try {
      if (template.channel === "sms") {
        const twilioSettings = await storage.getTwilioSettings();
        if (!twilioSettings) continue;
        const companySettings = await storage.getCompanySettings();
        const companyName = companySettings?.companyName ?? "My Company";
        const validation = validateConfig(twilioSettings, { companyName });
        if (!validation.success) continue;
        await sendSms(validation.config, body);
      } else if (template.channel === "telegram") {
        // Phase 32 stub — no-op
        console.log(`[notifications] telegram stub: ${eventKey}`);
      }
    } catch (err) {
      console.error(`[notifications] dispatch error for ${eventKey}/${template.channel}:`, err);
    }
  }
}
```

### Pattern: Storage method (getNotificationTemplates)

```typescript
// server/storage.ts (inside DatabaseStorage class)
async getNotificationTemplates(eventKey?: string): Promise<NotificationTemplate[]> {
  if (eventKey) {
    return db.select().from(notificationTemplates)
      .where(eq(notificationTemplates.eventKey, eventKey));
  }
  return db.select().from(notificationTemplates);
}

async upsertNotificationTemplate(
  template: InsertNotificationTemplate & { id?: number }
): Promise<NotificationTemplate> {
  if (template.id) {
    const [updated] = await db
      .update(notificationTemplates)
      .set({ ...template, updatedAt: new Date() })
      .where(eq(notificationTemplates.id, template.id))
      .returning();
    return updated;
  }
  const [created] = await db
    .insert(notificationTemplates)
    .values(template)
    .returning();
  return created;
}
```

### Pattern: New chat call site (fire-and-forget preserved)

```typescript
// server/routes.ts ~932 — after refactor
if (isNewConversation) {
  dispatchNotification(storage, 'new_chat', {
    company: companyName,
    conversationId,
    pageUrl: input.pageUrl ?? "",
  }).catch(err => {
    console.error('Failed to send new chat notification:', err);
  });
}
```

---

## Environment Availability

Step 2.6: SKIPPED — Phase 31 is purely server-side code and schema changes. External dependencies (Twilio, PostgreSQL) are already wired into the running application. No new external services or CLI tools are required.

---

## Validation Architecture

No test framework is available per CLAUDE.md: "Manual QA only: No test framework available — verify critical flows manually."

**Manual verification steps for the plan:**

1. Run `npm run check` — zero TypeScript errors (NOTIF-05 success criterion)
2. Run migration script: `npx tsx scripts/migrate-notification-templates.ts` — verify table created in DB
3. Run seed script: `npx tsx scripts/seed-notification-templates.ts` — verify 6 rows inserted
4. Trigger a chat message to a page — verify SMS sent with correct body (new_chat)
5. Trigger a hot lead (score ≥ threshold) — verify SMS sent with correct body (hot_lead)
6. Trigger low-perf alert path — verify SMS sent with correct body (low_perf_alert)

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hardcoded strings in function bodies | DB-stored templates with `{{var}}` substitution | Phase 31 | Admin can edit messages without deploy |
| 3 exported Twilio functions called by routes | Single `dispatchNotification(storage, eventKey, vars)` | Phase 31 | Callers decoupled from message text and channel routing |
| SMS only | SMS + telegram stub (telegram activated in Phase 32) | Phase 31/32 | Multi-channel with zero call site changes |

---

## Open Questions

1. **`name` column on `notification_templates` for Phase 33 UI**
   - What we know: Phase 33 will display a notifications panel showing event names and per-channel editors. It may want a human-readable name (e.g., "New Chat Notification") separate from `event_key`.
   - What's unclear: Whether Phase 33 will derive the display name from `event_key` (formatted) or need a separate `name` column.
   - Recommendation: Add `name text` column to the schema and SQL migration now — it costs nothing and avoids a second migration. Default to a human-readable string derived from `event_key`. If not needed, Phase 33 can ignore it. This is Claude's discretion per CONTEXT.md.

2. **Dispatcher's companyName source**
   - What we know: `validateConfig()` in `twilio.ts` accepts `companyName` as an option and falls back to `"My Company"`. The dispatcher needs to pass companyName when it calls `validateConfig`.
   - What's unclear: Whether to fetch `companySettings` inside the dispatcher (extra DB call per dispatch) or require it as part of the `variables` map.
   - Recommendation: Require callers to pass `company` in the variables map (it is part of D-04 for all 3 events). The dispatcher extracts `variables.company` and passes it to `validateConfig`. This avoids the extra DB round-trip.

---

## Sources

### Primary (HIGH confidence)
- `server/integrations/twilio.ts` — Hardcoded message bodies extracted directly (lines 106-113, 136-144, 162-163); internal `sendSms` and `validateConfig` functions identified
- `shared/schema/hub.ts` — Canonical schema file pattern (`$onUpdate`, `index`, `z.enum`, manual Zod schemas)
- `shared/schema/settings.ts` — TwilioSettings table pattern confirmed (`serial`, `text`, `boolean`, `timestamp`, manual insert schemas)
- `shared/schema.ts` — Barrel re-export with `.js` extensions confirmed
- `server/storage.ts` — `IStorage` interface location (line 618), `DatabaseStorage` class (line 792), `getTwilioSettings()` method (line 902), import block (lines 1-117)
- `server/routes.ts` — All 3 Twilio call sites confirmed at lines 417-428, 714-724, 929-935; import line 13 confirmed
- `server/lib/lead-processing.ts` — 4th call site at lines 30-43; module-level `storage` import at line 6
- `migrations/0036_create_skale_hub_tables.sql` — SQL migration structure confirmed (BEGIN/COMMIT, IF NOT EXISTS, RLS, service_role policy)
- `scripts/migrate-skale-hub.ts` — Migration script pattern confirmed (`pool.connect()`, `client.query(sql)`, table verification)
- `migrations/` directory listing — Next migration number confirmed as `0039`

### Secondary (MEDIUM confidence)
- CONTEXT.md decisions D-01 through D-05 — User-locked decisions treated as authoritative constraints

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already present in package.json, versions confirmed
- Architecture: HIGH — all patterns sourced directly from existing codebase files
- Pitfalls: HIGH — identified from direct code inspection of files being modified
- Migration number: HIGH — verified by listing `migrations/` directory

**Research date:** 2026-05-04
**Valid until:** Stable (no fast-moving external dependencies)
