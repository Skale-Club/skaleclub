# Phase 2: Route File Splitting - Research

**Researched:** 2026-03-30
**Domain:** Express 4.x Router splitting, modular route organization
**Confidence:** HIGH

## Summary

The `server/routes/xpot.ts` file is a 1,042-line monolith containing 33 route handlers across 10 logical domains plus shared middleware and helper functions. Express 4.22.1 (verified installed) ships `express.Router()` — the idiomatic mechanism for splitting routes into composable modules. The existing codebase already has a precedent for sub-modules (`registerStorageRoutes` in `server/storage/storageAdapter.ts`), but that pattern registers directly on `app`.

**Primary recommendation:** Use `express.Router()` per domain, each exporting a factory function. Mount all routers under `/api/xpot` via `app.use("/api/xpot", domainRouter)`. This preserves all 33 URL paths exactly, requires only 1 line changed in `server/routes.ts`, and is the standard Express pattern.

**Key constraint:** Phase 1 (Error Handling) must be completed first. The global error middleware in `server/app.ts` (lines 64-88) already handles ZodError → 400 with `err.flatten().fieldErrors` and standardizes responses to `{ message, errors? }`. The new domain routers inherit this — they should NOT add local error handlers. They should let ZodErrors and other errors propagate to the global middleware via `express-async-errors` (already imported at `app.ts:1`).

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| express | 4.22.1 | HTTP framework | Already in project, Router API is the standard splitting mechanism |
| express-async-errors | (installed) | Async error propagation | Already imported in `app.ts:1` — catches unhandled promise rejections in async route handlers |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod | (installed) | Schema validation | Each domain router imports only the schemas it needs from `#shared/xpot.js` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `express.Router()` per domain | Factory functions registering directly on `app` | Non-standard, couples each file to full URL path, no router-level middleware |
| Single shared router instance | Separate routers per domain | Creates tight coupling, import order matters, hard to reason about |
| Nested routers (`masterRouter.use("/admin", adminRouter)`) | Flat mounts (`app.use("/api/xpot", router)`) | Unnecessary complexity — all xpot routes are flat under `/api/xpot/`, no `mergeParams` needed |

**No new dependencies required.** This is a pure reorganization.

## Architecture Patterns

### Recommended Project Structure
```
server/routes/
├── xpot.ts              # DELETE after migration
├── xpot/
│   ├── index.ts         # Aggregator: exports registerXpotRoutes(app)
│   ├── middleware.ts     # requireXpotUser, requireXpotManager, ensureXpotRep, getCurrentSessionUser, SessionUser type
│   ├── helpers.ts        # getDistanceMeters, syncAccountToGhl, syncOpportunityToGhl, syncTaskToGhl
│   ├── auth.ts           # GET /me
│   ├── dashboard.ts      # GET /dashboard
│   ├── metrics.ts        # GET /metrics
│   ├── accounts.ts       # GET/POST /accounts, GET/PATCH /accounts/:id, GET/POST /accounts/:id/contacts
│   ├── visits.ts         # GET /visits, POST /visits/check-in, POST /visits/:id/check-out, POST /visits/:id/cancel, PATCH /visits/:id/note, POST /visits/:id/audio
│   ├── opportunities.ts  # GET/POST /opportunities, PATCH /opportunities/:id
│   ├── tasks.ts          # GET/POST /tasks, PATCH /tasks/:id
│   ├── sync.ts           # POST /sync/flush
│   ├── place-search.ts   # GET /place-search
│   └── admin.ts          # GET /admin/overview, GET/POST /admin/reps, GET /admin/sync-events, GET /admin/ghl/pipelines
```

### Pattern 1: Domain Router Factory
**What:** Each domain file exports a `create*Router()` function that returns an `express.Router()`.
**When to use:** Every domain file.
**Example:**
```typescript
// Source: Express 4.x Router API + ROUTE-SPLITTING.md research
import { Router } from "express";
import { storage } from "../../storage.js";
import { xpotAccountCreateSchema, xpotAccountUpdateSchema, xpotAccountContactCreateSchema } from "#shared/xpot.js";
import { requireXpotUser } from "./middleware.js";
import { syncAccountToGhl } from "./helpers.js";

export function createAccountsRouter(): Router {
  const router = Router();
  router.use(requireXpotUser); // Router-level middleware — applies to ALL routes in this router

  router.get("/", async (req, res) => {
    // ... handler code unchanged
  });

  // ... etc

  return router;
}
```

