# Phase 23: API Endpoints + Cron — Research

**Researched:** 2026-04-22
**Domain:** Express REST endpoints, Bearer-token cron auth, Node.js setInterval cron, existing project route/storage/auth patterns
**Confidence:** HIGH — all findings verified from direct codebase inspection; no external library choices are being made

---

## Summary

Phase 23 is a thin integration layer that connects the already-complete `BlogGenerator.generate()` service (Phase 22) to the outside world through three REST endpoints and one in-process cron timer. Nothing new needs to be designed architecturally — the patterns exist and are proven in the codebase.

The key facts: `isAuthorizedCronRequest()` already lives in `server/routes/_shared.ts` and handles `Authorization: Bearer {CRON_SECRET}` validation. `requireAdmin` from the same file is the auth middleware for admin-only endpoints. `getBlogSettings()` already returns `undefined` when the DB row is absent — the route must supply the safe-defaults response on its own rather than relying on the storage layer. `startCron()` is a new file (`server/cron.ts`) that wraps `setInterval` and is called from `server/index.ts` only when `process.env.VERCEL` is falsy.

**Primary recommendation:** Add one new route file `server/routes/blogAutomation.ts`, register it in `registerRoutes()`, and create `server/cron.ts`. No storage changes, no schema changes, no new dependencies.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BLOG-13 | `GET /api/blog/settings` (no auth) — safe defaults when no row; `PUT /api/blog/settings` (admin-auth) — upsert + return saved row | `getBlogSettings()` returns `undefined`; must inline defaults in the GET handler. `upsertBlogSettings()` fully implemented. `requireAdmin` + `insertBlogSettingsSchema` available. |
| BLOG-14 | `POST /api/blog/generate` (admin-auth) — manual trigger, returns `{ jobId, postId, post }` or `{ skipped, reason }`, never 4xx on skip | `BlogGenerator.generate({ manual: true })` returns the discriminated-union result. Route maps result to JSON: spread the success fields or return the skip object. |
| BLOG-15 | `POST /api/blog/cron/generate` (no session auth) — validates Bearer token via `CRON_SECRET`, returns 401 on mismatch, calls `generate({ manual: false })` | `isAuthorizedCronRequest(req)` in `_shared.ts` implements the exact token check required. No new auth code needed. |
| BLOG-16 | `server/cron.ts` exports `startCron()` — calls `BlogGenerator.generate({ manual: false })` hourly, skipped on Vercel, started from `server/index.ts` | `server/index.ts` imports are async; `setInterval` is built-in. Guard is `if (!process.env.VERCEL)`. |
</phase_requirements>

---

## Standard Stack

### Core (all already in project — no new installs)

| Library / API | Version | Purpose | Why Standard |
|---------------|---------|---------|--------------|
| Express 4 | 4.21.2 | HTTP routing | Already the server framework |
| `server/routes/_shared.ts` | — | `requireAdmin`, `isAuthorizedCronRequest`, `setPublicCache` | Established shared middleware; all previous route files import from here |
| `server/storage.ts` (`storage` singleton) | — | DB access via `IStorage` | All existing route files use the named import `import { storage } from "../storage.js"` |
| `shared/schema/blog.ts` | — | `insertBlogSettingsSchema`, `selectBlogSettingsSchema`, `BlogSettings` types | Phase 21 output; already barrel-exported from `shared/schema.ts` |
| `server/lib/blog-generator.ts` | — | `BlogGenerator.generate()`, `BlogGeneratorResult` type | Phase 22 output; stable public API |
| Node.js `setInterval` | built-in | Hourly cron in non-Vercel environments | Already used elsewhere (rate-limit resets in `routes.ts`) |
| `express-async-errors` | installed | Async error propagation without try/catch in every handler | Registered globally in `server/app.ts` line 1 — all routes benefit |

**Installation:** No new packages required.

---

## Architecture Patterns

### Recommended Project Structure

The new work adds exactly two files:

```
server/
├── routes/
│   ├── blog.ts                  (existing — untouched)
│   └── blogAutomation.ts        (NEW — BLOG-13, BLOG-14, BLOG-15)
├── cron.ts                      (NEW — BLOG-16)
└── index.ts                     (modify: import + call startCron())
server/routes.ts                 (modify: import + call registerBlogAutomationRoutes)
```

### Pattern 1: Route File Registration

Every route module exports a single `register*Routes(app: Express): void` function and is imported + called inside `registerRoutes()` in `server/routes.ts`.

