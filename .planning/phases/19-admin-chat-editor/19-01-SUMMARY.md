---
phase: 19-admin-chat-editor
plan: "01"
subsystem: admin-ui
tags:
  - presentations
  - admin
  - react
  - typescript
dependency_graph:
  requires:
    - "Phase 17: BrandGuidelinesSection, /api/brand-guidelines"
    - "Phase 15/16: /api/presentations endpoints (PresentationWithStats type)"
    - "shared/schema/presentations.ts: SlideBlock, PresentationWithStats"
  provides:
    - "PresentationsSection.tsx: list + editor sub-views"
    - "Phase 19 PT translations"
    - "presentations route wired into Admin.tsx"
  affects:
    - "client/src/pages/Admin.tsx"
    - "client/src/lib/translations.ts"
tech_stack:
  added: []
  patterns:
    - "key={selectedId} re-mount pattern for editor state reset"
    - "useQuery list data reused by editor (no second fetch)"
    - "AlertDialog delete confirmation (mirrors EstimatesSection)"
    - "apiRequest().then(r => r.json()) for POST returning JSON body"
key_files:
  created:
    - client/src/components/admin/PresentationsSection.tsx
    - shared/schema/presentations.ts
    - client/src/components/admin/BrandGuidelinesSection.tsx
  modified:
    - client/src/lib/translations.ts
    - client/src/pages/Admin.tsx
    - client/src/components/admin/shared/types.ts
    - client/src/components/admin/shared/constants.ts
    - shared/schema.ts
decisions:
  - "key={selectedId} re-mount strategy chosen over useEffect for editor state reset — React lifecycle handles it cleanly with zero extra code"
  - "PresentationsSection.tsx co-locates SlideCard, PresentationEditor, and main export in one file — matches EstimatesSection pattern; file stays under 600-line CLAUDE.md limit at 355 lines"
  - "Editor receives presentation object from parent's list query data — avoids a second API fetch; list query is already cached"
  - "Foundation files (presentations schema, BrandGuidelinesSection, shared types/constants) extracted from main branch — these were built in Phase 17 worktree; this worktree branch diverged before those commits"
metrics:
  duration: "~4 minutes"
  completed: "2026-04-22"
  tasks: 2
  files: 8
---

# Phase 19 Plan 01: Presentations Admin UI Summary

Builds the complete admin presentations management UI — PresentationsSection.tsx with list view (PRES-14) and JSON editor sub-view (PRES-15/16) — and wires it into Admin.tsx, replacing the temporary BrandGuidelinesSection placeholder.

## What Was Built

**PresentationsSection.tsx** (355 lines) provides two toggled sub-views:

**List view:**
- SectionHeader with "New Presentation" button (POST /api/presentations → opens editor)
- AdminCard with per-row: title, Layers slideCount badge, Eye viewCount badge, Copy-link button, Delete button, Open Editor button
- AlertDialog delete confirmation with "Presentation deleted" toast
- EmptyState when no presentations exist
- BrandGuidelinesSection rendered below the list (always visible)

**Editor sub-view:**
- Monospace JSON textarea initialized from presentation.slides
- Live parse validation: inline error message, Save button disabled on invalid JSON
- Slide mini-cards panel (grid-cols-2) showing layout badge + heading per slide
- Empty panel shows "No slides yet" (checker warning fix)
- Save calls PUT /api/presentations/:id with { slides: parsedSlides } — toasts success/error
- Back button returns to list; key={selectedId} re-mounts editor on open to reset state

**Admin.tsx** changes (surgical):
- Import swapped: BrandGuidelinesSection → PresentationsSection
- Both slug maps updated to include 'presentations': 'presentations'
- sectionsWithOwnHeader array includes 'presentations'
- Render: `{activeSection === 'presentations' && <PresentationsSection />}`

## Checker Warnings Addressed

1. **'Link copied' and 'Copy failed'** — Added to translations.ts Phase 19 block (were missing from worktree)
2. **createMutation.onSuccess toast** — Added `toast({ title: t('Presentation created') })`; opening editor is direct UX feedback but toast provides clear confirmation
3. **Empty slide panel string** — Uses `t('No slides yet')` (not `t('No presentations yet')`) as recommended

## Deviations from Plan

### Foundation Infrastructure (Rule 3 — Blocking issue)

**Found during:** Task setup
**Issue:** This worktree branch diverged from main before Phase 17 landed (BrandGuidelinesSection.tsx, shared/schema/presentations.ts, admin types/constants with 'presentations' entry). TypeScript check had a compilation error on the AdminSection exhaustiveness check.
**Fix:** Extracted 5 files from main using `git show main:<path>` — no merge, no rebase. This is the parallel-execution pattern: each worktree takes only what it needs from main without touching other agents' in-progress work.
**Files added:** shared/schema/presentations.ts, BrandGuidelinesSection.tsx, shared/schema.ts barrel (+ presentations.js export), admin/shared/types.ts (+ 'presentations' variant), admin/shared/constants.ts (+ presentations sidebar entry)
**Commit:** 7e51e36

## Known Stubs

None. All data flows from real API endpoints (/api/presentations GET/POST/PUT/DELETE). The editor textarea is initialized from actual presentation.slides data. SlideCard renders real layout/heading fields.

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| PresentationsSection.tsx exists | FOUND |
| presentations.ts schema exists | FOUND |
| BrandGuidelinesSection.tsx exists | FOUND |
| Commit 7e51e36 (Task 1) | FOUND |
| Commit 31e8d68 (Task 2) | FOUND |
| npm run check | 0 errors |
