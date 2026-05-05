---
phase: 38
slug: dynamic-cron-observability
status: approved
nyquist_compliant: false
wave_0_complete: true
created: 2026-05-05
note: Project has no test framework (CLAUDE.md "Manual QA only"). All validation is manual.
---

# Phase 38 — Validation Strategy

> Per-phase validation contract. Project constraint: **no test framework available** (CLAUDE.md). Validation is manual — Wave 0 is N/A; sampling rate is "user verifies after execute-phase".

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None (project constraint — manual QA only per CLAUDE.md) |
| **Config file** | none |
| **Quick run command** | `npm run check` (TypeScript only) |
| **Full suite command** | `npm run check` (TypeScript only) |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** `npm run check` to catch type regressions
- **After every plan wave:** `npm run check` (no automated test suite exists)
- **Before `/gsd:verify-work`:** Manual UAT covering BLOG2-14/15/16 acceptance criteria
- **Max feedback latency:** ~10s (TypeScript compile)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 38-01-01 | 01 | 1 | BLOG2-15 | type | `npm run check` | n/a | ⬜ pending |
| 38-01-02 | 01 | 1 | BLOG2-15 | type | `npm run check` | n/a | ⬜ pending |
| 38-02-01 | 02 | 2 | BLOG2-14 | type | `npm run check` | n/a | ⬜ pending |
| 38-02-02 | 02 | 2 | BLOG2-16 | type | `npm run check` | n/a | ⬜ pending |
| 38-02-03 | 02 | 2 | BLOG2-15 | type | `npm run check` | n/a | ⬜ pending |
| 38-03-01 | 03 | 3 | BLOG2-15 | type | `npm run check` | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements — no test stubs to author.

(Project has no test framework; `npm run check` covers TypeScript correctness only.)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Cron interval responds to `postsPerDay` change without restart | BLOG2-14 | Requires running long-lived node process; observing scheduler logs across multiple ticks | `npm run dev` → admin sets `postsPerDay=24` → wait one tick → observe log shows `interval=60min` (clamp); change to `postsPerDay=2` → next tick logs `interval=720min` |
| `durations_ms` JSONB populated on every completed job | BLOG2-15 | Requires real Gemini call + DB inspection | Trigger Generate Now → preview → Save → query `SELECT durations_ms FROM blog_generation_jobs ORDER BY id DESC LIMIT 1` → verify object has 5 numeric keys |
| Transient Gemini failure auto-retries | BLOG2-16 | Requires forced 5xx (e.g., temporarily set bad endpoint or use sinon stub at runtime) | Mock Gemini to throw 503 once → verify console logs show retry at 1s, 5s; verify post still saves |
| Image failure remains non-blocking after retry exhaustion | D-03 (carries Phase 22 D-04) | Requires forced image failure 3x | Mock image API to throw 3x → verify post saves with `featureImageUrl: null` and `console.warn` is logged |
| Admin sees `total` chip + expand-on-click breakdown | BLOG2-15 admin facing | UI behavior (collapsed/expanded toggle, format) | Admin → Blog → RSS → Jobs sub-tab → click row → verify per-stage table appears with topic/content/image/upload/total in seconds |

---

## Validation Sign-Off

- [x] All tasks have automated `npm run check` or manual UAT
- [x] Sampling continuity: every task commits with `npm run check` clean
- [x] Wave 0 N/A — no test framework
- [x] No watch-mode flags
- [x] Feedback latency ~10s
- [ ] `nyquist_compliant: true` — N/A (manual-only project)

**Approval:** approved 2026-05-05 — manual-only constraint accepted per CLAUDE.md
