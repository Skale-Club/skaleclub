# Phase 32: Telegram Integration - Research

**Researched:** 2026-05-04
**Domain:** Telegram Bot API + Storage singleton pattern + Dispatcher wiring
**Confidence:** HIGH

## Summary

Phase 32 adds Telegram as a second notification channel. The work is narrowly scoped: one new DB table (`telegram_settings`), one new integration module (`server/integrations/telegram.ts`), two new routes in the existing integrations file, two new `IStorage` methods, and replacing the no-op stub in `server/lib/notifications.ts` with a real `sendTelegramMessage` call.

All structural patterns are established in the existing Twilio integration and can be mirrored exactly. The Telegram Bot API is a simple HTTPS JSON endpoint — no SDK, no streaming, no auth complexity. The only configuration required at runtime is a bot token and a chat ID.

The migration pattern (raw SQL tsx script + manually named `.sql` file) is already proven across six prior scripts. The next migration number is `0040`.

**Primary recommendation:** Mirror the Twilio singleton pattern exactly. One plan is sufficient — all five deliverables (schema, storage, integration module, routes, dispatcher wiring) are straightforward and interdependent.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** New `telegram_settings` pgTable in `shared/schema/settings.ts` (mirrors `twilioSettings`) with fields `id`, `enabled` (boolean, default false), `botToken` (text), `chatId` (text), `createdAt`, `updatedAt`. Insert Zod schema follows `insertTwilioSettingsSchema` pattern (manual z.object, not drizzle-zod). IStorage interface gets `getTelegramSettings()` and `saveTelegramSettings()` methods.
- **D-02:** Dispatcher's `telegram` branch calls `storage.getTelegramSettings()`, validates `settings.enabled === true`, `settings.botToken` non-empty, `settings.chatId` non-empty — skip silently on failure.
- **D-03:** `sendTelegramMessage(config, text)` calls `api.telegram.org/bot{token}/sendMessage` with `parse_mode: "Markdown"` (legacy). Non-throwing, best-effort: check `ok` field in JSON response, log on failure.
- **D-04:** `GET /api/integrations/telegram` masks `botToken` as `'********'` when set. `PUT` preserves stored token when body contains `'********'`.
- **D-05:** `GET + PUT /api/integrations/telegram` in `server/routes/integrations.ts`, gated by `requireAdmin`. Default when no row: `{ enabled: false, botToken: '', chatId: '' }`.

### Claude's Discretion

- Exact field order and Zod schema structure for `telegramSettingsSchema` (local to integrations.ts) — follow `twilioSettingsSchema` pattern.
- Whether to include `POST /api/integrations/telegram/test` — not required by NOTIF-06–09 but a natural complement (trivial single fetch call).

### Deferred Ideas (OUT OF SCOPE)

- Admin UI for Telegram settings in IntegrationsSection — Phase 33 scope.
- Multiple chatIds / recipient routing — not requested.
- `POST /api/integrations/telegram/test` is Claude's discretion, not a requirement.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| NOTIF-06 | `GET /api/integrations/telegram` and `PUT /api/integrations/telegram` exist, require admin auth, persist `{ botToken, chatId, enabled }` using same pattern as Twilio settings | Routes section — Twilio GET/PUT pattern lines 619–676 is the exact template |
| NOTIF-07 | `server/integrations/telegram.ts` exports `sendTelegramMessage(config, text)` posting to Bot API — no SDK, native fetch only | Bot API section — endpoint, payload, error shape all documented |
| NOTIF-08 | Dispatcher routes 3 events to Telegram when `channel='telegram'` template is `active=true` and integration is enabled+configured | Dispatcher section — existing stub at line 42–44 is replaced |
| NOTIF-09 | Telegram messages support basic Markdown (bold, newlines) — body renders cleanly in Telegram clients | Parse mode section — legacy `Markdown` confirmed sufficient for current templates |
</phase_requirements>

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| native `fetch` | Node 18+ built-in | Telegram Bot API calls | Project constraint — no new npm deps; matches `server/integrations/ghl.ts` pattern |
| Drizzle ORM | 0.39.3 (existing) | `telegram_settings` table queries | Already in project; singleton upsert follows `twilioSettings` path |
| Zod | 3.24.2 (existing) | Request body validation for PUT route | Already in project; manual `z.object` not drizzle-zod (per project convention) |

