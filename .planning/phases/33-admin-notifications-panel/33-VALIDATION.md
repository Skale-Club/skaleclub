---
phase: 33
slug: admin-notifications-panel
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-04
---

# Phase 33 — Validation Strategy

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
- **After every plan wave:** Run `npm run check` + manual spot-check in dev browser
- **Before `/gsd:verify-work`:** Full `npm run check` must be green
- **Max feedback latency:** ~5 seconds (tsc)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 33-01-01 | 01 | 1 | NOTIF-10, NOTIF-13 | type-check | `npm run check` | ⬜ pending |
| 33-01-02 | 01 | 1 | NOTIF-10, NOTIF-11, NOTIF-12 | type-check | `npm run check` | ⬜ pending |
| 33-01-03 | 01 | 1 | NOTIF-10 | type-check | `npm run check` | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements — no test framework, TypeScript compilation is the automated gate.

Pre-conditions (ordering constraints, not test files):
- [ ] `server/routes/notifications.ts` must exist before wiring into `server/routes.ts`
- [ ] `NotificationsSection.tsx` must compile before Admin.tsx renders it

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Notifications section appears in admin sidebar | NOTIF-10 | UI inspection | Navigate to /admin, confirm "Notifications" appears in sidebar |
| Three event cards render (new_chat, hot_lead, low_perf_alert) | NOTIF-10 | UI inspection | Open Notifications section, confirm 3 cards visible |
| Edit opens inline per-channel editor | NOTIF-11 | UI interaction | Each card shows SMS + Telegram rows with textarea and active toggle |
| Variable badges display per event | NOTIF-12 | UI inspection | Confirm {{company}}, {{name}} etc. visible below each textarea |
| Saving template persists without restart | NOTIF-13 | Runtime behavior | Edit SMS body text, save, trigger a hot_lead notification, confirm new text in SMS |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify (`npm run check`)
- [ ] `npm run check` passes after each task
- [ ] Manual spot-check: 3 event cards render in dev server
- [ ] Manual spot-check: save persists template to DB
- [ ] `nyquist_compliant: true` set in frontmatter when above complete

**Approval:** pending
