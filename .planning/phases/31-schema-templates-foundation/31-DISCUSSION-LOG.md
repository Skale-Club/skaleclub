# Phase 31: Schema & Templates Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-04
**Phase:** 31-schema-templates-foundation
**Areas discussed:** Seeding strategy, Dispatcher storage access, Caller refactor depth

---

## Seeding Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| A — Raw SQL migration script | `script/seed-notification-templates.ts`, explicit one-time run, matches Phase 6/9 pattern | ✓ |
| B — Storage upsert-on-boot | Server ensures rows exist at startup | |
| C — Lazy upsert on first admin GET | `ensureDefaultTemplates()` called once on first read | |

**User's choice:** Recommended (A)
**Notes:** Matches established migration script pattern from earlier phases.

---

## Dispatcher Storage Access

| Option | Description | Selected |
|--------|-------------|----------|
| A — Inject storage as parameter | `dispatchNotification(storage, eventKey, vars)` — clean, testable | ✓ |
| B — Import storage singleton directly | Simpler callers, harder to test | |

**User's choice:** Recommended (A)

---

## Caller Refactor Depth

| Option | Description | Selected |
|--------|-------------|----------|
| A — Full replacement at all 4 call sites | Routes call dispatcher, not Twilio functions directly | ✓ |
| B — Thin wrapper | Keep existing Twilio functions, have them call dispatcher internally | |

**User's choice:** Recommended (A)
**Notes:** Achieves the goal of callers never dealing with message text.

---

## Claude's Discretion

- Template body text for seed rows
- Whether to add a `name` column to `notification_templates`
- Telegram seed row Markdown formatting

## Deferred Ideas

None.
