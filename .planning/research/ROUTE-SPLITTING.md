# Route File Splitting Research: Xpot Routes

**Project:** SkaleClub (brownfield Express/React)
**Research date:** 2026-03-30
**Subject:** Splitting `server/routes/xpot.ts` (1,042 lines) into domain modules
**Confidence:** HIGH

## Executive Summary

The `xpot.ts` monolith contains 33 route handlers across 8 logical domains, plus shared helpers/middleware. Express 4.21.2 ships `express.Router()` — the idiomatic mechanism for splitting routes into composable modules. The existing codebase already has a precedent for sub-modules (`registerStorageRoutes`), but that pattern registers directly on `app`, which avoids `express.Router()` entirely.

**Recommendation:** Use `express.Router()` per domain, each exporting a factory function. Mount all routers under `/api/xpot` with a single aggregator. This is the standard Express pattern, preserves URL structure exactly, and minimizes import changes in `routes.ts`.

## Current Code Analysis

### File Structure (1,042 lines)

| Section | Lines | Content |
|---------|-------|---------|
| Imports & types | 1–25 | Shared schemas, integrations, `SessionUser` type |
| Helper functions | 26–153 | `getDistanceMeters`, `getCurrentSessionUser`, `ensureXpotRep`, `syncAccountToGhl`, `syncOpportunityToGhl`, `syncTaskToGhl` |
| Auth middleware | 54–99 | `requireXpotUser`, `requireXpotManager` |
| Route handlers | 254–1042 | 33 route registrations inside `registerXpotRoutes(app)` |

### Route Domain Map

| Domain | Routes | Lines | Auth Level |
|--------|--------|-------|------------|
| **Auth/Me** | `GET /me` | 358–373 | `requireXpotUser` |
| **Dashboard** | `GET /dashboard` | 375–417 | `requireXpotUser` |
| **Metrics** | `GET /metrics` | 419–495 | `requireXpotUser` |
| **Accounts** | `GET/POST /accounts`, `GET/PATCH /accounts/:id`, `GET/POST /accounts/:id/contacts` | 497–605 | `requireXpotUser` |
| **Visits** | `GET /visits`, `POST /visits/check-in`, `POST /visits/:id/check-out`, `POST /visits/:id/cancel`, `PATCH /visits/:id/note`, `POST /visits/:id/audio` | 607–837 | `requireXpotUser` |
| **Opportunities** | `GET/POST /opportunities`, `PATCH /opportunities/:id` | 839–918 | `requireXpotUser` |
| **Tasks** | `GET/POST /tasks`, `PATCH /tasks/:id` | 920–957 | `requireXpotUser` |
| **Sync** | `POST /sync/flush` | 959–976 | `requireXpotUser` |
| **Place Search** | `GET /place-search` | 255–356 | `requireXpotUser` |
| **Admin** | `GET /admin/overview`, `GET/POST /admin/reps`, `GET /admin/sync-events`, `GET /admin/ghl/pipelines` | 978–1042 | `requireXpotManager` |

### Shared Dependencies

- `storage` (singleton from `../storage.js`) — used by every handler
- Zod schemas from `#shared/xpot.js` — per-domain imports
- GHL integration functions — used by Accounts, Opportunities, Tasks, Sync
- `getDistanceMeters` — used by Visits (check-in only)
- `ensureXpotRep` / `getCurrentSessionUser` — used by both auth middlewares

## Recommended Architecture

### File Layout

```
server/routes/xpot/
  index.ts              # Aggregator: registers all sub-routers
  middleware.ts          # requireXpotUser, requireXpotManager, ensureXpotRep, SessionUser type
  helpers.ts             # getDistanceMeters, syncAccountToGhl, syncOpportunityToGhl, syncTaskToGhl
  auth.ts                # GET /me
  dashboard.ts           # GET /dashboard
  metrics.ts             # GET /metrics
  accounts.ts            # All /accounts/* routes
  visits.ts              # All /visits/* routes
  opportunities.ts       # All /opportunities/* routes
  tasks.ts               # All /tasks/* routes
  sync.ts                # POST /sync/flush
  place-search.ts        # GET /place-search
  admin.ts               # All /admin/* routes
```

