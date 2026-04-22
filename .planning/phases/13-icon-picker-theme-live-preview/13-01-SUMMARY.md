---
phase: 13-icon-picker-theme-live-preview
plan: 01
subsystem: ui
tags: [react, admin, links-page, icon-picker, lucide, shadcn-popover, shadcn-tabs, upload, i18n]

# Dependency graph
requires:
  - phase: 10-schema-upload-foundation
    provides: LinksPageConfig schema with iconType/iconValue per link; POST /api/uploads/links-page (assetType='linkIcon' provisioned)
  - phase: 12-admin-redesign-core-editing
    plan: 02
    provides: Reusable DragDropUploader component supporting assetType='linkIcon'
  - phase: 12-admin-redesign-core-editing
    plan: 03
    provides: SortableLinkRow host ready to receive an icon slot in the row header
provides:
  - IconPicker component with Popover + Tabs (Lucide / Upload / Auto)
  - Debounced (250ms) Lucide icon search filtering PascalCase canonical names
  - Reuse of DragDropUploader with assetType='linkIcon' in the Upload tab
  - Auto tab that clears iconValue so public page falls back to URL heuristic
  - 40×40 preview block matching public-page display size
  - 32×32 trigger button per link row rendering the currently-selected icon
  - 10 new PT translation keys for IconPicker UI strings
affects: [13-03-live-preview, 14-public-render]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Lucide namespace import filter — Object.entries(LucideIcons) filtered by PascalCase regex, skipping *Icon aliases and Icon/LucideIcon exports
    - Controlled Popover open state with setOpen(false) on every tab's commit action
    - defaultValue={iconType ?? 'auto'} on Tabs so the picker opens to the currently-active type
    - Reuse over rebuild — Upload tab delegates entirely to DragDropUploader

key-files:
  created:
    - client/src/components/admin/links/IconPicker.tsx
  modified:
    - client/src/components/admin/LinksSection.tsx
    - client/src/lib/translations.ts
    - .planning/REQUIREMENTS.md

key-decisions:
  - "Filter Lucide exports with PascalCase regex + typeof 'object' + skip *Icon aliases — avoids the duplicate Foo/FooIcon pairs Lucide re-exports, keeps the grid clean and halves candidate count"
  - "Cap rendered list to 200 icons (both idle and filtered) — React can handle full 1000+ grid but DOM mount cost is noticeable on popover open; 200 is plenty for idle browse and for any single search query"
  - "Auto tab sets iconValue=undefined explicitly (not empty string) — matches the 'URL heuristic fallback' contract the public Links page's getLinkIcon(url) expects"
  - "Popover width w-80 with align='start' side='bottom' — keeps the popover anchored to the trigger and fits the 6-column icon grid + preview comfortably"
  - "TriggerIcon + preview share a single renderCurrentIcon helper — avoids duplicated type-branching for the identical 3-state (lucide/upload/auto) render logic"

patterns-established:
  - "Lucide picker filter recipe — `/^[A-Z][a-zA-Z0-9]+$/` PascalCase + typeof 'object' + skip *Icon aliases; reusable for any other Lucide-powered picker UI"
  - "Icon-type tri-state onChange contract — `{ iconType: 'lucide'|'upload'|'auto'; iconValue?: string }` flows directly into updateLink() (Partial<LinksPageLink>) without adapter — future admin list pickers can adopt the same shape"

requirements-completed:
  - LINKS-09

# Metrics
duration: ~10min
completed: 2026-04-20
---

# Phase 13 Plan 01: IconPicker Component + Per-Row Wiring Summary

**Reusable IconPicker (Popover + Tabs: Lucide search / Upload / Auto) wired per-link-row in admin LinksSection, persisting iconType + iconValue through the existing saveSettings → PUT /api/company-settings path.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-04-20
- **Completed:** 2026-04-20
- **Tasks:** 3
- **Files created:** 1
- **Files modified:** 3

## Accomplishments

