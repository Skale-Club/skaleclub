---
phase: 8
slug: admin-ui-estimatessection
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-19
---

# Phase 8 — Validation Strategy

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
| 8-01-01 | 01 | 1 | EST-06 | type-check | `npm run check` | ✅ | ⬜ pending |
| 8-01-02 | 01 | 1 | EST-07 | type-check | `npm run check` | ✅ | ⬜ pending |
| 8-01-03 | 01 | 1 | EST-08 | type-check | `npm run check` | ✅ | ⬜ pending |
| 8-01-04 | 01 | 1 | EST-09 | type-check | `npm run check` | ✅ | ⬜ pending |
| 8-01-05 | 01 | 1 | EST-10 | type-check | `npm run check` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements — no test framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Estimates tab appears in sidebar | EST-06 | UI rendering, no test framework | Navigate to /admin, verify "Estimates" tab visible |
| List shows client name, slug, date, copy-link | EST-06 | UI rendering | Open Estimates tab, create estimate, verify list columns |
| Catalog picker pre-fills title/description/price | EST-07 | UI interaction | Open create dialog, select service from catalog, verify fields pre-filled |
| Custom row can be added manually | EST-08 | UI interaction | Open dialog, add custom row with manual title/desc/price |
| Drag reorder persists on save | EST-09 | UI interaction + persistence | Reorder rows via drag, save, re-open estimate, verify order preserved |
| Delete removes estimate from list | EST-10 | UI interaction | Delete estimate from list, verify it disappears |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
