---
phase: 23
slug: api-endpoints-cron
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-22
---

# Phase 23 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Executable `tsx` scripts + manual curl smoke tests (CLAUDE.md: "Manual QA only") |
| **Config file** | none — standalone executable scripts |
| **Quick run command** | `npm run check` |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run check`
- **After every plan wave:** Run `npm run check` + manual smoke of affected endpoints
- **Before `/gsd:verify-work`:** Full TypeScript pass + all 5 success criteria verified manually

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 23-01-01 | 01 | 1 | BLOG-13 | TypeScript + manual curl | `npm run check` | ❌ W0 | ⬜ pending |
| 23-01-02 | 01 | 1 | BLOG-14 | TypeScript + manual curl | `npm run check` | ❌ W0 | ⬜ pending |
| 23-01-03 | 01 | 1 | BLOG-15 | TypeScript + manual curl | `npm run check` | ❌ W0 | ⬜ pending |
| 23-01-04 | 01 | 1 | BLOG-16 | TypeScript + server log | `npm run check` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `server/routes/blogAutomation.ts` — new route file (BLOG-13, BLOG-14, BLOG-15)
- [ ] `server/cron.ts` — startCron() with setInterval guard (BLOG-16)
- [ ] Registration in `server/routes.ts` before `registerBlogRoutes` (route order pitfall)
- [ ] `startCron()` called in `server/index.ts` after server listen

*All Wave 0 items are new files — no existing infrastructure to scaffold.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| GET /api/blog/settings returns 200 with defaults when no DB row | BLOG-13 | No test framework; needs running server | `curl http://localhost:5000/api/blog/settings` — expect `{"enabled":false,...}` |
| PUT /api/blog/settings upserts; subsequent GET returns saved | BLOG-13 | Requires admin session | PUT with cookie + GET to verify round-trip |
| POST /api/blog/generate returns skip or success as 200 | BLOG-14 | Requires admin session + live BlogGenerator | POST with admin cookie; expect `{skipped,reason}` or `{jobId,postId,post}` |
| POST /api/blog/cron/generate with wrong token returns 401 | BLOG-15 | Needs running server | `curl -X POST -H "Authorization: Bearer wrong" http://localhost:5000/api/blog/cron/generate` — expect 401 |
| startCron() logs on non-Vercel startup | BLOG-16 | Requires server start observation | Start `npm run dev`; look for `[cron] blog auto-generator starting` in console |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
