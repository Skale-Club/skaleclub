---
phase: 28-skale-hub-admin-management
plan: 01
subsystem: frontend
tags: [skale-hub, admin, HUB-14, HUB-15]
dependency_graph:
  requires: [26-01, 27-01]
  provides: [Admin Skale Hub section, live management UI]
  affects: [client/src/components/admin/shared/types.ts, client/src/components/admin/shared/constants.ts, client/src/pages/Admin.tsx, client/src/components/admin/SkaleHubSection.tsx]
tech_stack:
  added: []
  patterns: [admin section registration, list-and-detail editor, existing admin card system, React Query mutations]
key_files:
  created:
    - client/src/components/admin/SkaleHubSection.tsx
  modified:
    - client/src/components/admin/shared/types.ts
    - client/src/components/admin/shared/constants.ts
    - client/src/pages/Admin.tsx
decisions:
  - "Skale Hub appears as a first-class admin section instead of a modal or nested route"
  - "Live activation is exposed directly from the list to make weekly switchovers fast"
  - "The management view includes a lightweight participation snapshot so admins can review registrations while editing a live"
metrics:
  completed: 2026-05-02
  tasks_completed: 3
  files_modified: 4
---

# Phase 28 Plan 01: Skale Hub Admin Management Summary

**One-liner:** Added a dedicated Skale Hub section inside the admin dashboard with live creation, editing, status control, activation, and quick registration snapshots.

## Tasks Completed

| Task | Name | Files |
|------|------|-------|
| 1 | Register Skale Hub as an admin section | `client/src/components/admin/shared/types.ts`, `client/src/components/admin/shared/constants.ts`, `client/src/pages/Admin.tsx` |
| 2 | Build Skale Hub live management UI | `client/src/components/admin/SkaleHubSection.tsx` |
| 3 | Verify admin integration and save flow types | `client/src/components/admin/SkaleHubSection.tsx`, `client/src/pages/Admin.tsx` |

## Verification Results

- `npm run check` exits 0
- Admin routing recognizes `/admin/skale-hub`
- Sidebar and section ordering support the new Skale Hub entry

## Decisions Made

- The admin experience follows the existing sidebar/section model rather than creating a separate control panel
- Create and edit use a single unified form to keep weekly live updates quick
- Registration/access counts are shown next to each live so the next analytics phase can build on already visible participation context

## Manual Smoke

- Deferred: browser verification for create, update, activation, and detail refresh flows in `/admin/skale-hub`

## Self-Check: PASSED

- HUB-14 delivered - FOUND
- HUB-15 delivered - FOUND
