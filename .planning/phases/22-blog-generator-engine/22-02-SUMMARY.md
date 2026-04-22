---
phase: 22-blog-generator-engine
plan: 02
subsystem: api
tags: [gemini, supabase, postgres, drizzle, blog, testing]
requires:
  - phase: 21-schema-storage-foundation
    provides: blog settings/job tables and storage methods
  - phase: 22-blog-generator-engine
    provides: skip gates, lock orchestration, and blog Gemini helper wiring
provides:
  - full blog topic, content, and optional image generation pipeline
  - draft blog post persistence with AI Assistant author metadata
  - completed and failed job finalization that updates settings lock state correctly
affects: [23-api-endpoints-cron, 24-admin-ui-automation-settings]
tech-stack:
  added: []
  patterns: [lazy runtime storage imports for executable service tests, injectable generation/upload hooks, non-blocking feature image pipeline]
key-files:
  created: []
  modified: [server/lib/blog-generator.ts, server/lib/__tests__/blog-generator.test.ts]
key-decisions:
  - "BlogGenerator now lazy-loads DB-backed defaults so the executable contract can run without a provisioned DATABASE_URL."
  - "Feature-image failures degrade to console.warn plus featureImageUrl null so draft creation still succeeds."
patterns-established:
  - "Blog generation finalizes the job only after createBlogPost succeeds and then clears the singleton settings lock."
  - "Gemini content is parsed from JSON defensively before saving HTML-ready blog content directly to blog_posts.content."
requirements-completed: [BLOG-05, BLOG-08, BLOG-09, BLOG-10, BLOG-11, BLOG-12]
duration: 11m
completed: 2026-04-22
---

# Phase 22 Plan 02: Blog Generator Engine Summary

**Gemini-powered topic, draft, and optional feature-image generation that saves AI-authored draft posts and finalizes blog jobs in the required order**

## Performance

- **Duration:** 11m
- **Started:** 2026-04-22T15:41:55Z
- **Completed:** 2026-04-22T15:52:32Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Expanded the executable contract to cover successful runs, image fallback, draft metadata, post-before-job ordering, and settings finalization behavior.
- Implemented Gemini topic generation, structured draft generation, defensive JSON parsing, and optional image upload to `images/blog-images/`.
- Wired draft post creation, completed-job `postId` assignment, and success/failure settings finalization so `lastRunAt` only updates on success while the lock clears in both branches.

## Task Commits

Each task was committed atomically:

1. **Task 1: Expand the executable spec for success, image fallback, and finalization ordering** - `48f2fb1` (test)
2. **Task 2: Implement the Gemini content/image pipeline, Supabase upload, and draft-post completion flow** - `df6635a` (feat)

**Plan metadata:** pending

_Note: TDD tasks may have multiple commits (test -> feat -> refactor)_

## Files Created/Modified
- `server/lib/blog-generator.ts` - runs the Gemini topic/content/image pipeline, uploads optional images, creates draft posts, and finalizes jobs/settings.
- `server/lib/__tests__/blog-generator.test.ts` - executable `tsx` contract that proves success, fallback, ordering, and failure-finalization behavior without live services.

## Decisions Made
- Used injectable generation and upload hooks inside `BlogGenerator` so the service stays fully executable in tests while the production path still uses the real Gemini and Supabase helpers.
- Kept image generation best-effort instead of fatal because BLOG-11 requires draft creation to succeed even when the feature image branch fails.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Removed eager DB/storage imports from the generator module**
- **Found during:** Task 2 (Implement the Gemini content/image pipeline, Supabase upload, and draft-post completion flow)
- **Issue:** The executable spec crashed before running because importing `server/lib/blog-generator.ts` eagerly loaded `server/db.ts`, which required `DATABASE_URL` even when tests injected fake storage and lock behavior.
- **Fix:** Swapped default DB and storage access to lazy runtime imports inside helper functions so the executable contract can load and run without a provisioned database connection.
- **Files modified:** `server/lib/blog-generator.ts`
- **Verification:** `npm run check && npx tsx server/lib/__tests__/blog-generator.test.ts`
- **Committed in:** `df6635a` (part of task commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** The fix was required to make the planned executable spec runnable; no scope creep.

## Issues Encountered
- The first green run failed because the test asserted an exact uploaded image URL; relaxing that assertion to a path pattern preserved the contract while allowing the runtime UUID to vary.

## User Setup Required

None - no external service configuration required for automated verification, though live generation still needs `BLOG_GEMINI_API_KEY` and Supabase env vars in later phases.

## Next Phase Readiness
- Phase 23 can call `BlogGenerator.generate()` from routes and cron with the full draft-return contract now in place.
- Admin automation settings can rely on `lastRunAt`, job `postId`, and non-blocking image behavior already being enforced at the service layer.

---
*Phase: 22-blog-generator-engine*
*Completed: 2026-04-22*

## Self-Check: PASSED
