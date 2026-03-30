# Phase 1: Error Handling Standardization - Research

**Researched:** 2026-03-30
**Domain:** Express 4.x error handling, Zod validation, async error propagation
**Confidence:** HIGH

## Summary

The Xpot API layer has three error handling bugs that this phase must fix: (1) a `throw err` in `server/app.ts:66` that re-throws errors after sending a response, crashing the Node process; (2) 11 unguarded `schema.parse(req.body)` calls in async route handlers (`server/routes/xpot.ts`) that throw `ZodError` which Express 4 silently swallows because Express 4 does NOT auto-catch promise rejections; (3) inconsistent error response shapes across Xpot endpoints.

The fix is well-established: add `express-async-errors` (one-line import, patches Express Router prototype to auto-catch async rejections), remove the `throw err`, add `instanceof ZodError` detection to the global error middleware using `err.flatten()`, and standardize the response shape to `{ message, errors? }`. Only one new dependency is needed.

**Primary recommendation:** `import 'express-async-errors'` at the top of `server/app.ts` (before `express`), remove `throw err` from error middleware, add ZodError branch using `err.flatten().fieldErrors`.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ERR-01 | Fix `throw err` crash bug in `server/app.ts` error middleware | Confirmed at line 66 — sends response then re-throws, causing unhandled exception |
| ERR-02 | Add `express-async-errors` to catch uncaught async errors | Express 4 confirmed to NOT auto-catch async rejections; 11 `parse()` calls in xpot.ts throw from async handlers |
| ERR-03 | Add ZodError handling to global error middleware | Zod 3.x `err.flatten().fieldErrors` API verified; returns `{ formErrors, fieldErrors }` shape |
| ERR-04 | Standardize error response shape across all Xpot endpoints | Current shape is `{ message }`; additive `{ errors }` for validation failures is safe for frontend |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| express | ^4.21.2 (existing) | HTTP framework | Already in project; no upgrade needed |
| express-async-errors | 3.1.1 | Polyfill Express 5 async error catching | One-line import, zero API changes, patches Router prototype |
| zod | ^3.24.2 (existing) | Validation | Already in project; `flatten()` instance method available |
| zod-validation-error | ^3.4.0 (existing) | ZodError → readable string | Already installed; optional for enhanced logging |

### Installation
```bash
npm install express-async-errors
```

**Version verification:** `express-async-errors@3.1.1` confirmed latest as of 2026-03-30.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| express-async-errors | asyncHandler wrapper | Requires wrapping every route definition (33 routes); higher risk of forgetting on new routes |
| express-async-errors | Upgrade to Express 5 | Express 5 still in beta; breaking changes; not ready for production |

## Architecture Patterns

### Error Middleware Structure (Recommended)
```typescript
// server/app.ts — FINAL
import 'express-async-errors';  // MUST be before express
import express, { type Request, Response, NextFunction } from "express";
import { ZodError } from "zod";

// ... existing middleware, routes ...

// Error handling middleware (replaces current broken version)
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  // Safety: if headers already sent, delegate to Express default handler
  if (res.headersSent) {
    return _next(err);
  }

  // ZodError → 400 with field-level errors
  if (err instanceof ZodError) {
    return res.status(400).json({
      message: "Validation failed",
      errors: err.flatten().fieldErrors,
    });
  }

  // AppError or errors with status → use provided status
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  res.status(status).json({ message });
  // NO throw err — this is the bug fix
});
```

### Zod 3.x Error Flattening API
```typescript
// Source: Zod 3.x docs (instance method, NOT global z.flattenError which is Zod 4)
const error: ZodError = schema.parse(invalidData);
const flat = error.flatten();
// Returns:
// {
//   formErrors: string[],      // top-level errors (path: [])
//   fieldErrors: {             // field-specific errors
//     [key: string]: string[]
//   }
// }
```

**Important:** Zod 4 changed to `z.flattenError()` (global function) and renamed keys (`formErrors` → `errors`). Project uses Zod 3.x — must use `error.flatten()`.

### Import Order Requirement
```typescript
// server/app.ts — FIRST TWO LINES
import 'express-async-errors';   // Line 1 — MUST be before express
import express, { ... } from "express";  // Line 2
```

`express-async-errors` patches Express's Router prototype. If imported after `express`, the patch may not take effect and async errors will still be silently swallowed.

