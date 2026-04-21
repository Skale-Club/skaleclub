# Phase 16: Admin CRUD API — Research

**Researched:** 2026-04-21
**Domain:** Express.js REST API — admin-authenticated CRUD for presentations resource
**Confidence:** HIGH

## Summary

Phase 16 is a pure backend phase: wire four REST endpoints (GET list, POST create, PUT update, DELETE delete) for the `presentations` table. All storage logic is already implemented in `server/storage.ts` as fully-working methods (not stubs — Phase 15 implemented the real queries). The only work is: (1) create `server/routes/presentations.ts` following the exact `estimates.ts` pattern, (2) register it in `server/routes.ts`, and (3) add version auto-increment to the PUT handler.

No new libraries are needed. No schema changes are needed. No storage changes are needed except one small gap: the `IStorage` interface (lines 582–695 of `server/storage.ts`) does not declare the presentation methods — they exist only on `DatabaseStorage`. This is not a TypeScript error today (the interface is satisfied by having extra methods), but it means no code can program against `IStorage` for presentations. Phase 16 routes call `storage.*` directly (the singleton is `DatabaseStorage`), so this does not block execution. The interface gap can be noted and addressed as a task or deferred.

**Primary recommendation:** Copy `server/routes/estimates.ts` as the structural template. The presentations route file is ~85–100 lines. Register it in `routes.ts` alongside `registerEstimatesRoutes`. One deviation from the estimates pattern: the PUT handler must inject `version: sql\`${presentations.version} + 1\`` (or fetch current + increment at the application layer) because `insertPresentationSchema` has no `version` field and `updatePresentation` in storage does not auto-increment it.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PRES-05 | `GET /api/presentations` — admin-auth, returns array with id, slug, title, slideCount, viewCount, createdAt; sorted by createdAt desc; 401 when unauthenticated | `listPresentations()` storage method is fully implemented with LEFT JOIN + JSONB count query. `requireAdmin` middleware from `_shared.ts` handles 401. |
| PRES-06 | `POST /api/presentations` — admin-auth, accepts `{ title }`, returns `{ id, slug }` with empty `slides: []`; duplicate titles produce distinct records | `createPresentation()` is fully implemented. UUID slug is generated at DB level by `defaultRandom()` — no `crypto.randomUUID()` needed in route. Body validated via `insertPresentationSchema`. |
| PRES-07 | `PUT /api/presentations/:id` — admin-auth, updates title/slides/accessCode; `version` increments by 1 per call | `updatePresentation()` exists but does NOT auto-increment `version`. Route handler must add `version` increment. Pattern: read current version via `getPresentation`, then pass `version: existing.version + 1` into the update. Alternatively use a raw SQL increment in a one-line Drizzle `set`. |
| PRES-08 | `DELETE /api/presentations/:id` — admin-auth, removes presentation and cascades presentation_views; 404 if not found | `deletePresentation()` is implemented. DB has `ON DELETE CASCADE` on `presentation_views.presentation_id`, so cascade is automatic. Route should 404-guard before delete. |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Max 600 lines per file** — presentations route file will be ~85–100 lines, well within limit
- **Translation rule** — No UI strings in this phase; not applicable
- **Border styling rule** — No UI in this phase; not applicable
- **Admin design system** — No UI in this phase; not applicable
- **TypeScript** — `npm run check` must pass; all route handlers must be fully typed
- **Storage layer pattern** — All DB access through `server/storage.ts` methods; routes must not use `db` directly
- **Shared schema as source of truth** — Validate request bodies with Zod schemas from `shared/schema.ts`

## Standard Stack

### Core (already installed — no new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| express | existing | HTTP routing | Project standard; all routes use Express |
| zod | existing | Request body validation | Project-wide validation pattern |
| drizzle-orm | existing | ORM (used only in storage layer) | Project standard |
| `_shared.ts` requireAdmin | existing | Admin auth middleware | Used by estimates, blog, xpot routes |

**No new npm installs required for Phase 16.**

### Alternatives Considered

None — the project's patterns are established and locked. Phase 16 follows the `estimates.ts` template exactly.

## Architecture Patterns

### Recommended Project Structure

Phase 16 adds one file and modifies one import list:

```
server/
├── routes/
│   ├── _shared.ts           # requireAdmin (already exists, import from here)
│   ├── estimates.ts         # Structural template to mirror
│   └── presentations.ts     # NEW — Phase 16 deliverable (~85–100 lines)
└── routes.ts                # ADD: registerPresentationsRoutes(app) call
```

### Pattern 1: Route Module Registration (mirror estimates.ts)

**What:** Each resource domain is a separate `server/routes/*.ts` file exporting a `registerXRoutes(app: Express)` function.
**When to use:** Every new resource domain.

