---
phase: 27-skale-hub-public-experience
plan: 01
subsystem: frontend
tags: [skale-hub, public-page, routing, HUB-10, HUB-11, HUB-12, HUB-13]
dependency_graph:
  requires: [26-01]
  provides: [Public Skale Hub page, route integration, branded gate UI]
  affects: [shared/pageSlugs.ts, server/storage.ts, client/src/components/admin/SEOSection.tsx, client/src/components/layout/Navbar.tsx, client/src/pages/SkaleHub.tsx, client/src/App.tsx]
tech_stack:
  added: []
  patterns: [page slug routing, React Query public fetch, mutation-based unlock flow, existing site card/layout styling]
key_files:
  created:
    - client/src/pages/SkaleHub.tsx
  modified:
    - shared/pageSlugs.ts
    - server/storage.ts
    - client/src/components/admin/SEOSection.tsx
    - client/src/components/layout/Navbar.tsx
    - client/src/App.tsx
decisions:
  - "Skale Hub uses the shared page slug system with default slug `skale-hub` so it behaves like a native site page"
  - "Public active-live fetch stays short-lived and re-fetches on mount so weekly live updates are visible without stale client cache"
  - "Live access opens only after calling the tracking endpoint so click-through events remain measurable"
metrics:
  completed: 2026-05-02
  tasks_completed: 3
  files_modified: 6
---

# Phase 27 Plan 01: Skale Hub Public Experience Summary

**One-liner:** Added the public `Skale Hub` page, connected it to the new backend endpoints, integrated it into the site slug/routing system, and surfaced the route in the main navigation.

## Tasks Completed

| Task | Name | Files |
|------|------|-------|
| 1 | Extend shared page-slug support for Skale Hub | `shared/pageSlugs.ts`, `server/storage.ts`, `client/src/components/admin/SEOSection.tsx` |
| 2 | Add public Skale Hub page with live card, gate form, unlock state, and empty state | `client/src/pages/SkaleHub.tsx` |
| 3 | Wire route integration and surface Skale Hub in navigation | `client/src/App.tsx`, `client/src/components/layout/Navbar.tsx` |

## Verification Results

- `npm run check` exits 0
- Public route compiles through the shared page slug system
- Registration and access flows are connected to `/api/skale-hub/register` and `/api/skale-hub/:liveId/access`

## Decisions Made

- The public page reuses the current Skale Club visual language instead of introducing a separate theme system
- Navigation now includes `Skale Hub` so visitors can discover the page naturally
- Unlock state is reset automatically when the active live changes so access does not leak across different weekly sessions

## Manual Smoke

- Deferred: browser verification for the empty state, successful unlock flow, and new-tab access behavior

## Self-Check: PASSED

- HUB-10 delivered - FOUND
- HUB-11 delivered - FOUND
- HUB-12 delivered - FOUND
- HUB-13 delivered - FOUND
