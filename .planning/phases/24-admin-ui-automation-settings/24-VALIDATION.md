---
phase: 24
slug: admin-ui-automation-settings
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-22
---

# Phase 24 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — no test framework in project (manual QA only) |
| **Config file** | none |
| **Quick run command** | `npm run check` |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run check`
- **After every plan wave:** Run `npm run check`
- **Before `/gsd:verify-work`:** TypeScript must be clean + manual smoke tests
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 24-01-01 | 01 | 1 | BLOG-19 | tsc | `npm run check` | ✅ | ⬜ pending |
| 24-01-02 | 01 | 1 | BLOG-19 | tsc | `npm run check` | ✅ | ⬜ pending |
| 24-02-01 | 02 | 2 | BLOG-17, BLOG-18 | tsc | `npm run check` | ✅ | ⬜ pending |
| 24-02-02 | 02 | 2 | BLOG-19 | tsc | `npm run check` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements — TypeScript + React, no new tooling needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Automation tab renders in Blog section | BLOG-17 | No test framework | Navigate to /admin → Blog → Automation tab |
| Settings form saves and shows "Saved" | BLOG-17 | No test framework | Toggle enabled, click Save, verify isSaved state |
| "Generate Now" button spinner and toast | BLOG-18 | No test framework | Click Generate Now, observe spinner then toast |
| "Last generated: X ago" updates from lastRunAt | BLOG-19 | No test framework | Check timestamp display after a generation run |
| Error toast on generator skip | BLOG-18 | No test framework | Disable automation, click Generate Now, expect skip toast |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
