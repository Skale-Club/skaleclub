---
phase: 22
slug: blog-generator-engine
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-22
---

# Phase 22 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | TypeScript compiler (`tsc`) + executable `tsx` assertion script |
| **Config file** | `tsconfig.json` |
| **Quick run command** | `npm run check` |
| **Full suite command** | `npm run check && npx tsx server/lib/__tests__/blog-generator.test.ts` |
| **Estimated runtime** | ~25 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run check`
- **After every plan wave:** Run `npm run check && npx tsx server/lib/__tests__/blog-generator.test.ts`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 25 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 22-01-01 | 01 | 1 | BLOG-05, BLOG-06 | executable assertions | `npx tsx server/lib/__tests__/blog-generator.test.ts` | ❌ W0 | ⬜ pending |
| 22-01-02 | 01 | 1 | BLOG-07 | compiler + executable assertions | `npm run check && npx tsx server/lib/__tests__/blog-generator.test.ts` | ✅ | ⬜ pending |
| 22-02-01 | 02 | 2 | BLOG-08, BLOG-09 | executable assertions | `npx tsx server/lib/__tests__/blog-generator.test.ts` | ✅ | ⬜ pending |
| 22-02-02 | 02 | 2 | BLOG-10, BLOG-11, BLOG-12 | compiler + executable assertions | `npm run check && npx tsx server/lib/__tests__/blog-generator.test.ts` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers the phase. The first task creates `server/lib/__tests__/blog-generator.test.ts` as the executable verification harness.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live Gemini call returns topic + structured blog JSON with the configured key fallback | BLOG-08 | Requires real external API credentials and quota | Set `BLOG_GEMINI_API_KEY` or `GEMINI_API_KEY`, run a manual invocation of `BlogGenerator.generate({ manual: true })`, confirm a draft post is created |
| Live image generation/upload stores a public image URL in Supabase `images/blog-images/...` | BLOG-09, BLOG-10 | Requires external Gemini + Supabase services | Run a manual generation with valid keys, inspect the created post and bucket path |
| Successful run updates `lastRunAt` and completed job data in the real database | BLOG-11, BLOG-12 | Requires DB state inspection after a live run | Inspect `blog_settings` and the latest `blog_generation_jobs` row after a successful manual generation |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 25s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