```typescript
// server/routes/brandGuidelines.ts (reference implementation)
import type { Express } from "express";
import { storage } from "../storage.js";
import { requireAdmin } from "./_shared.js";

export function registerBrandGuidelinesRoutes(app: Express) {
  app.get("/api/brand-guidelines", async (_req, res) => {
    const row = await storage.getBrandGuidelines();
    res.json({ content: row?.content ?? '' });
  });

  app.put("/api/brand-guidelines", requireAdmin, async (req, res) => {
    // ...
  });
}
```

Apply the same pattern for `blogAutomation.ts`.

### Pattern 2: Settings GET with Safe Defaults (no 404)

`getBlogSettings()` returns `undefined` when no DB row exists. The GET handler must never 404 — it must return safe defaults.

```typescript
// Inline safe-default constants
const BLOG_SETTINGS_DEFAULTS = {
  enabled: false,
  postsPerDay: 0,
  seoKeywords: "",
  enableTrendAnalysis: false,
  promptStyle: "",
  lastRunAt: null,
  lockAcquiredAt: null,
};

app.get("/api/blog/settings", async (_req, res) => {
  const row = await storage.getBlogSettings();
  res.json(row ?? BLOG_SETTINGS_DEFAULTS);
});
```

This is the same pattern as `GET /api/brand-guidelines` which returns `{ content: row?.content ?? '' }` on an empty DB.

### Pattern 3: Admin-Guarded PUT with Zod Validation

```typescript
app.put("/api/blog/settings", requireAdmin, async (req, res) => {
  const parsed = insertBlogSettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.errors[0].message });
  }
  const saved = await storage.upsertBlogSettings(parsed.data);
  res.json(saved);
});
```

Reference: `PUT /api/brand-guidelines` uses identical structure.

### Pattern 4: POST /api/blog/generate — Manual Trigger

`BlogGenerator.generate()` returns a discriminated union. The route forwards the result directly — skip results are 200 (not 4xx), as required by BLOG-14.

```typescript
app.post("/api/blog/generate", requireAdmin, async (_req, res) => {
  const result = await BlogGenerator.generate({ manual: true });
  if (result.skipped) {
    return res.json({ skipped: result.skipped, reason: result.reason });
  }
  res.json({ jobId: result.jobId, postId: result.postId, post: result.post });
});
```

Note: `express-async-errors` is active globally — if `BlogGenerator.generate()` throws, Express will catch it and return 500 automatically. No try/catch needed in the route handler unless a specific non-500 response is desired on error.

### Pattern 5: POST /api/blog/cron/generate — Bearer Token Auth

`isAuthorizedCronRequest(req)` is already implemented in `_shared.ts`. It checks `Authorization: Bearer {CRON_SECRET}` when `CRON_SECRET` is set. Returns `true` in development with no secret set, `false` in production without a matching token.

```typescript
import { isAuthorizedCronRequest } from "./_shared.js";

app.post("/api/blog/cron/generate", async (req, res) => {
  if (!isAuthorizedCronRequest(req)) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  const result = await BlogGenerator.generate({ manual: false });
  if (result.skipped) {
    return res.json({ skipped: result.skipped, reason: result.reason });
  }
  res.json({ jobId: result.jobId, postId: result.postId });
});
```

### Pattern 6: server/cron.ts — startCron()

```typescript
// server/cron.ts
import { BlogGenerator } from "./lib/blog-generator.js";

const HOUR_IN_MS = 60 * 60 * 1000;

export function startCron(): void {
  if (process.env.VERCEL) {
    // Vercel is serverless — no persistent process, cron is triggered via HTTP
    return;
  }

  console.log("[cron] blog auto-generator starting — runs every 60 minutes");
  setInterval(async () => {
    try {
      const result = await BlogGenerator.generate({ manual: false });
      if (result.skipped) {
        console.log(`[cron] blog generation skipped: ${result.reason}`);
      } else {
        console.log(`[cron] blog generation completed: postId=${result.postId}`);
      }
    } catch (err) {
      console.error("[cron] blog generation error:", err);
    }
  }, HOUR_IN_MS);
}
```

### Pattern 7: server/index.ts Integration

```typescript
// server/index.ts — add after createApp()
import { startCron } from "./cron.js";

// Inside the IIFE, after httpServer.listen():
startCron();
```