```typescript
// server/routes/presentations.ts
import type { Express } from "express";
import { storage } from "../storage.js";
import { insertPresentationSchema } from "#shared/schema.js";
import { requireAdmin } from "./_shared.js";

export function registerPresentationsRoutes(app: Express) {
  // Routes registered here
}
```

```typescript
// server/routes.ts — add alongside registerEstimatesRoutes
import { registerPresentationsRoutes } from "./routes/presentations.js";
// ...inside registerRoutes():
registerPresentationsRoutes(app);
```

### Pattern 2: GET list with derived counts

**What:** `listPresentations()` already returns `PresentationWithStats[]` — includes `slideCount` and `viewCount` derived from LEFT JOIN + JSONB aggregate. Route handler is trivial.

```typescript
// Source: server/storage.ts lines 1852–1872
app.get("/api/presentations", requireAdmin, async (_req, res) => {
  try {
    const list = await storage.listPresentations();
    res.json(list);
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
});
```

### Pattern 3: POST create — slug from DB defaultRandom()

**What:** Unlike estimates (where slug is `crypto.randomUUID()` in the route), presentations slug is `defaultRandom()` in the Drizzle column definition. The `createPresentation` storage method simply passes the validated title; the DB auto-generates both `id` and `slug`.

```typescript
app.post("/api/presentations", requireAdmin, async (req, res) => {
  try {
    const parsed = insertPresentationSchema.pick({ title: true }).safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Validation error", errors: parsed.error.errors });
    }
    const presentation = await storage.createPresentation({ title: parsed.data.title, slides: [] });
    res.status(201).json({ id: presentation.id, slug: presentation.slug, slides: presentation.slides });
  } catch (err) {
    res.status(400).json({ message: (err as Error).message });
  }
});
```

**Key:** Do NOT generate a slug in the route — the DB generates it. PRES-06 requires that two POSTs with the same title produce distinct `id` and `slug` values — this is satisfied by `defaultRandom()`.

### Pattern 4: PUT update with version increment

**What:** `updatePresentation` in storage does NOT auto-increment `version`. PRES-07 requires incrementing on every successful PUT. The safest approach is to fetch the current row first, then pass `version + 1` explicitly.

```typescript
app.put("/api/presentations/:id", requireAdmin, async (req, res) => {
  try {
    const updateSchema = insertPresentationSchema.partial();
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Validation error", errors: parsed.error.errors });
    }
    const existing = await storage.getPresentation(req.params.id);
    if (!existing) return res.status(404).json({ message: "Presentation not found" });
    const updated = await storage.updatePresentation(req.params.id, {
      ...parsed.data,
      version: existing.version + 1,
    });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: (err as Error).message });
  }
});
```

**Note:** `insertPresentationSchema` does not include `version` — it must be injected manually in the route. The `updatePresentation` storage method accepts `Partial<InsertPresentation>` — since `InsertPresentation` comes from `typeof presentations.$inferInsert` which DOES have `version`, passing `version` in the update set is valid.

### Pattern 5: DELETE with 404 guard

**What:** Cascade delete is handled by the DB (`ON DELETE CASCADE` on `presentation_views`). Route fetches to verify existence before deleting.

```typescript
app.delete("/api/presentations/:id", requireAdmin, async (req, res) => {
  try {
    const existing = await storage.getPresentation(req.params.id);
    if (!existing) return res.status(404).json({ message: "Presentation not found" });
    await storage.deletePresentation(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ message: (err as Error).message });
  }
});
```

### Anti-Patterns to Avoid

- **Generating slug in route handler:** Do NOT call `crypto.randomUUID()` for slug — the DB column uses `defaultRandom()` and generates it automatically. Generating in route would shadow the DB default.
- **Implementing version increment in storage:** `updatePresentation` accepts `Partial<InsertPresentation>` but does not know the current version — incrementing there would require an extra read inside the method. Better to do the read in the route and pass explicit `version` (consistent with the single responsibility of storage methods).
- **Calling `db` directly in route:** All DB access must go through `storage.*` per project architecture.
- **Missing 404 guard on PUT/DELETE:** Routes must check `getPresentation` before mutating; returning 404 for unknown IDs is required behavior.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Admin authentication | Custom auth check in each handler | `requireAdmin` from `_shared.ts` | Already handles session check + DB admin flag + 401/403 responses |
| Request body validation | Manual `if (!req.body.title)` checks | `insertPresentationSchema.safeParse()` from shared schema | Provides structured error output; Zod handles type coercion |
| UUID generation for slug | `crypto.randomUUID()` in route | Drizzle `.defaultRandom()` in DB column | Slug is generated at DB level; route does not need to know about it |
| Cascade delete of views | Manual `DELETE FROM presentation_views WHERE ...` | DB `ON DELETE CASCADE` constraint | Already in SQL migration; automatic |
| Derived counts (slideCount, viewCount) | Computing in route handler | `listPresentations()` storage method | Already uses LEFT JOIN + JSONB aggregate query |

