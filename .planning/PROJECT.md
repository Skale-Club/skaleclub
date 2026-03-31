# Xpot Technical Debt Remediation

## What This Is

The Xpot field sales CRM codebase, cleaned up from monolithic files into modular, maintainable code. Technical debt remediation completed across 4 areas: error handling, route splitting, schema organization, and context refactoring.

## Core Value

Make Xpot code maintainable — reduce cognitive load for developers working on the field sales module.

## Requirements

### Validated (v1.0)

- ✓ **DEBT-01**: Route file splitting — v1.0 (1,042 lines → 13 focused files)
- ✓ **DEBT-02**: Schema organization — v1.0 (1,004 lines → 6 domain files + barrel)
- ✓ **DEBT-03**: Context refactoring — v1.0 (729 lines → 8 focused hooks + GeoContext)
- ✓ **DEBT-04**: Error handling standardization — v1.0 (crash bug fixed, ZodError handling added)

### Active

- [ ] **OPT-01**: Granular query invalidation per mutation (deferred from v1.0)
- [ ] **OPT-02**: Add `AppError` class for typed error throws (optional)

### Out of Scope

- Main app (non-Xpot) routes and schemas — separate concern, not in scope
- Database schema migrations — preserve all existing tables/columns
- Automated test creation — no test framework exists

## Context

- v1.0 shipped 2026-03-30: 64 files changed, +9,106 / -1,763 lines
- Codebase: TypeScript/React + Express + Drizzle ORM + Supabase
- Xpot routes: 10 domain routers under `server/routes/xpot/`
- Schemas: 6 domain files under `shared/schema/` with barrel re-export
- Hooks: 8 focused hooks under `client/src/pages/xpot/hooks/` with GeoContext
- Deployed to Vercel serverless

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Surgical refactoring, not deep refactor | Minimize risk, preserve existing behavior | ✅ v1.0 — all API contracts preserved |
| Focus on Xpot + shared only | Main app is separate concern | ✅ v1.0 — main app untouched |
| Split schemas by domain, not by module | Shared schemas serve multiple consumers | ✅ v1.0 — 6 domain files, zero consumer changes |
| GeoContext for shared geoState | useState-per-call creates isolated state | ✅ v1.0 — single geoState instance via React Context |
| Barrel re-export pattern | Enable zero-consumer-change migration | ✅ v1.0 — 64 import sites unchanged |

---

*Last updated: 2026-03-30 after v1.0 milestone*