### Pattern 2: Aggregator Index
**What:** `index.ts` exports `registerXpotRoutes(app)` with the same signature as the old monolith. Mounts each domain router via `app.use("/api/xpot", router)`.
**When to use:** Single entry point for all xpot routes.
**Example:**
```typescript
// server/routes/xpot/index.ts
import type { Express } from "express";
import { createAuthRouter } from "./auth.js";
import { createAccountsRouter } from "./accounts.js";
// ... other imports

export function registerXpotRoutes(app: Express) {
  app.use("/api/xpot", createAuthRouter());
  app.use("/api/xpot", createAccountsRouter());
  // ... etc — one mount per domain
}
```

### Pattern 3: Router-Level Middleware
**What:** Apply `requireXpotUser` once at the router level instead of per-route.
**When to use:** All domain routers except admin (which uses `requireXpotManager`).
**Example:**
```typescript
const router = Router();
router.use(requireXpotUser);  // CORRECT: middleware first
router.get("/", handler);     // Routes after
```

**CRITICAL:** Middleware MUST be declared before route definitions. The order matters in Express.

### Anti-Patterns to Avoid

- **Declaring routes before middleware:** `router.get("/", handler)` BEFORE `router.use(requireXpotUser)` means the route runs WITHOUT auth.
- **Changing URL paths:** `router.get("/accounts", ...)` mounted via `app.use("/api/xpot", router)` resolves to `/api/xpot/accounts`. This is correct. Do NOT add `/api/xpot` to the router path.
- **Local error handlers in domain routers:** Let errors propagate to the global middleware in `app.ts`. The `express-async-errors` import (line 1 of `app.ts`) catches async rejections automatically.
- **Shared mutable router:** Do NOT create a single `Router()` and have multiple files add routes to it. Each domain owns its own router.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Route organization | Custom registry/dispatcher | `express.Router()` | Standard, composable, router-level middleware |
| Async error handling | try/catch in every handler | `express-async-errors` + global middleware | Already installed and imported; catches ZodErrors automatically |
| URL prefix management | Hardcode `/api/xpot/` in each file | `app.use("/api/xpot", router)` mount | Single source of truth for prefix |

**Key insight:** The existing xpot.ts handlers already have clean patterns — they use Zod `.parse()` (throws on invalid), call `storage.*` methods, and return JSON. The split is a mechanical extraction, not a logic rewrite. The only structural change is `app.get("/api/xpot/X", ...)` → `router.get("/X", ...)`.

## Common Pitfalls

### Pitfall 1: Middleware Ordering Within Routers
**What goes wrong:** Defining routes before `router.use(requireXpotUser)` skips the auth guard.
**Why it happens:** Express executes middleware in declaration order.
**How to avoid:** Always declare `router.use(middleware)` before route definitions. Use linter rules or code review.
**Warning signs:** A route that should require auth returns 200 without a session.

### Pitfall 2: `(req as any).xpotActor` Not Set
**What goes wrong:** The `xpotActor` property is set by `requireXpotUser`/`requireXpotManager` on `(req as any)`. If middleware runs on a different router, the property won't be set when the handler runs.
**Why it happens:** Using router-level middleware ensures it runs on the same router as the handler.
**How to avoid:** Each domain router that reads `xpotActor` must have its own `router.use(requireXpotUser)` or `router.use(requireXpotManager)`.
**Warning signs:** `Cannot read property 'rep' of undefined` errors.

### Pitfall 3: `#shared/*` Import Path Resolution
**What goes wrong:** Fear that `#shared/xpot.js` won't resolve from `server/routes/xpot/` (deeper directory).
**Why it's NOT a risk:** `#shared/*` is a Node.js subpath import defined in `package.json` `"imports"` field. It resolves relative to the package root, NOT the importing file. Moving from `server/routes/xpot.ts` to `server/routes/xpot/*.ts` is the same depth from root.
**Verification:** The existing `server/routes/xpot.ts` at depth 2 uses `#shared/xpot.js`. New files at depth 3 will resolve identically.
**Warning signs:** TypeScript compile errors about module resolution.

