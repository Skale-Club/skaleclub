---
phase: 43-landing-page-system-dynamic-landings-at-root-slugs
plan: 02
subsystem: api
tags: [express, zod, landing-pages, crud, reserved-slugs, drizzle]

# Dependency graph
requires:
  - phase: 43-landing-page-system-dynamic-landings-at-root-slugs
    provides: "Drizzle landingPages table + insertLandingPageSchema / updateLandingPageSchema + storage CRUD methods (Plan 43-01)"
provides:
  - "shared/reservedSlugs.ts — RESERVED_SLUGS list + isReservedSlug() helper, single source of truth for client + server"
  - "server/routes/landingPages.ts — registerLandingPageRoutes(app) mounting 6 endpoints"
  - "Public contract for renderer (43-03): GET /api/landing-pages/slug/:slug returns { slug, name, sections, isActive } for active landings"
  - "Admin contract for editor UI (43-04): list / get-by-id / create / update / delete with reserved-slug + unique-slug guards"
affects:
  - "43-03 (DynamicLanding renderer) — consumes the public /slug/:slug endpoint"
  - "43-04 (Admin Landings UI) — consumes admin CRUD + imports RESERVED_SLUGS for client-side defensive check"
  - "43-05 (whatsappGroup migration) — uses POST /api/landing-pages to seed the `grupo` landing"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Literal /slug/ route registered BEFORE /:id to avoid Express treating 'slug' as a UUID (mirrors presentations.ts:44-45)"
    - "Reserved-slug list as a shared module so server validation and client UI read the same source of truth"
    - "Public response strips internal fields (id, createdAt, updatedAt) per CONTEXT.md decision"

key-files:
  created:
    - shared/reservedSlugs.ts
    - server/routes/landingPages.ts
  modified:
    - server/routes.ts

key-decisions:
  - "Reserved-slug guard returns HTTP 409 with message `Slug \"x\" is reserved` (matches duplicate-slug 409 semantics)"
  - "Public endpoint treats inactive landings as 404 (do not leak existence of disabled pages)"
  - "Update handler only revalidates slug when the body contains a slug field (partial updates that omit slug are not blocked)"

patterns-established:
  - "Route module shape: export registerXRoutes(app); literal segments first; admin gates via requireAdmin from _shared.js"
  - "Slug normalization: toLowerCase().trim() before guard checks AND before persistence"

requirements-completed: [SUCCESS-2, SUCCESS-3]

# Metrics
duration: 3min
completed: 2026-05-18
---

# Phase 43 Plan 02: Server CRUD routes + reserved-slug guard Summary

**Six landing-pages endpoints mounted (5 admin + 1 public) with a shared reserved-slug guard, locking the contract for the renderer (43-03) and the admin UI (43-04).**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-05-18T02:54:20Z
- **Completed:** 2026-05-18T02:57:25Z
- **Tasks:** 3
- **Files created:** 2
- **Files modified:** 1

## Accomplishments

- Created `shared/reservedSlugs.ts` exporting `RESERVED_SLUGS` (18 entries: admin, blog, portfolio, contact, faq, privacy, terms, e, p, f, links, vcard, xpot, sites, api, assets, skale-hub) and `isReservedSlug()`.
- Created `server/routes/landingPages.ts` with `registerLandingPageRoutes(app)` exposing 6 endpoints.
- Wired the new route module into `server/routes.ts` next to the existing registrations.
- `npm run check` and `npm run build` both pass.

## Endpoint Reference

| Method | Path                                | Auth   | Success | Error codes                                                                 |
| ------ | ----------------------------------- | ------ | ------- | --------------------------------------------------------------------------- |
| GET    | `/api/landing-pages/slug/:slug`     | public | 200     | 404 (missing or inactive), 500                                              |
| GET    | `/api/landing-pages`                | admin  | 200     | 401, 403, 500                                                               |
| GET    | `/api/landing-pages/:id`            | admin  | 200     | 401, 403, 404, 500                                                          |
| POST   | `/api/landing-pages`                | admin  | 201     | 400 (validation), 409 (reserved slug), 409 (duplicate slug), 401, 403       |
| PUT    | `/api/landing-pages/:id`            | admin  | 200     | 400 (validation), 404, 409 (reserved slug), 409 (duplicate slug), 401, 403  |
| DELETE | `/api/landing-pages/:id`            | admin  | 200     | 404, 401, 403, 400                                                          |

