---
phase: 40
slug: ai-presentation-generator
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-15
---

# Phase 40 — Validation Strategy

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
- **After every plan wave:** Visual browser check of admin + viewer
- **Before `/gsd:verify-work`:** TypeScript passes + manual E2E flow verified

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 40-01-01 | 01 | 1 | PRES2-05 | type-check | `npm run check` | ✅ | ⬜ pending |
| 40-02-01 | 02 | 1 | PRES2-06 | type-check | `npm run check` | ✅ | ⬜ pending |
| 40-02-02 | 02 | 1 | PRES2-07 | type-check | `npm run check` | ✅ | ⬜ pending |
| 40-03-01 | 03 | 2 | PRES2-08 | manual | browser admin modal | ✅ | ⬜ pending |
| 40-04-01 | 04 | 2 | PRES2-09 | manual | browser viewer controls | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements. No test framework to install.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| "Generate with AI" modal opens from admin | PRES2-08 | Browser UI | Click Generate button in PresentationsSection header; verify modal with title, textarea, audio button |
| Audio recording captures and displays transcription | PRES2-06 | Browser mic API | Click record, speak, stop; verify transcription appears in modal |
| Gemini generates full presentation from text prompt | PRES2-05 | Live AI call | Enter prompt "Agency intro 5 slides", click Generate; verify new presentation created with slides |
| Delete slide removes it from presentation | PRES2-09 | Browser UI | In ?edit=1 mode, click trash on a slide; verify slide removed and saved |
| AI-redo regenerates single slide | PRES2-09 | Live AI call | Click refresh on a slide in ?edit=1 mode; verify slide content changes |
| Inline edit saves heading/body changes | PRES2-09 | Browser UI | Click pencil, edit heading, blur; verify saved to DB |
| Per-slide controls hidden in public view | PRES2-09 | Browser UI | Visit /p/:slug without ?edit=1; verify no toolbar visible |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or manual verification defined
- [ ] TypeScript check passes after every wave
- [ ] Generator creates new presentation end-to-end (manual E2E)
- [ ] Per-slide controls work in edit mode only
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
