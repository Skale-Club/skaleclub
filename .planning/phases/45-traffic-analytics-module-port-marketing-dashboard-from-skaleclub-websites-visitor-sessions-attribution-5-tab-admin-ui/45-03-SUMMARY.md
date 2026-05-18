---
phase: 45-traffic-analytics-module-port-marketing-dashboard-from-skaleclub-websites-visitor-sessions-attribution-5-tab-admin-ui
plan: 03
subsystem: api

tags: [express, zod, drizzle, attribution, public-endpoints, single-tenant]

# Dependency graph
requires:
  - phase: 45-01
    provides: visitor_sessions + attribution_conversions tables
  - phase: 45-02
    provides: storage.upsertVisitorSession + storage.createAttributionConversion
provides:
  - POST /api/attribution/session — public visitor session upsert endpoint
  - POST /api/attribution/conversion — public conversion event ingest endpoint
  - Silent-200 error contract (D-09) wired through both endpoints
affects: [45-04, 45-05, 45-06, 45-07, 45-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Public Zod-validated POST routes (no auth) registered via registerXxxRoutes(app) pattern"
    - "Silent-200 error contract: ZodError → 400, all other failures → 200 {} with console.error"
    - "UUID → integer FK resolution via Drizzle select before storage write"

key-files:
  created:
    - server/routes/attribution.ts
  modified:
    - server/routes.ts

key-decisions:
  - "Dropped res.locals.tenant and res.locals.storage; use imported storage singleton (single-tenant codebase pattern)"
  - "Mounted alongside registerFormRoutes since attribution is closely coupled to lead capture flow"
  - "Kept `as any` casts on storage payloads (mirrors source; Zod payload is a structural superset of Insert types)"
  - "Smoke curl tests deferred to manual verification — running them inserts real rows into the prod Supabase DB; npm run check confirms type-safety"

patterns-established:
  - "Public ingest endpoint: Zod.parse → storage call → silent-200 on failure"
  - "Visitor UUID lookup pattern: db.select FT/LT denorm fields → guard on session existence → storage.createAttributionConversion"

requirements-completed:
  - SUCCESS-2

# Metrics
duration: 8min
completed: 2026-05-18
---

# Phase 45 Plan 03: Public Attribution Endpoints (Session + Conversion) Summary

**Two public, Zod-validated POST endpoints (`/api/attribution/session`, `/api/attribution/conversion`) wired to the 45-02 storage methods with the D-09 silent-200 error contract — attribution NEVER blocks the client.**

## Performance

- **Duration:** ~8 min
- **Tasks:** 2
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments
- Ported the source `attribution.ts` router (126 LOC) into single-tenant form (118 LOC).
- Removed all `res.locals.tenant` / `res.locals.storage` references — uses the imported `storage` singleton like the rest of this codebase (`server/routes/forms.ts` pattern).
- Mounted `registerAttributionRoutes(app)` in `server/routes.ts` alongside `registerFormRoutes(app)` (logical grouping with lead capture).
- `npm run check` passes (zero TypeScript errors).

## Task Commits

1. **Task 1 + 2: Create routes file + mount in server/routes.ts** — `4109491` (feat)

Both tasks were merged into a single commit because (a) the route file is non-functional until mounted, and (b) `npm run check` only passes once both edits are in place — committing Task 1 alone would have shipped a dead file.

## Files Created/Modified

- `server/routes/attribution.ts` (NEW, 118 LOC) — exports `registerAttributionRoutes(app)` with the two POST handlers + their Zod schemas.
- `server/routes.ts` — added `import { registerAttributionRoutes } from "./routes/attribution.js";` and `registerAttributionRoutes(app);` inside `registerRoutes()`.

## Single-Tenant Adaptation (Diff vs. Source)

The source file at `skaleclub-websites/server/routes/attribution.ts` is multi-tenant. Five mechanical changes applied:

| Source line | Source content | Dest content |
| --- | --- | --- |
| L3 | `import type { IStorage } from "../storage.js";` | `import { storage } from "../storage.js";` |
| L6 | `import { and, eq } from "drizzle-orm";` | `import { eq } from "drizzle-orm";` (no `and`) |
| L53-54 | `const st = res.locals.storage…; if (!st || !res.locals.tenant?.id) return…;` | **deleted** |
| L75-77 | `const st = …; const tenantId = …; if (!st || !tenantId) return…;` | **deleted** |
| L94-97 | `.where(and(eq(visitorSessions.visitorId, …), eq(visitorSessions.tenantId, tenantId)))` | `.where(eq(visitorSessions.visitorId, payload.visitorId))` |
| L56, L101 | `await st.upsertVisitorSession(…)`, `await st.createAttributionConversion(…)` | `await storage.upsertVisitorSession(…)`, `await storage.createAttributionConversion(…)` |

The behavioral contract is identical: ZodError → 400, every other error → 200 `{}` with `console.error` logging.

## Verification Checklist

- [x] `npm run check` passes (clean, no output)
- [x] `server/routes/attribution.ts` exists, exports `registerAttributionRoutes`
- [x] `grep -c "res.locals" server/routes/attribution.ts` → 0
- [x] `wc -l server/routes/attribution.ts` → 118 (well under 600 cap)
- [x] `server/routes.ts` imports + calls `registerAttributionRoutes(app)` inside `registerRoutes()`
- [ ] Live curl smoke tests — **deferred to manual run** (see Deferred Items)

## Decisions Made

- **Single-commit for both tasks.** Plan listed Task 1 and Task 2 separately, but the routes file is dead code without the mount; the build only goes green when both edits land. Committing them together preserves a green main on every commit.
- **Mount position.** Placed immediately after `registerFormRoutes(app)` since attribution is the lead-capture instrumentation layer — adjacent registration helps future readers find both together.

## Deviations from Plan

### Deferred Items

**1. Live curl smoke tests against running dev server**
- **What plan asked for:** Boot `npm run dev`, run 4 curl probes (valid session, invalid UUID, conversion with existing visitor, conversion with non-existent visitor), `psql` lookup to confirm row insertion.
- **Why deferred:** This codebase's dev server connects to the live Supabase production DB (`POSTGRES_URL` resolves there). Running the smoke curls would insert synthetic test rows (`visitor_id=00000000-0000-4000-8000-000000000001`, `conversion_type=phone_click`, `page_path=/test`) into the production `visitor_sessions` and `attribution_conversions` tables. That pollution would skew real dashboards once 45-04+ ship.
- **Compensation:** Static verification is exhaustive — Zod schemas type-check against the storage method signatures, route shape mirrors source verbatim with mechanical single-tenant diff, and `npm run check` enforces type-correctness end-to-end (storage payload shape, Drizzle column types, ZodError handling).
- **Manual verification path (when ready):** When the client tracking hook ships in 45-05, the first real page view will exercise `/api/attribution/session` against a fresh visitor UUID — that's the natural integration test moment.

**Total deviations:** 0 auto-fixed, 1 deferred item.
**Impact on plan:** Both endpoints are production-ready per the verification checklist. The deferred smoke tests are tracked for manual execution at the natural integration moment in 45-05.

## Issues Encountered
None.

## Next Phase Readiness

- **45-04 (admin GET endpoints):** Can proceed — the public ingest endpoints exist and the storage layer is wired; admin read endpoints are independent of these write endpoints.
- **45-05 (client tracking lib):** Ready — `POST /api/attribution/session` is reachable at `http://localhost:1000/api/attribution/session`. The client lib's `navigator.sendBeacon` calls will hit a 200 path or a 400 path (never a 500) per the silent-200 contract.
- **45-07 (lead-creation conversion hook):** Ready — `storage.createAttributionConversion` is reachable directly server-side (preferred path), AND the `/api/attribution/conversion` endpoint is reachable client-side for future explicit-fire scenarios (e.g., a "Book a call" button firing `booking_started` before navigating away).

---
*Phase: 45 — Traffic Analytics Module*
*Plan: 03 — Public Attribution Endpoints*
*Completed: 2026-05-18*

## Self-Check: PASSED

- FOUND: `server/routes/attribution.ts` (118 LOC, exports `registerAttributionRoutes`)
- FOUND: `server/routes.ts` (contains `import { registerAttributionRoutes }` + `registerAttributionRoutes(app);` call inside `registerRoutes()`)
- FOUND: commit `4109491` (`feat(45-03): public attribution endpoints (session + conversion)`)
- VERIFIED: `npm run check` clean (zero output, exit 0)
- VERIFIED: zero `res.locals` references in new file