### How It Works

**Each domain file** exports a function that receives the `Express` app or, better, creates and exports an `express.Router()`:

```typescript
// server/routes/xpot/accounts.ts
import { Router } from "express";
import { storage } from "../../storage.js";
import { xpotAccountCreateSchema, xpotAccountUpdateSchema, xpotAccountContactCreateSchema } from "#shared/xpot.js";
import { requireXpotUser } from "./middleware.js";
import { syncAccountToGhl } from "./helpers.js";

export function createAccountsRouter(): Router {
  const router = Router();

  router.get("/", requireXpotUser, async (req, res) => {
    // ... handler code unchanged
  });

  router.post("/", requireXpotUser, async (req, res) => {
    // ... handler code unchanged
  });

  // ... etc

  return router;
}
```

**The aggregator** mounts all sub-routers:

```typescript
// server/routes/xpot/index.ts
import type { Express } from "express";
import { createAuthRouter } from "./auth.js";
import { createDashboardRouter } from "./dashboard.js";
import { createMetricsRouter } from "./metrics.js";
import { createAccountsRouter } from "./accounts.js";
import { createVisitsRouter } from "./visits.js";
import { createOpportunitiesRouter } from "./opportunities.js";
import { createTasksRouter } from "./tasks.js";
import { createSyncRouter } from "./sync.js";
import { createPlaceSearchRouter } from "./place-search.js";
import { createAdminRouter } from "./admin.js";

export function registerXpotRoutes(app: Express) {
  app.use("/api/xpot", createAuthRouter());
  app.use("/api/xpot", createDashboardRouter());
  app.use("/api/xpot", createMetricsRouter());
  app.use("/api/xpot", createAccountsRouter());
  app.use("/api/xpot", createVisitsRouter());
  app.use("/api/xpot", createOpportunitiesRouter());
  app.use("/api/xpot", createTasksRouter());
  app.use("/api/xpot", createSyncRouter());
  app.use("/api/xpot", createPlaceSearchRouter());
  app.use("/api/xpot", createAdminRouter());
}
```

**routes.ts** has ONE line changed — from importing `./routes/xpot.js` to importing `./routes/xpot/index.js`:

```typescript
// server/routes.ts line 32
import { registerXpotRoutes } from "./routes/xpot/index.js";  // was "./routes/xpot.js"
```

The function signature `registerXpotRoutes(app)` is identical. No downstream changes.

### Why `app.use("/api/xpot", router)` NOT `router.use("/api/xpot", subRouter)`

Two options exist for composing routers:

| Approach | How | URL Prefix Handling |
|----------|-----|---------------------|
| **A) Mount on app** (recommended) | `app.use("/api/xpot", createAccountsRouter())` | Each router defines paths relative to `/api/xpot` — e.g., `router.get("/accounts", ...)` |
| **B) Nested router** | Master router uses sub-routers: `masterRouter.use("/accounts", accountsRouter)` | Sub-router paths are relative to their mount point inside master |

Option A is simpler for this use case because:
- All routes are under `/api/xpot/*` (flat, not hierarchical)
- No need for `mergeParams` across router boundaries
- Each router is independently testable
- The aggregator file is just a list of mounts

### Middleware Strategy

**Shared middleware goes in `middleware.ts`:**

```typescript
// server/routes/xpot/middleware.ts
export async function requireXpotUser(req: Request, res: Response, next: NextFunction) { ... }
export async function requireXpotManager(req: Request, res: Response, next: NextFunction) { ... }
export type SessionUser = { ... };
```

**Per-router middleware attachment:**

```typescript
// Most routers: every route needs requireXpotUser
router.use(requireXpotUser);  // Apply once at router level

// Admin router: every route needs requireXpotManager
router.use(requireXpotManager);  // Apply once at router level
```

