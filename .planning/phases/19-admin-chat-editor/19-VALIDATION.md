---
phase: 19
slug: admin-presentations-editor
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-22
---

# Phase 19 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — TypeScript check + manual browser testing |
| **Config file** | None |
| **Quick run command** | `npm run check` |
| **Full suite command** | `npm run check` then manual browser at localhost:5000/admin |
| **Estimated runtime** | ~5 seconds (TypeScript check) |

---

## Sampling Rate

- **After every task commit:** Run `npm run check`
- **After every plan wave:** `npm run check` + brief manual smoke test
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 19-01-01 | 01 | 1 | PRES-14 | TypeScript | `npm run check` | ✅ | ⬜ pending |
| 19-01-02 | 01 | 1 | PRES-15, PRES-16 | TypeScript | `npm run check` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Manual Browser Tests

### Test 1: Presentations List (PRES-14)
1. Open `/admin` → click Presentations in sidebar
2. Verify: list shows title, slide count, view count badge, copy-link button, delete button, Open Editor button
3. Click delete → confirm dialog appears → confirm → row removed without page reload
4. Click copy-link → clipboard contains `/p/{slug}` URL

### Test 2: JSON Editor (PRES-15)
1. Click "Open Editor" on any presentation
2. Verify: textarea shows current SlideBlock[] JSON (or `[]` for new), Save button visible, mini-cards shown
3. Edit JSON to a valid SlideBlock[], click Save → mini-cards update
4. Enter invalid JSON → inline error message shown, Save button disabled

### Test 3: Slide Mini-Cards (PRES-16)
1. After saving valid SlideBlock[], verify cards show layout type badge + heading text
2. All 8 layout variants display without blank/broken card

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| List renders real DB data | PRES-14 | Requires live DB + running server | Open admin/presentations with real presentations in DB |
| JSON save persists to DB | PRES-15 | Requires live DB | Edit JSON, save, reload page — verify JSON persisted |
| Copy-link puts correct URL in clipboard | PRES-14 | Browser clipboard API | Click copy-link, paste in address bar |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or manual equivalents documented
- [ ] Sampling continuity: no 3 consecutive tasks without verification
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s (TypeScript)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