### Anti-Patterns to Avoid
- **`throw err` after `res.json()`:** Once a response is sent, never re-throw or send another response. The current bug does exactly this.
- **Sending stack traces to clients:** The error middleware must NOT leak `err.stack` in production. Only send `err.message`.
- **Changing the `{ message }` base shape:** The frontend expects `{ message: string }`. Adding `{ errors: ... }` for validation is additive (safe). Changing the base key breaks existing consumers.
- **safeParse per route (instead of middleware):** Would require modifying 11+ parse calls. Middleware approach handles all at once.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Async error catching | asyncHandler wrapper function | express-async-errors | Zero route changes; patches Router prototype; can't forget to wrap new routes |
| ZodError detection | Custom error type checks | `err instanceof ZodError` | Zod exports ZodError class; reliable detection built-in |
| Error response formatting | Manual field mapping | `err.flatten().fieldErrors` | Handles nested paths, array indices, multiple errors per field |

**Key insight:** The error middleware is the single place where error format is enforced. All routes benefit automatically — no per-route changes needed.

## Common Pitfalls

### Pitfall 1: Import Order (CRITICAL)
**What goes wrong:** `express-async-errors` imported AFTER `express` doesn't patch the Router prototype in time.
**Why it happens:** The package mutates Express internals at import time; if Express is already initialized, the patch is missed.
**How to avoid:** Always put `import 'express-async-errors'` as the FIRST import in `server/app.ts`.
**Warning signs:** After adding the package, ZodErrors from async handlers still return 500 instead of 400.

### Pitfall 2: Double Response / Re-throw
**What goes wrong:** Error middleware sends response AND throws, causing unhandled exception.
**Why it happens:** The current code does `res.status(status).json({ message }); throw err;`
**How to avoid:** Remove `throw err` entirely. Add `if (res.headersSent) return next(err)` as safety.
**Warning signs:** Server crashes on errors; "Cannot set headers after they are sent" errors in logs.

### Pitfall 3: ZodError Branch Placement
**What goes wrong:** If the `instanceof ZodError` check is AFTER the generic handler, ZodErrors hit the generic branch first.
**Why it happens:** Middleware checks run in order; first match wins.
**How to avoid:** Put the ZodError check BEFORE the generic status/message extraction.
**Warning signs:** Validation errors return 500 instead of 400.

### Pitfall 4: Breaking Frontend with Shape Changes
**What goes wrong:** Changing `{ message }` to `{ error }` or adding required fields.
**Why it happens:** Frontend hooks check `response.message` — changing the key breaks all error handling.
**How to avoid:** Keep `{ message }` as the base key. Only ADD `{ errors }` for Zod validation.
**Warning signs:** Frontend no longer displays error messages to users.

## Code Examples

### Current Broken Error Middleware
```typescript
// server/app.ts:62-67 — CURRENT (BROKEN)
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  res.status(status).json({ message });
  throw err;  // ← CRASHES PROCESS
});
```

### Fixed Error Middleware (Target)
```typescript
// Source: Express official error handling guide + Zod flatten docs
import 'express-async-errors';
import express, { type Request, Response, NextFunction } from "express";
import { ZodError } from "zod";

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  // Safety: delegate to Express default if response already started
  if (res.headersSent) {
    return _next(err);
  }

  // Zod validation errors → 400 with field details
  if (err instanceof ZodError) {
    return res.status(400).json({
      message: "Validation failed",
      errors: err.flatten().fieldErrors,
    });
  }

  // All other errors → use status + message
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  res.status(status).json({ message });
});
```

### Zod 3.x flatten() Output
```typescript
// Source: https://zod.dev/error-formatting (Zod 3.x instance method)
const schema = z.object({ username: z.string(), age: z.number() });
try {
  schema.parse({ username: 123, age: "not a number" });
} catch (err) {
  if (err instanceof ZodError) {
    const flat = err.flatten();
    // {
    //   formErrors: [],
    //   fieldErrors: {
    //     username: ["Expected string, received number"],
    //     age: ["Expected number, received string"]
    //   }
    // }
  }
}
```

### Standardized Validation Error Response
```json
{
  "message": "Validation failed",
  "errors": {
    "username": ["Expected string, received number"],
    "email": ["Invalid email"]
  }
}
```

