---
phase: 23-api-endpoints-cron
verified: 2026-04-22T00:00:00Z
status: passed
score: 7/7 must-haves verified
gaps: []
human_verification:
  - test: "GET /api/blog/settings with no DB row returns safe defaults"
    expected: '{"enabled":false,"postsPerDay":0,"seoKeywords":"","enableTrendAnalysis":false,"promptStyle":"","lastRunAt":null,"lockAcquiredAt":null}'
    why_human: "Requires a running server against a DB with no blog_settings row to confirm storage.getBlogSettings() returns undefined and the fallback is served"
  - test: "PUT /api/blog/settings does not overwrite lockAcquiredAt or lastRunAt"
    expected: "After PUT with a body that omits lock fields, a concurrent generator lock is still intact on the row"
    why_human: "Requires live DB state with a locked row to confirm omit behavior is safe at runtime"
  - test: "POST /api/blog/cron/generate with CRON_SECRET set and wrong token returns 401"
    expected: '401 {"message":"Unauthorized"}'
    why_human: "Requires CRON_SECRET env var to be set in the running environment to hit the guarded branch"
  - test: "POST /api/blog/generate returns {error} with 500 on generator throw"
    expected: '500 {"error":"<message>"}'
    why_human: "Requires inducing a generator failure (e.g. invalid Gemini key) and confirming structured JSON, not HTML error page"
  - test: "Server startup logs [cron] blog auto-generator starting when VERCEL is absent"
    expected: "[cron] blog auto-generator starting — runs every 60 minutes appears in stdout"
    why_human: "Requires running npm run dev locally without VERCEL set in env"
---

# Phase 23: API Endpoints + Cron Verification Report

**Phase Goal:** Wire BlogGenerator.generate() to the outside world via three REST endpoints and one in-process cron timer so admins can read/save settings and trigger generation, Vercel cron can call the generator on a schedule, and persistent environments auto-start an hourly timer.
**Verified:** 2026-04-22
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | GET /api/blog/settings returns 200 with safe defaults even when no DB row exists | ✓ VERIFIED | `app.get("/api/blog/settings")` in blogAutomation.ts:19 returns `row ?? BLOG_SETTINGS_DEFAULTS`; BLOG_SETTINGS_DEFAULTS defined with all required fields |
| 2 | PUT /api/blog/settings (admin-auth) upserts the row; subsequent GET returns saved values | ✓ VERIFIED | `app.put("/api/blog/settings", requireAdmin)` calls `storage.upsertBlogSettings(parsed.data)` and returns saved row; storage.ts:1795 implements real DB upsert |
| 3 | PUT /api/blog/settings never touches lockAcquiredAt or lastRunAt | ✓ VERIFIED | blogAutomation.ts:27-29 calls `insertBlogSettingsSchema.omit({ lockAcquiredAt: true, lastRunAt: true }).safeParse(req.body)` — lock fields stripped before DB write |
| 4 | POST /api/blog/generate (admin-auth) returns {jobId, postId, post} or {skipped, reason} as 200 — never 4xx on skip | ✓ VERIFIED | blogAutomation.ts:40-51; skip path returns `res.json({ skipped, reason })` (no status code = 200); success path returns `res.json({ jobId, postId, post })` |
| 5 | POST /api/blog/generate returns {error: message} with status 500 on generator failure | ✓ VERIFIED | blogAutomation.ts:47-50: explicit try/catch returns `res.status(500).json({ error: message })`; not delegated to express-async-errors |
| 6 | POST /api/blog/cron/generate returns 401 with wrong/missing CRON_SECRET, calls generator with correct secret | ✓ VERIFIED | blogAutomation.ts:54-63: `isAuthorizedCronRequest(req)` checked first; 401 returned on false; `_shared.ts:45-46` returns `bearerToken === cronSecret` when CRON_SECRET is set |
| 7 | On non-Vercel startup, startCron() logs that it is running; on Vercel, cron is not started | ✓ VERIFIED | cron.ts:6-11: `if (process.env.VERCEL) return;` guards the Vercel case; `console.log("[cron] blog auto-generator starting — runs every 60 minutes")` follows the guard |

