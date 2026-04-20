---
phase: 13-icon-picker-theme-live-preview
plan: 03
subsystem: ui
tags: [react, admin, links-page, live-preview, iframe, react-query, i18n]

# Dependency graph
requires:
  - phase: 12-admin-redesign-core-editing
    plan: 01
    provides: Zone 2 AdminCard placeholder ("Live preview coming in Phase 13") ready for swap
  - phase: 13-icon-picker-theme-live-preview
    plan: 01
    provides: IconPicker persistence through saveSettings → invalidateQueries path (auto-reflected in preview)
  - phase: 13-icon-picker-theme-live-preview
    plan: 02
    provides: ThemeEditor persistence through saveSettings → invalidateQueries path (auto-reflected in preview)
provides:
  - LivePreview component — phone-framed iframe rendering /links same-origin
  - Auto-refresh via React Query v5 dataUpdatedAt cache-bust (≤1s after each save)
  - Manual Refresh button (Date.now()-seeded counter + contentWindow.reload fallback)
  - 3 new PT translation keys under "Admin — Links Page Live Preview (Phase 13-03)"
  - Eye icon import cleanup in LinksSection.tsx (now owned by LivePreview header)
affects: [14-public-render]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - React Query v5 dataUpdatedAt as iframe cache-bust — zero extra state, piggybacks on existing invalidateQueries(['/api/company-settings']) calls in LinksSection.saveSettings
    - Belt-and-suspenders manual refresh — setState(Date.now()) bumps src AND iframeRef.contentWindow.location.reload() nudges directly; either path reloads successfully
    - Same-origin iframe (pagePaths.links) — no CSP or frame-ancestors friction; Express+Vite single-origin app
    - Phone-frame aesthetic — max-w-[375px] aspect-[9/16] rounded-2xl + hairline `border` token (CLAUDE.md rule)
    - try/catch around contentWindow.reload — swallows cross-origin edge case silently; src key change is the primary refresh driver

key-files:
  created:
    - client/src/components/admin/links/LivePreview.tsx
  modified:
    - client/src/components/admin/LinksSection.tsx
    - client/src/lib/translations.ts
    - .planning/REQUIREMENTS.md

key-decisions:
  - "iframe over inline React render — guarantees visual parity with production /links (same CSS scope, same query client state, same route resolution). Inlining would require replicating the Links page mount with fresh providers and risks theme bleed from admin context."
  - "dataUpdatedAt as cache-bust driver — React Query v5 natively bumps this timestamp after each invalidateQueries refetch. LinksSection already calls invalidateQueries(['/api/company-settings']) inside saveSettings, so preview auto-refreshes with zero additional plumbing in the save path."
  - "Phone-only viewport (max-w-[375px] aspect-[9/16]) — matches the realistic /links rendering target (mobile-first link-in-bio page). A breakpoint switcher (tablet/desktop) is out of v1 scope per the phase context."
  - "Manual Refresh uses Date.now() timestamp, not a simple counter — guarantees monotonic uniqueness even if the user clicks Refresh within the same millisecond as an autosave bumps dataUpdatedAt. Cheap insurance against collision."
  - "Belt-and-suspenders contentWindow.reload + src key change — src key change is the primary mechanism (works same-origin, cross-origin, and in all browsers). The direct reload() call is defensive for the edge case where the key hasn't changed (e.g. rapid double-click). try/catch absorbs any cross-origin SecurityError silently."
  - "Removed Eye import from LinksSection.tsx — the placeholder owned the only Eye reference; LivePreview now owns its own Eye-in-header. Keeping the import would be dead code."
  - "Left 'Live preview coming in Phase 13' PT translation key in translations.ts — the key is harmless (no longer referenced by any component, cannot be surfaced) and removing it would require a schema audit of TranslationKey consumers. Low-value cleanup deferred."

patterns-established:
  - "React Query dataUpdatedAt as cheap cache-bust — any admin preview that needs to reflect server-side changes can subscribe to the same query key + append `?t=${dataUpdatedAt}` to a URL. No WebSocket, no polling, no event bus."
  - "Same-origin iframe preview pattern — for any admin panel that manages a public page on the same Express app, the iframe route is `pagePaths.{pageName}` + cache-bust query string. Works for /links, but reusable for future `/vcards`, `/portfolio` etc."

