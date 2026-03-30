# Xpot Technical Debt Remediation

## What This Is

A surgical cleanup of the Xpot field sales CRM sub-app and its shared dependencies. The Xpot module has grown organically into large monolithic files (1,000+ line routes, 1,000+ line schemas, bloated context) that are hard to maintain. This project addresses the four most painful technical debt areas without changing external API contracts.

## Core Value

Make Xpot code maintainable again — reduce cognitive load for developers working on the field sales module while preserving all existing behavior.

## Requirements

### Validated

- ✓ Check-in/Check-out visits with GPS — existing
- ✓ Account management (CRUD, contacts) — existing
- ✓ Visit notes with audio transcription — existing
- ✓ Opportunities pipeline — existing
- ✓ Task management — existing
- ✓ Admin overview dashboard — existing
- ✓ Place search via Google Places API — existing
- ✓ Xpot-specific authentication (rep login) — existing
- ✓ Offline sync support — existing

### Active

- [ ] **DEBT-01**: Break `server/routes/xpot.ts` (1,042 lines) into domain-focused route modules
- [ ] **DEBT-02**: Split `shared/schema.ts` (1,000+ lines) into domain-grouped schema files
- [ ] **DEBT-03**: Refactor `XpotContext` into smaller, composable concerns
- [ ] **DEBT-04**: Standardize error handling across Xpot API endpoints

### Out of Scope

- Main app (non-Xpot) routes and schemas — separate concern, not in scope
- Feature additions or behavior changes — this is cleanup only
- Database schema migrations — preserve all existing tables/columns
- External API contract changes — all `/api/xpot/*` endpoints keep same signatures

## Context

- Xpot is a field sales CRM used by sales representatives in the field
- Routes file covers: auth, me, dashboard, metrics, accounts, visits, check-in/out, opportunities, tasks, sync
- `shared/schema.ts` contains ALL Drizzle tables for the entire app (not just Xpot)
- `XpotContext` manages 7+ query results, form state, mutations, and navigation in one context
- Deployed to Vercel serverless with 30s timeout for xpot functions
- No automated tests exist for Xpot — manual verification required

## Constraints

- **Surgical scope**: Minimize changes, keep existing patterns, just clean up
- **API stability**: All `/api/xpot/*` endpoint signatures must remain unchanged
- **No DB changes**: Don't modify table schemas or create migrations
- **No feature changes**: Behavior must be identical before/after
- **Manual QA only**: No test framework available — verify critical flows manually

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Surgical refactoring, not deep refactor | Minimize risk, preserve existing behavior | — Pending |
| Focus on Xpot + shared only | Main app is separate concern, out of scope | — Pending |
| Split schemas by domain, not by module | Shared schemas serve multiple consumers | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-30 after initialization*
