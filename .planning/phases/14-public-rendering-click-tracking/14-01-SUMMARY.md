---
phase: 14-public-rendering-click-tracking
plan: 01
subsystem: public-page
tags: [react, public-page, lucide, theme, css-var, sendbeacon, analytics, final-phase, v1.3-complete]

# Dependency graph
requires:
  - phase: 10-schema-upload-foundation
    provides: normalizeLinksPageConfig guarantees id/iconType/iconValue/visible/clickCount/theme defaults on every read; LinksPageLink type via z.input<>; DEFAULT_LINKS_PAGE_THEME
  - phase: 11-click-analytics-api
    provides: "POST /api/links-page/click/:linkId — public, IP-rate-limited, 204 on success/rate-limit/error, 404 on unknown id (sendBeacon-safe)"
  - phase: 13-icon-picker-theme-live-preview
    plan: 01
    provides: admin-side iconType/iconValue persistence via IconPicker; established `import * as LucideIcons from 'lucide-react'` namespace pattern
  - phase: 13-icon-picker-theme-live-preview
    plan: 02
    provides: admin-side theme persistence via ThemeEditor; shared/links.ts made browser-bundlable via globalThis.crypto.randomUUID
provides:
  - Public /links respects visible !== false filter
  - Per-link icon rendering — Lucide by name / uploaded URL / URL-heuristic fallback
  - Theme consumption — primaryColor as CSS var, background gradient/color/image, ambient glow recolor
  - Fire-and-forget sendBeacon click tracking on all link clicks (including open-in-new-tab)
affects: []
  # Final phase of v1.3 — nothing downstream

# Tech tracking
tech-stack:
  added: []  # zero new dependencies
  patterns:
    - Lucide namespace import + `(LucideIcons as any)[name]` dynamic icon lookup — matches Phase 13-01 IconPicker pattern
    - CSS custom property via inline style with `['--links-primary' as any]` key + Tailwind arbitrary value `bg-[var(--links-primary)]/20` for theme-driven accents
    - Spread-then-sort-then-filter on array from React Query cache so sort() never mutates cache
    - Fire-and-forget `navigator.sendBeacon` with `typeof navigator.sendBeacon === 'function'` guard + empty-catch — analytics never blocks navigation

key-files:
  created: []
  modified:
    - client/src/pages/Links.tsx
    - .planning/REQUIREMENTS.md
    - .planning/ROADMAP.md
    - .planning/STATE.md

key-decisions:
  - "Added `order` to fallback seed links/socials in the `settings?.linksPageConfig || {...}` literal — Task 1's `(a.order ?? 0) - (b.order ?? 0)` sort plus the stricter LinksPageLink/LinksPageSocial types require it. Plan did not call this out; logged as Rule 3 deviation."
  - "Spread `config.links` before sort — `.sort()` mutates in place and `config.links` comes from the React Query cache. `[...config.links].sort(...).filter(...).map(...)` is the safe pattern."
  - "`key={link.id ?? index}` — normalizer-stamped UUID preferred, index fallback for the hardcoded seed-data case where ids are absent."
  - "`bg-[var(--links-primary)]/20` Tailwind arbitrary value consumes the `--links-primary` CSS var set on the root inline style — zero theme plumbing beyond a single CSS var per accent."
  - "Track all clicks including cmd/ctrl/shift/middle-click — no modifier-key inspection in onClick. sendBeacon is fire-and-forget and happens before navigation regardless of which modifier opens a new tab."
  - "Social links NOT wired to click tracking — out of LINKS-17 scope; v1.3 requirement is only per-(main)link click count."
  - "Loading spinner div uses inline style with DEFAULT_LINKS_PAGE_THEME.backgroundColor — theme isn't loaded yet when isLoading is true, so defaults are the only safe source."
  - "z-[1] on ambient glow divs + z-0 on bg-image layer + z-10 on content — explicit stacking so the optional background image never covers the glows or the avatar column."

patterns-established:
  - "Theme-consuming public surface — inline style spreads a theme object (merged with module-level DEFAULT) onto the root, exposes primaryColor as a CSS custom property, and uses `bg-[var(--...)]` Tailwind arbitrary values for accents. Reusable any time a public page needs to honor admin-set colors."
  - "sendBeacon helper shape — `if (!id) return; try { if (typeof navigator.sendBeacon === 'function') navigator.sendBeacon(url); } catch {}` — adopt anywhere fire-and-forget analytics is needed."

requirements-completed:
  - LINKS-14
  - LINKS-15
  - LINKS-16
  - LINKS-17

# Metrics
duration: ~4 minutes
completed: 2026-04-20
tasks: 3
files_changed: 1  # Links.tsx — plus docs (REQUIREMENTS/ROADMAP/STATE) in the final metadata commit
commits: 3        # one per task; final metadata commit separate
---

