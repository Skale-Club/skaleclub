# Phase 32: Telegram Integration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-04
**Phase:** 32-telegram-integration
**Mode:** --auto (all areas auto-resolved with recommended defaults)
**Areas discussed:** Schema storage, Dispatcher activation guard, Telegram parse mode, Token masking

---

## Schema Storage Approach

| Option | Description | Selected |
|--------|-------------|----------|
| New `telegram_settings` table | Singleton pgTable matching `twilioSettings` pattern; SQL migration required | ✓ |
| JSONB column in `company_settings` | No migration; but diverges from Twilio pattern and adds coupling | |
| Row in generic `integrations` table | More flexible but no such table exists; adds migration complexity | |

**Auto-selected:** New `telegram_settings` table (recommended — matches established Twilio singleton pattern)

---

## Dispatcher Activation Guard

| Option | Description | Selected |
|--------|-------------|----------|
| Validate enabled+configured in dispatcher | Calls `getTelegramSettings()`, checks `enabled`+`botToken`+`chatId`, skips on failure | ✓ |
| Template `active` flag alone | Simpler, but risks sending when credentials not configured | |

**Auto-selected:** Validate enabled+configured in dispatcher (recommended — per NOTIF-08 requirement)

---

## Telegram Parse Mode

| Option | Description | Selected |
|--------|-------------|----------|
| `Markdown` (legacy) | `*bold*` + `_italic_` without escaping special chars | ✓ |
| `MarkdownV2` | More features; requires escaping `.!()-` etc. in template bodies | |
| No parse_mode (plain text) | Safest; loses any formatting in templates | |

**Auto-selected:** `Markdown` legacy (recommended — simplest, sufficient for current seed templates)

---

## Token Masking on GET

| Option | Description | Selected |
|--------|-------------|----------|
| Mask `botToken` as `'********'` | Mirrors Twilio `authToken` masking; preserves stored token on PUT | ✓ |
| Return plain `botToken` | Simpler but exposes credential in admin API response | |

**Auto-selected:** Mask `botToken` (recommended — security parity with Twilio pattern)

---

## Claude's Discretion

- Exact Zod schema field structure — follow `insertTwilioSettingsSchema` closely
- Whether to include `POST /api/integrations/telegram/test` — noted as optional (not required by NOTIF-06–09)

## Deferred Ideas

- Admin UI in IntegrationsSection for bot token/chatId — Phase 33 scope
- Multiple chatId routing — not requested