**Key insight:** All business logic for this phase is already in the storage layer. Routes are purely wiring and validation.

## Runtime State Inventory

Step 2.5: SKIPPED — this is a greenfield API phase, not a rename/refactor/migration phase. No runtime state is affected.

## Environment Availability

Step 2.6: SKIPPED — no external dependencies. Phase 16 uses only libraries already installed. The PostgreSQL database must have the Phase 15 migration applied (tables must exist), but that is a prerequisite verified by Phase 15 completion, not an environment check for this phase.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Phase 15 tables | All 4 endpoints | Assumed applied | — | Run `npx tsx scripts/migrate-presentations.ts` if not |
| express | Route registration | ✓ | existing | — |
| zod | Body validation | ✓ | existing | — |
| `requireAdmin` middleware | All 4 endpoints | ✓ | existing | — |

## Validation Architecture

### Test Framework

No test infrastructure exists in this project (`package.json` has no test script, no vitest/jest/mocha). Nyquist validation for this phase must rely on integration smoke tests via `curl`.

| Property | Value |
|----------|-------|
| Framework | None — no test runner installed |
| Config file | None |
| Quick run command | `curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/api/presentations` |
| Full suite command | Manual curl sequence (see Wave 0 Gaps) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PRES-05 | GET /api/presentations returns 401 without auth | smoke | `curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/api/presentations` → expect 401 | ❌ Wave 0 |
| PRES-05 | GET /api/presentations returns array with correct fields when authenticated | smoke/manual | Manual curl with session cookie | ❌ Wave 0 |
| PRES-06 | POST /api/presentations creates record with empty slides | smoke/manual | `curl -X POST -H "Content-Type: application/json" -d '{"title":"Test"}' http://localhost:5000/api/presentations` → expect 401 without auth | ❌ Wave 0 |
| PRES-06 | Two POSTs with same title produce distinct id/slug | smoke/manual | Manual two-POST sequence with auth | ❌ Wave 0 |
| PRES-07 | PUT /api/presentations/:id increments version by 1 | smoke/manual | Manual PUT with auth, compare version before/after | ❌ Wave 0 |
| PRES-08 | DELETE removes row + views; subsequent GET excludes id | smoke/manual | Manual DELETE then GET with auth | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npm run check` (TypeScript must pass)
- **Per wave merge:** `npm run check` + manual curl smoke test for each endpoint
- **Phase gate:** All 4 endpoints respond correctly (401 without auth, correct behavior with auth)

### Wave 0 Gaps

No automated test files to create — project has no test framework. The verification gate for Phase 16 is:

- [ ] `npm run check` passes after route file is created and registered
- [ ] Manual curl or browser DevTools confirms 401 on unauthenticated GET
- [ ] Authenticated smoke test confirms all 4 endpoints work as specified

*(No test framework install is recommended for this phase — adding a testing framework is not in scope and would be a separate phase.)*

## Common Pitfalls

### Pitfall 1: UUID ID comparison type mismatch
**What goes wrong:** Route extracts `req.params.id` as `string` and passes to storage. Storage uses `eq(presentations.id, id)` where `presentations.id` is `uuid()` column. This works in Drizzle/Postgres because UUID columns accept string input. No coercion needed.
**Why it happens:** Might be tempted to call `Number()` on `:id` by reflex from estimate routes (which use integer IDs).
**How to avoid:** Do NOT call `Number(req.params.id)` — presentation IDs are UUID strings. Pass `req.params.id` directly.
**Warning signs:** TypeScript would catch a type mismatch at `storage.getPresentation(id: string)`.

### Pitfall 2: version field not in insertPresentationSchema
**What goes wrong:** Planner tries `insertPresentationSchema.partial().safeParse(req.body)` for PUT and then passes the parsed data to `storage.updatePresentation`. The `version` field is not in `insertPresentationSchema`, so it won't be in `parsed.data`. If the planner then passes `parsed.data` directly to `updatePresentation`, `version` never increments.
**Why it happens:** The schema intentionally omits `version` (it's server-controlled). But PRES-07 requires it to increment.
**How to avoid:** After `safeParse`, explicitly add `version: existing.version + 1` to the update payload. This is separate from the user-supplied body.
**Warning signs:** PUT succeeds but GET still shows original `version` value.

### Pitfall 3: Slug route ordering (future-proofing)
**What goes wrong:** If Phase 16 registers `GET /api/presentations/:id` before Phase 20's `GET /api/presentations/slug/:slug`, Express would match `"slug"` as an `:id` value.
**Why it happens:** Express route matching is order-dependent.
**How to avoid:** Register the literal-segment route (`/slug/:slug`) before the wildcard route (`/:id`). This is the established pattern in `estimates.ts` (slug endpoint registered first at line 1).
**Warning signs:** `GET /api/presentations/slug/abc123` returns 404 or a DB error about invalid UUID.

### Pitfall 4: slides JSONB default vs undefined
**What goes wrong:** POST body might not include `slides` — which is correct per PRES-06 (only `title` required). `insertPresentationSchema` has `slides: z.array(slideBlockSchema).default([])` which means omitting `slides` is valid and defaults to `[]`. Passing `{ title }` to `createPresentation` will insert `slides: []` because the DB column also has `DEFAULT '[]'::jsonb`.
**Why it happens:** Double-default (Zod schema + DB column) ensures `slides: []` in both validation and storage.
**How to avoid:** No action needed — just be aware not to require `slides` in the POST body. The success criterion states "returns `{ id, slug }` with an empty `slides: []`".

## Code Examples

### Verified: requireAdmin middleware signature
```typescript
// Source: server/routes/_shared.ts
export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void>
// Usage: app.get("/api/presentations", requireAdmin, async (req, res) => { ... })
```

### Verified: updatePresentation storage method signature
```typescript
// Source: server/storage.ts line 1889
async updatePresentation(id: string, data: Partial<InsertPresentation>): Promise<Presentation>
// Note: InsertPresentation = typeof presentations.$inferInsert (includes version field)
```

### Verified: createPresentation storage method
```typescript
// Source: server/storage.ts line 1884
async createPresentation(data: InsertPresentation): Promise<Presentation>
// DB auto-generates id (UUID PK) and slug (UUID UNIQUE) via defaultRandom()
// No need to pass id or slug from route
```

### Verified: listPresentations already returns PresentationWithStats
```typescript
// Source: server/storage.ts lines 1852–1872
// Returns: { id, slug, title, slides, guidelinesSnapshot, accessCode, version,
//            createdAt, updatedAt, slideCount (jsonb_array_length), viewCount (COUNT) }
// Sorted: orderBy(desc(presentations.createdAt))
```

### Verified: Route registration pattern in routes.ts
```typescript
// Source: server/routes.ts lines 25, 132
import { registerEstimatesRoutes } from "./routes/estimates.js";
// ...
registerEstimatesRoutes(app);
// Phase 16 adds analogous import + call for registerPresentationsRoutes
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Routes in monolithic routes.ts | Separate route modules per domain | v1.2 estimates phase | Phase 16 follows this established pattern |
| Integer PKs for admin resources | UUID PKs for presentations | Phase 15 | ID type in routes is `string`, not `Number()` |

