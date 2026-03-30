# Express Error Handling Standardization Research

**Domain:** Express 4.x API error handling for brownfield codebase
**Researched:** 2026-03-30
**Overall confidence:** HIGH

## Executive Summary

The xpot routes module (`server/routes/xpot.ts`, 1,042 lines) has three inconsistent error handling patterns coexisting: inline `res.status().json()` for business logic errors, bare `schema.parse()` calls that throw uncaught ZodErrors in async handlers, and try-catch blocks only around external API calls. The global error middleware in `server/app.ts:62-67` has a critical bug — it sends a response AND then `throw err`, which will crash the process on every error that reaches it.

**The core problem:** Express 4 does NOT automatically catch rejected promises from async route handlers. Every `async (req, res) => { ... }` handler that throws or has an unhandled rejection will bypass the error middleware entirely. The project uses Express 4.21.x (not 5), so this is a live issue.

**The recommended fix:** Use `express-async-errors` (import-only, zero-API-change) to polyfill Express 5's async error catching behavior, add ZodError handling to the error middleware, fix the `throw err` bug, and standardize the error response shape.

## Key Findings

### 1. Express 4 vs 5: The Async Gap (CRITICAL)

Express 4 requires explicit handling of async errors. Express 5 (still in beta/release candidate) auto-calls `next(err)` when an async handler rejects. The project uses `"express": "^4.21.2"`.

From the official Express error handling docs:
> "For errors returned from asynchronous functions invoked by route handlers and middleware, you must pass them to the `next()` function, where Express will catch and process them."

In Express 4, if an `async` handler throws, the promise rejection is **silently swallowed** unless caught. This means the current code's `schema.parse()` calls (which throw `ZodError`) are **unhandled** in most routes — they crash or silently fail rather than returning a 400.

**Two approaches to fix:**
- **`express-async-errors` package** (recommended): One-line import, patches Express router to auto-catch async rejections. Zero API changes to existing routes. Works today on Express 4.
- **`asyncHandler` wrapper function**: Wraps each handler `(fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)`. More explicit but requires touching every route definition.

**Recommendation:** `express-async-errors` — it's the lowest-friction fix for a brownfield codebase with 30+ route handlers.

### 2. Current Error Patterns in xpot.ts (INVENTORY)

| Pattern | Count | Example Lines | Problem |
|---------|-------|---------------|---------|
| `res.status(X).json({ message })` inline | ~20 | 80, 83, 272, 556, 561, 629, 635, 666 | Inconsistent status codes, works but scatters error logic |
| `schema.parse(req.body)` (no try-catch) | ~12 | 515, 584, 602, 626, 700, 755, 858, 891, 934, 951, 1019 | **UNCAUGHT in Express 4** — ZodError thrown from async handler |
| `z.enum().parse(req.query)` | 2 | 842, 923 | Same uncaught issue for query validation |
| try-catch (external API calls) | 2 | 275-355, 784-836 | Correct — catches fetch/upload errors |
| Error middleware throw bug | 1 | app.ts:66 | `throw err` after `res.status().json()` — crashes process |

### 3. The Global Error Middleware Bug (CRITICAL)

```typescript
// server/app.ts:62-67 — CURRENT (BROKEN)
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  res.status(status).json({ message });
  throw err;  // ← THIS CRASHES THE PROCESS
});
```

The `throw err` after sending a response means:
1. The error response IS sent to the client (good)
2. Then the error is re-thrown, becoming an unhandled exception (bad)
3. In production, this can crash the Node process or trigger uncaughtException handlers

**Fix:** Remove the `throw err` line entirely. The error middleware's job is to handle and respond — not re-throw.

### 4. Zod Error Handling Gap

When `schema.parse()` throws a `ZodError`, it has a specific structure:
```typescript
{
  name: "ZodError",
  issues: [
    { code: "invalid_type", path: ["username"], message: "Expected string, received number" }
  ]
}
```

Currently, if this reaches the error middleware (after the async fix), it would return:
```json
{ "message": "Invalid input: expected string, received number" }
```

This is **not useful for API consumers**. A better format uses `z.flattenError()` (Zod 3.x) or `error.flatten()`:
```json
{
  "message": "Validation failed",
  "errors": {
    "username": ["Expected string, received number"]
  }
}
```

### 5. Response Format Inconsistency

The current code returns errors in one shape:
```json
{ "message": "Account not found" }
```

This is fine for simple errors, but doesn't support:
- Multiple validation errors per field
- Error codes for programmatic handling
- Request ID for tracing

**Recommendation:** Keep `{ message }` as the base shape, add `{ errors }` only for Zod validation failures. Don't over-engineer — this is a sales CRM, not a platform API.

## Implications for Roadmap

Based on research, suggested phase structure for error handling standardization:

### Phase 4a: Fix Critical Bugs (LOW effort, HIGH impact)
- Remove `throw err` from global error middleware in `app.ts`
- Add `import 'express-async-errors'` to `server/app.ts` (one line)
- Add ZodError detection in error middleware with `error.flatten()` formatting
- **Why first:** These are correctness issues. Without them, validation errors silently fail.

