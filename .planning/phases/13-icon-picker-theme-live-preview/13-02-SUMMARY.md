---
phase: 13-icon-picker-theme-live-preview
plan: 02
subsystem: ui
tags: [react, admin, links-page, theme, color-picker, i18n, shared-constants]

# Dependency graph
requires:
  - phase: 10-schema-upload-foundation
    provides: linksPageThemeSchema (hex regex + optional gradient string) + DEFAULT_LINKS_PAGE_THEME
  - phase: 12-admin-redesign-core-editing
    provides: Profile zone AdminCard layout with existing theme.backgroundImageUrl uploader
provides:
  - ThemeEditor component with primaryColor + backgroundColor + backgroundGradient controls
  - 400ms debounced auto-save per field via existing saveSettings pipeline
  - "Reset to defaults" button restoring primary/bg/gradient (not backgroundImageUrl)
  - 7 new PT translation keys for theme editor UI strings
  - Isomorphic randomUUID in shared/links.ts (works in both Node and browser bundles)
affects: [13-03-live-preview, 14-public-page-theme-consumption]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Native <input type="color"> paired with hex Input (both bind to same local state)
    - useRef<setTimeout>-based debouncer with clearTimeout on unmount + on each new change
    - useEffect re-sync so local state follows upstream after refetch
    - Regex-gated upstream fire: hex text input only schedules save when /^#[0-9a-fA-F]{6}$/ matches
    - Isomorphic crypto.randomUUID via globalThis (zero Node-only imports in shared/)

key-files:
  created:
    - client/src/components/admin/links/ThemeEditor.tsx
  modified:
    - client/src/components/admin/LinksSection.tsx
    - client/src/lib/translations.ts
    - shared/links.ts

key-decisions:
  - "Native <input type=\"color\"> + paired hex Input — zero dependencies vs react-color (~40KB). Both bind to same primary/bg state; hex text input validates against the schema regex before firing the debounced save."
  - "Free-form gradient text input — no client-side validation; server Zod accepts any string, and a typo just renders no gradient. Admins can paste full CSS expressions (linear-gradient / radial-gradient / conic-gradient)."
  - "400ms debounce per field — matches the existing onBlur-driven save cadence on other inputs; avoids flooding PUT /api/company-settings while dragging the native color slider."
  - "Reset restores primary + background + gradient, intentionally NOT backgroundImageUrl — that field has a separate uploader in the Profile zone (Phase 12-02) and clearing it on reset would be surprising behavior."
  - "Moved `randomUUID` import out of shared/links.ts — Vite cannot bundle `import { randomUUID } from 'crypto'` for the browser. Replaced with `globalThis.crypto.randomUUID()`, which is isomorphic (Node 19+ and all modern browsers). This unblocked @shared/links from being imported into any client module."

patterns-established:
  - "Browser-safe shared/ constants — any shared module imported by client code must avoid Node built-ins (`crypto`, `fs`, `path`). Use globalThis APIs or split constants into a separate file."
  - "Debounced controlled-input pattern for admin settings — local state drives the control, useRef<timeout> schedules the onChange, useEffect resyncs on upstream refetch."

requirements-completed:
  - LINKS-12

# Metrics
duration: ~15min
completed: 2026-04-19
---

# Phase 13 Plan 02: Theme Editor Summary

**ThemeEditor component mounted in admin Profile zone with native color pickers + hex inputs + free-form CSS gradient + reset-to-defaults button, persisting through existing 400ms-debounced saveSettings path.**

## Performance

- **Duration:** ~15 min (including a Rule 3 deviation fix for a Vite bundler blocker)
- **Started:** 2026-04-19
- **Completed:** 2026-04-19
- **Tasks:** 2
- **Files created:** 1
- **Files modified:** 3

## Accomplishments

- Created `client/src/components/admin/links/ThemeEditor.tsx` (163 lines) with three editable surfaces:
  - Primary color: native `<input type="color">` + paired hex text input, both bound to the same local state
  - Background color: same pattern
  - Background gradient: single free-form text input (any CSS gradient expression)
- Each field change writes immediately to local React state for smooth typing, then debounces a 400ms `onChange(patch)` upstream — hex text inputs only fire when the value matches the schema regex `/^#[0-9a-fA-F]{6}$/`.
- "Reset to defaults" button restores `primaryColor` / `backgroundColor` / `backgroundGradient` from `DEFAULT_LINKS_PAGE_THEME` (shared with server normalizer) and flushes a single save. `backgroundImageUrl` is intentionally untouched — handled by its own uploader.
- Mounted ThemeEditor inside Zone 1 (Profile) between the Profile Information AdminCard (which contains Avatar + Background Image uploaders) and the Social Links AdminCard. Layout spacing is handled by the parent's `space-y-6`.
- Appended 7 PT translation keys under the "Admin — Links Page Theme Editor (Phase 13-02)" block in `translations.ts`: Theme, Colors and background for your links page, Primary Color, Background Color, Background Gradient (CSS), the gradient helper string, and Reset to defaults.
- Fixed an import-side-effect bundler failure (see Deviations) by making `shared/links.ts` browser-safe.