Currently, `requireXpotUser` is applied per-route (e.g., `app.get("/api/xpot/accounts", requireXpotUser, handler)`). Moving to router-level middleware is a safe improvement — it's DRYer and prevents accidentally forgetting the guard on a new route. The middleware mutates `(req as any).xpotActor`, so it must run before handlers.

**Caution:** The `/me` endpoint uses `requireXpotUser`. The admin routes use `requireXpotManager`. These cannot share a single router-level middleware. Keep them on separate routers.

### Helpers Strategy

```typescript
// server/routes/xpot/helpers.ts
export async function syncAccountToGhl(accountId: number) { ... }
export async function syncOpportunityToGhl(opportunityId: number) { ... }
export async function syncTaskToGhl(taskId: number) { ... }
export function getDistanceMeters(lat1, lng1, lat2, lng2): number { ... }
```

Import only what each domain file needs:
- `accounts.ts` → `syncAccountToGhl`
- `opportunities.ts` → `syncOpportunityToGhl`
- `tasks.ts` → `syncTaskToGhl`
- `sync.ts` → all three sync functions
- `visits.ts` → `getDistanceMeters`

## Migration Plan (Low Risk)

### Step 1: Create directory and shared files
- `server/routes/xpot/middleware.ts` — extract middleware + SessionUser type
- `server/routes/xpot/helpers.ts` — extract helper functions
- Verify: `import type` works, no circular deps

### Step 2: Create first domain router (smallest: `place-search.ts`)
- 1 route, self-contained, good smoke test
- Update `index.ts` to mount it
- Verify: `GET /api/xpot/place-search` still works

### Step 3: Create remaining domain routers (one at a time)
- Order by dependency: `auth.ts` → `dashboard.ts` → `metrics.ts` → `accounts.ts` → `visits.ts` → `opportunities.ts` → `tasks.ts` → `sync.ts` → `admin.ts`
- After each: verify the routes still respond correctly

### Step 4: Update `routes.ts` import
- Change line 32: `import { registerXpotRoutes } from "./routes/xpot/index.js";`
- Delete old `server/routes/xpot.ts`
- Full integration test

### Step 5: Clean up
- Remove any dead imports
- Run `npm run check` for TypeScript validation

## Pitfalls to Avoid

### Pitfall 1: Changing URL paths accidentally

**What goes wrong:** Moving from `app.get("/api/xpot/accounts", ...)` to `router.get("/accounts", ...)` and forgetting the mount prefix changes URLs.

**Prevention:** The `app.use("/api/xpot", router)` mount means router paths are relative. `router.get("/accounts", ...)` → `/api/xpot/accounts`. Verify each route after migration.

**Detection:** Hit every endpoint in the API. Frontend breaks if URLs change.

### Pitfall 2: Middleware ordering within routers

**What goes wrong:** Defining routes before `router.use(requireXpotUser)` skips the guard.

**Prevention:** Always declare `router.use(middleware)` before route definitions in each file.

```typescript
// CORRECT
const router = Router();
router.use(requireXpotUser);   // middleware first
router.get("/", handler);      // routes after

// WRONG
const router = Router();
router.get("/", handler);      // runs WITHOUT auth!
router.use(requireXpotUser);   // too late
```

### Pitfall 3: Breaking `(req as any).xpotActor` typing

**What goes wrong:** The `xpotActor` property is set by middleware on `req` via `(req as any).xpotActor`. If middleware runs on a different router, the property won't be set when the handler runs.

**Prevention:** Ensure the middleware that sets `xpotActor` runs on the same router as the handler that reads it. Using `router.use(requireXpotUser)` at the top of each domain router ensures this.

### Pitfall 4: Forgetting `syncAccountToGhl` on account create/update

**What goes wrong:** The sync helpers are called inline in account, opportunity, and task handlers. If they're moved to a shared file but imports are wrong, GHL sync silently fails.

**Prevention:** After migration, create an account and verify GHL sync event appears in `sales_sync_events` table.

### Pitfall 5: Import path breakage with `#shared/*`

**What goes wrong:** The `#shared/xpot.js` path alias may not resolve correctly from deeper directory nesting.

