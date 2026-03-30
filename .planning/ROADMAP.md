# ROADMAP: Xpot Technical Debt Remediation

**Created:** 2026-03-30
**Granularity:** standard
**Total phases:** 4
**Total v1 requirements:** 18

---

## Phases

- [x] **Phase 1: Error Handling Standardization** — Fix live bugs and establish error handling patterns across all Xpot API endpoints
- [x] **Phase 2: Route File Splitting** — Decompose 1,042-line monolith into 10 domain-focused route modules
- [x] **Phase 3: Schema Organization** — Split 1,000+ line schema file into 6 domain-grouped files
- [ ] **Phase 4: Context Refactoring** — Replace 729-line XpotContext with focused feature hooks

---

## Phase Details

### Phase 1: Error Handling Standardization
**Goal**: All Xpot API endpoints catch errors consistently and return structured responses without crashing the server
**Depends on**: Nothing
**Requirements**: ERR-01, ERR-02, ERR-03, ERR-04
**Success Criteria** (what must be TRUE):
  1. Server process stays alive when an unhandled error occurs in any Xpot route handler (no crash from `throw err` in error middleware)
  2. Validation errors (ZodError) from async handlers return structured 400 responses with `fieldErrors` instead of being silently swallowed
  3. All Xpot endpoints return errors in a consistent `{ message, errors? }` shape
  4. Existing `/api/xpot/*` behavior is identical for successful requests (no regressions)
**Plans**: 1 plan
Plans:
- [ ] 01-01-PLAN.md — Fix error middleware crash bug, add async error catching, add ZodError handling

### Phase 2: Route File Splitting
**Goal**: Replace the single 1,042-line `xpot.ts` with 10 focused domain router files while keeping all 28 routes working identically
**Depends on**: Phase 1
**Requirements**: SPLIT-01, SPLIT-02, SPLIT-03, SPLIT-04, SPLIT-05
**Success Criteria** (what must be TRUE):
  1. Shared middleware (`requireXpotUser`, `requireXpotManager`) is extracted into a reusable module and imported by all domain routers
  2. Shared helpers (`getDistanceMeters`, `syncAccountToGhl`) are extracted into a shared utility module
  3. Each of the 10 domains (auth, dashboard, metrics, accounts, visits, opportunities, tasks, sync, place-search, admin) has its own route file under 200 lines
  4. `server/routes.ts` imports from a single `xpot/index.ts` barrel — no other changes needed
  5. All 28 API endpoints respond identically (same URLs, same payloads, same behavior) verified via manual smoke test
**Plans**: 3 plans in 3 waves
Plans:
- [ ] 02-01-PLAN.md — Extract shared middleware and helpers (wave 1)
- [ ] 02-02-PLAN.md — Create 10 domain routers + index, delete old monolith (wave 2)
- [ ] 02-03-PLAN.md — Update routes.ts import + smoke test verification (wave 3)

### Phase 3: Schema Organization
**Goal**: Split the 1,000+ line `shared/schema.ts` into 6 domain-focused files while keeping all 64 import sites working unchanged
**Depends on**: Nothing
**Requirements**: SCHM-01, SCHM-02, SCHM-03, SCHM-04
**Success Criteria** (what must be TRUE):
  1. Six domain schema files exist under `shared/schema/` (auth, cms, chat, forms, sales, settings), each under 300 lines
  2. `shared/schema.ts` (outside the folder) acts as a barrel re-export — all 64 existing import sites resolve correctly
  3. `drizzle.config.ts` uses folder path `./shared/schema` and drizzle-kit detects all tables
  4. `npm run db:push` completes without errors, confirming schema detection works
**Plans**: 3 plans in 2 waves
Plans:
- [ ] 03-01-PLAN.md — Create domain files: auth.ts, chat.ts, forms.ts (wave 1)
- [ ] 03-02-PLAN.md — Create domain files: cms.ts, settings.ts, sales.ts (wave 1)
- [ ] 03-03-PLAN.md — Convert barrel, update drizzle.config.ts, verify (wave 2)

### Phase 4: Context Refactoring
**Goal**: Replace the 729-line XpotContext with focused feature hooks that each consumer can import independently
**Depends on**: Nothing (frontend-only, decoupled from backend)
**Requirements**: CTX-01, CTX-02, CTX-03, CTX-04, CTX-05
**Success Criteria** (what must be TRUE):
  1. Feature hooks exist for each concern: useXpotQueries, useCheckIn, useAccounts, useSales, useVisits — each under 150 lines
  2. A backward-compatible `useXpotApp()` facade hook allows zero-change migration during transition
  3. All 5 page consumers (Dashboard, Visits, Sales, Accounts, CheckIn) import feature hooks directly instead of the monolithic context
  4. `XpotContext.tsx` and the facade hook are deleted — no dead code remains
  5. Check-in flow works without race conditions (the `checkingInRef` pattern preserved in extracted hook)
**Plans**: TBD

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Error Handling Standardization | 1/1 | Complete | 2026-03-30 |
| 2. Route File Splitting | 3/3 | Complete | 2026-03-30 |
| 3. Schema Organization | 3/3 | Complete | 2026-03-30 |
| 4. Context Refactoring | 0/0 | Not started | - |

---

## Coverage

| Area | Requirements | Phase |
|------|-------------|-------|
| Error Handling | ERR-01, ERR-02, ERR-03, ERR-04 | Phase 1 |
| Route Splitting | SPLIT-01, SPLIT-02, SPLIT-03, SPLIT-04, SPLIT-05 | Phase 2 |
| Schema Organization | SCHM-01, SCHM-02, SCHM-03, SCHM-04 | Phase 3 |
| Context Refactoring | CTX-01, CTX-02, CTX-03, CTX-04, CTX-05 | Phase 4 |

**18/18 v1 requirements mapped — 100% coverage ✓**

---

## Dependencies

```
Phase 1 (Error Handling) ──→ Phase 2 (Route Splitting)
                                  [error patterns inherited by new modules]

Phase 3 (Schema Org)       [independent — no dependency on Phase 1 or 2]

Phase 4 (Context Refactor) [independent — frontend-only, decoupled from backend]
```

Phases 3 and 4 could technically run in parallel with other phases, but sequencing reduces cognitive load.

---

*Roadmap created: 2026-03-30*
*Ready for planning: `/gsd-plan-phase 1`*
