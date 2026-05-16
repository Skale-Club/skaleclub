---
phase: 40-ai-presentation-generator
plan: "03"
subsystem: client/presentations
tags: [presentations, edit-mode, inline-edit, ai-redo, delete-slide]
dependency_graph:
  requires:
    - PUT /api/presentations/:id (existing route)
    - POST /api/presentations/:id/chat (existing SSE route)
  provides:
    - Per-slide edit toolbar (delete, AI-redo, inline-edit) in PresentationViewer
  affects:
    - client/src/pages/PresentationViewer.tsx
tech_stack:
  added: []
  patterns:
    - Group-hover opacity toolbar pattern (opacity-0 → group-hover:opacity-100)
    - Optimistic React Query cache update with invalidation fallback on error
    - SSE stream reader loop for AI-redo response
    - contenteditable with inlineSavePending ref to prevent blur-on-rerender loop
    - Immediate index clamp on slide delete (Pitfall 7 pattern)
key_files:
  created: []
  modified:
    - client/src/pages/PresentationViewer.tsx
decisions:
  - "Per-slide toolbar gated on isEditMode (URLSearchParams.has('edit')) — public viewers see nothing"
  - "inlineSavePending ref (not state) prevents the blur-on-rerender save loop (Pitfall 6)"
  - "handleDeleteSlide clamps activeIndex immediately before async PUT — avoids index-out-of-bounds (Pitfall 7)"
  - "handleRedoSlide reads SSE stream inline rather than using useMutation — SSE is not a standard request/response"
  - "Inline edit overlay positioned absolute inset-0 z-50 inside outer slide area div, after AnimatePresence"
metrics:
  duration: "~3 min"
  completed_date: "2026-05-15"
  tasks_completed: 1
  files_changed: 1
---

# Phase 40 Plan 03: Per-Slide Edit Toolbar Summary

**One-liner:** Per-slide floating toolbar (Trash, RefreshCw, Pencil) visible only in `?edit=1` mode, with delete+persist, AI-redo via existing SSE chat endpoint, and contenteditable inline edit with blur/Enter auto-save.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add per-slide toolbar with delete, AI-redo, and inline edit | 016b4e6 | client/src/pages/PresentationViewer.tsx |

## Acceptance Criteria Verified

- Trash2, RefreshCw, Pencil imported from lucide-react (line 5)
- isEditMode gates toolbar at 5 call sites (lines 206, 223, 241, 493, 529)
- handleDeleteSlide defined (line 322)
- handleRedoSlide defined (line 344)
- handleInlineSave defined (line 385)
- Index clamp on delete: `Math.min(activeIndex, Math.max(0, newSlides.length - 1))` (line 326)
- inlineSavePending ref guards save loop (lines 204, 386, 387, 405)
- Chat endpoint targeted instruction: "Regenerate only slide at index ${index}..." (line 352)
- group-hover:opacity-100 on toolbar (line 494)
- `npm run check` exits 0

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all handlers make real API calls to existing endpoints.

## Self-Check: PASSED

- File exists: `/c/Users/Vanildo/Dev/skaleclub/.claude/worktrees/agent-a2e2ec37edabd9d8f/client/src/pages/PresentationViewer.tsx` — FOUND
- Commit 016b4e6 exists — FOUND (git rev-parse HEAD returned 016b4e6)
- `npm run check` exit 0 — CONFIRMED
