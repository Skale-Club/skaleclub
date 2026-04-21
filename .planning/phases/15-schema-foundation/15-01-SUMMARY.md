---
phase: 15-schema-foundation
plan: 01
subsystem: database
tags: [drizzle, zod, postgres, jsonb, uuid, presentations, rls]

# Dependency graph
requires: []
provides:
  - migrations/0033_create_presentations.sql — idempotent SQL creating presentations, presentation_views, brand_guidelines tables
  - scripts/migrate-presentations.ts — tsx migration runner with triple table verification
  - shared/schema/presentations.ts — Drizzle table definitions + Zod validators (slideBlockSchema, insertPresentationSchema, selectPresentationSchema)
  - shared/schema.ts — barrel now re-exports presentations schema
  - server/storage.ts — presentations/presentationViews/brandGuidelines tables imported; stub CRUD methods added
affects: [16-admin-crud-api, 17-brand-guidelines, 18-ai-authoring, 19-admin-chat-editor, 20-public-viewer]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - UUID PK + UUID slug (both defaultRandom) for presentation public links
    - ip_hash TEXT (not ipAddress) for SHA-256 privacy-preserving view tracking
    - Manual Zod insert schema for JSONB tables (drizzle-zod generates unknown for jsonb)
    - guidelinesSnapshot as TEXT not JSONB — markdown content, not structured data
    - Storage stub pattern: Phase N adds typed method shells; Phase N+1 wires API routes

key-files:
  created:
    - migrations/0033_create_presentations.sql
    - scripts/migrate-presentations.ts
    - shared/schema/presentations.ts
  modified:
    - shared/schema.ts
    - server/storage.ts

key-decisions:
  - "UUID slug (not text) for presentations — unguessable public URL, consistent with PRES-01 spec"
  - "guidelinesSnapshot is TEXT not JSONB — content is markdown, not structured JSON; avoids JSONB complexity for plain text storage"
  - "ip_hash TEXT (not ip_address) — SHA-256 hashing is Phase 17/20 concern; column named ip_hash from the start per PRES-02"
  - "Manual Zod insert schema — drizzle-zod generates unknown for JSONB columns; follows cms.ts convention established in estimates"
  - "Storage stubs in Phase 15 — typed method shells ensure downstream phases compile before routes are wired"

patterns-established:
  - "Pattern 1: UUID PK + UUID slug both use .defaultRandom() — different columns, both auto-generated UUIDs"
  - "Pattern 2: UUID FK on presentation_views.presentation_id (not integer FK like estimate_views.estimate_id)"
  - "Pattern 3: slideBlockSchema flat Zod schema with 8 layout variants; discriminated union deferred to Phase 18 if needed"

requirements-completed: [PRES-01, PRES-02, PRES-03]

# Metrics
duration: 3min
completed: 2026-04-21
---

# Phase 15 Plan 01: Schema Foundation Summary

**Drizzle/Zod schema for three presentation tables (presentations UUID PK, presentation_views UUID FK cascade, brand_guidelines singleton) with SQL migration, tsx runner, barrel re-export, and typed storage stubs**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-21T17:29:23Z
- **Completed:** 2026-04-21T17:32:10Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- Created idempotent SQL migration with all three tables, RLS policies, and indexes — UUID FK on presentation_views mirrors PRES-02 spec exactly
- Created shared/schema/presentations.ts with slideBlockSchema (8 layouts), Drizzle table definitions, PresentationWithStats type, manual Zod validators
- Wired barrel re-export (8th export in shared/schema.ts) and storage.ts imports/stubs so all downstream phases have typed access

## Task Commits

Each task was committed atomically:

1. **Task 1: SQL migration + tsx runner** - `232d2a4` (feat)
2. **Task 2: Drizzle/Zod schema** - `dc75abf` (feat)
3. **Task 3: Barrel re-export + storage wiring** - `e13b800` (feat)

## Files Created/Modified
- `migrations/0033_create_presentations.sql` — Three-table idempotent SQL with UUID FK, RLS service_role policies, BEGIN/COMMIT wrapper
- `scripts/migrate-presentations.ts` — tsx runner reads SQL file, runs migration, verifies all three tables exist
- `shared/schema/presentations.ts` — slideBlockSchema, presentations/presentationViews/brandGuidelines Drizzle tables, all TypeScript types, Zod validators
- `shared/schema.ts` — Added 8th barrel export for presentations schema
- `server/storage.ts` — Added table + type imports; added 9 stub methods (listPresentations, getPresentation, getPresentationBySlug, createPresentation, updatePresentation, deletePresentation, recordPresentationView, getBrandGuidelines, upsertBrandGuidelines)

## Decisions Made
- UUID slug (not text) for presentations — unguessable public URL consistent with PRES-01 spec
- guidelinesSnapshot stored as TEXT not JSONB — content is markdown, plain text; no structured access needed
- ip_hash column named ip_hash from creation (not ip_address) — SHA-256 hashing is Phase 20 concern; column name matches final intent
- Manual Zod insert schema — drizzle-zod generates unknown for JSONB; follows cms.ts/estimates.ts convention
- Storage stubs added in Phase 15 — ensures typed compilation for all downstream phases before routes exist

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required. Migration script (`npx tsx scripts/migrate-presentations.ts`) must be run against production DB when deploying.

## Next Phase Readiness
- Phase 16 (Admin CRUD API): All storage stubs ready — `listPresentations`, `createPresentation`, `updatePresentation`, `deletePresentation` typed and callable
- Phase 17 (Brand Guidelines): `getBrandGuidelines` and `upsertBrandGuidelines` stubs ready
- Phase 20 (Public Viewer): `getPresentationBySlug` and `recordPresentationView` stubs ready
- `npm run check` passes cleanly across all modified files

---
*Phase: 15-schema-foundation*
*Completed: 2026-04-21*