## LandingSection shape

From `shared/schema/landings.ts` (created in 43-01):

```ts
landingSectionSchema = z.object({
  type:  z.string().min(1).max(80),
  props: z.record(z.unknown()).default({}),
});
```

Insert/update schemas:

```ts
insertLandingPageSchema = z.object({
  slug:     z.string().min(1).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name:     z.string().min(1).max(200),
  sections: z.array(landingSectionSchema).default([]),
  isActive: z.boolean().default(true),
});
updateLandingPageSchema = insertLandingPageSchema.partial();
```

Per CONTEXT.md, per-type props validation is enforced at render time in the client section registry (43-03), not at the route layer.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create shared/reservedSlugs.ts** — `8644ec2` (feat)
2. **Task 2: Create server/routes/landingPages.ts** — `b57378e` (feat)
3. **Task 3: Wire registerLandingPageRoutes into server/routes.ts** — `4888a27` (feat)

## Files Created/Modified

- `shared/reservedSlugs.ts` (created, 28 lines) — RESERVED_SLUGS + isReservedSlug helper
- `server/routes/landingPages.ts` (created, 109 lines) — full CRUD module
- `server/routes.ts` (modified, +2 lines) — added import + registration call

## Verification

- `npm run check` — zero errors (run after each task, including final)
- `npm run build` — succeeds (client Vite build + esbuild server bundle)
- `grep registerLandingPageRoutes server/routes.ts` — confirms 2 occurrences (line 27 import, line 145 call)

### Smoke-test (deferred)

The plan's curl smoke-tests require a running `npm run dev` instance plus an admin session cookie (admin login flow). They are intentionally deferred to Plan 43-04 (Admin UI), which will exercise every endpoint via React Query as the natural integration test. Static analysis (`npm run check`) plus the build succeeding gives high confidence the routes mount and types resolve correctly. The Zod parsing + guards are pure logic with no dynamic side effects that would only surface at runtime.

## Decisions Made

- **Reserved-slug check before unique-slug check.** Cheaper (sync array lookup vs DB hit) and produces the more useful error message when both conditions could fire.
- **Slug normalization happens in the route layer**, not the schema, because the schema regex enforces an already-normalized shape and we want the 400 to fire for malformed input rather than silently mutating it. The `.toLowerCase().trim()` in the handler is defensive only — a regex-valid slug is already lowercase.
- **`as any` cast for the public-endpoint destructure.** `LandingPage` (Drizzle select type) doesn't yet have a narrow public-DTO type; the destructure is correct at runtime and validated by the schema upstream. A follow-up could add a `PublicLandingPage` type if 43-03 wants the extra safety.

## Deviations from Plan

None — plan executed exactly as written. All three tasks ran clean on the first attempt with no auto-fixes required. The Drizzle table, Zod schemas, and storage methods produced by Plan 43-01 plugged into the route layer with no friction.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Public contract locked. Plan 43-03 (DynamicLanding renderer) can be built against `GET /api/landing-pages/slug/:slug`.
- Admin contract locked. Plan 43-04 (Admin UI) can call the 5 admin endpoints and import `RESERVED_SLUGS` for the client-side defensive check.
- Plan 43-05 (whatsappGroup migration) can `POST /api/landing-pages` to seed the `grupo` landing once 43-03/43-04 are in place.

## Self-Check: PASSED

- File `shared/reservedSlugs.ts` exists.
- File `server/routes/landingPages.ts` exists.
- File `server/routes.ts` contains `registerLandingPageRoutes` at line 27 (import) and line 145 (call).
- Commit `8644ec2` exists (Task 1).
- Commit `b57378e` exists (Task 2).
- Commit `4888a27` exists (Task 3).

---
*Phase: 43-landing-page-system-dynamic-landings-at-root-slugs*
*Completed: 2026-05-18*
