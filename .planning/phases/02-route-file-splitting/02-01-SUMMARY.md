---
plan: 02-01
phase: 02-route-file-splitting
status: complete
wave: 1
completed: 2026-03-30
commits:
  - b53e1df: "refactor: split xpot.ts into 10 domain routers"
---

# Plan 02-01 Summary — Extract Middleware & Helpers

## What Was Built

Extracted shared auth middleware and GHL helper functions from `server/routes/xpot.ts` into two dedicated modules as prerequisites for the domain router split.

## Key Files

- `server/routes/xpot/middleware.ts` — exports `SessionUser` type, `getCurrentSessionUser`, `ensureXpotRep`, `requireXpotUser`, `requireXpotManager` (72 lines)
- `server/routes/xpot/helpers.ts` — exports `getDistanceMeters`, `syncAccountToGhl`, `syncOpportunityToGhl`, `syncTaskToGhl` (168 lines)

## One-liner

`server/routes/xpot/middleware.ts` + `helpers.ts` extracted from the 1,042-line monolith; all 10 domain routers import from these shared modules; `npm run check` green.
