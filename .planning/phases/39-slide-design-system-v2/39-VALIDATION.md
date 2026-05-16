---
phase: 39
slug: slide-design-system-v2
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-15
---

# Phase 39 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual only — no test framework in project (see CLAUDE.md) |
| **Config file** | none |
| **Quick run command** | `npm run check` (TypeScript type-check) |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run check`
- **After every plan wave:** Visual browser check of `/p/:slug` with test presentation
- **Before `/gsd:verify-work`:** TypeScript passes + manual slide rendering verified

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 39-01-01 | 01 | 1 | PRES2-01 | type-check | `npm run check` | ✅ | ⬜ pending |
| 39-01-02 | 01 | 1 | PRES2-02 | type-check | `npm run check` | ✅ | ⬜ pending |
| 39-02-01 | 02 | 2 | PRES2-03 | manual | browser `/p/:slug` | ✅ | ⬜ pending |
| 39-02-02 | 02 | 2 | PRES2-04 | manual | browser new layouts | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements. No test framework to install.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Existing slides render unchanged | PRES2-01 | Visual rendering | Load a presentation created before this phase; verify all 8 layouts still render correctly |
| New `image-left` layout renders image+text split | PRES2-03 | Visual rendering | Create test slide with `layout:"image-left"`, `style.bgImageUrl` set; verify split display |
| `full-bleed-image` shows background image with text overlay | PRES2-03 | Visual rendering | Create test slide with `layout:"full-bleed-image"`, `style.bgImageUrl`; verify overlay |
| `bgColor` overrides default zinc-950 background | PRES2-02 | Visual rendering | Create slide with `style.bgColor:"#1a1a2e"`; verify background color changes |
| `bgVideoUrl` plays muted looped video | PRES2-04 | Visual rendering | Set `style.bgVideoUrl` to public video URL; verify autoplay muted loop |
| `quote` layout shows pull-quote with attribution | PRES2-03 | Visual rendering | Create slide with `layout:"quote"`, `heading`, `attribution`; verify large text format |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or manual verification defined
- [ ] TypeScript check passes after every wave
- [ ] Backwards compatibility: existing slides render without modification
- [ ] No watch-mode flags
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
