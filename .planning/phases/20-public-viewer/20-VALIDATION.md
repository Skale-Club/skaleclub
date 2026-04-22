---
phase: 20
slug: public-viewer
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-21
---

# Phase 20 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | TypeScript only (no test suite exists in project) |
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

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 20-01-01 | 01 | 1 | PRES-17 | manual + TS | `npm run check` | ❌ W0 | ⬜ pending |
| 20-01-02 | 01 | 1 | PRES-18 | manual + TS | `npm run check` | ❌ W0 | ⬜ pending |
| 20-01-03 | 01 | 1 | PRES-22 | manual | `npm run check` | ❌ W0 | ⬜ pending |
| 20-02-01 | 02 | 2 | PRES-19 | manual + TS | `npm run check` | ❌ W0 | ⬜ pending |
| 20-02-02 | 02 | 2 | PRES-20 | manual | `npm run check` | ❌ W0 | ⬜ pending |
| 20-02-03 | 02 | 2 | PRES-21 | manual | `npm run check` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No Wave 0 setup needed — TypeScript type checking is the automated gate.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Slug endpoint records view + strips accessCode from response | PRES-17 | No test suite; runtime DB side-effect | curl `/api/presentations/slug/:slug`, check response has no `accessCode`; reload admin and verify view count increments |
| `/p/:slug` has no Navbar/Footer/ChatWidget | PRES-18 | DOM visibility check | Open `/p/:slug` in browser; confirm no nav bar, footer, or chat widget |
| All 8 layout variants render without blank sections | PRES-19 | Visual rendering | Create a presentation with all 8 layout types; scroll through viewer confirming each renders |
| Language switch changes slide fields without page reload | PRES-20 | URL param behavior | Toggle `?lang=pt-BR` and `?lang=en` in viewer; confirm text switches, no scroll position reset |
| Access code gate shows before slides; wrong code shows inline error | PRES-21 | Interactive gate UX | Access a code-protected presentation; confirm gate shows; enter wrong code; confirm inline error |
| Admin view count badge increments after viewer load | PRES-22 | Cross-system side-effect | Visit `/p/:slug`; reload admin presentations list; confirm view count increased by 1 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