### Phase 4b: Standardize Error Response Shape (MEDIUM effort)
- Define `AppError` class with `statusCode`, `message`, optional `errors` field
- Create typed error constructors: `NotFoundError`, `ValidationError`, `UnauthorizedError`
- Replace inline `res.status(X).json(...)` business logic errors with thrown `AppError` instances
- **Why second:** Cosmetic but important for API consistency and frontend error handling

### Phase 4c: Extract xpot.ts Routes (HIGHER effort, do alongside Phase 3)
- Break 1,042-line file into domain modules (accounts, visits, opportunities, tasks)
- Each module inherits the standardized error patterns from 4a/4b
- **Why alongside:** You're already touching the routes — apply the pattern during extraction

**Phase ordering rationale:**
- 4a first because it fixes actual bugs (silent failures, process crashes)
- 4b second because it's a DX improvement that builds on 4a
- 4c alongside extraction because rewriting error handling in a file you're about to split is wasted effort

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Express 4 async gap | HIGH | Verified against official Express docs (expressjs.com/en/guide/error-handling.html) |
| express-async-errors package | HIGH | Well-established, used by Express team members, minimal API |
| Zod error formatting | HIGH | Verified against zod.dev/error-formatting docs, `flatten()` API confirmed for Zod 3.x |
| Current code analysis | HIGH | Read all 1,042 lines, grep confirmed all patterns |
| Error middleware bug | HIGH | `throw err` after `res.json()` is definitively a bug |

## Detailed Findings

### Throw vs Inline Handling: Trade-offs

| Aspect | Throw (centralized) | Inline (per-route) |
|--------|---------------------|-------------------|
| Consistency | ✅ Single format enforced | ❌ Each route can differ |
| Boilerplate | ✅ Minimal in routes | ❌ `res.status().json()` everywhere |
| Debugging | ⚠️ Stack trace may point to middleware | ✅ Error originates at source |
| Custom context | ⚠️ Must encode in Error props | ✅ Can add context inline |
| 404/401/403 | ✅ Perfect — standard HTTP errors | ⚠️ Verbose but clear |

**Recommendation for this codebase:** Hybrid. Throw `AppError` for "expected" errors (not found, unauthorized, validation). Keep inline `res.status().json()` ONLY where the route needs to send extra data alongside the error (e.g., the sync result in opportunity routes). This is pragmatic, not dogmatic.

### How to Standardize Zod Error Responses

**Option A: Catch in middleware (recommended)**
```typescript
// In error middleware, add:
if (err instanceof ZodError) {
  return res.status(400).json({
    message: "Validation failed",
    errors: err.flatten().fieldErrors,
  });
}
```

**Option B: safeParse per route**
```typescript
const result = schema.safeParse(req.body);
if (!result.success) {
  return res.status(400).json({
    message: "Validation failed",
    errors: result.error.flatten().fieldErrors,
  });
}
```

Option A is better for this codebase because: (1) there are 12+ parse calls to change, (2) it keeps routes clean, (3) it ensures consistent format. Option B is only better if you need per-route customization of validation error messages.

### Whether to Use a Wrapper/Helper

**Yes — but use `express-async-errors`, not a wrapper function.**

`express-async-errors` patches Express's Router prototype to wrap handlers automatically. You just add one import line and all async errors are caught. This is strictly better than `asyncHandler` for brownfield because:
- Zero route definition changes needed
- Works with middleware (not just handlers)
- No risk of forgetting to wrap a new route

Install: `npm install express-async-errors`
Usage: `import 'express-async-errors'` (must be imported before express)

### Common Pitfalls When Refactoring Error Handling

1. **Forgetting Express 4 doesn't catch async errors** — The #1 pitfall. Adding `express-async-errors` first prevents this.

2. **Double response: sending AND throwing** — Current bug in app.ts. Once `res.json()` is called, never call it again or throw. Check `res.headersSent` in error middleware as safety.

3. **Leaking internal errors to clients** — The error middleware must NOT send stack traces or internal details in production. Add `NODE_ENV === 'development'` guard for stack.

4. **ZodError swallowing other errors** — If you add ZodError handling to the middleware, make sure it comes BEFORE the generic handler, and always call `next(err)` for non-Zod errors.

5. **Breaking existing callers with format changes** — The frontend currently expects `{ message: string }`. Adding `{ errors: ... }` for validation is additive (safe). Changing the base shape breaks things.

6. **Not handling the "headers already sent" case** — If a streaming error occurs after headers are sent, the error middleware must delegate to Express's default handler: `if (res.headersSent) return next(err)`.

## Sources

- Express.js official error handling guide: https://expressjs.com/en/guide/error-handling.html (HIGH confidence)
- Zod v3 error formatting: https://zod.dev/error-formatting — `flatten()` confirmed (HIGH confidence)
- OneUptime Express error handling guide (Feb 2026): https://oneuptime.com/blog/post/2026-02-02-express-error-handling/view (MEDIUM confidence — blog, not official)
- Boundev Express promise error handling (Mar 2026): https://www.boundev.com/blog/express-js-promises-error-handling (MEDIUM confidence)
- Codebase analysis: `server/routes/xpot.ts` (1,042 lines), `server/app.ts` (70 lines) (HIGH confidence)
