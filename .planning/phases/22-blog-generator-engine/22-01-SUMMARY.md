---
phase: 22-blog-generator-engine
plan: 01
subsystem: api
tags: [gemini, google-genai, postgres, drizzle, blog, testing]
requires:
  - phase: 21-schema-storage-foundation
    provides: blog settings/job tables and storage methods
provides:
  - blog-specific Gemini client helper with fallback key resolution
  - BlogGenerator preflight skip logic and stale lock orchestration
  - executable assertion harness for skip, lock, and failed-job cleanup behavior
affects: [23-api-endpoints-cron, 24-admin-ui-automation-settings]
tech-stack:
  added: [@google/genai]
  patterns: [blog-specific provider helper, injectable generator dependencies for executable assertions, guarded singleton row lock]
key-files:
  created: [server/lib/blog-gemini.ts, server/lib/blog-generator.ts, server/lib/__tests__/blog-generator.test.ts]
  modified: [package.json, package-lock.json, .env.example]
key-decisions:
  - "Use a dedicated @google/genai singleton for blog automation without changing the existing chat Gemini helper."
  - "Expose narrow test dependency hooks so the executable spec can verify skip and lock branches without a live database or Gemini credentials."
patterns-established:
  - "Blog generator preflight returns skip metadata instead of throwing for non-run conditions."
  - "Global blog lock uses one guarded update against the singleton blog_settings row with a 10-minute stale window."
requirements-completed: [BLOG-05, BLOG-06, BLOG-07]
duration: 8m
completed: 2026-04-22
---

# Phase 22 Plan 01: Blog Generator Engine Summary

**Blog-specific Gemini wiring with deterministic BlogGenerator skip reasons, singleton DB lock handling, and an executable contract harness**

## Performance

- **Duration:** 8m
- **Started:** 2026-04-22T15:31:37Z
- **Completed:** 2026-04-22T15:39:59Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Added `@google/genai`, documented `BLOG_GEMINI_API_KEY`, and isolated blog Gemini client setup in `server/lib/blog-gemini.ts`.
- Implemented `BlogGenerator.generate({ manual })` with deterministic skip results for missing settings, disabled automation, zero cadence, too-soon cadence, and lock contention.
- Added an executable `tsx` contract script that covers manual bypass, lock contention, and failed-job cleanup without requiring live Gemini credentials.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add the dedicated Gemini contract and executable generator spec** - `106922f` (test), `207493f` (feat)
2. **Task 2: Implement `BlogGenerator.generate()` preflight, lock, and running-job orchestration** - `dd15614` (feat)

**Plan metadata:** pending

_Note: TDD tasks may have multiple commits (test -> feat -> refactor)_

## Files Created/Modified
- `server/lib/blog-gemini.ts` - resolves blog Gemini credentials in fallback order and caches the official SDK client.
- `server/lib/blog-generator.ts` - owns preflight gates, guarded lock acquisition, running-job creation, and failed-job cleanup.
- `server/lib/__tests__/blog-generator.test.ts` - executable assertion harness for skip reasons, manual bypass behavior, lock contention, and cleanup semantics.
- `package.json` - adds `@google/genai` for the blog subsystem.
- `package-lock.json` - locks the new Gemini SDK dependency tree.
- `.env.example` - documents the optional `BLOG_GEMINI_API_KEY` override.

## Decisions Made
- Used a blog-only Gemini helper instead of touching `server/lib/gemini.ts`, preserving the existing chat integration path.
- Kept `BlogGenerator.generate()` as the only public entry point while exposing test-only dependency hooks for storage, lock, clock, and pipeline behavior.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- `server/db.ts` evaluates env vars on import, so verification used an exported placeholder `DATABASE_URL` even though the test harness injects storage and lock behavior.

## User Setup Required

None - no external service configuration required for this plan's automated verification.

## Known Stubs
- `server/lib/blog-generator.ts:108` - `runPipeline()` is still a deliberate placeholder that validates the Gemini helper boundary and throws until Plan 22-02 wires the real topic/content/image/post pipeline.

## Next Phase Readiness
- Phase 22-02 can replace the private `runPipeline()` placeholder with real Gemini content/image generation, Supabase upload, draft post creation, and success finalization.
- Phase 23 can build API endpoints directly on the stable skip/result contract from `BlogGenerator.generate()`.

---
*Phase: 22-blog-generator-engine*
*Completed: 2026-04-22*

## Self-Check: PASSED