- Created `client/src/components/admin/links/IconPicker.tsx` (171 lines, under the 220 target) — exports `IconPicker` function component + `IconPickerProps` interface
- Popover+Tabs layout with preview block (40×40, matching public-page display size) over a three-tab panel (Lucide / Upload / Auto)
- Lucide tab: debounced (250ms) text search on `Object.entries(LucideIcons)` filtered to PascalCase canonical names (`/^[A-Z][a-zA-Z0-9]+$/`, typeof 'object', skipping `Icon`, `LucideIcon`, and `*Icon` aliases); clicking an icon calls `onChange({ iconType: 'lucide', iconValue: name })` and closes the popover
- Upload tab: delegates to the existing `DragDropUploader` with `assetType='linkIcon'` (server path provisioned by Phase 10-02); on upload success, calls `onChange({ iconType: 'upload', iconValue: url })` and closes the popover
- Auto tab: single button calling `onChange({ iconType: 'auto', iconValue: undefined })` — public page falls back to `getLinkIcon(url)` URL heuristic (no public-page change in this plan)
- Wired `<IconPicker>` into `SortableLinkRow` at the left of the row header (before the click-count Badge) in `client/src/components/admin/LinksSection.tsx`; onChange delegates to `onUpdate(index, updates)` which routes through the existing `updateLink → updateConfig → saveSettings` path
- Appended 10 PT translation keys under a new `// Admin — Links Page Icon Picker (Phase 13-01)` block in `client/src/lib/translations.ts`
- Flipped LINKS-09 in `.planning/REQUIREMENTS.md`: checkbox `[ ]` → `[x]`, traceability row `Pending` → `Complete`

## Task Commits

1. **Task 1: Create IconPicker component** — `9778a9f` (feat) — 171 lines, compiles standalone
2. **Task 2: Wire IconPicker into SortableLinkRow** — `aeb824e` (feat) — 14 insertions in LinksSection.tsx
3. **Task 3: Add PT translations** — `96a4c57` (feat) — 10 new keys + comment header

## Files Created/Modified

- **CREATED** `client/src/components/admin/links/IconPicker.tsx` — 171 lines. Imports: `useEffect/useMemo/useState`, `* as LucideIcons` + named `{ Link as LinkIcon, Search }` from lucide-react, `Popover*/Tabs*/Input/Button` from shadcn/ui, `DragDropUploader` from admin/shared, `useTranslation`, `cn`. Exports `IconPickerProps` interface and `IconPicker` function component. Internal `renderCurrentIcon` helper shared by trigger (w-5 h-5) and preview (w-10 h-10).

- **MODIFIED** `client/src/components/admin/LinksSection.tsx` — Added `import { IconPicker } from './links/IconPicker'`; inserted `<IconPicker iconType={link.iconType} iconValue={link.iconValue} onChange={(updates) => onUpdate(index, updates)} />` in `SortableLinkRow` at the left of the first flex row, before the click-count Badge. (Note: the import block also picked up a `ThemeEditor` import landed by parallel Plan 13-02 — left in place per coordination scope; disjoint region, clean merge.)

- **MODIFIED** `client/src/lib/translations.ts` — Appended `// Admin — Links Page Icon Picker (Phase 13-01)` comment block with 10 new PT keys (Change icon, Preview, Lucide, Upload, Auto, Search icons..., No icons match your search, Upload icon, Automatically picks an icon based on the destination URL., Use automatic icon).

- **MODIFIED** `.planning/REQUIREMENTS.md` — LINKS-09 flipped to `[x]` and traceability row to `Complete`.

## Decisions Made

- **Lucide filter uses PascalCase + typeof 'object' + *Icon skip.** Rationale: `lucide-react` exports ~1000 canonical PascalCase icons AND an equal number of `*Icon` aliases (`Mail` + `MailIcon`). Filtering to canonicals halves the grid, eliminates duplicates, and keeps search semantic ("search 'mail' → find `Mail`, not `Mail` and `MailIcon` both").

- **Cap rendered results at 200.** Rationale: React can mount 1000+ buttons but the popover-open cost is noticeable. 200 icons in a 6-column grid is plenty for idle browsing before searching. Search queries almost never return more than 100 matches anyway.