## Open Questions

1. **Should `IStorage` interface be updated to declare presentation methods?**
   - What we know: Methods exist on `DatabaseStorage` but not on `IStorage` (lines 582–695). TypeScript compiles fine because routes access `storage` as `DatabaseStorage` singleton.
   - What's unclear: Whether future tests or mocks would depend on `IStorage`.
   - Recommendation: Add declaration to `IStorage` as a single task in Phase 16 (5-line change, no risk). This completes the architecture properly.

2. **Should `updatePresentation` storage method handle version increment internally?**
   - What we know: Current signature is `updatePresentation(id, data: Partial<InsertPresentation>)` — caller controls all fields including version.
   - What's unclear: Phase 18 (AI endpoint) also calls `updatePresentation` and also needs to increment version.
   - Recommendation: Keep version increment in the route handler for Phase 16 (consistent with explicit control). Phase 18 can adopt the same pattern. Alternatively, add a dedicated `incrementVersion` helper in storage.

## Sources

### Primary (HIGH confidence)
- Direct codebase audit: `server/storage.ts` lines 1850–1928 — presentation storage methods fully implemented
- Direct codebase audit: `server/routes/estimates.ts` — structural template (entire file)
- Direct codebase audit: `server/routes/_shared.ts` — `requireAdmin` middleware implementation
- Direct codebase audit: `shared/schema/presentations.ts` — Drizzle table + Zod validators
- Direct codebase audit: `migrations/0033_create_presentations.sql` — cascade delete confirmed
- Direct codebase audit: `server/routes.ts` lines 116–133 — registration pattern
- Direct codebase audit: `.planning/phases/15-schema-foundation/15-01-SUMMARY.md` — Phase 15 deliverables

### Secondary (MEDIUM confidence)
- `npm run check` output: confirmed TypeScript passes with current codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; all patterns verified in codebase
- Architecture: HIGH — estimates.ts is a direct, proven template; differences documented
- Pitfalls: HIGH — identified via direct code reading, not speculation

**Research date:** 2026-04-21
**Valid until:** N/A — findings are based on current codebase state, not library documentation