The cron must start AFTER the server is listening so DB connections are available. `server/index.ts` already uses an async IIFE — the import and `startCron()` call fit cleanly there.

### Anti-Patterns to Avoid

- **Do NOT add cron routes to `server/routes/blog.ts`** — that file is for blog post CRUD. Settings and generate routes belong in a separate file to maintain separation of concerns, consistent with the pattern established by `presentationsChat.ts` being separate from `presentations.ts`.
- **Do NOT return 4xx for skip results** — BLOG-14 explicitly requires `{ skipped, reason }` as a 200 response, not a 400.
- **Do NOT start the cron inside `registerRoutes()`** — cron is a process-level concern, not a routing concern. `server/index.ts` is the right place.
- **Do NOT import from `"../db.js"` directly in route handlers** — use `storage` singleton, consistent with all other route files.
- **Do NOT use try/catch in every handler** — `express-async-errors` is active; only use try/catch when a specific non-500 branch is needed on error.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cron auth | Custom header parsing logic | `isAuthorizedCronRequest(req)` from `_shared.ts` | Already handles `Bearer {CRON_SECRET}`, `x-vercel-cron` header, and dev-mode bypass |
| Admin auth | Session check inline in handler | `requireAdmin` middleware from `_shared.ts` | Battle-tested; used in 12+ routes |
| Settings validation | Inline type guards | `insertBlogSettingsSchema.safeParse()` | Phase 21 Zod schema covers all fields with correct types |
| Blog settings defaults | DB row with default values | Inline constant in GET handler | Storage returns `undefined` by design; defaults are the route's responsibility per BLOG-13 |

---

## Common Pitfalls

### Pitfall 1: Route Order — `/api/blog/settings` before `/api/blog/:idOrSlug`

**What goes wrong:** Express matches `/api/blog/settings` as a wildcard `idOrSlug` match if the literal route is registered after the parameterized one.

**Why it happens:** `server/routes/blog.ts` registers `app.get("/api/blog/:idOrSlug", ...)` which captures any path segment. If `blogAutomation.ts` routes are registered after `blog.ts`, `/api/blog/settings` is consumed by the wildcard handler and returns a 404 ("blog post not found").

**How to avoid:** In `registerRoutes()`, call `registerBlogAutomationRoutes(app)` BEFORE `registerBlogRoutes(app)`, or ensure the literal `/api/blog/settings` path is registered before the wildcard `:idOrSlug` route. The safest approach is to register `blogAutomation.ts` first in `routes.ts`.

**Warning signs:** `GET /api/blog/settings` returns `{ message: "Blog post not found" }` — sure sign the wildcard handler intercepted it.

### Pitfall 2: Cron Not Starting in Development

**What goes wrong:** Developer sets `VERCEL=1` in their `.env` for testing and the cron silently never starts.

**Why it happens:** `if (process.env.VERCEL)` guard skips cron startup.

**How to avoid:** The console.log in `startCron()` ("blog auto-generator starting") makes this visible. Document the guard behavior in the log message so developers aren't confused.

### Pitfall 3: BlogGenerator Import in cron.ts — Lazy vs. Eager

**What goes wrong:** `blog-generator.ts` uses lazy dynamic imports for `db` and `storage` to avoid `DATABASE_URL` requirement at module load time. Importing `BlogGenerator` in `cron.ts` is safe because the class itself doesn't initialize anything on import — `generate()` defers DB access until called.

**Why it matters:** If a future developer tries to pre-initialize the generator or call it at module load time, it will crash without `DATABASE_URL`.

**How to avoid:** Always call `BlogGenerator.generate()` inside the `setInterval` callback, never at module initialization time.

### Pitfall 4: Cron Error Swallowing

**What goes wrong:** An unhandled rejection inside `setInterval(async () => {...})` is swallowed by Node.js and the cron silently dies.

**Why it happens:** `setInterval` does not propagate promise rejections.

**How to avoid:** Wrap the `generate()` call in try/catch inside the interval callback and log errors explicitly. The pattern is shown in the Pattern 6 code example above.

### Pitfall 5: PUT /api/blog/settings Does Not Strip Lock Fields

**What goes wrong:** A client sends `lockAcquiredAt` or `lastRunAt` in the PUT body, unintentionally clearing the lock or resetting timing state.

**Why it happens:** `insertBlogSettingsSchema` accepts these fields as optional. A naive upsert forwards them directly.

