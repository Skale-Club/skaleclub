---
phase: 32
slug: telegram-integration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-04
---

# Phase 32 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | none — Manual QA only (project has no test framework) |
| **Config file** | none |
| **Quick run command** | `npm run check` (TypeScript type-check) |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run check`
- **After every plan wave:** Run `npm run check` + manual integration spot-check
- **Before `/gsd:verify-work`:** Full `npm run check` must be green
- **Max feedback latency:** ~5 seconds (tsc) + manual spot-check

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 32-01-01 | 01 | 1 | NOTIF-06 | type-check | `npm run check` | ✅ | ⬜ pending |
| 32-01-02 | 01 | 1 | NOTIF-07 | type-check + manual | `npm run check` | ✅ W0 | ⬜ pending |
| 32-01-03 | 01 | 1 | NOTIF-08 | type-check | `npm run check` | ✅ | ⬜ pending |
| 32-01-04 | 01 | 1 | NOTIF-09 | manual | — | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements (no test framework — TypeScript compilation is the automated gate).

- [ ] `server/integrations/telegram.ts` — must be created before dispatcher wiring
- [ ] `shared/schema/settings.ts` exports — must compile before route registration

*Migration script (`scripts/migrate-telegram-settings.ts`) must run successfully before integration testing.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Telegram message received in chat | NOTIF-07 | No test framework; requires live bot + chat | Configure bot token + chatId in admin, trigger notification event, verify message arrives in Telegram |
| `botToken` masked as `'********'` on GET | NOTIF-06 | HTTP response inspection | `curl -H "Cookie: ..." /api/integrations/telegram` — confirm botToken field is `'********'` |
| Dispatcher skips telegram when `enabled=false` | NOTIF-08 | Runtime behavior | Set enabled=false in admin, trigger hot_lead event, confirm no Telegram message received |
| Markdown rendering in Telegram | NOTIF-09 | Telegram client inspection | Send test message with `*bold*` in template, verify bold rendering in Telegram client |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or manual test instructions
- [ ] `npm run check` passes after each task
- [ ] Migration script runs without error
- [ ] Live Telegram integration tested manually (bot receives messages)
- [ ] `nyquist_compliant: true` set in frontmatter when above complete

**Approval:** pending
