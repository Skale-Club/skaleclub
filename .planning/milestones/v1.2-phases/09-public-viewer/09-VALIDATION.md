---
phase: 9
slug: public-viewer
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-19
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual only (no test framework configured per CLAUDE.md) |
| **Config file** | none |
| **Quick run command** | `npm run check` |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run check`
- **After every plan wave:** Run `npm run check` + manual browser smoke test
- **Before `/gsd:verify-work`:** TypeScript must pass + all success criteria verified manually
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 9-01-01 | 01 | 1 | EST-11, EST-12 | type-check | `npm run check` | ✅ | ⬜ pending |
| 9-01-02 | 01 | 1 | EST-11 | type-check | `npm run check` | ✅ | ⬜ pending |
| 9-02-01 | 02 | 2 | EST-13..EST-18 | type-check | `npm run check` | ✅ | ⬜ pending |
| 9-02-02 | 02 | 2 | EST-11, EST-12 | type-check | `npm run check` | ✅ | ⬜ pending |
| 9-03-01 | 03 | 3 | EST-11, EST-12 | type-check | `npm run check` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements — no test framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| /e/:slug renders fullscreen, no Navbar/Footer/ChatWidget | EST-13 | UI rendering | Navigate to /e/:slug in browser, inspect page |
| Cover section shows client name + branding | EST-14 | UI rendering | Create estimate, open viewer link |
| Intro section (Skale Club fixed intro) visible | EST-15 | UI rendering | Scroll to section 2 in viewer |
| Each service renders as fullscreen section | EST-16 | UI rendering | Add services, verify each gets its own section |
| Closing section appears after services | EST-17 | UI rendering | Scroll to end of viewer |
| Unknown slug shows graceful 404 | EST-18 | UI rendering | Navigate to /e/nonexistent |
| View event recorded on page load | EST-11 | DB + API | Load viewer, check admin list for view count increment |
| Admin list shows view count + last seen | EST-11 | UI rendering | Check EstimatesSection after viewing |
| Access code gate appears when set | EST-12 | UI interaction | Set access_code in admin, open viewer link |
| Wrong code shows inline error | EST-12 | UI interaction | Enter wrong code, verify inline error |
| Correct code grants access | EST-12 | UI interaction | Enter correct code, verify viewer renders |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
