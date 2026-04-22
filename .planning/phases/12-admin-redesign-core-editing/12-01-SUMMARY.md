---
phase: 12-admin-redesign-core-editing
plan: 01
subsystem: ui
tags: [react, admin, links-page, shadcn, radix-switch, tailwind, i18n]

# Dependency graph
requires:
  - phase: 10-schema-upload-foundation
    provides: LinksPageConfig schema with visible/clickCount/id fields; normalizer guarantees per-link defaults
  - phase: 11-click-analytics-api
    provides: /api/links/:id/click writes clickCount; normalizer exposes link.clickCount on GET
provides:
  - Three-zone admin layout for Links Page (Profile | Live Preview placeholder | Main Links)
  - Per-link Visible Switch wired to PUT /api/company-settings (opacity-50 dim on hidden rows)
  - Click-count Badge on every link row (reads link.clickCount)
  - Background Image URL input wired to linksPageConfig.theme.backgroundImageUrl
  - 24 PT translation keys for admin Links Page labels
  - Vertical-stack link row structure (title and URL stack) ready for Plan 12-03 drag-reorder
affects: [12-02-uploaders, 12-03-sortable, 13-preview, 13-theme-editor]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - AdminCard + FormGrid + SectionHeader primitives over raw Card/CardHeader wrappers
    - Three-zone responsive grid (grid-cols-1 md:grid-cols-2 lg:grid-cols-12 with md:col-span-2 lg:col-span-4)
    - Radix Switch bound to normalizer-guaranteed boolean field, save-on-toggle via existing auto-save debounce
    - Opacity-50 transition for hidden rows (transition-opacity)

key-files:
  created: []
  modified:
    - client/src/components/admin/LinksSection.tsx
    - client/src/lib/translations.ts

key-decisions:
  - "Kept Avatar URL and Background Image URL as plain text Inputs (marked TODO(12-02)) — Plan 12-02 will swap them for DragDropUploader without touching layout"
  - "Did NOT set visible: true explicitly in addLink — lets server normalizer (Phase 10) assign the default, keeping client object shape identical to pre-migration paths"
  - "Added PT translations proactively even though LinksSection strings are still hardcoded English (not yet wrapped in t()) — satisfies CLAUDE.md translation rule preemptively so later i18n wrap-up is a no-op"
  - "Stacked link-row title and URL inputs vertically (dropped md:grid-cols-2) to make the row narrower — fits the Zone 3 col-span-4 width, and 12-03 drag handle still has room"

patterns-established:
  - "Zone-based admin layout: each top-level admin section wraps feature groups in AdminCard inside a 12-col responsive grid; Preview zone is always a card with tone='muted' padding='hero'"
  - "Normalizer trust: UI reads link.visible with ?? true / !== false guard instead of requiring explicit defaults in client state"
  - "Save-on-toggle pattern: Switch onCheckedChange calls existing updateX → updateConfig → saveSettings — no parallel save path for new boolean fields"

requirements-completed:
  - LINKS-07
  - LINKS-10

# Metrics
duration: 12min
completed: 2026-04-19
---

# Phase 12 Plan 01: Admin Links Page Three-Zone Layout + Visibility Toggle Summary

**Three-zone admin grid (Profile | Live Preview placeholder | Main Links) with per-link Radix Switch visibility toggle and click-count Badge, wired to existing PUT /api/company-settings auto-save**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-04-19
- **Completed:** 2026-04-19
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Replaced legacy `grid-cols-3` with responsive `grid-cols-1 md:grid-cols-2 lg:grid-cols-12` three-zone layout using AdminCard/FormGrid/SectionHeader primitives
- Added Live Preview placeholder in Zone 2 (`tone="muted"`, Eye icon, "Live preview coming in Phase 13" message)
- Added Background Image URL input in Profile card, wired to `config.theme.backgroundImageUrl` via `updateConfig({ theme: { ...config.theme, backgroundImageUrl } }, 'theme')`
- Added click-count `<Badge>` (`{link.clickCount ?? 0} clicks`) on every link row, reading directly from Phase 10 normalizer output
- Added Radix `<Switch>` per link row bound to `link.visible`; toggling calls existing `updateLink` which triggers `saveSettings` → `PUT /api/company-settings`
- Hidden rows (`link.visible === false`) dim to `opacity-50` with `transition-opacity`
- Appended 24 PT translation keys to `client/src/lib/translations.ts` covering all new admin Links Page labels (Visible, Live Preview, clicks, Links Page, Profile Information, Avatar URL, Page Title, Short Bio, Background Image URL, Social Links, Main Links, etc.)

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite LinksSection with three-zone layout + click-count badge** - `6091c1d` (feat)
2. **Task 2: Add per-link visibility Switch + PT translations** - `f5cc862` (feat)

