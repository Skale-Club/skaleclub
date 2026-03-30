# STATE: Xpot Technical Debt Remediation

**Created:** 2026-03-30

---

## Project Reference

**Core Value:** Make Xpot code maintainable again — reduce cognitive load for developers working on the field sales module while preserving all existing behavior.

**Current Focus:** Roadmap created. Awaiting Phase 1 planning (Error Handling Standardization).

---

## Current Position

| Field | Value |
|-------|-------|
| Phase | 1 (of 4) |
| Phase Name | Error Handling Standardization |
| Plan | Not started |
| Status | Awaiting `/gsd-plan-phase 1` |

**Progress:**
```
[ ] Phase 1: Error Handling    ░░░░░░░░░░ 0%
[ ] Phase 2: Route Splitting   ░░░░░░░░░░ 0%
[ ] Phase 3: Schema Org        ░░░░░░░░░░ 0%
[ ] Phase 4: Context Refactor  ░░░░░░░░░░ 0%
```

---

## Performance Metrics

| Metric | Value |
|--------|-------|
| Total v1 requirements | 18 |
| Requirements completed | 0 |
| Phases completed | 0 |
| Plans created | 0 |

---

## Accumulated Context

### Decisions Made
- Surgical refactoring, not deep refactor (minimize risk, preserve existing behavior)
- Focus on Xpot + shared only (main app out of scope)
- Split schemas by domain, not by module (shared schemas serve multiple consumers)
- No new dependencies beyond `express-async-errors`

### Critical Warnings (from research)
- `express-async-errors` must be imported BEFORE `express` in `server/app.ts`
- Do NOT put barrel `index.ts` inside `shared/schema/` folder (drizzle-kit sees duplicates)
- Do NOT change URL paths during route splitting
- Keep `checkingInRef` race condition guard in extracted visit hook

### Blockers
None identified.

---

## Session Continuity

| Session | Last Action | Next Action |
|---------|-------------|-------------|
| 2026-03-30 | Roadmap created | `/gsd-plan-phase 1` |

---

*Last updated: 2026-03-30 after roadmap creation*