### Supporting

No new libraries. All dependencies are already in the project.

**Installation:** None required.

---

## Architecture Patterns

### Recommended File Changes

```
shared/schema/settings.ts          — Add telegramSettings pgTable + insertTelegramSettingsSchema + types
shared/schema.ts                   — Already re-exports settings.ts; no change needed (exports are wildcard)
server/integrations/telegram.ts    — New file: TelegramConfig type + sendTelegramMessage()
server/storage.ts                  — IStorage: +getTelegramSettings / +saveTelegramSettings
                                     DatabaseStorage: implementations (mirror getTwilioSettings/saveTwilioSettings)
server/routes/integrations.ts      — Add GET + PUT /api/integrations/telegram (after Twilio block)
server/lib/notifications.ts        — Replace telegram stub with sendTelegramMessage() call
migrations/0040_create_telegram_settings.sql  — New SQL file
scripts/migrate-telegram-settings.ts          — New tsx migration runner
```

### Pattern 1: Singleton Settings Table

**What:** One row per settings type, created on first read if absent. `id=1` is implied — queries use `LIMIT 1` + auto-create via insert returning.

**When to use:** All integration credential stores in this codebase.

**Example (from `server/storage.ts` lines 909–916 — authoritative):**
```typescript
async getTwilioSettings(): Promise<TwilioSettings | undefined> {
  const [settings] = await db.select().from(twilioSettings).orderBy(asc(twilioSettings.id)).limit(1);
  if (settings) return settings;
  // Keep as singleton row to simplify reads/updates.
  const [created] = await db.insert(twilioSettings).values({}).returning();
  return created;
}
```

Mirror for `getTelegramSettings()` — same shape, `telegram_settings` table.

### Pattern 2: Token Masking on GET / Preservation on PUT

**What:** Sensitive credential masked as `'********'` on GET responses. PUT handler checks `if value !== '********'` before overwriting stored value.

**When to use:** Any credential field — `authToken` for Twilio, `botToken` for Telegram.

**Example (from `server/routes/integrations.ts` lines 631, 645–646 — authoritative):**
```typescript
// GET — mask on response
authToken: settings.authToken ? '********' : '',

// PUT — preserve stored value when mask is echoed back
const tokenFromRequest = parsed.authToken && parsed.authToken !== '********'
  ? parsed.authToken.trim()
  : undefined;
const authTokenToPersist = tokenFromRequest || existingSettings?.authToken;
```

Apply same logic: `botToken` field, mask sentinel `'********'`.

### Pattern 3: Local Zod Schema in Route File

**What:** A `const telegramSettingsSchema = z.object({...})` defined at the top of `integrations.ts`, used only in the Telegram GET/PUT routes. Mirrors `twilioSettingsSchema` at line 135.

**Why local:** The route-layer schema is deliberately lenient (all `.optional()`). The DB-layer `insertTelegramSettingsSchema` is the authoritative contract for storage. This separation is the established pattern.

```typescript
// Add after twilioSettingsSchema (line 143)
const telegramSettingsSchema = z.object({
  botToken: z.string().trim().optional(),
  chatId: z.string().trim().optional(),
  enabled: z.boolean().optional(),
});
```

### Pattern 4: Dispatcher Guard (D-02)

**What:** In the `telegram` branch of `dispatchNotification`, fetch settings, validate, then call `sendTelegramMessage`. Non-throwing.

**When to use:** Matches how the `sms` branch handles `validateConfig` failure with `continue`.

**Example (from `server/lib/notifications.ts` lines 34–41 — current sms branch, authoritative):**
```typescript
if (template.channel === "sms") {
  const twilioSettings = await storage.getTwilioSettings();
  if (!twilioSettings) continue;
  const companyName = variables.company ?? "My Company";
  const validation = validateConfig(twilioSettings, { companyName });
  if (!validation.success) continue;
  await sendSms(validation.config, body);
}
```