- **Auto tab sets `iconValue: undefined` explicitly.** Rationale: the public `/links` page's `getLinkIcon(url)` fallback activates when `iconValue` is missing; using `undefined` (not `''`) matches the schema's `iconValue?: string` semantics exactly and keeps the saved JSONB tidy.

- **Shared `renderCurrentIcon(iconType, iconValue, sizeClass)` helper.** Rationale: trigger (w-5 h-5) and preview (w-10 h-10) do identical 3-state branching; one helper, one set of invariants, no drift if the rendering logic evolves.

- **Popover controlled via `useState(open)`.** Rationale: each tab needs to close the popover after its commit action. Controlled state is the cleanest idiom; uncontrolled would require `Radix.closeFrom*` refs per tab action.

## Deviations from Plan

None — plan executed exactly as written. One coordination surprise (documented): when Task 2 staged `LinksSection.tsx`, the file also contained an `import { ThemeEditor } from './links/ThemeEditor'` line and a mounted `<ThemeEditor>` instance, both added by parallel Plan 13-02. Per the plan's coordination note ("accept both" on imports; merge conflicts in disjoint regions are clean), that line was left in place and captured by the same commit. TypeScript + Vite build both green, confirming 13-02's ThemeEditor file exists and exports what LinksSection imports.

## Issues Encountered

- **Working-tree noise** — ~50 pre-existing unstaged modifications across `client/src/**` and `server/routes/company.ts` plus untracked `client/src/components/ui/loader.tsx` and `client/src/lib/leadDisplay.ts` (same noise Phase 10-02 and 12-02 documented). Stayed strictly out of this noise; staged only the three owned files via explicit `git add` by path.

- **Task 3 mid-execution re-read** — Initial Edit against the pre-13-02 translations tail failed because Plan 13-02 had already appended its theme-editor translations block. Re-read lines 300-350 of `translations.ts`, then appended the 13-01 block AFTER 13-02's block. No strings were overwritten; no existing translations changed.

## User Setup Required

None — the `linkIcon` asset path (`links-page/linkIcon/{ts}-{uuid}.{ext}`) was provisioned server-side in Phase 10-02. No new environment variables, no new Supabase bucket, no migration.

## Acceptance Summary

**Task 1 (grep counts in IconPicker.tsx):**
- `export function IconPicker` → 1 ✓
- `import * as LucideIcons from 'lucide-react'` → 1 ✓
- `assetType="linkIcon"` → 1 ✓
- `TabsTrigger value="lucide|upload|auto"` → 3 ✓
- `setTimeout(() => setDebouncedQuery(query), 250)` → 1 ✓ (debounce present)
- `iconType: 'lucide|upload|auto'` → 4 ✓ (≥3 required; extra from isSelected check)
- File length → 171 lines (target 150–250, 170 guideline) ✓

**Task 2 (grep counts in LinksSection.tsx):**
- `import { IconPicker } from './links/IconPicker'` → 1 ✓
- `<IconPicker` → 1 ✓
- `iconType={link.iconType}` → 1 ✓
- `iconValue={link.iconValue}` → 1 ✓
- `onChange={(updates) => onUpdate(index, updates)}` → 1 ✓
- File length → 463 lines (< 500 limit) ✓
- Pre-existing markers `DragDropUploader|SortableContext|handleDragEnd` → ≥3 ✓

**Task 3 (grep counts in translations.ts):**
- `Admin — Links Page Icon Picker (Phase 13-01)` → 1 ✓
- `'Change icon': 'Alterar ícone'` → 1 ✓
- `'Search icons...': 'Pesquisar ícones...'` → 1 ✓
- `'Use automatic icon': 'Usar ícone automático'` → 1 ✓
- `'No icons match your search': 'Nenhum ícone corresponde à sua pesquisa'` → 1 ✓
- File ends with `} as const;` then `export type TranslationKey = keyof typeof translations.pt;` ✓

