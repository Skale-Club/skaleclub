# Xpot Technical Debt Remediation — Research Summary

**Synthesized:** 2026-03-30
**Source files:** ROUTE-SPLITTING.md, SCHEMA-ORGANIZATION.md, CONTEXT-REFACTORING.md, ERROR-HANDLING.md
**Overall confidence:** HIGH

---

## Executive Summary

The Xpot field sales CRM module has accumulated ~3,800 lines of technical debt across four monolithic files: `server/routes/xpot.ts` (1,042 lines), `shared/schema.ts` (1,004 lines), `XpotContext.tsx` (729 lines), and inconsistent error handling scattered across all routes. All four areas share the same trait — they grew organically without domain boundaries, making the code hard to navigate, risky to modify, and prone to merge conflicts.

Research confirms all four areas can be refactored surgically (no API contract changes, no DB migrations, no behavior changes) using well-established patterns: `express.Router()` for routes, Drizzle's folder-path schema scanning, domain-scoped custom hooks for React context, and `express-async-errors` for error handling. Critically, the error handling research uncovered **live bugs** — a `throw err` in the global error middleware that crashes the process, and 12+ uncaught `ZodError` throws from async handlers (Express 4 doesn't auto-catch promise rejections). These bugs must be fixed first, before any route refactoring begins.

The recommended sequencing is: **Error Handling (bugs first) → Route Splitting → Schema Organization → Context Refactoring**. This ordering respects dependency chains — error patterns should be established before routes are split, schemas are independent of routes, and frontend context refactoring is decoupled from backend work entirely.

---

## Key Findings

### 1. Error Handling Has Live Bugs That Crash the Process (CRITICAL)

The global error middleware in `server/app.ts:62-67` calls `throw err` after `res.status().json()`, which re-throws the error as an unhandled exception — crashing the Node process. Additionally, 12+ `schema.parse(req.body)` calls in async route handlers throw `ZodError` that Express 4 silently swallows (Express 4 does NOT auto-catch async rejections). The fix: add `import 'express-async-errors'` (one line), remove the `throw err`, and add ZodError handling to the error middleware.

**Confidence:** HIGH — verified against Express official docs and direct code analysis.

### 2. Route Splitting Is Straightforward with `express.Router()`

The 1,042-line `xpot.ts` contains 33 handlers across 10 logical domains. Express 4.21.2's `express.Router()` is the idiomatic solution. The recommended pattern: one router per domain, each exporting a factory function, mounted via `app.use("/api/xpot", domainRouter)`. The `routes.ts` import changes by one line. No URL paths change. No `mergeParams` needed (flat route structure).

**Confidence:** HIGH — standard Express pattern, no exotic requirements.

### 3. Schema Splitting Works via Drizzle Folder Scanning — But Avoid Barrel Traps

