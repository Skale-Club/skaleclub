---
phase: 17
slug: brand-guidelines
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-21
---

# Phase 17 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — no test runner installed; TypeScript compiler + manual curl/browser |
| **Config file** | `tsconfig.json` |
| **Quick run command** | `npm run check` |
| **Full suite command** | `npm run check` + manual curl smoke tests |
| **Estimated runtime** | ~10 seconds (tsc) |

---

## Sampling Rate

- **After every task commit:** Run `npm run check`
- **After every plan wave:** Run `npm run check` + curl unauthenticated GET smoke test
- **Before `/gsd:verify-work`:** All endpoints return correct shapes + admin UI shows editor
- **Max feedback latency:** ~10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 17-01-01 | 01 | 1 | PRES-09 | unit (tsc) | `npm run check` | ❌ Wave 0 | ⬜ pending |
| 17-01-02 | 01 | 1 | PRES-10 | unit (tsc) | `npm run check` | ❌ Wave 0 | ⬜ pending |
| 17-01-03 | 01 | 1 | PRES-10 | unit (tsc) | `npm run check` | ❌ Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `server/routes/presentations.ts` — add GET + PUT `/api/brand-guidelines` handlers (PRES-09)
- [ ] `shared/types.ts` — add `'presentations'` to AdminSection union (PRES-10)
- [ ] `shared/constants.ts` — add Presentations entry to SIDEBAR_MENU_ITEMS (PRES-10)
- [ ] `Admin.tsx` — add to both slug maps + render switch (PRES-10)
- [ ] `client/src/components/admin/PresentationsSection.tsx` — brand guidelines editor (PRES-10)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| GET returns 200 with null before any PUT | PRES-09 | Requires running server | `curl http://localhost:5000/api/brand-guidelines` → must return `{"content":null}` or `{"content":""}` not 404 |
| PUT upserts + GET returns saved content | PRES-09 | Requires admin auth | PUT with auth cookie, then GET, verify content matches |
| PUT > 2000 chars returns 400 | PRES-09 | Requires running server | PUT with 2001-char string, expect 400 + error message |
| Admin editor visible in Presentations tab | PRES-10 | Browser test | Open admin, click Presentations, see textarea with char count |
| Save shows "Saved" confirmation | PRES-10 | Browser test | Type in editor, click Save, verify SavedIndicator appears |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