# Phase 14 Plan 01: Public /links Rendering + Click Tracking Summary

Rewrote `client/src/pages/Links.tsx` so the public `/links` page now (1) hides links with `visible === false`, (2) renders per-link icons from Lucide name, uploaded URL, or URL-heuristic fallback, (3) applies `linksPageConfig.theme` (primaryColor as a CSS var driving the ambient glow; backgroundColor/Gradient on root; backgroundImageUrl as a fixed layer behind the glow), and (4) fires `navigator.sendBeacon` to the click endpoint before every link navigation. This closes LINKS-14, LINKS-15, LINKS-16, LINKS-17 — the final four requirements of v1.3 Links Page Upgrade.

## Performance

- **Duration:** ~4 min
- **Started:** 2026-04-20T19:32:34Z
- **Completed:** 2026-04-20T19:36:41Z
- **Tasks:** 3 (all auto, no checkpoints)
- **Files modified:** 1 code file (`client/src/pages/Links.tsx`) + 3 planning docs in final metadata commit
- **Total line delta on Links.tsx:** +104 / -35 across three task commits; final file 207 lines (≤ 220 target, ≤ 300 CLAUDE.md cap).

## Accomplishments

- **Task 1 (LINKS-14 + LINKS-15):** Added `import * as LucideIcons from 'lucide-react'` namespace + `import type { LinksPageLink } from '@shared/schema'`. Added `renderLinkIcon(link)` helper that branches on `iconType`: `'lucide'` uses `(LucideIcons as any)[link.iconValue]` (falls back to `getLinkIcon` if name unknown), `'upload'` renders `<img src={iconValue}>`, `'auto'` / missing falls back to the existing URL-heuristic `getLinkIcon`. Replaced the `config.links.map` block with `[...config.links].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).filter((l) => l.visible !== false).map(...)`. Switched map key from `index` to `link.id ?? index`.

- **Task 2 (LINKS-16):** Added `import { DEFAULT_LINKS_PAGE_THEME } from '@shared/links'` + `import type { CSSProperties } from 'react'`. Computed `const theme = { ...DEFAULT_LINKS_PAGE_THEME, ...(config.theme ?? {}) }` and `const rootStyle: CSSProperties = { background: theme.backgroundGradient || theme.backgroundColor, ['--links-primary' as any]: theme.primaryColor }`. Rewrote the root `<div>` opening tag to drop the hardcoded `bg-[#0f1014]` Tailwind class and apply `style={rootStyle}` instead. Added an optional `backgroundImageUrl` layer as a fixed-inset `z-0` div behind the ambient glow. Replaced the first ambient-glow div's `bg-primary/20` with `bg-[var(--links-primary)]/20` so primaryColor drives the accent; added `z-[1]` to both glows for explicit stacking above the bg-image layer and below the `z-10` content column. Updated the loading-state div to use `style={{ background: DEFAULT_LINKS_PAGE_THEME.backgroundColor }}` instead of the hardcoded Tailwind class.

- **Task 3 (LINKS-17):** Added `trackLinkClick(linkId)` helper that guards against missing id, `typeof navigator !== 'undefined'`, `typeof navigator.sendBeacon === 'function'`, then fires `navigator.sendBeacon('/api/links-page/click/${encodeURIComponent(linkId)}')`; all wrapped in a try/empty-catch so analytics never blocks navigation. Wired `onClick={() => trackLinkClick(link.id)}` on the `<motion.a>` inside the sorted/filtered map. Did NOT preventDefault; did NOT filter on mouse button or modifier keys — all clicks (including cmd/ctrl/shift/middle-click that open a new tab) are counted. Social links intentionally not wired.

## Task Commits

| # | Hash | Subject | Files |
|---|------|---------|-------|
| 1 | `5c7c9db` | `feat(14-01-task-1): visible filter + per-link icon rendering on public /links` | client/src/pages/Links.tsx |
| 2 | `53aa325` | `feat(14-01-task-2): apply linksPageConfig.theme on public /links root` | client/src/pages/Links.tsx |
| 3 | `02f410b` | `feat(14-01-task-3): sendBeacon click tracking on public /links` | client/src/pages/Links.tsx |

Final docs metadata commit follows this SUMMARY (separate commit, captures REQUIREMENTS/ROADMAP/STATE flips + the SUMMARY.md itself).

## Files Modified

- `client/src/pages/Links.tsx` — 150 → 207 lines. Namespace import + LinksPageLink type import + DEFAULT_LINKS_PAGE_THEME/CSSProperties imports; new `renderLinkIcon` + `trackLinkClick` helpers; reworked loading div; computed theme + rootStyle; root div restructured (inline style + optional bg-image layer + themed ambient glow); motion.a in links map now carries `onClick` and `key={link.id ?? index}`; fallback seed links/socials gained `order` fields.