**How to avoid:** The Zod schema accepts them (the generator itself needs to pass them through `buildSettingsUpdate`). For the admin PUT endpoint, either strip lock-related fields from the parsed body before calling `upsertBlogSettings`, or document that the admin UI will never send these fields. The safe approach: omit `lockAcquiredAt` from the schema slice accepted by the PUT handler, or use `.omit({ lockAcquiredAt: true })` on the schema.

---

## Code Examples

### BlogGeneratorResult type (from Phase 22)

```typescript
// server/lib/blog-generator.ts
type BlogGeneratorResult =
  | { skipped: true; reason: SkipReason }
  | { skipped: false; reason: null; jobId: number; postId: number; post: BlogPost };
```

The route handler pattern branches on `result.skipped`.

### isAuthorizedCronRequest (existing, server/routes/_shared.ts)

```typescript
export function isAuthorizedCronRequest(req: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization;
  const bearerToken =
    typeof authHeader === "string" && authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : null;
  const hasVercelCronHeader = typeof req.headers["x-vercel-cron"] === "string";

  if (cronSecret) {
    return bearerToken === cronSecret;
  }

  if (process.env.NODE_ENV !== "production") {
    return true;
  }

  return hasVercelCronHeader;
}
```

BLOG-15 success criterion: "with wrong/missing `CRON_SECRET` returns 401" — this function returns `false`, the route returns 401. Already covered.

### Full blogAutomation.ts skeleton

```typescript
import type { Express } from "express";
import { storage } from "../storage.js";
import { insertBlogSettingsSchema } from "#shared/schema.js";
import { BlogGenerator } from "../lib/blog-generator.js";
import { requireAdmin, isAuthorizedCronRequest } from "./_shared.js";

const BLOG_SETTINGS_DEFAULTS = {
  enabled: false,
  postsPerDay: 0,
  seoKeywords: "",
  enableTrendAnalysis: false,
  promptStyle: "",
  lastRunAt: null,
  lockAcquiredAt: null,
};

export function registerBlogAutomationRoutes(app: Express) {
  // BLOG-13
  app.get("/api/blog/settings", async (_req, res) => {
    const row = await storage.getBlogSettings();
    res.json(row ?? BLOG_SETTINGS_DEFAULTS);
  });

  // BLOG-13
  app.put("/api/blog/settings", requireAdmin, async (req, res) => {
    const parsed = insertBlogSettingsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message });
    }
    const saved = await storage.upsertBlogSettings(parsed.data);
    res.json(saved);
  });

  // BLOG-14
  app.post("/api/blog/generate", requireAdmin, async (_req, res) => {
    const result = await BlogGenerator.generate({ manual: true });
    if (result.skipped) {
      return res.json({ skipped: result.skipped, reason: result.reason });
    }
    res.json({ jobId: result.jobId, postId: result.postId, post: result.post });
  });

  // BLOG-15
  app.post("/api/blog/cron/generate", async (req, res) => {
    if (!isAuthorizedCronRequest(req)) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const result = await BlogGenerator.generate({ manual: false });
    if (result.skipped) {
      return res.json({ skipped: result.skipped, reason: result.reason });
    }
    res.json({ jobId: result.jobId, postId: result.postId });
  });
}
```

---

## Validation Architecture

`nyquist_validation` is enabled (config.json). The existing test infrastructure for this phase is the `tsx` executable contract pattern established in Phase 22.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Executable `tsx` scripts (no Jest/Vitest — CLAUDE.md: "Manual QA only") |
| Config file | none — standalone executable scripts |
| Quick run command | `npx tsx server/lib/__tests__/blog-generator.test.ts` |
| Full suite command | `npm run check` (TypeScript compilation = full type-safety gate) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BLOG-13 (GET) | Returns 200 with defaults when no row | manual smoke | `curl http://localhost:1000/api/blog/settings` | ❌ Wave 0 |
| BLOG-13 (PUT) | Upserts + subsequent GET returns saved values | manual smoke | `curl -X PUT ...` then `curl GET` | ❌ Wave 0 |
| BLOG-14 | POST returns `{skipped, reason}` or `{jobId,postId,post}` | manual smoke | `curl -X POST /api/blog/generate` with session | ❌ Wave 0 |
| BLOG-15 | 401 with bad token; 200 with correct token | executable assertion or manual | `npx tsx` script or curl | ❌ Wave 0 |
| BLOG-16 | startCron() logs on non-Vercel startup | TypeScript compile + manual log check | `npm run check` + server start observation | ❌ Wave 0 |

