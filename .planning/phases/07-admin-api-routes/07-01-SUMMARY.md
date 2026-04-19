---
phase: 07-admin-api-routes
plan: "01"
subsystem: server/routes
tags: [express, api, estimates, admin, auth]
dependency_graph:
  requires:
    - "06-02: estimates CRUD storage methods"
    - "06-01: shared/schema/estimates.ts (insertEstimateSchema)"
  provides:
    - "GET /api/estimates (admin)"
    - "POST /api/estimates (admin, UUID slug)"
    - "PUT /api/estimates/:id (admin, partial)"
    - "DELETE /api/estimates/:id (admin)"
    - "GET /api/estimates/slug/:slug (public)"
  affects:
    - server/routes.ts (route registration added)
tech_stack:
  added: []
  patterns:
    - "domain route file pattern (registerXxxRoutes(app: Express))"
    - "safeParse validation with 400 on failure"
    - "crypto.randomUUID() for server-generated slug"
    - "pre-flight getEstimate() check before updateEstimate() to avoid undefined return"
key_files:
  created:
    - server/routes/estimates.ts
  modified:
    - server/routes.ts
decisions:
  - "D-12 corrected: registerEstimatesRoutes(app: Express) only — no requireAdmin parameter (import directly)"
  - "Slug route registered first to avoid Express matching 'slug' as :id"
  - "No setPublicCache on public slug endpoint (estimate data is sensitive per D-15)"
  - "Pre-flight getEstimate() check in PUT handler (Drizzle .returning() returns undefined for missing rows)"
metrics:
  duration_minutes: 3
  completed_date: "2026-04-19"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 1
---

# Phase 7 Plan 01: Estimates API Routes Summary

**One-liner:** Five Express route handlers for estimates with UUID slug generation, admin auth guard, and public slug viewer endpoint.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create server/routes/estimates.ts | 9983f3a | server/routes/estimates.ts (created) |
| 2 | Register estimates routes in server/routes.ts | 037cc7c | server/routes.ts (2 lines added) |

## What Was Built

### server/routes/estimates.ts

Five route handlers following the `portfolio.ts` domain-router pattern:

1. `GET /api/estimates/slug/:slug` — public, no auth, returns full estimate record or 404
2. `GET /api/estimates` — admin-only, returns all estimates ordered by `createdAt DESC`
3. `POST /api/estimates` — admin-only, validates body with `insertEstimateSchema.omit({ slug: true })`, generates slug via `crypto.randomUUID()`, returns 201 with full record
4. `PUT /api/estimates/:id` — admin-only, validates with `insertEstimateSchema.partial().omit({ slug: true })`, pre-flight 404 check via `storage.getEstimate()`, returns updated full record
5. `DELETE /api/estimates/:id` — admin-only, returns `{ success: true }`

### server/routes.ts

- Added `import { registerEstimatesRoutes } from "./routes/estimates.js"` to the domain route imports block
- Added `registerEstimatesRoutes(app)` call after `registerIntegrationRoutes(app)`

## Verification

- `npx tsc --noEmit` exits 0 with zero errors on both files
- All 14 acceptance criteria met (verified programmatically)

## Deviations from Plan

None — plan executed exactly as written.

The worktree required a `git merge dev` to bring in Phase 6 work (estimates schema + storage methods) before implementation could begin. This was a setup step, not a deviation.

## Known Stubs

None — all endpoints wire directly to storage methods from Phase 6.

## Requirements Satisfied

| Req ID | Description | Status |
|--------|-------------|--------|
| EST-03 | `GET /api/estimates` returns all estimates with admin auth | Done |
| EST-04 | POST/PUT/DELETE estimate endpoints with admin auth | Done |
| EST-05 | `GET /api/estimates/slug/:slug` public endpoint | Done |

## Self-Check: PASSED

- server/routes/estimates.ts: FOUND
- server/routes.ts contains registerEstimatesRoutes: FOUND
- Commit 9983f3a: verified
- Commit 037cc7c: verified
- TypeScript: 0 errors
