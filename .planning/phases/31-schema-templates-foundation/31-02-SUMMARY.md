---
plan: 31-02
phase: 31-schema-templates-foundation
status: complete
completed: 2026-05-04
tasks_completed: 2
tasks_total: 2
requirements: [NOTIF-02, NOTIF-03, NOTIF-04]
self_check: PASSED
---

# Plan 31-02 Summary: Dispatcher Service + Call Site Refactors

## What Was Built

Dispatcher service (`server/lib/notifications.ts`) with `dispatchNotification(storage, eventKey, variables)` as the single entry point for all notification delivery. All 4 direct Twilio call sites replaced with the dispatcher.

## Tasks

### Task 1: Export sendSms/validateConfig/TwilioConfig + create dispatcher
- Added `export` to `TwilioConfig`, `TwilioValidationResult`, `validateConfig`, `sendSms` in `server/integrations/twilio.ts`
- Created `server/lib/notifications.ts` with `dispatchNotification()` and `substituteVariables()` helper
- Dispatcher queries DB templates by `eventKey`, substitutes `{{variable}}` tokens, routes to SMS or Telegram stub

### Task 2: Replace 4 Twilio call sites with dispatchNotification
- `server/routes.ts` import updated: removed `sendHotLeadNotification/sendLowPerformanceAlert/sendNewChatNotification`, added `dispatchNotification`
- `hot_lead` call site in `routes.ts` (~line 418): replaced with `await dispatchNotification(storage, 'hot_lead', {...})`
- `low_perf_alert` call site in `routes.ts` (~line 720): fire-and-forget `.catch()` pattern, formats `avgSeconds` to `"Xm Ys"` string before passing as `{{avgTime}}`
- `new_chat` call site in `routes.ts` (~line 934): explicitly guards on `twilioSettings?.notifyOnNewChat` before dispatching (preserves original `requireNotify: true` behavior per NOTIF-03); fire-and-forget `.catch()` preserved
- `hot_lead` call site in `server/lib/lead-processing.ts` (~line 32): replaced with `await dispatchNotification(storage, 'hot_lead', {...})` using module-level `storage` singleton

## Key Files

### Created
- `server/lib/notifications.ts` — dispatcher + substituteVariables

### Modified
- `server/integrations/twilio.ts` — added exports for sendSms, validateConfig, TwilioConfig, TwilioValidationResult
- `server/routes.ts` — replaced 3 call sites + import
- `server/lib/lead-processing.ts` — replaced 1 call site + import

## Verification

- `npm run check` — zero TypeScript errors ✓
- No remaining `sendHotLeadNotification/sendLowPerformanceAlert/sendNewChatNotification` in routes.ts or lead-processing.ts ✓
- All 4 call sites use `dispatchNotification` ✓
- `notifyOnNewChat` guard preserved at new_chat call site ✓
- Fire-and-forget `.catch()` preserved for new_chat and low_perf_alert ✓

## Decisions

- `notificacaoEnviada` flag set unconditionally after dispatch (dispatcher swallows channel errors internally — flag marks "notification attempted", not "notification confirmed delivered")
- `lastLowPerformanceAlertAt` set unconditionally after dispatch (same rationale — non-blocking alert)
- `low_perf_alert` formats `avgSeconds` at call site (dispatcher receives formatted string `{{avgTime}}`) per RESEARCH.md Pitfall 3
- Known minor delta (documented in RESEARCH.md Pitfall 2): `new_chat` SMS body always renders `Página: {{pageUrl}}` — when `pageUrl` is empty, renders as `Página: ` with trailing blank vs. original omitting the line entirely; acceptable since Phase 33 template editor allows admins to customize

## Commits

- `b69a533` feat(31-02): export sendSms/validateConfig/TwilioConfig from twilio.ts + create dispatcher
- `efae449` feat(31-02): replace 4 Twilio call sites with dispatchNotification