**Plan metadata:** (appended after this SUMMARY write)

## Files Created/Modified
- `client/src/components/admin/LinksSection.tsx` — Rewrote from lg:grid-cols-3 two-column Card layout to three-zone lg:grid-cols-12 AdminCard layout; dropped all `Card/CardHeader/CardContent/CardDescription/CardTitle` imports; added `AdminCard`, `FormGrid`, `Badge`, `Switch`, `Eye` imports; added Background Image URL input in Profile zone; added Visible Switch + click-count Badge per link row; final length 364 lines (< 400 target, < 600 CLAUDE.md rule)
- `client/src/lib/translations.ts` — Appended 24 PT translation keys under "Admin — Links Page (Phase 12)" comment block before closing brace of `pt:` object

## Decisions Made
- **Kept Avatar URL and Background Image URL as plain text Inputs** (annotated `TODO(12-02): replace with DragDropUploader`). Rationale: Plan 12-02 explicitly targets uploader integration; keeping text inputs now means the page still functions end-to-end and Phase 12-02 only changes the input component, not the wiring.
- **Did not add `visible: true` explicitly in `addLink`.** Rationale: plan called this out intentionally — the server-side normalizer (Phase 10) assigns the default, and the UI guards with `link.visible !== false`, so newly-added links appear visible without a client-side write of the default.
- **Proactively added PT translations even though JSX strings are still hardcoded English** (no `t()` wrapper yet in LinksSection). Rationale: CLAUDE.md translation rule applies to any *new* user-facing string; adding keys now means when a future plan wraps strings with `t()`, the PT side is already populated — no follow-up translation pass needed.
- **Stacked title/URL inputs vertically inside each link row.** Rationale: Zone 3 is `lg:col-span-4` (narrower than the previous `lg:col-span-2`); dropping the `md:grid-cols-2` inside the row keeps inputs readable at the narrower width and leaves horizontal room for the Switch toolbar on the first line.

## Deviations from Plan

None — plan executed exactly as written. All specified imports added, both Task 1 and Task 2 acceptance criteria met on first pass, tsc and build green.

## Issues Encountered
None.

## User Setup Required
None — no external service configuration required. Admin can open `/admin` → Links Page tab and see the new layout immediately after deploy.

## Acceptance Summary

All acceptance criteria from PLAN.md verified via grep + tsc + build:

**Task 1 (grep counts in LinksSection.tsx):**
- `grid-cols-12` → 1 match
- `md:col-span-2 lg:col-span-4` → 3 matches (three zones)
- `Live preview coming in Phase 13` → 1 match
- `AdminCard` → 9 matches (import + usages)
- `from '@/components/ui/card'` → 0 matches (old Card imports removed)
- `link.clickCount` → 1 match
- `backgroundImageUrl` → 4 matches
- `Eye` → imported from lucide-react + used in Preview zone
- File length → 364 lines (<400 target)

**Task 2 (grep counts):**
- `import { Switch }` in LinksSection.tsx → 1 match
- `onCheckedChange={(checked) => updateLink(index, { visible: checked })}` → 1 match
- `link.visible === false ? 'opacity-50'` → 1 match
- `link.visible !== false` → 1 match (Switch checked prop)
- `{link.clickCount ?? 0} clicks` → 1 match
- `'Visible': 'Visível'` in translations.ts → 1 match
- `'Live preview coming in Phase 13': 'Pré-visualização ao vivo em breve'` → 1 match
- `'clicks': 'cliques'` → 1 match
- `'Links Page': 'Página de Links'` → 1 match

**Build gates:**
- `npx tsc --noEmit` → EXIT 0
- `npm run build` → succeeds (client Vite + server esbuild; dist/index.cjs 1.7mb)

## Next Phase Readiness

**Plan 12-02 (Uploaders):**
- Avatar URL Input has `TODO(12-02): replace with DragDropUploader` marker at the exact swap point
- Background Image URL Input has same marker
- Both use the same `updateConfig` signature the uploader will target

**Plan 12-03 (Drag-reorder):**
- Link rows already have `data-testid={\`link-row-${index}\`}` hook
- Each row keyed by `link.id ?? index` (id from normalizer — stable for dnd-kit)
- GripVertical placeholder exists at the left of each row at the correct location for the drag handle
- Row uses `flex gap-4 items-start`; the drag handle can be wired to the existing GripVertical by 12-03 without structural changes

**Phase 13 (Live Preview):**
- Zone 2 placeholder is a full-height AdminCard (min-h-[400px]) ready to be swapped for the real preview component
- Zone 2 is `md:col-span-2 lg:col-span-4` — Preview will have a generous center column

No blockers or concerns.

---
*Phase: 12-admin-redesign-core-editing*
*Completed: 2026-04-19*

## Self-Check: PASSED
