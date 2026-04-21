---
phase: 15
slug: schema-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-21
---

# Phase 15 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | TypeScript compiler (`tsc`) via `npm run check` |
| **Config file** | `tsconfig.json` |
| **Quick run command** | `npm run check` |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run check`
- **After every plan wave:** Run `npm run check` + manual `SELECT * FROM presentations LIMIT 1`
- **Before `/gsd:verify-work`:** Full suite must be green + migration script exits 0
- **Max feedback latency:** ~10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 15-01-01 | 01 | 1 | PRES-01/02/03 | smoke (manual SQL) | `npm run check` | ❌ Wave 0 | ⬜ pending |
| 15-01-02 | 01 | 1 | PRES-01/02/03 | unit (tsc) | `npm run check` | ❌ Wave 0 | ⬜ pending |
| 15-01-03 | 01 | 1 | PRES-04 | unit (tsc) | `npm run check` | ❌ Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `migrations/0033_create_presentations.sql` — raw SQL migration creating presentations, presentation_views, brand_guidelines tables (PRES-01, PRES-02, PRES-03)
- [ ] `scripts/migrate-presentations.ts` — runner script for the migration
- [ ] `shared/schema/presentations.ts` — Drizzle table definitions + Zod validators (PRES-01, PRES-02, PRES-03)
- [ ] `server/lib/anthropic.ts` — Anthropic SDK singleton (PRES-04)

*All Wave 0 items are created in the single plan for this phase — no pre-existing files to stub.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Tables created with correct columns | PRES-01/02/03 | No test framework; requires DB connection | Run migration, then `SELECT * FROM presentations LIMIT 1`, `SELECT * FROM presentation_views LIMIT 1`, `SELECT * FROM brand_guidelines LIMIT 1` — all must return empty result set, not error |
| Cascade delete on presentation_views | PRES-02 | Requires live DB | Insert test presentation + view row, delete presentation, verify view row is gone |
| Anthropic API reachable | PRES-04 | Requires live ANTHROPIC_API_KEY | Run server locally with ANTHROPIC_API_KEY set, call `getAnthropicClient()`, verify no error thrown |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