**Score:** 7/7 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `server/routes/blogAutomation.ts` | registerBlogAutomationRoutes — GET/PUT settings, POST generate, POST cron/generate | ✓ VERIFIED | 64 lines; exports `registerBlogAutomationRoutes`; all 4 handlers present |
| `server/cron.ts` | startCron() — hourly setInterval with Vercel guard | ✓ VERIFIED | 24 lines; exports `startCron`; `HOUR_IN_MS = 60 * 60 * 1000`; Vercel guard at top |
| `server/routes.ts` | registerBlogAutomationRoutes called BEFORE registerBlogRoutes | ✓ VERIFIED | Line 128: `registerBlogAutomationRoutes(app)`; Line 129: `registerBlogRoutes(app)` |
| `server/index.ts` | startCron() called after httpServer.listen() | ✓ VERIFIED | Line 33: `startCron()` immediately after listen() closing parenthesis at line 32 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| server/routes.ts | server/routes/blogAutomation.ts | import + call before registerBlogRoutes | ✓ WIRED | Import at line 31; call at line 128; registerBlogRoutes at line 129 |
| server/index.ts | server/cron.ts | import startCron + call after listen | ✓ WIRED | Import at line 4; call at line 33 |
| server/routes/blogAutomation.ts | server/lib/blog-generator.ts | BlogGenerator.generate({ manual: true|false }) | ✓ WIRED | `BlogGenerator.generate({ manual: true })` at line 42; `BlogGenerator.generate({ manual: false })` at line 58 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| server/routes/blogAutomation.ts GET handler | `row` | `storage.getBlogSettings()` → `db.select().from(blogSettings)` (storage.ts:1791) | Yes — real DB select | ✓ FLOWING |
| server/routes/blogAutomation.ts PUT handler | `saved` | `storage.upsertBlogSettings(parsed.data)` → DB insert/update returning (storage.ts:1795-1808) | Yes — real DB upsert | ✓ FLOWING |
| server/routes/blogAutomation.ts POST generate | `result` | `BlogGenerator.generate({ manual: true })` → full pipeline in blog-generator.ts:424 | Yes — real generator | ✓ FLOWING |
| server/cron.ts setInterval | `result` | `BlogGenerator.generate({ manual: false })` inside callback | Yes — lazy DB init in callback | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript compiles cleanly | `npm run check` | Exit 0, no errors | ✓ PASS |
| Route registration order correct | grep lines in routes.ts | blogAutomation line 128, blogRoutes line 129 | ✓ PASS |
| BlogGenerator.generate export exists with correct signature | grep in blog-generator.ts | `static async generate({ manual }: { manual: boolean })` at line 425 | ✓ PASS |
| Commits documented in SUMMARY exist | git log 66c32e8 3f9a535 | Both commits present on dev branch | ✓ PASS |
| isAuthorizedCronRequest correctly gates 401 | Code inspection _shared.ts:45-46 | `return bearerToken === cronSecret` when CRON_SECRET set | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|---------|
| BLOG-13 | 23-01-PLAN.md | GET /api/blog/settings (public, safe defaults) + PUT /api/blog/settings (admin, upsert) | ✓ SATISFIED | Both handlers in blogAutomation.ts:19-35; storage methods real in storage.ts:1790-1808 |
| BLOG-14 | 23-01-PLAN.md | POST /api/blog/generate — {jobId, postId, post} or {skipped, reason} or {error}; skip = 200 | ✓ SATISFIED | blogAutomation.ts:40-51; try/catch returns 500 JSON on throw; skip returns 200 |
| BLOG-15 | 23-01-PLAN.md | POST /api/blog/cron/generate — Bearer token auth; 401 on wrong/missing; calls generator | ✓ SATISFIED | blogAutomation.ts:54-63; _shared.ts:36-54 implements token check |
| BLOG-16 | 23-01-PLAN.md | server/cron.ts startCron() — hourly setInterval when VERCEL falsy; called from server/index.ts | ✓ SATISFIED | cron.ts:1-24; index.ts:4+33 |

All 4 requirements (BLOG-13, BLOG-14, BLOG-15, BLOG-16) mapped to phase 23 in REQUIREMENTS.md are satisfied. No orphaned requirements found.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| server/routes/blogAutomation.ts | 58 | POST /api/blog/cron/generate has no try/catch around BlogGenerator.generate() | ℹ️ Info | express-async-errors installed (app.ts:1) catches unhandled async errors and returns 500 via error middleware — not a stub, but error response will be from error middleware (JSON with `message` key), not structured `{error}` JSON. BLOG-15 does not require structured error for cron endpoint, only 401 on auth failure. Acceptable. |

### Human Verification Required

#### 1. GET /api/blog/settings with no DB row

**Test:** Start server against a DB that has no `blog_settings` row, then `curl http://localhost:1000/api/blog/settings`
**Expected:** `{"enabled":false,"postsPerDay":0,"seoKeywords":"","enableTrendAnalysis":false,"promptStyle":"","lastRunAt":null,"lockAcquiredAt":null}`
**Why human:** Requires a running server with an empty blog_settings table; cannot verify DB state programmatically without a live connection.

#### 2. PUT /api/blog/settings does not corrupt lock state

**Test:** Set a lock by running a generation job, then PUT settings with a body that does not include lockAcquiredAt, then GET and confirm lockAcquiredAt is unchanged.
**Expected:** lockAcquiredAt on the DB row is not nulled out by the PUT.
**Why human:** Requires concurrent DB state that cannot be set up with static analysis.

#### 3. POST /api/blog/cron/generate with wrong CRON_SECRET

**Test:** Set `CRON_SECRET=mysecret` in env, then `curl -X POST -H "Authorization: Bearer wrongtoken" http://localhost:1000/api/blog/cron/generate`
**Expected:** 401 `{"message":"Unauthorized"}`
**Why human:** Requires CRON_SECRET to be configured in the running environment.

#### 4. POST /api/blog/generate structured 500 on generator failure

**Test:** With invalid/missing Gemini API key, call POST /api/blog/generate with an admin session.
**Expected:** Response is `500 {"error":"<message>"}` — JSON, not an HTML error page.
**Why human:** Requires inducing a generator failure condition in the live environment.

#### 5. Cron startup log on non-Vercel server

**Test:** Run `npm run dev` without `VERCEL` in env and observe stdout.
**Expected:** `[cron] blog auto-generator starting — runs every 60 minutes` appears within first few seconds of startup.
**Why human:** Requires running the dev server locally and observing console output.

### Gaps Summary

No gaps. All 7 must-have truths verified. All 4 required artifacts exist, are substantive, and are wired. All 4 BLOG-13/14/15/16 requirements satisfied. TypeScript compiles cleanly. Commits documented in SUMMARY are confirmed present. One minor informational note: the cron endpoint (`POST /api/blog/cron/generate`) lacks an explicit try/catch, but this is acceptable because `express-async-errors` handles it via the global error middleware, and BLOG-15 only requires structured auth failure (401), not structured generator errors for the cron path.

Five human verification items require a running server to test runtime behavior (defaults with empty DB, lock field protection, CRON_SECRET gating, structured 500, cron startup log).

---

_Verified: 2026-04-22_
_Verifier: Claude (gsd-verifier)_