**Build gates:**
- `npx tsc --noEmit` → EXIT 0 ✓
- `npm run build` → succeeds (Vite client ✓ built in 7.03s; esbuild server `dist/index.cjs` 1.7 MB) ✓

## Manual Smoke (deferred to `/gsd:verify-work`)

1. Open `/admin` → Links Page → confirm every link row now has a small icon-trigger button at the left of its header.
2. Click a trigger → popover opens with preview block showing generic link icon (or the persisted icon) at 40×40.
3. Lucide tab: type `mail` → list debounces ~250ms → filters to mail-themed icons → click `Mail` → trigger updates, popover closes, network shows `PUT /api/company-settings` with `linksPageConfig.links[i].iconType='lucide'` and `iconValue='Mail'`.
4. Upload tab: drop a 100KB PNG → DragDropUploader spins `Uploading...` → `Uploaded ✓` → trigger shows the uploaded image; network shows POST `/api/uploads/links-page` then PUT `/api/company-settings`.
5. Auto tab: click `Use automatic icon` → trigger reverts to generic link icon; network shows PUT with `iconType='auto'`, `iconValue` undefined (omitted from the links entry).
6. Reload `/admin` → chosen icon persists on each row (GET /api/company-settings returns links with their iconType/iconValue).
7. Public `/links` renders unchanged — Phase 14 will consume these fields; for now it still uses `getLinkIcon(url)` for every link regardless of the chosen icon (Plan 13-01 scope is admin-side only).

## Known Stubs

None. IconPicker is end-to-end:
- Real Lucide list (filtered, not hardcoded)
- Real debounced search (not stubbed)
- Real DragDropUploader delegation (not mock)
- Real `onChange → onUpdate → updateLink → updateConfig → saveSettings → PUT /api/company-settings` persistence
- Real trigger rendering of the persisted icon (lucide component, uploaded img, or fallback LinkIcon)

The only intentional "defer" is the public-page render of the chosen icon — that's Plan 14's scope, documented in LINKS-14 (Pending). This plan's job is the admin-side picker and persistence; public consumption is out of scope per the phase split.

## Downstream Enablement

**Plan 13-02 (ThemeEditor):** Running in parallel, disjoint regions. Coordination clean — both plans' import blocks merged without conflict; both plans' translation blocks appended sequentially without key collisions. No blockers.

**Plan 13-03 (Live Preview iframe):** IconPicker persists via the existing `saveSettings` → `PUT /api/company-settings` path. The live-preview iframe's `queryClient.invalidateQueries({ queryKey: ['/api/company-settings'] })` after-save already fires, so iframe refresh will reflect icon changes automatically — no additional wiring needed from 13-03.

**Plan 14 (Public render):** The `linksPageLinkSchema.iconType` + `iconValue` fields are now actually populated in saved data. Public `/links` page consumption in Plan 14 will need to add branching:
  - `iconType === 'lucide'` → `(LucideIcons as any)[iconValue]` render
  - `iconType === 'upload'` → `<img src={iconValue} />`
  - `iconType === 'auto'` or missing → existing `getLinkIcon(url)` fallback

---
*Phase: 13-icon-picker-theme-live-preview*
*Plan: 01*
*Completed: 2026-04-20*

## Self-Check: PASSED

- FOUND: client/src/components/admin/links/IconPicker.tsx (171 lines)
- FOUND: client/src/components/admin/LinksSection.tsx (IconPicker wired in SortableLinkRow)
- FOUND: client/src/lib/translations.ts (10 new PT keys under Phase 13-01 block)
- FOUND: .planning/REQUIREMENTS.md (LINKS-09 flipped to [x] + Complete)
- FOUND: commit 9778a9f (feat 13-01 Task 1 — IconPicker component)
- FOUND: commit aeb824e (feat 13-01 Task 2 — SortableLinkRow wiring)
- FOUND: commit 96a4c57 (feat 13-01 Task 3 — PT translations)
- VERIFIED: npx tsc --noEmit EXIT=0
- VERIFIED: npm run build succeeds (Vite ✓ 7.03s, esbuild ✓ dist/index.cjs 1.7 MB)