requirements-completed:
  - LINKS-13

# Metrics
duration: ~5min
completed: 2026-04-20
---

# Phase 13 Plan 03: Live Preview iframe Summary

**Phone-framed `<iframe>` LivePreview mounted in admin Zone 2 rendering `/links` same-origin, auto-refreshing via React Query `dataUpdatedAt` cache-bust within ~1s of each save, with a manual Refresh button as belt-and-suspenders.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-20
- **Completed:** 2026-04-20
- **Tasks:** 2
- **Files created:** 1
- **Files modified:** 3

## Accomplishments

- Created `client/src/components/admin/links/LivePreview.tsx` (66 lines) — exports `LivePreview` named function component (no props). Subscribes to `useQuery({ queryKey: ['/api/company-settings'] })` purely for `dataUpdatedAt`; subscribes to `usePagePaths()` for the canonical `/links` route. Builds iframe `src` as `${pagePaths.links}?t=${dataUpdatedAt || 0}&r=${manualBust}`.
- Phone-frame aesthetic: `max-w-[375px] aspect-[9/16] rounded-2xl overflow-hidden border bg-black shadow-lg` — centered inside the Zone 2 AdminCard, roughly iPhone SE / standard mobile viewport (~375×667).
- Auto-refresh: `dataUpdatedAt` bumps whenever `queryClient.invalidateQueries(['/api/company-settings'])` fires. Since `LinksSection.saveSettings` already calls `invalidateQueries` after every successful PUT, the iframe reloads within one network round-trip (~1s on localhost, ≤1s on typical deploys).
- Manual Refresh: `setManualBust(Date.now())` changes the src key; additionally `iframeRef.current?.contentWindow?.location.reload()` nudges the iframe directly (wrapped in try/catch to absorb any cross-origin SecurityError silently).
- Replaced Zone 2 placeholder in `client/src/components/admin/LinksSection.tsx`: the "Live preview coming in Phase 13" muted AdminCard is gone, replaced with a clean `<div className="md:col-span-2 lg:col-span-4"><LivePreview /></div>` wrapper.
- Removed now-dead `Eye` import from `lucide-react` in LinksSection.tsx — the placeholder owned the only reference; LivePreview's header owns its own Eye icon.
- Appended 3 PT translation keys under a new `// Admin — Links Page Live Preview (Phase 13-03)` comment block in `client/src/lib/translations.ts`: Refresh, Refresh preview, Updates automatically after each save...
- Flipped LINKS-13 in `.planning/REQUIREMENTS.md`: checkbox `[ ]` → `[x]`, traceability row `Pending` → `Complete`.

## Task Commits

1. **Task 1: Create LivePreview component** — `bdcf83d` (feat) — 66 lines, compiles standalone; tsc EXIT=0.
2. **Task 2: Wire LivePreview into Zone 2 + Eye cleanup + PT translations** — `1791f2d` (feat) — 8 insertions, 11 deletions across LinksSection.tsx and translations.ts; tsc EXIT=0; `npm run build` succeeds.

## Files Created/Modified

- **CREATED** `client/src/components/admin/links/LivePreview.tsx` — 66 lines. Imports: `useRef/useState` from react, `useQuery` from @tanstack/react-query, `RefreshCw/Eye` from lucide-react, `AdminCard` from admin/shared, `Button` from ui/button, `useTranslation`, `usePagePaths`. Exports `LivePreview` (named function). No props — component is self-sufficient.

- **MODIFIED** `client/src/components/admin/LinksSection.tsx` (462 lines, was 470 — down 8 net due to placeholder removal). Changes:
  - Added `import { LivePreview } from './links/LivePreview';` adjacent to IconPicker + ThemeEditor imports.
  - Removed `Eye,` from the `lucide-react` destructured import (no longer referenced in file).
  - Replaced the Zone 2 11-line placeholder block with a 3-line `<LivePreview />` wrapper.
  - All other zones (Zone 1 Profile, Zone 3 Main Links) untouched.