### Pitfall 4: GHL Sync Functions Silently Failing
**What goes wrong:** The sync helpers (`syncAccountToGhl`, `syncOpportunityToGhl`, `syncTaskToGhl`) are called inline in handlers. If imports are wrong after extraction, GHL sync silently fails.
**How to avoid:** After migration, create/update an account and verify GHL sync event appears in `sales_sync_events` table. Check the `sync/flush` endpoint works.
**Warning signs:** No new rows in `sales_sync_events` after account CRUD operations.

### Pitfall 5: Admin Routes Using Wrong Middleware
**What goes wrong:** Admin routes use `requireXpotManager` (not `requireXpotUser`). If admin routes share a router with non-admin routes, middleware conflicts.
**How to avoid:** Admin routes get their OWN router with `router.use(requireXpotManager)`. Never mix admin and non-admin middleware on the same router.
**Warning signs:** Regular users can access `/api/xpot/admin/overview`.

### Pitfall 6: ZodError Handling After Split
**What goes wrong:** Adding try/catch with manual ZodError handling in new domain routers, duplicating the global middleware.
**How to avoid:** Domain routers should NOT catch ZodErrors. Let them propagate. The global error middleware in `app.ts:71-76` handles them with `err.flatten().fieldErrors`. This is already working via `express-async-errors`.
**Warning signs:** Duplicate error handling code, inconsistent error shapes.

## Code Examples

### Domain Router Template (verified from Express 4.x docs)
```typescript
// Source: Express 4.x Router API + current codebase analysis
import { Router } from "express";
import { storage } from "../../storage.js";
import { requireXpotUser } from "./middleware.js";

export function createDashboardRouter(): Router {
  const router = Router();
  router.use(requireXpotUser);

  router.get("/", async (req, res) => {
    const actor = (req as any).xpotActor;
    // ... handler body identical to original
  });

  return router;
}
```

### Middleware Extraction (from xpot.ts lines 39-99)
```typescript
// server/routes/xpot/middleware.ts
import type { NextFunction, Request, Response } from "express";
import { storage } from "../../storage.js";

export type SessionUser = {
  userId: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  isAdmin: boolean;
};

export async function getCurrentSessionUser(req: Request): Promise<SessionUser | null> {
  const sess = req.session as any;
  if (!sess?.userId) return null;
  return {
    userId: sess.userId,
    email: sess.email ?? null,
    firstName: sess.firstName ?? null,
    lastName: sess.lastName ?? null,
    isAdmin: Boolean(sess.isAdmin),
  };
}

export async function ensureXpotRep(req: Request) {
  // ... identical to xpot.ts lines 54-75
}

export async function requireXpotUser(req: Request, res: Response, next: NextFunction) {
  // ... identical to xpot.ts lines 77-87
}

export async function requireXpotManager(req: Request, res: Response, next: NextFunction) {
  // ... identical to xpot.ts lines 89-99
}
```

### Helpers Extraction (from xpot.ts lines 26-252)
```typescript
// server/routes/xpot/helpers.ts
import { storage } from "../../storage.js";
import { getOrCreateGHLContact, createGHLOpportunity, updateGHLOpportunity, createGHLTask } from "../../integrations/ghl.js";

export function getDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  // ... identical to xpot.ts lines 26-37
}

export async function syncAccountToGhl(accountId: number) {
  // ... identical to xpot.ts lines 101-153
}

export async function syncOpportunityToGhl(opportunityId: number) {
  // ... identical to xpot.ts lines 155-214
}

export async function syncTaskToGhl(taskId: number) {
  // ... identical to xpot.ts lines 216-252
}
```