### Standardized Business Logic Error Response (unchanged)
```json
{
  "message": "Account not found"
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Express 5 auto-catches async | express-async-errors on Express 4 | Express 5 still beta (2026) | Polyfill until Express 5 stable |
| Manual try-catch per route | Middleware-based ZodError handling | Standard pattern for Express+Zod | 11 parse calls fixed at once |
| `throw err` in error handler | Log-only (no re-throw) | Express best practice since v4 | Prevents process crashes |

**Deprecated/outdated:**
- `throw err` in error middleware: Always wrong — sends response then crashes
- `asyncHandler` wrapper: Superseded by `express-async-errors` for brownfield codebases
- Zod `error.format()` (deprecated): Replaced by `error.flatten()` in Zod 3.x and `z.treeifyError()` in Zod 4

## Open Questions

1. **Should we add an `AppError` class now or defer?**
   - What we know: REQUIREMENTS.md marks OPT-02 (AppError class) as v2/deferred
   - What's unclear: Whether inline `res.status().json()` calls in xpot.ts should be converted to throws now
   - Recommendation: **Defer to Phase 2** (Route Splitting). Phase 1 should only fix bugs + add ZodError handling. Converting inline errors to throws is a DX improvement that's better done during route extraction.

2. **Should we add `console.error` logging in the error middleware?**
   - What we know: No structured logging exists; current errors are not logged anywhere
   - What's unclear: Whether adding `console.error` is in scope for "standardization"
   - Recommendation: **Add `console.error(err)` in the error middleware for 500 errors only.** Minimal effort, significant debugging value. Don't add structured logging (that's a separate concern).

3. **Should error middleware check `NODE_ENV` to hide internal details?**
   - What we know: Current code sends `err.message` unconditionally; some messages may leak implementation details
   - What's unclear: Whether any current 500-error messages leak sensitive info
   - Recommendation: **Keep `err.message` for now** (existing behavior). Add a TODO comment for production hardening. Changing error messages could break frontend error display.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Runtime | ✓ | v22.22.0 | — |
| npm | Package install | ✓ | 10.9.2 | — |
| express | HTTP framework | ✓ | ^4.21.2 | — |
| zod | Validation | ✓ | ^3.24.2 | — |
| express-async-errors | Async error catching | ✗ | — | Must `npm install` |

**Missing dependencies with no fallback:**
- `express-async-errors` — must be installed; no alternative without touching all 33 route definitions

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None configured |
| Config file | none |
| Quick run command | N/A |
| Full suite command | N/A |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ERR-01 | Server doesn't crash on unhandled errors | Manual | `curl POST /api/xpot/accounts` with bad body → expect 400, not crash | ❌ No test framework |
| ERR-02 | Async ZodErrors return 400, not 500 | Manual | `curl POST /api/xpot/accounts` with invalid JSON → expect 400 | ❌ No test framework |
| ERR-03 | Validation errors include field-level details | Manual | `curl POST /api/xpot/accounts` with missing fields → expect `{ message, errors }` | ❌ No test framework |
| ERR-04 | All Xpot error responses use `{ message }` shape | Manual | Grep all `res.status().json()` calls in xpot.ts | ❌ No test framework |

### Wave 0 Gaps
- No test framework exists — all validation must be manual
- Manual smoke test checklist needed: hit each Xpot endpoint with invalid input and verify:
  1. Server doesn't crash (ERR-01)
  2. Returns 400 for validation errors (ERR-02)
  3. Response includes `{ message: "Validation failed", errors: { field: [...] } }` (ERR-03)
  4. All non-validation errors still return `{ message }` (ERR-04)

## Sources

### Primary (HIGH confidence)
- `server/app.ts` — Direct code read, confirmed `throw err` bug at line 66
- `server/routes/xpot.ts` — Direct grep, confirmed 11 unguarded `schema.parse(req.body)` calls
- Express official error handling guide: https://expressjs.com/en/guide/error-handling.html
- Zod 3.x error formatting: https://zod.dev/error-formatting — `error.flatten()` confirmed for Zod 3.x
- `express-async-errors` npm package v3.1.1 — patches Express Router prototype

### Secondary (MEDIUM confidence)
- `.planning/research/ERROR-HANDLING.md` — Comprehensive error pattern analysis
- `.planning/research/SUMMARY.md` — Phase ordering rationale

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — All libraries verified (express, zod, express-async-errors); versions confirmed
- Architecture: HIGH — Error middleware pattern is standard Express; Zod flatten API verified against official docs
- Pitfalls: HIGH — Import order, double-response, and shape-change risks all confirmed against official sources

**Research date:** 2026-03-30
**Valid until:** 2026-04-30 (30 days — Express 4 error handling is stable; express-async-errors is mature)