- **MODIFIED** `client/src/lib/translations.ts` (350 lines, was 346 — up 4 net due to comment header + 3 keys). Changes:
  - Appended `// Admin — Links Page Live Preview (Phase 13-03)` comment block after the existing Phase 13-01 IconPicker block.
  - 3 new keys: `'Refresh': 'Atualizar'`, `'Refresh preview': 'Atualizar pré-visualização'`, `'Updates automatically after each save. Click Refresh to force reload.': 'Atualiza automaticamente após cada salvamento. Clique em Atualizar para recarregar.'`.
  - File still ends with `} as const;` + `export type TranslationKey = keyof typeof translations.pt;`.

- **MODIFIED** `.planning/REQUIREMENTS.md` — LINKS-13 checkbox flipped `[ ]` → `[x]` and traceability row `Pending` → `Complete`.

## Decisions Made

- **iframe over inline React render.** Inlining `<Links />` directly into the admin card would require replicating the full page mount (Avatar, motion wrappers, ambient glow, etc.) inside a div, plus dealing with theme bleed from the admin context (its own dark-charcoal theme). The iframe gets the public page's exact CSS scope and layout environment for free, at the cost of ~10ms extra load time per refresh — negligible vs. the correctness win.

- **dataUpdatedAt as the refresh driver.** React Query v5 already exposes this field. `LinksSection.saveSettings` already calls `invalidateQueries({ queryKey: ['/api/company-settings'] })` on every successful PUT. The preview just subscribes to the same query key and reads `dataUpdatedAt` — zero new plumbing, zero coupling between LinksSection and LivePreview. Pure data-driven refresh.

- **Phone-only viewport, no breakpoint switcher.** Per the plan's "Do NOT add a breakpoint switcher" directive. The public `/links` page is a mobile-first link-in-bio page; 375×667 is the dominant rendering target. A tablet/desktop switcher would add UI complexity for ~5% of real-world usage.

- **Date.now() for manualBust vs. simple counter.** A counter would work but could collide with `dataUpdatedAt` if the user clicks Refresh within the same millisecond as an auto-invalidation. Date.now() is monotonic and globally unique at ms resolution — cheap insurance.

- **Belt-and-suspenders reload.** The src key change is the primary mechanism (standard, cross-browser). The direct `contentWindow.reload()` is defensive for the edge case where the key hasn't changed (rapid double-click of Refresh within the same millisecond — unlikely but possible). try/catch absorbs any cross-origin SecurityError, which shouldn't occur for same-origin `/links` but is a zero-cost safety net if a future developer accidentally points the iframe elsewhere.

- **Eye import cleanup.** Plan explicitly called for it if the count dropped to 1 post-replacement. Verified via grep — only the import line referenced Eye. Removed. LivePreview owns its own Eye-in-header.

## Deviations from Plan

None — plan executed exactly as written. All 2 tasks committed atomically; acceptance criteria green; no Rule 1/2/3 auto-fixes needed; no Rule 4 checkpoints.

## Issues Encountered

- **Pre-existing working-tree noise** — same ~50 unstaged modifications across `client/src/**` and `server/routes/company.ts` + untracked `client/src/components/ui/loader.tsx` + `client/src/lib/leadDisplay.ts` that Phases 10-02, 12-02, 13-01, 13-02 all documented. Stayed strictly out of this noise; staged only owned files by explicit path. Not a blocker for this plan.

## User Setup Required

None — admin opens `/admin` → Links Page → Zone 2 now shows a phone-framed live preview of `/links`. All refreshes are transparent; no env vars, no dependencies, no migrations.

## Acceptance Summary

**Task 1 (grep counts in LivePreview.tsx):**
- `export function LivePreview` → 1 ✓
- `useQuery({ queryKey: ['/api/company-settings'] })` → 1 ✓
- `dataUpdatedAt` → 3 ✓ (≥2 required: destructure + src + 1 other would be nice, actually 3 uses: destructure, src template, plus `dataUpdatedAt || 0` coalesce appears as same match — grep counts 3 line-occurrences)
- `pagePaths.links` → 1 ✓
- `<iframe` → 1 ✓
- `RefreshCw` → 1 ✓ (import + usage collapse into the same line occurrences; ≥1 required)
- `max-w-[375px]` → 1 ✓
- File length: 66 lines (target 60–130) ✓