## Task Commits

1. **Task 1: Create ThemeEditor component with color inputs + gradient + reset** — `431abcb` (feat)
2. **Task 2: Mount ThemeEditor in Profile zone + PT translations + isomorphic UUID fix** — Bundled into parallel Plan 13-01 commits (`aeb824e` and `96a4c57`) due to shared working-tree — see Coordination Notes below. The 13-02 additions committed under those hashes are:
   - `aeb824e`: `+import { ThemeEditor } from './links/ThemeEditor';` and the `<ThemeEditor theme={config.theme ?? {}} onChange={...} />` mount block in LinksSection.tsx
   - `96a4c57`: The full "Admin — Links Page Theme Editor (Phase 13-02)" translation block in translations.ts
   - `18e6319`: The `shared/links.ts` isomorphic `randomUUID` fix (rolled into 13-01's plan wrap-up commit)

Net effect: all 13-02 work is in HEAD; git history attributes the multi-file diff mostly to 13-01's commits because 13-01 committed later in the parallel execution and picked up my already-written working-tree changes.

## Files Created/Modified

- `client/src/components/admin/links/ThemeEditor.tsx` *(created)* — 163 lines. Exports `ThemeEditor` (named) and `ThemeEditorProps`. Imports only `useEffect, useRef, useState` from react; `RotateCcw, Palette` from lucide-react; AdminCard/FormGrid from shared; Input/Label/Button primitives; `useTranslation`; `DEFAULT_LINKS_PAGE_THEME`; `LinksPageTheme` type.
- `client/src/components/admin/LinksSection.tsx` — Added `import { ThemeEditor } from './links/ThemeEditor';` (line 32) and the mount block (lines 352-357) inside Zone 1, between Profile Information and Social Links AdminCards. File grew to 470 lines (still under the 600-line CLAUDE.md soft cap).
- `client/src/lib/translations.ts` — Appended 7 keys under "Admin — Links Page Theme Editor (Phase 13-02)" comment block. File now 345 lines; still ends with `} as const;` and `export type TranslationKey = keyof typeof translations.pt;`.
- `shared/links.ts` — Removed `import { randomUUID } from "crypto";` and replaced with `const randomUUID = (): string => globalThis.crypto.randomUUID();`. This unblocked the Vite client build without changing the normalizer's runtime behavior (Node 19+ and all modern browsers expose `crypto.randomUUID` via `globalThis`).

## Decisions Made

- **Native color input instead of react-color.** Rationale: zero-dep, accessible by default (browser-native UI), and the paired hex text input gives power users a way to type exact values. Phase 12 already committed to lean admin primitives — adding react-color just for two color fields is overkill.
- **400ms debounce per field.** Chosen to match the cadence of other admin inputs (which save onBlur). A 400ms window is long enough that dragging the native color slider produces exactly one PUT at release time, but short enough that typing-then-tabbing out of the hex input still produces an immediate save.
- **Gradient is a single free-form text input with no validation.** Rationale: CSS gradient syntax is extensive (linear/radial/conic, multiple stops, angles, color spaces). Any regex we pick will be wrong for some legitimate cases. Server Zod accepts any string, and a typo degrades gracefully (no gradient renders, background color is used).
- **Reset restores three fields, not four.** `backgroundImageUrl` is managed by the DragDropUploader above ThemeEditor; conflating them would mean "Reset" unexpectedly deletes the admin's uploaded background image. Keeping them separate mirrors the UI layout.
- **Isomorphic randomUUID via globalThis instead of a separate defaults-only file.** Rationale: minimum blast radius — a 2-line change inside `shared/links.ts` vs. splitting the file and updating every server import site. Node 19+ has supported `globalThis.crypto.randomUUID()` for over a year; Node 20/22 LTS are safe, and the dev environment runs Node 24.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Vite could not bundle `import { randomUUID } from "crypto"` in shared/links.ts**

- **Found during:** Task 2 build verification (`npm run build`)
- **Issue:** `shared/links.ts (1:9): "randomUUID" is not exported by "__vite-browser-external", imported by "shared/links.ts".` Rollup failed because the browser build cannot resolve Node's `crypto` module. ThemeEditor importing `DEFAULT_LINKS_PAGE_THEME` from `@shared/links` pulled the entire file (including the Node-only import) into the client bundle for the first time — prior to this plan, `shared/links.ts` was only imported by server code.
- **Fix:** Replaced `import { randomUUID } from "crypto";` with `const randomUUID = (): string => globalThis.crypto.randomUUID();`. Available in Node 19+ and all modern browsers. Runtime behavior of `normalizeLinksPageConfig` is identical.
- **Files modified:** `shared/links.ts`
- **Commit:** Rolled into 13-01 plan-wrap commit `18e6319` (due to parallel-execution commit interleaving)
- **Why this is Rule 3 (blocking) not Rule 4 (architectural):** The change is a drop-in replacement for a stdlib call, not a library/framework swap or schema change. It unblocks the current task without altering any downstream contract.

No Rule 1 or Rule 4 deviations.

## Issues Encountered

- **Commit attribution skew due to parallel execution.** Plan 13-01 ran in the same working tree and committed its changes after my Task 2 edits had already been written to disk. Git therefore packaged my LinksSection.tsx, translations.ts, and shared/links.ts edits into 13-01's commits. All code is in HEAD and builds/typechecks green; only the commit-log authorship is cross-attributed. This is acceptable per both plans' coordination notes ("accept both imports and both blocks").

## User Setup Required

None — admin can open `/admin` → Links Page → Profile zone and see the new Theme card immediately after deploy. All changes persist through the existing PUT `/api/company-settings` path with no schema migration.

## Acceptance Summary

**Task 1 (grep counts in ThemeEditor.tsx):**
- `export function ThemeEditor` → 1 match
- `DEFAULT_LINKS_PAGE_THEME` → 11 matches (1 import + 10 usages incl. reset)
- `type="color"` → 2 matches
- `backgroundGradient` → 8 matches
- `setTimeout(() => onChange` → 1 match (debounced save)
- `Reset to defaults` → 1 match
- File length: 163 lines (plan target 90–170 ✓)

**Task 2 (grep counts):**
- `import { ThemeEditor } from './links/ThemeEditor'` in LinksSection.tsx → 1 match
- `<ThemeEditor` in LinksSection.tsx → 1 match
- `theme={config.theme ?? {}}` → 1 match
- `theme: { ...(config.theme ?? {}), ...patch }` → 1 match
- LinksSection.tsx length: 470 lines (< 500 loose target; < 600 CLAUDE.md hard rule)
- `Admin — Links Page Theme Editor (Phase 13-02)` in translations.ts → 1 match
- `'Theme': 'Tema'` → 1 match
- `'Primary Color': 'Cor Primária'` → 1 match
- `'Reset to defaults': 'Restaurar padrões'` → 1 match
- `'Background Gradient (CSS)': 'Gradiente de Fundo (CSS)'` → 1 match
- translations.ts still ends with `} as const;` and `export type TranslationKey = keyof typeof translations.pt;` ✓

**Build gates:**
- `npx tsc --noEmit` → EXIT 0
- `npm run build` → succeeds (Vite client 3731 modules + esbuild server 1.7MB; built in ~7s)

## Coordination Notes (for Plan 13-01 author and future agents)

**Shared-file outcome:**
- `LinksSection.tsx` imports block: both `IconPicker` (13-01) and `ThemeEditor` (13-02) imports co-exist on adjacent lines (31, 32) — disjoint regions, no conflict.
- `LinksSection.tsx` body: IconPicker renders inside SortableLinkRow (Zone 3 row header); ThemeEditor renders inside Zone 1 Profile column. Completely disjoint.
- `translations.ts`: Two separate comment blocks ("Phase 13-02" and "Phase 13-01") added back-to-back after the Phase 12-02 block.
- `shared/links.ts` crypto fix was required for ThemeEditor's `@shared/links` import. It also benefits any future client code that wants to read shared link defaults.

**Parallel-commit attribution:** Due to parallel execution, some Plan 13-02 file edits were committed under Plan 13-01's commit messages (`aeb824e`, `96a4c57`, `18e6319`). All 13-02 code is functionally present in HEAD; the only divergence from the plan's "one commit per task" ideal is commit-log attribution. Working tree is clean and reproducible from HEAD.

## Next Phase Readiness

**Plan 13-03 (LivePreview):**
- `config.theme` is now fully editable from the admin — LivePreview can read `config.theme.primaryColor`, `.backgroundColor`, `.backgroundGradient`, `.backgroundImageUrl` and render them live.
- ThemeEditor's `onChange` debounces at 400ms; if LivePreview reads from `config` directly (not from saved settings), preview will update within one render cycle of each keystroke (before the debounce fires) — no extra plumbing needed.
- Zone 2 AdminCard at `md:col-span-2 lg:col-span-4` (from Phase 12-01) is still a placeholder and ready to be swapped.

**Phase 14 (Public page consumption):**
- `/links` page can now read the new theme fields from `normalizeLinksPageConfig` (which returns fully-merged defaults). Rendering logic: if `backgroundGradient` is non-empty, use it; else use `backgroundColor`. `primaryColor` applies to link buttons / accents.

## Known Stubs

None — ThemeEditor is fully wired end-to-end to an existing persistence path. No placeholder data, no mock callbacks.

---
*Phase: 13-icon-picker-theme-live-preview*
*Completed: 2026-04-19*

## Self-Check: PASSED

All artifacts and commits verified present:
- `client/src/components/admin/links/ThemeEditor.tsx` — found
- `.planning/phases/13-icon-picker-theme-live-preview/13-02-SUMMARY.md` — found
- Commit `431abcb` (feat(13-02): add ThemeEditor component) — found
- Commit `aeb824e` (13-01 commit bundling Task 2 LinksSection mount) — found
- Commit `96a4c57` (13-01 commit bundling Task 2 translations block) — found
- Commit `18e6319` (13-01 wrap-up commit bundling shared/links.ts crypto fix) — found
