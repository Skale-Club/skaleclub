---
phase: 12-admin-redesign-core-editing
plan: 03
subsystem: ui
tags: [react, admin, links-page, dnd-kit, drag-reorder, i18n, accessibility]

# Dependency graph
requires:
  - phase: 12-admin-redesign-core-editing
    plan: 01
    provides: SortableLinkRow-ready link rows keyed by stable `link.id`, GripVertical placeholder, updateConfig/saveSettings helpers for PUT /api/company-settings auto-save
  - phase: 10-schema-upload-foundation
    provides: LinksPageConfig normalizer — guarantees every link has a stable `link.id` (required by @dnd-kit useSortable)
provides:
  - Drag-and-drop reorder for Main Links card via @dnd-kit/core + @dnd-kit/sortable
  - SortableLinkRow sub-component (GripVertical handle, useSortable, isDragging opacity/z-index)
  - DndContext + SortableContext + verticalListSortingStrategy wrap around the links list
  - handleDragEnd that reindexes `order: 0..N-1` via arrayMove and persists through existing updateConfig
  - PT translation for 'Drag to reorder' aria-label
  - Keyboard accessibility via KeyboardSensor + sortableKeyboardCoordinates
affects: [13-preview, 13-theme-editor]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Same @dnd-kit sortable shape as SortableQuestionItem.tsx (attributes+listeners on handle, CSS.Transform.toString, opacity+zIndex during drag)
    - Same PointerSensor activationConstraint { distance: 6 } as EstimatesSection (prevents accidental drags)
    - SortableLinkRow co-located in LinksSection.tsx file (same pattern as EstimatesSection's SortableServiceRow)
    - Grip handle is a semantic `<button type="button">` with `touch-none` class for mobile touch drag + keyboard focusability
    - Order reindex after arrayMove: `.map((l, i) => ({ ...l, order: i }))` — guarantees persisted order is always 0..N-1 regardless of prior values

key-files:
  created:
    - .planning/phases/12-admin-redesign-core-editing/12-03-SUMMARY.md
  modified:
    - client/src/components/admin/LinksSection.tsx
    - client/src/lib/translations.ts
    - .planning/REQUIREMENTS.md

key-decisions:
  - "Co-located SortableLinkRow in the same LinksSection.tsx file rather than extracting to a separate file — matches EstimatesSection's SortableServiceRow pattern, keeps related UI atomic, and the file is still well under the 600-line CLAUDE.md limit"
  - "Used `<button type=button>` for the drag handle (not `<div>`) — gives built-in keyboard focusability + correct semantics for the KeyboardSensor-driven Space/Arrow reorder flow"
  - "Wrapped ONLY the links list in DndContext (empty state rendered above as a fallthrough) — avoids needlessly instantiating sensors when there are no items to drag"
  - "Kept the `link.id!` non-null assertion inside useSortable and SortableContext items — normalizer (Phase 10) guarantees id presence at runtime; the assertion quiets TypeScript without adding defensive runtime fallbacks"
  - "Used existing `updateConfig({ links: reordered }, 'links')` helper rather than adding a parallel reorder-save path — ensures SavedIndicator fires on the 'links' fieldKey just like Add/Remove/Toggle operations"

patterns-established:
  - "Drag-reorder template: sensors (Pointer + Keyboard) → DndContext → SortableContext(items=id[], strategy=verticalListSortingStrategy) → map to Sortable*Row that owns GripVertical + useSortable — reusable for future reorderable admin lists (social links, theme blocks)"
  - "Order reindex on drop: always rewrite `order: 0..N-1` after arrayMove, never trust prior order values — server persists a clean contiguous sequence every time"

requirements-completed:
  - LINKS-11

# Metrics
duration: 8min
completed: 2026-04-19
---

# Phase 12 Plan 03: Drag-and-Drop Reorder for Main Links Summary

**@dnd-kit-powered drag reorder on admin Main Links card with 6px pointer activation, keyboard sensor, arrayMove + order-reindex persistence, and PT aria-label — wired through existing updateConfig auto-save.**

## Performance
- **Duration:** ~8 min
- **Started:** 2026-04-19
- **Completed:** 2026-04-19
- **Tasks:** 3 (two implementation tasks combined into one atomic commit since SortableLinkRow requires DndContext parent and vice versa to compile)
- **Files modified:** 3 (LinksSection.tsx, translations.ts, REQUIREMENTS.md)

## Accomplishments
- Extracted `SortableLinkRow` sub-component co-located in `LinksSection.tsx` — owns `useSortable({ id: link.id! })`, the GripVertical `<button>` handle with `{...attributes} {...listeners}`, `touch-none` class for mobile, `aria-label={t('Drag to reorder')}`, and CSS.Transform + isDragging opacity/z-index during drag
- Added @dnd-kit imports (`DndContext`, `closestCenter`, `PointerSensor`, `KeyboardSensor`, `useSensor`, `useSensors`, `type DragEndEvent` from `@dnd-kit/core`; `SortableContext`, `arrayMove`, `sortableKeyboardCoordinates`, `useSortable`, `verticalListSortingStrategy` from `@dnd-kit/sortable`; `CSS` from `@dnd-kit/utilities`)
- Added `useTranslation` hook usage inside `LinksSection` for the handle aria-label
- Wired `sensors = useSensors(PointerSensor(distance:6), KeyboardSensor(sortableKeyboardCoordinates))` — matches EstimatesSection's accidental-drag guard
- Added `handleDragEnd` that looks up active/over indices on `config.links` by id, runs `arrayMove`, then `.map((l, i) => ({ ...l, order: i }))` to rewrite order 0..N-1, and calls existing `updateConfig({ links: reordered }, 'links')` so the SavedIndicator fires
- Wrapped the links `.map()` render in `<DndContext>` → `<SortableContext items={config.links.map(l => l.id!)} strategy={verticalListSortingStrategy}>` → `<SortableLinkRow>` per link; empty state remains outside DndContext
- Preserved every pre-existing feature of the row (visibility Switch, click-count Badge, title/URL inputs, delete button, `data-testid={\`link-row-${index}\`}`)
- Added `'Drag to reorder': 'Arraste para reordenar'` to the PT block in `translations.ts`
- Flipped LINKS-11 checkbox to `[x]` and traceability row to `Complete` in REQUIREMENTS.md

## Task Commits

1. **Tasks 12-03-01 + 12-03-02 (combined):** `ece85d1` (feat) — `feat(12-03): add drag-reorder to links via @dnd-kit SortableLinkRow`
   - SortableLinkRow extraction + DndContext/SortableContext wiring + sensors + handleDragEnd
   - Combined into a single atomic commit because the sub-component and parent wrap cannot compile independently
2. **Task 12-03-03:** (this commit) `docs(12-03): complete drag-reorder (LINKS-11)` — translation + requirements + SUMMARY

## Files Created/Modified

- `client/src/components/admin/LinksSection.tsx` — Added @dnd-kit imports + `useTranslation` import; extracted `SortableLinkRow` sub-component (~80 lines) with `useSortable` hook, GripVertical `<button>` handle (with attributes/listeners/touch-none/aria-label), and preserved row body (Badge, Switch, inputs, delete); inside `LinksSection` added `const { t }` destructure, `sensors` via `useSensors(PointerSensor(distance:6), KeyboardSensor(sortableKeyboardCoordinates))`, `handleDragEnd` with arrayMove + order reindex calling `updateConfig`; replaced inline `.map()` render with `<DndContext>`/`<SortableContext>` wrap; empty state rendered as the `else` branch of a ternary so DndContext isn't instantiated when there are no links
- `client/src/lib/translations.ts` — Appended `'Drag to reorder': 'Arraste para reordenar'` at the end of the PT block
- `.planning/REQUIREMENTS.md` — Flipped LINKS-11 checkbox `[ ]` → `[x]`; flipped traceability row `Pending` → `Complete`

## Decisions Made
- **Co-located SortableLinkRow in LinksSection.tsx** rather than a separate file. Rationale: matches EstimatesSection's SortableServiceRow precedent; keeps row state close to parent DndContext/handlers; file still well within CLAUDE.md's 600-line limit.
- **Semantic `<button type=button>` for the drag handle** instead of a `<div>`. Rationale: built-in focus + keyboard semantics; KeyboardSensor can pick up Space to activate + Arrow to move; accessible by default.
- **Only wrap the link list in DndContext** — empty state is rendered via a ternary branch outside DndContext. Rationale: no sensors instantiated when there's nothing to drag, and the add-first-link button flow stays unchanged.
- **Order reindex `0..N-1` after every drop.** Rationale: guarantees persisted order is always a clean contiguous sequence regardless of whether previous order values had gaps (from add/remove operations). Server sees a canonical order each time.
- **Combined Tasks 12-03-01 and 12-03-02 into one commit.** Rationale: the SortableLinkRow child and the DndContext parent reference each other and can't compile in isolation (setNodeRef relies on being inside a SortableContext; DndContext needs SortableLinkRow as its child). Atomic commit keeps HEAD always green.

## Deviations from Plan
- **Task 1 + Task 2 merged into a single commit** (not a code change — just a commit-granularity deviation). The plan structured them as two commits; compiling SortableLinkRow without its DndContext parent yields misleading runtime behavior (useSortable returns no-op transforms). Atomic commit is the correct tradeoff. No code omitted; all acceptance grep criteria for both tasks verified in one pass (see Acceptance Summary).

## Issues Encountered
- None. Initial attempt imported a `useLanguage` hook from LanguageContext; verified the actual hook is `useTranslation` from `@/hooks/useTranslation` and corrected the import before any downstream code referenced it. TypeScript compilation and Vite build both green on first pass after the fix.

## User Setup Required
- None — no external configuration needed. Admin can open `/admin` → Links Page tab and drag rows immediately after deploy.

## Manual QA (deferred to `/gsd:verify-work`)
- Open `/admin` → Links Page tab
- Ensure at least 2 links exist (add if not)
- Drag Link A (by the grip handle) below Link B — confirm optimistic DOM reorder during drag (opacity 0.5, z-index 50 on dragged row)
- Release — confirm SavedIndicator 'Saved' appears on the links field
- Reload page — confirm new order persisted (GET /api/company-settings returns links with rewritten order 0..N-1)
- Keyboard: Tab to a grip handle, Space to activate, ArrowDown to move — confirm row moves
- Tap+hold-drag on mobile (touch-none on handle prevents browser touch gestures hijacking the drag)
- Confirm 6px PointerSensor distance: brief mousedown+release on handle without movement does NOT trigger reorder (no accidental drag)

## Acceptance Summary

**Task 12-03-01 (grep counts in LinksSection.tsx):**
- `function SortableLinkRow` → 1 ✓
- `useSortable` → 2 ✓ (import + hook call)
- `GripVertical` → 2 ✓ (import + usage)
- `cursor-grab` → 1 ✓
- `aria-label={t('Drag to reorder')}` → 1 ✓

**Task 12-03-02 (grep counts in LinksSection.tsx):**
- `DndContext` → 3 ✓ (import + opening + closing tags)
- `SortableContext` → 3 ✓ (import + opening + closing tags)
- `handleDragEnd` → 2 ✓ (definition + usage)
- `arrayMove` → 2 ✓ (import + call)
- `activationConstraint: { distance: 6 }` → 1 ✓
- `verticalListSortingStrategy` → 2 ✓ (import + strategy prop)

**Task 12-03-03:**
- `'Drag to reorder':` in translations.ts → 1 ✓
- `- [x] **LINKS-11**` in REQUIREMENTS.md → 1 ✓
- `| LINKS-11 | Phase 12 | Complete |` in REQUIREMENTS.md → 1 ✓
- SUMMARY.md exists → ✓

**Build gates:**
- `npx tsc --noEmit` → EXIT 0 ✓
- `npm run build` → succeeds (Vite client + esbuild server; dist/index.cjs 1.7mb) ✓

## Coordination with Plan 12-02
Plan 12-02 (drag-drop uploaders) ran in parallel against the same file. 12-02 added a `DragDropUploader` import on line 30 of LinksSection.tsx. No merge conflicts — 12-02 touched only the Profile zone's avatar/background inputs, 12-03 touched only the Main Links card. Import blocks merged cleanly.

## Next Phase Readiness

**LINKS-11 closes — remaining Phase 12 scope done.** Phase 12 is now 3/3 plans complete (12-01 layout + visibility, 12-02 uploaders, 12-03 drag-reorder).

**Phase 13 (Live Preview, LINKS-12 theme editor, LINKS-13 live preview, LINKS-09 icon picker):**
- SortableLinkRow is the natural host for the icon-picker integration (LINKS-09) — icon slot can be added to the left of the Badge row without disturbing the drag handle
- Live preview (LINKS-13) will re-render when config changes via the existing invalidateQueries flow; reorder is already part of that flow via updateConfig

No blockers or concerns.

---
*Phase: 12-admin-redesign-core-editing*
*Plan: 03*
*Completed: 2026-04-19*

## Self-Check: PASSED
- FOUND: .planning/phases/12-admin-redesign-core-editing/12-03-SUMMARY.md
- FOUND: client/src/components/admin/LinksSection.tsx
- FOUND: commit ece85d1 (feat 12-03-01 + 12-03-02)