Telegram branch mirrors this: fetch `getTelegramSettings()`, validate three conditions, call `sendTelegramMessage(config, body)`.

### Pattern 5: Raw SQL Migration

**What:** A `.sql` file in `migrations/` + a `scripts/migrate-*.ts` runner that reads and executes it via `pool.connect()`.

**Why:** drizzle-kit push cannot resolve `.js` ESM imports in the CJS bundle — established in Phase 09 and used in every migration since.

**Next migration number:** `0040` (last is `0039_create_notification_templates.sql`).

**Template (from `scripts/migrate-notification-templates.ts` — authoritative):**
```typescript
import "dotenv/config";
import { readFileSync } from "fs";
import { join } from "path";
import { pool } from "../server/db.js";

const sql = readFileSync(join(process.cwd(), "migrations/0040_create_telegram_settings.sql"), "utf-8");

async function migrate() {
  const client = await pool.connect();
  try {
    console.log("Running Phase 32 migration: telegram_settings table...");
    await client.query(sql);
    console.log("Migration complete.");

    const result = await client.query(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'telegram_settings'"
    );
    if (result.rows.length === 0) {
      throw new Error("telegram_settings table not found after migration.");
    }
    console.log("Verified: telegram_settings table exists in public schema.");
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
```

### Anti-Patterns to Avoid

- **Using drizzle-zod for the insert schema:** Project convention uses manual `z.object` for settings tables. `insertTwilioSettingsSchema` is handwritten — `insertTelegramSettingsSchema` must be too.
- **Throwing errors in `sendTelegramMessage`:** Callers (dispatcher) do not handle rejections from channel functions; the function must catch and return `{ success: false }`.
- **Using `drizzle-kit push` as migration tool:** Raw SQL tsx script is the required pattern — drizzle-kit CJS resolution fails in this project's ESM setup.
- **Adding Telegram credentials to `TwilioConfig` or existing types:** Telegram needs its own `TelegramConfig` type in `server/integrations/telegram.ts`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP to Bot API | Custom fetch wrapper | Inline `fetch()` in `sendTelegramMessage` | Single call, no retry/pagination needed; GHL integration does the same |
| Settings upsert logic | Custom upsert | Mirror `saveTwilioSettings` pattern | Drizzle update-on-existing / insert-on-new already handles the singleton correctly |
| Token masking | Custom middleware | Same `!== '********'` sentinel check as Twilio | Already battle-tested in two routes |

**Key insight:** Every non-trivial piece of this phase already exists as a Twilio mirror. The implementation is pattern application, not invention.

---

## Telegram Bot API — Technical Specification

### sendMessage Endpoint

**URL:** `https://api.telegram.org/bot{TOKEN}/sendMessage`

**Method:** POST

**Content-Type:** `application/json`

**Payload:**
```json
{
  "chat_id": "-1001234567890",
  "text": "Message body here",
  "parse_mode": "Markdown"
}
```

**Required fields:** `chat_id`, `text`

**Optional fields:** `parse_mode` (use `"Markdown"` per D-03)

### Response Structure

**Success (HTTP 200):**
```json
{ "ok": true, "result": { /* Message object */ } }
```

**Failure (HTTP 4xx/5xx):**
```json
{ "ok": false, "error_code": 400, "description": "Bad Request: chat not found" }
```

The `ok` field is the canonical check — do NOT rely on HTTP status code alone. A `200 OK` response can still have `ok: false` in some edge cases.

### Common Error Codes

| Code | Description | Cause | Impact |
|------|-------------|-------|--------|
| 400 | `chat not found` | Bot is not a member of the chat, or chatId is wrong | Logged, silently skipped |
| 400 | `message text is empty` | Empty string sent as `text` | Prevented by template body validation |
| 401 | `Unauthorized` | Bot token is invalid or revoked | Logged, silently skipped |
| 403 | `bot was blocked by the user` | User blocked the bot in private chat | Logged, silently skipped |
| 429 | `Too Many Requests: retry after N` | Rate limit hit | Response has `parameters.retry_after`; log and skip (no retry needed for event-driven alerts) |