> Note: CLAUDE.md states "Manual QA only — No test framework available." TypeScript compilation (`npm run check`) is the primary automated gate. Manual curl-based smoke tests are the verification approach, consistent with Phase 21-22.

### Sampling Rate

- **Per task commit:** `npm run check` (TypeScript must pass clean)
- **Per wave merge:** `npm run check` + manual smoke of affected endpoints
- **Phase gate:** Full TypeScript pass + manual verification of all 5 success criteria before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] No automated executable spec for BLOG-15 cron auth — manual curl is sufficient but a `tsx` script could assert the 401 behavior without a running server. Optional enhancement.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| `server/lib/blog-generator.ts` | All routes | ✓ | Phase 22 output | — |
| `server/routes/_shared.ts` (requireAdmin, isAuthorizedCronRequest) | Route auth | ✓ | In repo | — |
| `storage.getBlogSettings()` / `upsertBlogSettings()` | BLOG-13 | ✓ | Phase 21 output | — |
| `CRON_SECRET` env var | BLOG-15 | ✓ (documented in .env.example) | — | Without it: production falls back to `x-vercel-cron` header check |
| `process.env.VERCEL` | BLOG-16 | ✓ (auto-set by Vercel runtime) | — | Falsy in local dev = cron starts |
| Node.js `setInterval` | BLOG-16 | ✓ | built-in | — |

**Missing dependencies with no fallback:** None.

---

## Project Constraints (from CLAUDE.md)

| Directive | Impact on Phase 23 |
|-----------|-------------------|
| API stability — all `/api/*` endpoint signatures must remain unchanged | New endpoints are additive; existing blog CRUD endpoints in `blog.ts` are untouched |
| No DB changes — don't modify table schemas or create migrations | No schema changes; storage methods from Phase 21 are used as-is |
| No feature changes — behavior must be identical before/after | Phase 23 is purely additive |
| Manual QA only — no test framework | TypeScript (`npm run check`) + manual curl smoke tests are the verification strategy |
| Surgical scope — minimize changes, keep existing patterns | One new route file, one new cron file, two small modifications (`routes.ts`, `index.ts`) |
| TypeScript strict mode | All types must be explicit; `BlogGeneratorResult` discriminated union must be narrowed with `result.skipped` check |
| Express 4 + express-async-errors | No try/catch needed in async handlers unless specific error branches are required |
| `requireAdmin` from `_shared.ts` | Do NOT inline session checks; import the existing middleware |
| `isAuthorizedCronRequest` from `_shared.ts` | Already handles CRON_SECRET bearer + vercel header + dev bypass |
| `#shared/*` import alias | Use `import { insertBlogSettingsSchema } from "#shared/schema.js"` not relative path |

---

## Sources

### Primary (HIGH confidence)

- `server/routes/_shared.ts` — `requireAdmin`, `isAuthorizedCronRequest` implementations verified directly
- `server/routes/blog.ts` — route file registration pattern, wildcard `:idOrSlug` route pitfall identified
- `server/routes/brandGuidelines.ts` — canonical model for settings GET/PUT with defaults
- `server/lib/blog-generator.ts` — `BlogGenerator.generate()` public API and `BlogGeneratorResult` type confirmed
- `shared/schema/blog.ts` — `insertBlogSettingsSchema`, `selectBlogSettingsSchema`, `BlogSettings` type confirmed
- `server/storage.ts` — `getBlogSettings()` returns `undefined` when empty, `upsertBlogSettings()` fully implemented
- `server/index.ts` — startup flow; cron integration point identified
- `server/routes.ts` — `registerRoutes()` function; registration order matters for route matching
- `.env.example` — `CRON_SECRET` already documented
- `vercel.json` — no existing `crons` section; Vercel cron must be HTTP-triggered via `POST /api/blog/cron/generate`
- `.planning/config.json` — `nyquist_validation: true`

### Secondary (MEDIUM confidence)

- Phase 22 SUMMARYs — confirmed `BlogGenerator.generate()` stable public API and lazy-import pattern

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in project, verified from source
- Architecture: HIGH — patterns copied directly from working route files
- Pitfalls: HIGH — route order pitfall identified from live Express matching behavior in `blog.ts`; others from code inspection

**Research date:** 2026-04-22
**Valid until:** Stable — only relevant if Phase 22 output changes (unlikely)
