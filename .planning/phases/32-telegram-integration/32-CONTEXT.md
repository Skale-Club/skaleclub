# Phase 32: Telegram Integration - Context

**Gathered:** 2026-05-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Add Telegram as a second notification channel: bot token + chat ID stored in `telegram_settings` table, `sendTelegramMessage()` integration function using native fetch, dispatcher updated to route `channel='telegram'` templates to the new function. Admin configures via existing Integrations section. The 3 existing notification events (new_chat, hot_lead, low_perf_alert) are dispatched to Telegram when their telegram template row is `active=true` and Telegram is enabled+configured.

This phase does NOT include the admin Notifications template editor (Phase 33) or any new notification events.

</domain>

<decisions>
## Implementation Decisions

### D-01: Schema Storage — New `telegram_settings` table
Match the `twilioSettings` singleton table pattern exactly: `pgTable("telegram_settings", ...)` in `shared/schema/settings.ts`, with fields `id`, `enabled` (boolean, default false), `botToken` (text), `chatId` (text), `createdAt`, `updatedAt`.

Insert Zod schema follows `insertTwilioSettingsSchema` pattern (manual z.object, not drizzle-zod). IStorage interface gets `getTelegramSettings()` and `saveTelegramSettings()` methods.

Requires a raw SQL migration script (tsx pattern — drizzle-kit CJS can't resolve .js ESM imports) matching `scripts/migrate-*.ts` convention.

### D-02: Dispatcher Activation Guard — Validate enabled+configured before sending
In `server/lib/notifications.ts`, the `telegram` branch calls `storage.getTelegramSettings()`, then validates:
- `settings.enabled === true`
- `settings.botToken` non-empty
- `settings.chatId` non-empty

If any check fails, skip silently (matching Twilio SMS path which calls `validateConfig` and `continue`s on failure).

Behavior contract (NOTIF-08): event dispatched to Telegram only when template `active=true` AND settings enabled AND credentials present.

### D-03: Telegram Parse Mode — `"Markdown"` (legacy)
`sendTelegramMessage(config, text)` calls `api.telegram.org/bot{token}/sendMessage` with `parse_mode: "Markdown"` (legacy mode).

Rationale: seed templates use simple text with emoji + newlines. `Markdown` supports `*bold*` and `_italic_` without requiring escaping of special chars. `MarkdownV2` would require escaping `.`, `!`, `(`, `)`, etc. in template bodies — unnecessary complexity for current templates.

No SDK — native `fetch` per NOTIF-07. Response: check `ok.json` field; log error on failure (non-throwing, best-effort).

### D-04: Token Masking — Mask `botToken` on GET
`GET /api/integrations/telegram` returns `botToken: '********'` when set (mirrors Twilio's `authToken` masking pattern). The PUT handler preserves the stored token when request body contains `'********'` (same token-preservation logic as Twilio PUT handler).

### D-05: Integration Route Pattern — Follow existing Twilio routes exactly
`GET /api/integrations/telegram` + `PUT /api/integrations/telegram` in `server/routes/integrations.ts`, gated by `requireAdmin`. Default response when no row exists: `{ enabled: false, botToken: '', chatId: '' }`.

NOTIF-14 says Telegram settings appear "in the existing Integrations section alongside Twilio" — admin UI wiring happens in Phase 33 (dedicated Notifications panel handles template editing; Telegram credentials live in IntegrationsSection which already shows Twilio).

### Claude's Discretion
- Exact field order and Zod schema structure for `telegramSettingsSchema` — follow `twilioSettingsSchema` pattern
- Whether to expose a `POST /api/integrations/telegram/test` endpoint — Twilio has one; for Telegram, a basic test message to the configured chatId would be useful but is not required by NOTIF-06–09. Claude can include it if the implementation is simple (single fetch call).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing Integration Pattern (authoritative source)
- `shared/schema/settings.ts` lines 20–31 — `twilioSettings` pgTable definition (exact columns to mirror)
- `shared/schema/settings.ts` lines 134–191 — `insertTwilioSettingsSchema` Zod + `TwilioSettings` type (mirror pattern)
- `server/routes/integrations.ts` lines 615–695 — Twilio GET + PUT + test route implementation (mirror for Telegram)
- `server/storage.ts` lines 643–644 — `getTwilioSettings`/`saveTwilioSettings` IStorage interface declarations (mirror for Telegram)
- `server/storage.ts` lines 909–930 — `getTwilioSettings`/`saveTwilioSettings` implementations (mirror for Telegram)
- `server/integrations/twilio.ts` — Full file — `TwilioConfig` type + `validateConfig` + `sendSms` (mirror structure for `TelegramConfig` + `sendTelegramMessage`)

### Dispatcher (modify here)
- `server/lib/notifications.ts` — Full file — `telegram` branch is the no-op stub that Phase 32 replaces

### Migration Pattern
- `scripts/migrate-notification-templates.ts` — Raw SQL tsx migration script pattern (no drizzle-kit)
- `migrations/0039_create_notification_templates.sql` — Example migration SQL structure

### Requirements
- `.planning/milestones/v1.8-REQUIREMENTS.md` NOTIF-06, NOTIF-07, NOTIF-08, NOTIF-09 — exact acceptance criteria

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `server/routes/integrations.ts` — `parseRecipients()` helper and `requireAdmin` middleware already imported; add Telegram routes here (no new file needed)
- `server/lib/notifications.ts` `telegram` branch — currently `console.log` stub; Phase 32 replaces it with real `sendTelegramMessage(config, text)` call
- `shared/schema/settings.ts` — Add `telegramSettings` table and Zod schema here (same file as `twilioSettings`)

### Established Patterns
- **Singleton settings table**: one row, `id=1` implied by upsert pattern (getTwilioSettings returns `rows[0]`)
- **Token masking**: sensitive credentials masked `'********'` on GET, preserved on PUT when value equals mask
- **Zod integration schema**: manual `z.object` with `.optional()` fields — not drizzle-zod (drizzle-zod produces overly strict types for settings upserts)
- **Native fetch for external APIs**: `server/integrations/ghl.ts` uses native fetch — same pattern for Telegram Bot API
- **Error swallowing in dispatcher**: per-channel errors caught, logged, execution continues to next template

### Integration Points
- `server/lib/notifications.ts` telegram branch: import `sendTelegramMessage` + `getTelegramSettings` → replace stub
- `server/routes/integrations.ts`: add `GET /api/integrations/telegram` + `PUT /api/integrations/telegram` after Twilio block
- `shared/schema/settings.ts`: add `telegramSettings` table + Zod schema + type exports
- `shared/schema.ts`: barrel re-export `telegramSettings`, `TelegramSettings`, `InsertTelegramSettings`
- `server/storage.ts`: add IStorage interface declarations + DatabaseStorage implementations

</code_context>

<specifics>
## Specific Ideas

- `sendTelegramMessage(config: TelegramConfig, text: string): Promise<{ success: boolean; message?: string }>` — mirrors `sendSms` return type; caller (dispatcher) ignores return value
- Telegram Bot API URL: `https://api.telegram.org/bot${config.botToken}/sendMessage`
- Payload: `{ chat_id: config.chatId, text, parse_mode: "Markdown" }`
- No need for recipient list (Telegram sends to one chatId) — simpler than Twilio's multi-recipient array

</specifics>

<deferred>
## Deferred Ideas

- `POST /api/integrations/telegram/test` — send test message to configured chatId. Not required by NOTIF-06–09 but a natural complement (Claude's discretion to include if trivial).
- Admin UI for Telegram settings in IntegrationsSection — Phase 33 scope (NOTIF-14 lives in the Admin Notifications Panel phase)
- Multiple chatIds / recipient routing — not requested; Phase 32 delivers single chatId

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 32-telegram-integration*
*Context gathered: 2026-05-04*