### chat_id Format

| Chat Type | Format | Example |
|-----------|--------|---------|
| Private (user DM) | Positive integer | `123456789` |
| Group / Supergroup | Negative integer | `-987654321` |
| Channel | `-100` prefix + channel ID | `-1001234567890` |

**Stored as text:** The `chatId` column is `text` (not integer) to accommodate all three formats, including the `-100`-prefixed channel IDs that overflow 32-bit integers.

### Parse Mode: `"Markdown"` vs `"MarkdownV2"`

| Mode | Supported Formatting | Escaping Required |
|------|----------------------|-------------------|
| `"Markdown"` (legacy) | `*bold*`, `_italic_`, `` `code` ``, `[link](url)` | Only `_`, `*`, `` ` ``, `[` outside entities |
| `"MarkdownV2"` | All above + underline, strikethrough, spoiler | 17 characters must be escaped: `_`, `*`, `[`, `]`, `(`, `)`, `~`, `` ` ``, `>`, `#`, `+`, `-`, `=`, `|`, `{`, `}`, `.`, `!` |

**Decision (D-03):** Use `"Markdown"` (legacy). Current seed templates use plain text with emoji and newlines — no characters require escaping in legacy mode. `MarkdownV2` would require escaping `.` and `!` that appear in template bodies (e.g., `🔔 Novo chat em Skale Club!`).

### Native fetch Implementation

```typescript
// Source: official Telegram Bot API docs + ghl.ts fetch pattern
export type TelegramConfig = {
  botToken: string;
  chatId: string;
};

type TelegramResult = { success: boolean; message?: string };

export async function sendTelegramMessage(
  config: TelegramConfig,
  text: string
): Promise<TelegramResult> {
  try {
    const url = `https://api.telegram.org/bot${config.botToken}/sendMessage`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: config.chatId,
        text,
        parse_mode: "Markdown",
      }),
    });

    const json = (await response.json()) as { ok: boolean; description?: string };
    if (!json.ok) {
      console.error("Telegram API error:", json.description);
      return { success: false, message: json.description };
    }
    return { success: true };
  } catch (error: any) {
    console.error("Failed to send Telegram message:", error);
    return { success: false, message: error?.message || "Failed to send Telegram message" };
  }
}
```

---

## Schema Specification

### `telegram_settings` pgTable

Mirror of `twilioSettings` (lines 20–31 in `shared/schema/settings.ts`):

```typescript
export const telegramSettings = pgTable("telegram_settings", {
  id: serial("id").primaryKey(),
  enabled: boolean("enabled").default(false),
  botToken: text("bot_token"),
  chatId: text("chat_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
```

### `insertTelegramSettingsSchema`

Mirror of `insertTwilioSettingsSchema` (lines 134–142 in `shared/schema/settings.ts`):

```typescript
export const insertTelegramSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  botToken: z.string().nullable().optional(),
  chatId: z.string().nullable().optional(),
});
```

### Exported Types

```typescript
export type TelegramSettings = typeof telegramSettings.$inferSelect;
export type InsertTelegramSettings = typeof telegramSettings.$inferInsert;
```

These types are automatically re-exported from `shared/schema.ts` via the existing `export * from "./schema/settings.js"` wildcard — no change to `shared/schema.ts` needed.

### Migration SQL (`migrations/0040_create_telegram_settings.sql`)

```sql
-- Phase 32 - Telegram Integration: create telegram_settings singleton table

BEGIN;

CREATE TABLE IF NOT EXISTS telegram_settings (
  id          SERIAL PRIMARY KEY,
  enabled     BOOLEAN NOT NULL DEFAULT false,
  bot_token   TEXT,
  chat_id     TEXT,
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);

ALTER TABLE telegram_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_access" ON telegram_settings;
CREATE POLICY "service_role_all_access"
  ON telegram_settings FOR ALL TO service_role
  USING (true) WITH CHECK (true);

COMMIT;
```

Note: No unique index needed — this is a singleton table, accessed only by `SELECT ... LIMIT 1`. No event/channel composite key like `notification_templates`.

---

## Common Pitfalls

### Pitfall 1: MarkdownV2 Special Character Explosion

**What goes wrong:** Switching from `"Markdown"` to `"MarkdownV2"` breaks message delivery — Bot API returns `400 Bad Request: can't parse entities`. Template bodies contain `.`, `!`, `(`, `)` that are reserved in MarkdownV2.

**Why it happens:** MarkdownV2 requires 17 characters to be backslash-escaped when they appear as literal text. The current seed templates (`🔔 Novo chat em {{company}}!`, `🧲 NEW LEAD | ...`) contain `!` and potentially `.` in variable substitutions.

**How to avoid:** Stick to `parse_mode: "Markdown"` (legacy) as decided in D-03.

**Warning signs:** `400` responses with `description` containing `"can't parse entities"`.

### Pitfall 2: chat_id Sent as Number Instead of String

**What goes wrong:** Channels have `-100`-prefixed IDs like `-1001234567890` that overflow JavaScript's safe integer range. If the route or storage layer coerces `chatId` to a number, large channel IDs are silently corrupted.

**Why it happens:** Forgetting to keep `chatId` as a `text` column and `string` type throughout.

**How to avoid:** `chatId` is `text` in the Drizzle schema, `z.string()` in Zod, and passed directly as a string in the JSON payload.

**Warning signs:** Bot API error `400 Bad Request: chat not found` for channels when the chat_id looks correct to the user.

### Pitfall 3: `ok: false` Not Caught Because Response is HTTP 200

**What goes wrong:** `fetch()` only rejects on network errors. A `200 OK` from Telegram with `{ "ok": false }` is not a rejection — `response.ok` is `true`. If only `response.ok` is checked, Bot API application-level errors are silently swallowed.

**Why it happens:** Conflating HTTP-level success (`response.ok`) with Bot API success (`json.ok`).

**How to avoid:** Always parse the response body as JSON and check `json.ok`, not just `response.ok`.

**Warning signs:** No error logs, no Telegram messages delivered, `success: true` returned incorrectly.

### Pitfall 4: TypeScript Error on `shared/schema.ts` Barrel

**What goes wrong:** Adding `telegramSettings` to `settings.ts` without exporting `TelegramSettings` and `InsertTelegramSettings` types causes `storage.ts` and route files to fail `npm run check`.

**Why it happens:** The storage interface and route need these types; they must be exported from the schema file and re-exported via the barrel.

**How to avoid:** Export `TelegramSettings` and `InsertTelegramSettings` types immediately when adding the table. The wildcard `export * from "./schema/settings.js"` in `shared/schema.ts` handles re-export automatically.

### Pitfall 5: Bot Token Exposed in GET Response

**What goes wrong:** Returning the raw `botToken` from `GET /api/integrations/telegram` exposes a secret in admin UI network tabs and logs.

**Why it happens:** Forgetting the masking step that applies to `authToken` in the Twilio GET route.

**How to avoid:** Return `botToken: settings.botToken ? '********' : ''` in GET response. Apply the `!== '********'` preservation logic in PUT handler.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hardcoded notification strings in route handlers | DB-stored templates with `{{variable}}` substitution | Phase 31 | New integrations only need to implement the transport — message text is managed separately |
| Telegram as no-op stub | Real `sendTelegramMessage()` dispatch | Phase 32 (this phase) | All 3 events now fan out to both SMS and Telegram channels |

**Deprecated/outdated:**
- The `console.log('[notifications] telegram stub...')` at line 44 of `server/lib/notifications.ts` — replaced in this phase.

---

## Open Questions

1. **`POST /api/integrations/telegram/test` endpoint**
   - What we know: Twilio has one (lines 678–715 in integrations.ts). Telegram test is simpler — one fetch call, no multi-recipient loop.
   - What's unclear: Whether Claude should include it (discretion item).
   - Recommendation: Include it. The implementation is trivial (fetch with a hardcoded "Test" body) and it provides immediate value for admin verification. Three additional lines in the route file.

2. **`saveTelegramSettings` auto-create behavior**
   - What we know: `getTwilioSettings` auto-creates an empty row on first read. `saveTwilioSettings` calls `getTwilioSettings()` first, then updates or inserts.
   - What's unclear: Whether `saveTelegramSettings` should also auto-create, or only update/insert.
   - Recommendation: Mirror `saveTwilioSettings` exactly — call `getTelegramSettings()` first to get or create the singleton, then `UPDATE` if exists, `INSERT` if new. This keeps behavior consistent.

---

## Environment Availability

Step 2.6: SKIPPED — This phase is purely server-side code changes and a DB migration. The only external dependency is the Telegram Bot API (public HTTPS endpoint). No CLI tools, runtimes, or local services beyond the existing project stack are required. The project's PostgreSQL connection (`DATABASE_URL`) is already established.

---

## Validation Architecture

`nyquist_validation` is enabled in `.planning/config.json`.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Manual QA only (CLAUDE.md: "No test framework available") |
| Config file | none |
| Quick run command | `npm run check` (TypeScript compilation) |
| Full suite command | `npm run check` |

### Phase Requirements — Verification Map

| Req ID | Behavior | Test Type | Verification Command | Notes |
|--------|----------|-----------|----------------------|-------|
| NOTIF-06 | GET returns masked botToken + PUT persists enabled/chatId | manual-only | `npm run check` (types) + curl test | No test framework |
| NOTIF-07 | `sendTelegramMessage` posts to Bot API with correct payload | manual-only | `npm run check` + live bot test | Requires a real bot token + chatId |
| NOTIF-08 | Dispatcher routes active telegram templates to `sendTelegramMessage` | manual-only | `npm run check` + trigger a hot_lead event | End-to-end flow |
| NOTIF-09 | Messages render with Markdown in Telegram client | manual-only | Send test message, view in Telegram app | Visual verification only |

### Sampling Rate

- **Per task commit:** `npm run check` — zero TypeScript errors required
- **Per wave merge:** `npm run check`
- **Phase gate:** `npm run check` green + manual Telegram delivery verified before `/gsd:verify-work`

### Wave 0 Gaps

None — no test framework exists in this project (CLAUDE.md constraint). All verification is TypeScript compilation + manual QA.

---

## Sources

### Primary (HIGH confidence)
- Telegram Bot API official docs (`https://core.telegram.org/bots/api#sendmessage`) — endpoint URL, payload schema, `ok` field semantics, parse_mode values
- `server/integrations/twilio.ts` (read directly) — `TwilioConfig` type, `sendSms` return type, error swallowing pattern
- `server/routes/integrations.ts` lines 619–715 (read directly) — Twilio GET/PUT/test routes to mirror
- `shared/schema/settings.ts` lines 20–31, 134–142 (read directly) — `twilioSettings` table + `insertTwilioSettingsSchema` to mirror
- `server/storage.ts` lines 909–946 (read directly) — `getTwilioSettings`/`saveTwilioSettings` implementations to mirror
- `server/lib/notifications.ts` (read directly) — current telegram stub to replace
- `scripts/migrate-notification-templates.ts` (read directly) — migration runner pattern
- `migrations/0039_create_notification_templates.sql` (read directly) — SQL structure reference

### Secondary (MEDIUM confidence)
- WebSearch results on Telegram chat_id format — `-100` prefix for channels confirmed by multiple community sources
- WebSearch results on Markdown vs MarkdownV2 escaping — character requirements confirmed across multiple bot framework docs

### Tertiary (LOW confidence)
- None — all critical claims verified against official docs or source code.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all patterns read directly from existing project source files
- Architecture: HIGH — Twilio integration is the authoritative mirror; no ambiguity
- Pitfalls: HIGH for MarkdownV2/ok-field/chatId; MEDIUM for the token masking pitfall (unlikely given strong existing precedent)
- Telegram Bot API: HIGH — verified against official docs

**Research date:** 2026-05-04
**Valid until:** 2026-06-04 (Telegram Bot API is stable; project patterns are locked)