- `.planning/REQUIREMENTS.md` — LINKS-14, -15, -16, -17 all flipped to `[x]` in the main checklist; traceability rows for all four flipped from `Pending` → `Complete`.

- `.planning/ROADMAP.md` — Phase 14 progress row updated (0/1 → 1/1 plans); Phase 14 plan list flipped `[ ] 14-01-PLAN.md` → `[x]` (via `roadmap update-plan-progress 14`).

- `.planning/STATE.md` — Current Plan advanced; progress bar recalculated; Phase 14 decisions appended; session row added.

## Decisions Made

1. **Added `order` to fallback seed links/socials (Rule 3 deviation)** — The fallback `const config = settings?.linksPageConfig || { ... }` literal previously omitted `order` on seed links/socials. Task 1's sort expression `(a.order ?? 0) - (b.order ?? 0)` paired with the strict `LinksPageLink` / `LinksPageSocial` types (both require `order: number`) caused TS2339/TS2345 errors. Fixed inline by adding sequential `order: 0..N-1` to both arrays in the fallback literal — zero runtime impact (the fallback only fires when `settings?.linksPageConfig` is undefined, which only happens during the initial `isLoading` → data transition race in SSR-less Vite).

2. **Spread before sort** — `.sort()` mutates in place; `config.links` is a reference from the React Query cache. `[...config.links].sort(...).filter(...).map(...)` ensures the cache is never mutated.

3. **`key={link.id ?? index}`** — Prefers the normalizer-stamped UUID for stable reconciliation across reorders and visibility toggles; index fallback handles the hardcoded-seed-data case where ids are absent.

4. **CSS var over Tailwind theme extend** — Exposing `--links-primary` via inline style and consuming it via `bg-[var(--links-primary)]/20` means no `tailwind.config` edit is needed and the color updates live from the admin without a rebuild.

5. **Track every click regardless of modifier** — sendBeacon is fire-and-forget; a user cmd-clicking to open in a new tab is still a click. No modifier-key inspection, no preventDefault.

6. **Social links not tracked** — LINKS-17 scope is explicitly per-link-row clicks, not social icon clicks. Honoring the requirement boundary.

7. **Loading div uses DEFAULT theme** — Theme isn't loaded yet when `isLoading` is true. Reading `DEFAULT_LINKS_PAGE_THEME.backgroundColor` is the only safe source for the loading state background.

8. **Explicit z-stacking** — bg-image `z-0`, ambient glows `z-[1]`, content column `z-10`. Prevents an admin-uploaded background image from ever covering the glows or avatar column.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Fallback seed data missing `order` field triggered TS2339/TS2345**

