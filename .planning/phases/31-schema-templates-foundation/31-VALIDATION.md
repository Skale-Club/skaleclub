---
phase: 31
slug: schema-templates-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-04
---

# Phase 31 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None (no test framework available — manual QA + TypeScript compiler) |
| **Config file** | none |
| **Quick run command** | `npm run check` |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run check`
- **After every plan wave:** Run `npm run check`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 31-01-01 | 01 | 1 | NOTIF-01 | compile | `npm run check` | ⬜ pending |
| 31-01-02 | 01 | 1 | NOTIF-05 | compile | `npm run check` | ⬜ pending |
| 31-01-03 | 01 | 2 | NOTIF-02 | compile | `npm run check` | ⬜ pending |
| 31-01-04 | 01 | 3 | NOTIF-03 | manual | seed script run | ⬜ pending |
| 31-01-05 | 01 | 3 | NOTIF-04 | compile | `npm run check` | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements — no new test framework needed. All verification is via TypeScript compiler (`npm run check`) and manual validation of seed data.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 6 seed rows inserted correctly | NOTIF-03 | No test framework | Run seed script, then `SELECT * FROM notification_templates` in DB console |
| dispatchNotification sends SMS via existing Twilio path | NOTIF-02 | No integration test infra | Trigger a hot_lead event in dev, confirm Twilio SMS received |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
