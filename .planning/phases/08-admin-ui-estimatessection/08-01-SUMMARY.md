---
phase: 08-admin-ui-estimatessection
plan: "01"
subsystem: admin-ui
tags: [estimates, admin, dnd-kit, mutations, dialog, react-query]
dependency_graph:
  requires:
    - shared/schema/estimates.ts (Estimate, EstimateServiceItem, CatalogServiceItem types)
    - /api/estimates (GET/POST/PUT/DELETE — Phase 07 plans)
    - /api/portfolio-services (GET — PortfolioSection already wired)
    - client/src/components/admin/shared/index.ts (SectionHeader, EmptyState)
  provides:
    - client/src/components/admin/EstimatesSection.tsx (exported EstimatesSection function)
  affects:
    - Admin.tsx (Plan 08-02 will import and mount EstimatesSection)
tech_stack:
  added: []
  patterns:
    - dnd-kit verticalListSortingStrategy for service row reordering
    - key={editingEstimate?.id ?? 'new'} remount pattern (from PortfolioSection)
    - discriminated union type narrowing for catalog vs custom service items
    - showCatalogPicker initialized from !editingEstimate (create=open, edit=collapsed)
key_files:
  created:
    - client/src/components/admin/EstimatesSection.tsx
  modified: []
decisions:
  - "Wrote all three co-located functions in one file pass — SortableServiceRow, EstimateDialogForm, EstimatesSection"
  - "Used index (not UUID) as dnd-kit sortable id — matches plan pattern for array-index drag"
metrics:
  duration: "~2 minutes"
  completed: "2026-04-19T23:27:39Z"
  tasks_completed: 2
  files_changed: 1
---

# Phase 08 Plan 01: EstimatesSection Admin UI Summary

**One-liner:** Full admin UI for estimates — list + create/edit dialog + dnd-kit drag reorder + clipboard copy-link in a single 503-line component file.

## What Was Built

Created `client/src/components/admin/EstimatesSection.tsx` with three co-located components:

**1. SortableServiceRow** — dnd-kit drag handle row for a single service item (catalog or custom), with title/description/price inputs and a remove button.

**2. EstimateDialogForm** — Dialog body managing `clientName`, `note`, and a `services[]` array. In create mode the catalog picker is open by default; in edit mode it is collapsed. Handles catalog toggle (add/remove from catalog), custom row append, and service field edits. Uses `key` remount pattern so form state is always fresh on open.

**3. EstimatesSection** — Top-level section with SectionHeader (Receipt icon + "New Estimate" button), loading spinner, EmptyState, and a list of estimate rows. Each row shows client name, slug (font-mono truncated), formatted date, and three action buttons: copy-link (writes `/e/:slug` to clipboard), edit (opens dialog pre-populated), delete (opens AlertDialog confirmation). Three mutations: `createMutation` (POST), `updateMutation` (PUT), `deleteMutation` (DELETE) — all invalidate `/api/estimates` on success with matching toast messages.

## Deviations from Plan

None — plan executed exactly as written.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | List view + mutations + delete AlertDialog | 305456b | client/src/components/admin/EstimatesSection.tsx |
| 2 | EstimateDialogForm + SortableServiceRow sub-components | 305456b | (same file, single write pass) |

Both tasks were executed in a single file write pass (consistent behavior — the plan describes building the same file top-to-bottom).

## Known Stubs

None. Component is fully wired to live API endpoints. The catalog picker fetches from `/api/portfolio-services`, and all mutations target `/api/estimates`. The component will render correctly once Plan 08-02 mounts it in Admin.tsx.

## Self-Check: PASSED

- FOUND: client/src/components/admin/EstimatesSection.tsx
- FOUND: commit 305456b