- **Found during:** Task 1 verification (`npx tsc --noEmit`).
- **Issue:** The hardcoded fallback `const config = settings?.linksPageConfig || { ... links: [{title, url}, ...], socialLinks: [{platform, url}, ...] }` literal does not include `order`. Once Task 1 added `.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))` and `renderLinkIcon(link: LinksPageLink)`, TypeScript's union-narrowing forced every element to satisfy both the real `LinksPageLink` shape and the fallback shape — the fallback shape lacked `order: number`.
- **Fix:** Added sequential `order: 0..N-1` to all four fallback links and all five fallback social rows. Zero runtime impact — fallback only fires when `settings?.linksPageConfig` is undefined during initial data load.
- **Why not Rule 4 (architectural):** Two-line literal edit, no schema/type change, no library swap.
- **Files modified:** `client/src/pages/Links.tsx` only.
- **Commit:** `5c7c9db` (rolled into Task 1's commit — the broken state was never committed standalone).

No other deviations. Rules 1, 2, and 4 did not trigger. No CLAUDE.md-driven adjustments needed (no new user-facing strings introduced — this is a display-only phase reading already-localized admin data).

## Authentication Gates

None. The public `/links` page and the `POST /api/links-page/click/:linkId` endpoint are both unauthenticated by design.

## Acceptance Summary

### Grep counts (final state of `client/src/pages/Links.tsx`)

| Pattern | Expected | Actual |
|---------|----------|--------|
| `visible !== false` | 1 | 1 ✓ |
| `renderLinkIcon(link)` | 1 | 1 ✓ |
| `(LucideIcons as any)[link.iconValue]` | 1 | 1 ✓ |
| `theme.backgroundImageUrl` | ≥ 2 | 2 ✓ (conditional check + inline style) |
| `bg-[var(--links-primary)]/20` | ≥ 1 | 2 ✓ (code line + explanatory comment) |
| `navigator.sendBeacon` | ≥ 1 | 2 ✓ (typeof guard + call) |
| `onClick={() => trackLinkClick` | 1 | 1 ✓ |
| `motion.a` | 2 | 2 ✓ (opening + closing tags) |
| `config.socialLinks.map` | 1 | 1 ✓ |
| `<Avatar` | 3 | 3 ✓ (Avatar + AvatarImage + AvatarFallback) |
| `preventDefault` | 0 | 0 ✓ |
| `className="min-h-screen bg-[#0f1014]` on main root | 0 | 0 ✓ |
| `bg-primary/20 rounded-full blur-[120px]` | 0 | 0 ✓ |
| File length | ≤ 220 | 207 ✓ |

### Build gates

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` after Task 1 | EXIT 0 ✓ |
| `npx tsc --noEmit` after Task 2 | EXIT 0 ✓ |
| `npx tsc --noEmit` after Task 3 | EXIT 0 ✓ |
| `npm run build` (Vite client + esbuild server) after Task 2 | ✓ built in 6.78s, `dist/index.cjs` 1.7 MB |
| `npm run build` after Task 3 | ✓ built; `dist/index.cjs` 1.7 MB |

## Manual Smoke (deferred to `/gsd:verify-work`)

1. Seed a link via admin at `/admin` → Links Page → add a link, set its icon via IconPicker (pick `Mail`), toggle visibility off, then back on.
2. Theme: set primaryColor to `#FFFF01` (brand yellow), set backgroundGradient to `linear-gradient(135deg, #1C53A3 0%, #0f1014 100%)`, upload a subtle background image.
3. Visit `/links` on a fresh incognito tab:
   - Background gradient visible; background image overlays behind glow; yellow glow in top-left corner.
   - Link row shows the `<Mail>` Lucide icon at left.
   - Hidden link (toggled off) does NOT appear.
4. Open DevTools → Network tab → filter `click`. Click the visible link — a `POST /api/links-page/click/<uuid>` fires as a Beacon request BEFORE the navigation completes. Status 204 expected. (If you click again within 60s same IP → 204 silent rate-limit.)
5. Return to admin, reload, and the click-count Badge on that link row should have incremented by 1.
6. Switch the link's icon to Upload mode with a custom PNG → public page renders `<img>` in place of the Lucide icon on next reload.
7. Switch to Auto mode → public page falls back to `getLinkIcon(url)` URL heuristic (Globe / Mail / ExternalLink by URL pattern).
8. Cmd/ctrl/middle-click a link (opens in new tab) → Network tab still shows the Beacon POST firing for that click — verifies open-in-new-tab counts too.

## Downstream Enablement

**v1.3 milestone is now feature-complete.** All 17 requirements (LINKS-01 … LINKS-17) delivered. Ready for:

1. `/gsd:verify-work` — run the manual smoke matrix above + all prior phases' deferred smokes; exercise the admin → public data round-trip end-to-end.
2. `/gsd:retrospective` — capture v1.3 learnings (lazy-backfill + normalizer pattern, CSS-var-driven theming, sendBeacon fire-and-forget analytics, parallel Phase 13 plans coordination).
3. `/gsd:new-milestone` — v1.4 planning can now begin on a clean v1.3 base.

No phase 15+ exists for v1.3. This SUMMARY is the final execute-plan artifact of the milestone.

## Known Stubs

None. The public `/links` page consumes every field it's contracted to consume:
- Real `visible` filter (not hardcoded)
- Real per-link icon rendering for all three `iconType` branches (not mock)
- Real theme application — primaryColor, backgroundColor, backgroundGradient, backgroundImageUrl all consumed
- Real `navigator.sendBeacon` call wired to the live Phase 11 endpoint

No "coming soon" placeholders, no mock data sources, no unwired props. The only lingering hardcoded constant is the second ambient glow's `bg-blue-600/10` tint — this is an intentional fixed secondary accent per the plan's Task 2 note ("Kept the second glow's blue tint — it's a fixed secondary accent, not themable in v1.3.").

---
*Phase: 14-public-rendering-click-tracking*
*Plan: 01*
*Completed: 2026-04-20*

## Self-Check: PASSED

- FOUND: `.planning/phases/14-public-rendering-click-tracking/14-01-SUMMARY.md`
- FOUND: `client/src/pages/Links.tsx` (207 lines)
- FOUND: commit `5c7c9db` — feat(14-01-task-1) visible filter + per-link icon rendering
- FOUND: commit `53aa325` — feat(14-01-task-2) theme application
- FOUND: commit `02f410b` — feat(14-01-task-3) sendBeacon click tracking
- VERIFIED: `npx tsc --noEmit` EXIT=0 after each task commit
- VERIFIED: `npm run build` succeeds (Vite ✓ 6.78s, esbuild ✓ `dist/index.cjs` 1.7 MB)
- VERIFIED: all 14 grep acceptance patterns matched expected counts (positive AND "must NOT match" patterns)