### routes.ts Change (single line)
```typescript
// BEFORE (line 32):
import { registerXpotRoutes } from "./routes/xpot.js";

// AFTER:
import { registerXpotRoutes } from "./routes/xpot/index.js";
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `app.get("/api/xpot/X", middleware, handler)` | `router.get("/X", handler)` with `router.use(middleware)` | This phase | DRY middleware, composable routers |
| Per-route middleware | Router-level middleware | This phase | Prevents forgotten guards on new routes |

**Deprecated/outdated:**
- Direct `app.get/post/patch` for xpot routes → replaced by `express.Router()` per domain
- Inline middleware per route → replaced by `router.use()` at router level

## Open Questions

1. **Should `getCurrentSessionUser` be exported from middleware.ts?**
   - What we know: It's only called by `ensureXpotRep`, which is called by both `requireXpotUser` and `requireXpotManager`.
   - What's unclear: Whether any handler directly calls `getCurrentSessionUser` (analysis: NO — only middleware uses it).
   - Recommendation: Export it anyway (it's a small function), but mark as internal if desired. It doesn't hurt.

2. **Should the old `server/routes/xpot.ts` be deleted immediately or kept temporarily?**
   - What we know: `server/routes.ts:32` imports from `./routes/xpot.js`. After changing to `./routes/xpot/index.js`, the old file would cause a conflict (same directory as the `xpot/` folder).
   - What's unclear: Whether the build system allows both `xpot.ts` and `xpot/` to coexist.
   - Recommendation: DELETE `xpot.ts` in the same commit that creates the `xpot/` directory. They cannot coexist (filesystem conflict).

3. **Should `ensureXpotRep` be in middleware.ts or helpers.ts?**
   - What we know: It's called by both auth middleware functions. It's not a "helper" in the domain sense — it's auth infrastructure.
   - Recommendation: Keep in `middleware.ts` alongside `requireXpotUser`/`requireXpotManager`. They form a cohesive auth unit.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| express | All domain routers | ✓ | 4.22.1 | — |
| Node.js subpath imports (`#shared/*`) | Schema imports in all routers | ✓ | (package.json `imports` field) | — |
| express-async-errors | Async error propagation | ✓ | (in app.ts) | — |
| zod | Route validation | ✓ | (in package.json) | — |
| TypeScript | Type checking | ✓ | (in project) | — |
| npm run check | Verification step | ✓ | — | — |
| PostgreSQL | Runtime testing | ✓ | (via DATABASE_URL) | — |

**Missing dependencies with no fallback:**
- None — all dependencies are available.

**Missing dependencies with fallback:**
- None.

## Validation Architecture

> This project has no automated test framework. `npm run check` (TypeScript type checking) is the only automated verification. Manual API smoke testing is required.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SPLIT-01 | Shared middleware extracted | type-check | `npm run check` | ✅ |
| SPLIT-02 | Shared helpers extracted | type-check | `npm run check` | ✅ |
| SPLIT-03 | 10 domain routers created | type-check | `npm run check` | ✅ |
| SPLIT-04 | routes.ts import updated | type-check + smoke | `npm run check` + manual | ✅ |
| SPLIT-05 | All 33 routes respond identically | manual smoke test | curl/browser | ❌ Manual only |

### Sampling Rate
- **After each domain router:** `npm run check` (TypeScript validation)
- **After all routers created:** Manual smoke test of all 33 endpoints
- **Phase gate:** All routes respond with same status codes and JSON shapes

### Wave 0 Gaps
- None — no test infrastructure exists or is planned for this phase.
- Manual smoke test script should be created as part of SPLIT-05 task.

## Sources

### Primary (HIGH confidence)
- Express 4.x Router API: https://expressjs.com/en/4x/api.html#router
- Express Routing Guide: https://expressjs.com/en/guide/routing.html
- Current codebase: `server/routes/xpot.ts` (1,042 lines, 33 routes — read in full)
- Current codebase: `server/routes.ts` (line 32 — import path)
- Current codebase: `server/app.ts` (error middleware lines 64-88, `express-async-errors` line 1)
- Installed Express version: 4.22.1 (verified via `node_modules/express/package.json`)
- `package.json` `imports` field: `#shared/*` → `./shared/*` (Node.js subpath imports)
- `tsconfig.json` `paths`: `@shared/*` → `./shared/*` (TypeScript alias)

### Secondary (MEDIUM confidence)
- Pre-existing ROUTE-SPLITTING.md research (2026-03-30) — cross-verified against actual code
- `server/storage/storageAdapter.ts` — existing sub-module pattern in same codebase

### Tertiary (LOW confidence)
- Community patterns for Express router organization (general knowledge, not project-specific)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Express 4.22.1 verified installed, Router API is well-documented
- Architecture: HIGH — Clean mechanical extraction, no logic changes needed
- Pitfalls: HIGH — All pitfalls derived from reading actual code patterns, not assumptions
- Import resolution: HIGH — `#shared/*` verified as Node.js subpath import (package.json), depth-independent

**Research date:** 2026-03-30
**Valid until:** 2026-04-30 (30 days — Express 4.x is stable, no breaking changes expected)
