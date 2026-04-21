---
phase: 16
slug: admin-crud-api
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-21
---

# Phase 16 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — no test runner installed; TypeScript compiler + manual curl |
| **Config file** | `tsconfig.json` |
| **Quick run command** | `npm run check` |
| **Full suite command** | `npm run check` + manual curl smoke tests |
| **Estimated runtime** | ~10 seconds (tsc) |

---

## Sampling Rate

- **After every task commit:** Run `npm run check`
- **After every plan wave:** Run `npm run check` + curl unauthenticated smoke tests
- **Before `/gsd:verify-work`:** All 4 endpoints return 401 without auth + correct behavior with auth
- **Max feedback latency:** ~10 seconds (tsc)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 16-01-01 | 01 | 1 | PRES-05/06/07/08 | unit (tsc) | `npm run check` | ❌ Wave 0 | ⬜ pending |
| 16-01-02 | 01 | 1 | PRES-05/06/07/08 | unit (tsc) | `npm run check` | ❌ Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `server/routes/presentations.ts` — route handlers for GET, POST, PUT, DELETE (PRES-05, PRES-06, PRES-07, PRES-08)
- [ ] Registration in `server/routes.ts` — import + `app.use('/api/presentations', presentationsRouter)`
- [ ] IStorage interface declarations for presentation methods

*All Wave 0 items created by the single plan in this phase.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| GET /api/presentations returns correct fields array | PRES-05 | Requires running server + admin auth | Start server, curl with session cookie, verify array has id/slug/title/slideCount/viewCount/createdAt |
| POST creates record with empty slides, returns {id, slug} | PRES-06 | Requires running server + admin auth | curl POST with title, verify response has id+slug, verify slides=[] |
| PUT increments version | PRES-07 | Requires running server + admin auth | GET version before, PUT, GET version after, assert +1 |
| DELETE cascades presentation_views | PRES-08 | Requires running server + admin auth | Create presentation, GET to confirm, DELETE, GET to confirm absent |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