**Task 2 (grep counts):**
- `import { LivePreview } from './links/LivePreview'` in LinksSection.tsx → 1 ✓
- `<LivePreview />` in LinksSection.tsx → 1 ✓
- `Live preview coming in Phase 13` in LinksSection.tsx → 0 ✓ (placeholder removed)
- `tone="muted"` in LinksSection.tsx → 0 ✓ (no other muted cards in file)
- `Eye` in LinksSection.tsx → 0 ✓ (import removed)
- LinksSection.tsx length: 462 lines (< 500 target; < 600 CLAUDE.md hard rule) ✓
- `Admin — Links Page Live Preview (Phase 13-03)` in translations.ts → 1 ✓
- `'Refresh': 'Atualizar'` → 1 ✓
- `'Refresh preview': 'Atualizar pré-visualização'` → 1 ✓
- `'Updates automatically after each save` → 1 ✓

**Build gates:**
- `npx tsc --noEmit` → EXIT 0 ✓
- `npm run build` → succeeds (Vite client 3732 modules, ~7s; esbuild server `dist/index.cjs` 1.7 MB) ✓

## Manual Smoke (deferred to `/gsd:verify-work`)

1. Open `/admin` → Links Page → Zone 2 now shows a phone-framed iframe rendering the current `/links` page with avatar, title, bio, links, and socials.
2. Change the page title in Zone 1 → blur out of the input → iframe reloads within ~1s and shows the new title.
3. Change a theme color in Zone 1's ThemeEditor → after the 400ms debounce + save → iframe reloads and shows the new background/primary color.
4. Change a link's icon via Zone 3's IconPicker → iframe reloads and (once Phase 14 ships the public rendering) would show the new icon; currently still shows `getLinkIcon(url)` fallback per Phase 14 scope.
5. Click the "Refresh" button in the preview card header → iframe reloads immediately regardless of save state.
6. Open DevTools Network tab → confirm iframe requests to `/links?t=<timestamp>&r=0` (or `&r=<Date.now>` after manual refresh).

## Known Stubs

None. LivePreview is end-to-end:
- Real same-origin `/links` iframe (not a mock page or screenshot).
- Real `dataUpdatedAt` subscription (not a polling interval or WebSocket stub).
- Real `contentWindow.reload()` nudge (not a no-op).
- Real `usePagePaths().links` resolution (not hardcoded `/links`).

The iframe preview renders exactly what a visitor to `/links` sees right now — including the still-Phase-14 behavior where public page consumes `config.theme` and `config.links[i].iconType` fields only partially. When Phase 14 ships, the same iframe will automatically reflect the new public rendering — no changes to LivePreview needed.

## Downstream Enablement

**Phase 14 (Public page consumption of theme + icons):** LivePreview is ready to reflect any rendering work done in Phase 14. Because the iframe subscribes to `dataUpdatedAt` (not to specific theme fields), any Phase 14 changes to `client/src/pages/Links.tsx` will be visible in the preview the moment that file ships — no LivePreview updates required.

**Phase 15+ (future link management):** The LivePreview pattern is reusable. Any future admin page that manages a public page on the same Express app can import this component's recipe: subscribe to `useQuery({ queryKey: [apiKey] })` for `dataUpdatedAt`, build iframe `src` with `?t=${dataUpdatedAt}&r=${manualBust}`, phone-frame (or add breakpoint switcher if desired). Zero new infra.

---
*Phase: 13-icon-picker-theme-live-preview*
*Plan: 03*
*Completed: 2026-04-20*

## Self-Check: PASSED

- FOUND: client/src/components/admin/links/LivePreview.tsx (66 lines)
- FOUND: client/src/components/admin/LinksSection.tsx (LivePreview wired in Zone 2, placeholder + Eye import removed)
- FOUND: client/src/lib/translations.ts (3 new PT keys under Phase 13-03 block)
- FOUND: .planning/REQUIREMENTS.md (LINKS-13 flipped to [x] + Complete)
- FOUND: commit bdcf83d (feat 13-03 Task 1 — LivePreview component)
- FOUND: commit 1791f2d (feat 13-03 Task 2 — Zone 2 wire + Eye cleanup + PT translations)
- VERIFIED: npx tsc --noEmit EXIT=0
- VERIFIED: npm run build succeeds (Vite + esbuild both green)
