---
phase: 21
slug: schema-storage-foundation
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-22
---

# Phase 21 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | TypeScript compiler (`tsc`) + `tsx` migration runner |
| **Config file** | `tsconfig.json` |
| **Quick run command** | `npm run check` |
| **Full suite command** | `npm run check && npx tsx scripts/migrate-blog-automation.ts` |
| **Estimated runtime** | ~20 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run check`
- **After every plan wave:** Run `npm run check && npx tsx scripts/migrate-blog-automation.ts`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 20 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 21-01-01 | 01 | 1 | BLOG-01, BLOG-02 | migration smoke | `npx tsx scripts/migrate-blog-automation.ts` | ✅ | ⬜ pending |
| 21-01-02 | 01 | 1 | BLOG-03 | compile | `npm run check` | ✅ | ⬜ pending |
| 21-01-03 | 01 | 1 | BLOG-04 | compile | `npm run check` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `SELECT * FROM blog_settings LIMIT 1` returns empty set instead of table error | BLOG-01 | Requires live DB inspection after migration | Run the migration script, then check the table in the target database |
| `blog_generation_jobs.post_id` has no FK constraint | BLOG-02 | Constraint inspection is DB-specific | Inspect table definition or attempt insert/update independently during execution verification |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 20s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