`drizzle.config.ts` can point at `schema: "./shared/schema"` (folder path) and drizzle-kit recursively scans all `.ts` files. The critical gotcha: **do NOT put a barrel `index.ts` inside the `schema/` folder** — drizzle-kit sees tables twice (GitHub issue #5353). Keep the barrel re-export file at `shared/schema.ts` (outside the folder). All 64 existing import sites continue working unchanged.

**Confidence:** HIGH — verified with official Drizzle docs and confirmed GitHub issues.

### 4. Context Refactoring Does NOT Need Zustand — Custom Hooks Are Sufficient

`XpotContext.tsx` (729 lines) mixes 6 concerns but consumers use clean, non-overlapping subsets. TanStack Query already handles server state. The recommended approach: domain-scoped custom hooks + a backward-compatible `useXpotApp()` facade hook. No external state library needed. Migration is incremental — each consumer migrates independently, facade removed last.

**Confidence:** HIGH — consumer usage analysis shows clean partition boundaries.

### 5. New Dependency Required: `express-async-errors`

One new npm package needed. Zero API changes — it patches Express's Router prototype to auto-catch async rejections. Must be imported before `express` in `server/app.ts`. This is the only new dependency across all four refactoring areas.

---

## Recommended Approach: Phase Ordering

### Phase 1: Error Handling Standardization (DEBT-04)
**Why first:** Fixes live bugs (process crashes, silent validation failures). Establishes error patterns that route splitting will inherit.

| Step | Action | Effort |
|------|--------|--------|
| 1a | `npm install express-async-errors` + add `import 'express-async-errors'` to `server/app.ts` | Trivial |
| 1b | Remove `throw err` from global error middleware | Trivial |
| 1c | Add ZodError detection with `err.flatten()` formatting to error middleware | Low |
| 1d | (Optional) Define `AppError` class + typed constructors for consistent throws | Medium |

**Deliverable:** Async errors caught, validation errors return structured 400s, no process crashes.

### Phase 2: Route File Splitting (DEBT-01)
**Why second:** Error patterns from Phase 1 are now established — new route modules inherit them. This is the largest file and highest-pain area.

| Step | Action | Effort |
|------|--------|--------|
| 2a | Create `server/routes/xpot/` directory with `middleware.ts` and `helpers.ts` | Low |
| 2b | Create first domain router (`place-search.ts` — 1 route, smoke test) | Low |
| 2c | Create remaining 9 domain routers one at a time | Medium |
| 2d | Update `routes.ts` import, delete old `xpot.ts` | Trivial |

**Deliverable:** 10 focused route files (~50-150 lines each) replacing one 1,042-line monolith.

### Phase 3: Schema Organization (DEBT-02)
**Why third:** Independent of routes — no dependency on Phase 2. Can technically run in parallel, but sequencing after routes reduces cognitive load (developer isn't context-switching between backend files).

| Step | Action | Effort |
|------|--------|--------|
| 3a | Create `shared/schema/` directory with 6 domain files | Medium |
| 3b | Update `drizzle.config.ts` to `schema: "./shared/schema"` | Trivial |
| 3c | Convert `shared/schema.ts` to barrel re-export (outside `schema/` folder) | Low |
| 3d | Run `npm run db:push` to verify drizzle-kit reads all tables | Trivial |

**Deliverable:** 6 domain-focused schema files (~30-280 lines each) replacing one 1,004-line monolith. Zero import changes at consumer sites.

### Phase 4: Context Refactoring (DEBT-03)
**Why last:** Frontend-only, fully decoupled from backend work. Benefits from stable backend (no more route/schema changes interfering with testing).

| Step | Action | Effort |
|------|--------|--------|
| 4a | Extract query hooks into `hooks/useXpotQueries.ts` | Low |
| 4b | Extract feature hooks (check-in, accounts, sales, visits) | Medium |
| 4c | Create `useXpotApp()` facade for backward compatibility | Low |
| 4d | Migrate consumers one at a time (Dashboard → Visits → Sales → Accounts → CheckIn) | Medium |
| 4e | Delete `XpotContext.tsx` and facade | Trivial |

**Deliverable:** ~15 focused hooks replacing one 729-line context. Each consumer imports only what it needs.

---

## Stack/Tools

| Dependency | Version | Purpose | Phase |
|-----------|---------|---------|-------|
| `express-async-errors` | latest | Polyfill Express 5 async error catching on Express 4 | Phase 1 |
| `express.Router()` | 4.21.2 (existing) | Route module splitting | Phase 2 |
| Drizzle Kit folder scan | existing | Multi-file schema support | Phase 3 |
| TanStack Query | existing | Server state (no changes needed) | Phase 4 |
| React Context + hooks | existing (React 18) | Context decomposition | Phase 4 |

**No other new dependencies required.** Specifically: no Zustand, no asyncHandler wrapper, no new validation library.

---

## Pitfalls to Avoid

### Top Risks

| # | Pitfall | Phase | Severity | Prevention |
|---|---------|-------|----------|------------|
| 1 | **Forgetting `express-async-errors` import order** — must be imported BEFORE `express` | 1 | CRITICAL | Add import as first line in `server/app.ts` |
| 2 | **Middleware ordering in split routers** — routes defined before `router.use(requireXpotUser)` skip auth | 2 | HIGH | Always declare `router.use(middleware)` before route definitions |
| 3 | **Barrel file in schema/ folder** — drizzle-kit sees duplicate tables | 3 | MEDIUM | Keep barrel at `shared/schema.ts`, outside `shared/schema/` |
| 4 | **Circular hook dependencies** — extracted hooks importing each other | 4 | MEDIUM | Pass query data as parameters, not from context |
| 5 | **Changing URL paths during route splitting** — `router.get("/accounts")` must resolve to `/api/xpot/accounts` | 2 | HIGH | Verify `app.use("/api/xpot", router)` mount prefix |
| 6 | **`checkingInRef` race condition** — ref prevents activeVisit flicker during check-in | 4 | MEDIUM | Keep ref in `useXpotActiveVisit` hook |

### Phase-Specific Warnings

- **Phase 1:** Don't change response format `{ message }` — frontend depends on it. Only ADD `{ errors }` for Zod validation failures (additive change).
- **Phase 2:** GHL sync helpers (`syncAccountToGhl`, etc.) are called inline — verify imports after extraction or GHL sync silently fails.
- **Phase 3:** Run `npm run db:push` immediately after config change. If folder scan fails, fallback to explicit array config.
- **Phase 4:** The `invalidateXpotData` helper invalidates ALL xpot queries. Optimize to granular invalidation AFTER migration, not during.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Error Handling | HIGH | Live bugs confirmed, `express-async-errors` well-established, Zod `flatten()` API verified |
| Route Splitting | HIGH | Standard Express pattern, codebase already has Router precedent, dependency graph is simple |
| Schema Organization | HIGH | Official Drizzle multi-file support documented, barrel trap confirmed via GitHub issues |
| Context Refactoring | HIGH | Consumer usage map shows clean non-overlapping subsets, facade pattern proven for brownfield |
| Phase Ordering | HIGH | Error bugs must come first; routes/schemas are independent; context is fully decoupled |

### Gaps to Address During Planning

1. **Manual QA checklist** — No automated tests exist. Need a per-phase verification checklist of critical flows (check-in, account CRUD, visit notes, GHL sync).
2. **GHL integration testing** — The sync helpers are called from multiple route handlers. After route splitting, need to verify sync events still appear in `sales_sync_events` table.
3. **`AppError` class design** — Phase 1d is optional. Decision needed: implement now or defer to a later cleanup pass?
4. **Granular query invalidation** — Current `invalidateXpotData` invalidates everything. Optimization opportunity after Phase 4, but not blocking.

---

## Sources

| Source | Type | Confidence |
|--------|------|------------|
| Express 4.x Router API & Error Handling Guide | Official docs | HIGH |
| Drizzle ORM Schema Declaration & Config File docs | Official docs | HIGH |
| Drizzle GitHub Issue #5353 (barrel file duplication) | Official issue tracker | HIGH |
| Zod v3 Error Formatting (`flatten()`) | Official docs | HIGH |
| `express-async-errors` package | Established npm package | HIGH |
| Codebase: `server/routes/xpot.ts`, `server/app.ts`, `shared/schema.ts`, `XpotContext.tsx` | Direct analysis | HIGH |
| Consumer usage patterns: `useXpotApp()` grep across 5 components | Direct analysis | HIGH |
| Community patterns (OneUptime, Boundev, Feature-Sliced Design) | Blog/guides | MEDIUM |
