---
phase: 23-api-endpoints-cron
plan: "01"
subsystem: blog-automation
tags: [blog, api, cron, routes, express]
dependency_graph:
  requires:
    - "22-blog-generator-engine/22-01 (BlogGenerator.generate, blog-gemini singleton)"
    - "22-blog-generator-engine/22-02 (BlogGenerator full pipeline)"
    - "21-schema-storage-foundation/21-01 (blogSettings table, storage methods, insertBlogSettingsSchema)"
  provides:
    - "GET /api/blog/settings (public, safe defaults)"
    - "PUT /api/blog/settings (admin-auth, Zod-validated, omits lock fields)"
    - "POST /api/blog/generate (admin-auth, try/catch structured error)"
    - "POST /api/blog/cron/generate (Bearer token auth)"
    - "startCron() — hourly setInterval with Vercel guard"
  affects:
    - server/routes.ts (route registration order)
    - server/index.ts (cron startup)
tech_stack:
  added: []
  patterns:
    - "Literal routes registered before parameterized wildcard (blogAutomation before blog)"
    - "try/catch in POST generate for structured 500 JSON error response"
    - "setInterval callback pattern for lazy DB init safety in cron"
key_files:
  created:
    - server/routes/blogAutomation.ts
    - server/cron.ts
  modified:
    - server/routes.ts
    - server/index.ts
decisions:
  - "registerBlogAutomationRoutes called before registerBlogRoutes to prevent GET /api/blog/:idOrSlug wildcard from intercepting /api/blog/settings"
  - "BlogGenerator.generate() called inside setInterval callback (not at module load time) to preserve lazy DB initialization contract"
  - "POST /api/blog/generate uses explicit try/catch rather than relying on express-async-errors, returning structured { error } JSON with status 500"
metrics:
  duration: "~2 minutes"
  completed_date: "2026-04-22"
  tasks_completed: 2
  files_changed: 4
---

# Phase 23 Plan 01: API Endpoints + Cron Summary

**One-liner:** Four REST endpoints (GET/PUT settings, POST generate, POST cron/generate) and an hourly in-process cron timer wired to BlogGenerator.generate() with Vercel guard.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create blogAutomation route file and register before blog routes | 66c32e8 | server/routes/blogAutomation.ts, server/routes.ts |
| 2 | Create server/cron.ts and wire startCron() into server/index.ts | 3f9a535 | server/cron.ts, server/index.ts |

## What Was Built

### server/routes/blogAutomation.ts

Exports `registerBlogAutomationRoutes(app)` with four handlers:

- **GET /api/blog/settings** — public; returns `storage.getBlogSettings()` or `BLOG_SETTINGS_DEFAULTS` when no row exists. Never 404 or 500 (BLOG-13).
- **PUT /api/blog/settings** — admin-auth required; parses body with `insertBlogSettingsSchema.omit({ lockAcquiredAt, lastRunAt })` so admin saves cannot corrupt lock or timing state; upserts and returns saved row (BLOG-13).
- **POST /api/blog/generate** — admin-auth required; calls `BlogGenerator.generate({ manual: true })` inside try/catch; skips return 200 `{ skipped, reason }`; success returns 200 `{ jobId, postId, post }`; generator throw returns 500 `{ error: message }` (BLOG-14).
- **POST /api/blog/cron/generate** — Bearer token auth via `isAuthorizedCronRequest(req)`; 401 on mismatch; calls `BlogGenerator.generate({ manual: false })`; returns `{ skipped, reason }` or `{ jobId, postId }` (BLOG-15).

### server/cron.ts

Exports `startCron()` that:
- Returns immediately when `process.env.VERCEL` is truthy (serverless environments use the cron endpoint instead).
- Logs `[cron] blog auto-generator starting — runs every 60 minutes`.
- Calls `BlogGenerator.generate({ manual: false })` every 60 minutes inside a `setInterval` callback with try/catch error logging (BLOG-16).

### server/routes.ts

- Import added: `import { registerBlogAutomationRoutes } from "./routes/blogAutomation.js"`.
- Call `registerBlogAutomationRoutes(app)` inserted BEFORE `registerBlogRoutes(app)` (line 128 vs 129) to prevent Express wildcard `GET /api/blog/:idOrSlug` from intercepting `/api/blog/settings`.

### server/index.ts

- Import added: `import { startCron } from "./cron.js"`.
- `startCron()` called immediately after `httpServer.listen()` closing parenthesis.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all endpoints are fully wired to real storage and generator logic.

## Self-Check: PASSED

- [x] server/routes/blogAutomation.ts exists
- [x] server/cron.ts exists
- [x] server/routes.ts: registerBlogAutomationRoutes (line 128) before registerBlogRoutes (line 129)
- [x] server/index.ts: startCron() called after httpServer.listen()
- [x] Commit 66c32e8 exists (Task 1)
- [x] Commit 3f9a535 exists (Task 2)
- [x] npm run check exits 0 — no TypeScript errors