**Prevention:** This is actually NOT a risk — the files move from `server/routes/xpot.ts` to `server/routes/xpot/*.ts`, which is the same depth relative to the project root. The `#shared` alias (from tsconfig `paths`) resolves from project root, not file location.

### Pitfall 6: `express.Router()` vs current `app.get()` pattern

**What goes wrong:** The current pattern uses `app.get()`, `app.post()`, etc. directly. `express.Router()` uses the same API but some middleware behavior differs (e.g., `app.param()` vs `router.param()`).

**Prevention:** The xpot.ts file does NOT use `app.param()`. It uses inline `Number(req.params.id)` validation. This is compatible with `express.Router()` without changes.

## Express 4.x Router — Key Details

From Express 4.21.2 documentation:

- `express.Router()` creates a standalone middleware/router
- Routes defined on a router are relative to its mount point
- `router.use(middleware)` applies to all subsequent routes on that router
- Routers are composable: `app.use("/prefix", router)` or `parentRouter.use("/sub", childRouter)`
- No `mergeParams` needed unless mounting nested routers that need parent params (e.g., `/:userId/addresses`)
- Router-level error handlers: `router.use((err, req, res, next) => { ... })` catches errors from that router's routes only

**This project does NOT need nested routers.** All xpot routes are flat under `/api/xpot/`. The admin routes use `/api/xpot/admin/*` but these can be a single router with routes like `router.get("/admin/overview", ...)`.

## Alternative Approaches Considered

### Alternative 1: Keep single file, use section comments

**What:** Add `// === ACCOUNTS ===` section markers. No structural change.

**Why not:** Doesn't solve the problem. 1,042 lines is too large for a single file. Merge conflicts in team. Hard to navigate.

### Alternative 2: Controller/Service layer extraction

**What:** Extract business logic into `server/services/xpot/*.ts`, keep thin route handlers.

**Why not:** Over-engineering for this codebase. The handlers are already thin (they call `storage.*` which IS the service layer). Adding another indirection layer adds complexity without benefit. The immediate need is file organization, not architectural overhaul. This could be a Phase 2 improvement.

### Alternative 3: Factory function taking `app` directly (like `storageAdapter.ts`)

**What:** Each domain exports `registerXxxRoutes(app: Express)` and registers directly on `app`.

**Why not:** Works but is non-standard. The `express.Router()` pattern is the canonical approach, better documented, and enables router-level middleware (which `app.get()` per route does not). Also, `app` direct registration means each sub-module needs the full URL path (`/api/xpot/accounts`), coupling it to the mount point.

### Alternative 4: Single router, single mount point

**What:** Create ONE `express.Router()`, have each domain file add routes to it via a shared router instance.

**Why not:** Creates tight coupling — all files mutate a shared object. Import order matters. Hard to reason about. The aggregator pattern (one `app.use()` per domain router) is cleaner.

## Recommendation Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Module system | `express.Router()` per domain | Standard Express pattern, composable, independently testable |
| Mount strategy | `app.use("/api/xpot", domainRouter)` | Flat URL structure, simple, no nested params needed |
| Middleware | Shared file, applied at router level | DRY, prevents forgotten guards |
| Helpers | Shared file, named imports | Sync functions + distance calc used across domains |
| File naming | `server/routes/xpot/*.ts` | Domain-named files, `index.ts` aggregator |
| Migration | Incremental, one domain at a time | Low risk, testable at each step |

## Sources

- Express 4.x Router API: https://expressjs.com/en/4x/api.html#router (HIGH confidence)
- Express Routing Guide: https://expressjs.com/en/guide/routing.html (HIGH confidence)
- Current codebase: `server/routes/xpot.ts`, `server/routes.ts`, `server/storage/storageAdapter.ts` (HIGH confidence)
- Community patterns: DEV Community (2026-03), Grizzly Peak Software (2026-02) (MEDIUM confidence — community sources, not official)
- Package: express@4.21.2 confirmed via package.json (HIGH confidence)
