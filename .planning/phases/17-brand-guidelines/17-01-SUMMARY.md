---
phase: 17-brand-guidelines
plan: 01
subsystem: api, ui, database
tags: [brand-guidelines, presentations, drizzle, react-query, admin, typescript]

# Dependency graph
requires:
  - phase: 15-schema-foundation
    provides: presentations/brand_guidelines DB schema (this plan creates it in parallel)
provides:
  - GET /api/brand-guidelines public endpoint returning { content: string }
  - PUT /api/brand-guidelines admin-auth endpoint for upsert
  - brand_guidelines singleton table (serial PK, content TEXT, updatedAt)
  - getBrandGuidelines() / upsertBrandGuidelines() storage methods on IStorage + DatabaseStorage
  - BrandGuidelinesSection.tsx admin component (AdminCard + Textarea + save mutation)
  - Admin sidebar Presentations section at /admin/presentations
affects: [18-ai-authoring, 20-public-viewer]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - singleton upsert pattern (check existing row → UPDATE or INSERT, returning())
    - public GET + admin-auth PUT pair for singleton resource

key-files:
  created:
    - shared/schema/presentations.ts
    - server/routes/brandGuidelines.ts
    - client/src/components/admin/BrandGuidelinesSection.tsx
    - migrations/0033_create_presentations.sql
    - scripts/migrate-presentations.ts
    - .planning/phases/17-brand-guidelines/17-01-PLAN.md
  modified:
    - shared/schema.ts
    - server/storage.ts
    - server/routes.ts
    - client/src/components/admin/shared/types.ts
    - client/src/components/admin/shared/constants.ts
    - client/src/pages/Admin.tsx
    - client/src/lib/translations.ts

key-decisions:
  - "GET /api/brand-guidelines requires no auth — Phase 18 AI endpoint reads it server-side without user session"
  - "BrandGuidelinesSection renders at /admin/presentations sidebar entry — Phase 19 will expand this section with presentation list; the route is established here"
  - "presentations schema created in parallel with Phase 15 — identical to Phase 15's output; merge will deduplicate idempotently"

requirements-completed: [PRES-09, PRES-10]

# Metrics
duration: 6min
completed: 2026-04-21
---

# Phase 17 Plan 01: Brand Guidelines Summary

**GET/PUT /api/brand-guidelines endpoints + singleton DB table + BrandGuidelinesSection admin textarea editor wired at /admin/presentations**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-04-21T21:32:48Z
- **Completed:** 2026-04-21T21:38:47Z
- **Tasks:** 3
- **Files modified:** 12

## Accomplishments
- Brand guidelines singleton table schema (`brand_guidelines`) with serial PK, `content TEXT`, `updatedAt`
- Storage layer: `getBrandGuidelines()` and `upsertBrandGuidelines(content)` on IStorage + DatabaseStorage with upsert-by-id pattern
- Public `GET /api/brand-guidelines` → `{ content: string }` (no auth, Phase 18 AI reads server-side)
- Admin `PUT /api/brand-guidelines` (requireAdmin) validates string content, upserts via storage
- `BrandGuidelinesSection.tsx`: AdminCard with Textarea (20 rows, monospace, resizable), useQuery fetch, useMutation save, PT translations
- `presentations` added to AdminSection type + SIDEBAR_MENU_ITEMS with Presentation icon at `/admin/presentations`
- 9 PT static translation keys added to translations.ts

## Task Commits

Each task was committed atomically:

1. **Task 1: Schema + storage** - `3ded3fe` (feat)
2. **Task 2: Brand guidelines routes** - `bc72b94` (feat)
3. **Task 3: Admin UI + Admin.tsx wiring** - `1d5d8e9` (feat)

## Files Created/Modified
- `shared/schema/presentations.ts` - presentations, presentationViews, brandGuidelines Drizzle tables + Zod schemas
- `shared/schema.ts` - barrel: added `export * from "./schema/presentations.js"`
- `server/storage.ts` - added brandGuidelines import, BrandGuidelines type, IStorage methods, DatabaseStorage implementation
- `server/routes/brandGuidelines.ts` - GET (public) + PUT (requireAdmin) for /api/brand-guidelines
- `server/routes.ts` - import + register registerBrandGuidelinesRoutes
- `client/src/components/admin/BrandGuidelinesSection.tsx` - admin textarea editor component
- `client/src/components/admin/shared/types.ts` - added 'presentations' to AdminSection union
- `client/src/components/admin/shared/constants.ts` - added Presentations sidebar menu entry
- `client/src/pages/Admin.tsx` - import BrandGuidelinesSection, add to both slug maps + render
- `client/src/lib/translations.ts` - 9 new PT keys for brand guidelines strings
- `migrations/0033_create_presentations.sql` - idempotent SQL for presentations + presentation_views + brand_guidelines
- `scripts/migrate-presentations.ts` - migration runner with verification

## Decisions Made
- GET /api/brand-guidelines is public (no requireAdmin) because Phase 18's AI endpoint calls it server-side without a user session context — avoids circular auth dependency
- BrandGuidelinesSection renders at `/admin/presentations` sidebar entry — Phase 19 will add presentation list to this same section; the route is established here
- presentations schema created in this worktree in parallel with Phase 15 — content is identical; merge will be idempotent (same CREATE TABLE IF NOT EXISTS SQL)

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered
None — TypeScript check (`npm run check`) passed with zero errors after all 3 tasks.

## User Setup Required
Run the migration to create presentations, presentation_views, and brand_guidelines tables:
```bash
npx tsx scripts/migrate-presentations.ts
```

## Next Phase Readiness
- Phase 18 (AI authoring endpoint) can now read `GET /api/brand-guidelines` as system prompt source
- Phase 19 (Admin Chat Editor) will expand `/admin/presentations` with the presentations list and chat panel — `BrandGuidelinesSection` will be embedded as a sub-section within Phase 19's layout
- Phase 20 (Public Viewer) has no dependency on brand guidelines

---
*Phase: 17-brand-guidelines*
*Completed: 2026-04-21*
