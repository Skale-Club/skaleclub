# Requirements: Xpot Technical Debt Remediation

**Defined:** 2026-03-30
**Core Value:** Make Xpot code maintainable again while preserving all existing behavior.

## v1 Requirements

Requirements for technical debt cleanup. Each maps to a roadmap phase.

### Error Handling

- [ ] **ERR-01**: Fix `throw err` crash bug in `server/app.ts` error middleware (response sent then throw)
- [ ] **ERR-02**: Add `express-async-errors` to catch uncaught async errors (12+ ZodErrors currently bypass middleware)
- [ ] **ERR-03**: Add ZodError handling to global error middleware (return 400 with `error.flatten().fieldErrors`)
- [ ] **ERR-04**: Standardize error response shape across all Xpot endpoints to `{ message, errors? }`

### Route Splitting

- [ ] **SPLIT-01**: Extract shared middleware (`requireXpotUser`, `requireXpotManager`) into `server/routes/xpot/middleware.ts`
- [ ] **SPLIT-02**: Extract shared helpers (`getDistanceMeters`, `syncAccountToGhl`) into `server/routes/xpot/helpers.ts`
- [ ] **SPLIT-03**: Split `server/routes/xpot.ts` into 10 domain routers (auth, dashboard, metrics, accounts, visits, opportunities, tasks, sync, place-search, admin)
- [ ] **SPLIT-04**: Update `server/routes.ts` import to use new `server/routes/xpot/index.ts` barrel
- [ ] **SPLIT-05**: Verify all 33 routes respond identically (manual API smoke test)

### Schema Organization

- [ ] **SCHM-01**: Split `shared/schema.ts` into 6 domain files (auth, cms, chat, forms, sales, settings) inside `shared/schema/`
- [ ] **SCHM-02**: Convert `shared/schema.ts` to barrel re-export (preserves all 64 import sites)
- [ ] **SCHM-03**: Update `drizzle.config.ts` to use folder path `./shared/schema`
- [ ] **SCHM-04**: Verify `npm run db:push` still detects schema changes correctly

### Context Refactoring

- [ ] **CTX-01**: Extract feature hooks from XpotContext (useXpotQueries, useCheckIn, useAccounts, useSales, useVisits)
- [ ] **CTX-02**: Create facade `useXpotApp()` hook that composes feature hooks (zero consumer changes)
- [ ] **CTX-03**: Migrate 5 page consumers from context to feature hooks (Dashboard → Visits → Sales → Accounts → CheckIn)
- [ ] **CTX-04**: Remove facade and old context after all consumers migrated
- [ ] **CTX-05**: Verify no visit check-in race conditions (the `checkingInRef` pattern)

## v2 Requirements

Deferred to future.

- [ ] **OPT-01**: Granular query invalidation per mutation (currently blanket invalidation)
- [ ] **OPT-02**: Add `AppError` class for typed error throws (optional, not required for standardization)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Main app routes/schemas | Separate concern, not in Xpot scope |
| Feature additions | This is cleanup only |
| Database migrations | Preserve all existing tables/columns |
| Automated test creation | No test framework exists; manual QA only |
| API contract changes | All `/api/xpot/*` endpoints keep same signatures |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| ERR-01 | Phase 1 | Pending |
| ERR-02 | Phase 1 | Pending |
| ERR-03 | Phase 1 | Pending |
| ERR-04 | Phase 1 | Pending |
| SPLIT-01 | Phase 2 | Pending |
| SPLIT-02 | Phase 2 | Pending |
| SPLIT-03 | Phase 2 | Pending |
| SPLIT-04 | Phase 2 | Pending |
| SPLIT-05 | Phase 2 | Pending |
| SCHM-01 | Phase 3 | Pending |
| SCHM-02 | Phase 3 | Pending |
| SCHM-03 | Phase 3 | Pending |
| SCHM-04 | Phase 3 | Pending |
| CTX-01 | Phase 4 | Pending |
| CTX-02 | Phase 4 | Pending |
| CTX-03 | Phase 4 | Pending |
| CTX-04 | Phase 4 | Pending |
| CTX-05 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 18 total
- Mapped to phases: 18
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-30*
*Last updated: 2026-03-30 after initial definition*
