---
phase: 20-public-viewer
plan: 02
subsystem: client
tags: [react, typescript, framer-motion, wouter, presentations, public-viewer, bilingual, scroll-snap]

# Dependency graph
requires:
  - phase: 20-01
    provides: isPresentationRoute guard in App.tsx, /p/:slug route, POST verify-code endpoint, POST view endpoint, PT translations

provides:
  - Full PresentationViewer component at client/src/pages/PresentationViewer.tsx
  - All 8 SlideBlock layout renderers (cover, section-break, title-body, bullets, stats, two-column, image-focus, closing)
  - Bilingual language switcher via ?lang=pt-BR URL param (no scroll reset, replace:true)
  - AccessCodeGate calling POST /api/presentations/:id/verify-code
  - View tracking via useRef(false) guard — fires POST /api/presentations/:id/view exactly once after gate passes
  - IntersectionObserver-driven active navigation dot state
  - Outfit font via inline style on all headings (not font-display CSS var)

affects: [PRES-19, PRES-20, PRES-21, PRES-22]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - resolveField bilingual helper — pt||en||'' fallback chain; avoids non-null assertions on optional fields
    - image-focus zinc-800 graceful fallback — defers imageUrl schema extension to future phase
    - useRef(false) view-tracking guard — exact EstimateViewer pattern; fires once per page load regardless of re-renders
    - replace:true language switching — navigate without history stack push; prevents scroll reset

key-files:
  created:
    - client/src/pages/PresentationViewer.tsx (330 lines — full viewer replacing Plan 01 stub)
  modified: []

key-decisions:
  - "resolveField helper declared above SlideContent — avoids repetition across 8 layout cases; pt||en||'' fallback chain"
  - "image-focus renders zinc-800 solid background fallback — imageUrl not in slideBlockSchema; defers schema extension to avoid Phase 15+ migration scope"
  - "Outfit font via inline style={{ fontFamily }} not font-display CSS var — UI-SPEC notes --font-display is incorrectly set to Inter in index.css"
  - "AUTO_CFG=true — Task 3 (human-verify checkpoint) auto-approved per workflow.auto_advance setting"

requirements-completed: [PRES-19, PRES-20, PRES-21, PRES-22]

# Metrics
duration: ~2min
completed: 2026-04-22
---

# Phase 20 Plan 02: Public Viewer Component Summary

**Full PresentationViewer.tsx (330 lines) — 8 SlideBlock layout renderers, bilingual ?lang= switcher, AccessCodeGate, view tracking, scroll-snap + framer-motion — /p/:slug is now a complete bilingual presentation experience**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-22T04:04:55Z
- **Completed:** 2026-04-22T04:07:08Z
- **Tasks:** 2 automated + 1 auto-approved checkpoint
- **Files modified:** 1 (PresentationViewer.tsx — stub replaced with full 330-line component)

## Accomplishments

- Replaced Plan 01 stub (`return null`) with full `PresentationViewer` component
- All 8 SlideBlock layouts implemented in a `switch` inside `SlideContent`:
  - `cover` — centered display heading (text-5xl Outfit) + optional subheading
  - `section-break` — centered eyebrow + heading + optional body
  - `title-body` — left-aligned heading (text-3xl Outfit) + body
  - `bullets` — heading + `<ul>` with `–` dash separator, text-zinc-300 items
  - `stats` — `<dl>` grid-cols-2, stat numbers at text-5xl, bilingual labelPt fallback
  - `two-column` — grid-cols-2 gap-16, heading left / body right
  - `image-focus` — zinc-800 graceful fallback + heading/body in lower half
  - `closing` — centered Outfit heading + body
- Bilingual `resolveField` helper: `pt || en || ''` for all text fields
- `?lang=pt-BR` URL param drives language without page reload or scroll reset (`replace: true`)
- AccessCodeGate calls `POST /api/presentations/:id/verify-code` (UUID id)
- View tracking fires exactly once via `useRef(false)` guard after gate passes
- IntersectionObserver (threshold 0.5) drives active navigation dot state
- framer-motion `whileInView` entrance animation per slide (once: true)
- Scroll-snap container: `snap-y snap-mandatory overflow-y-scroll`
- Fixed nav dots (right sidebar) + language switcher (top-right, left of dots)
- All Outfit headings use `style={{ fontFamily: "'Outfit', sans-serif" }}` — not `font-display` CSS var

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Scaffold PresentationViewer — access gate, view tracking, nav, language switcher | 3b7c4be | client/src/pages/PresentationViewer.tsx |
| 2 | Implement all 8 SlideContent layout renderers | 8fe8818 | client/src/pages/PresentationViewer.tsx |
| 3 | Human-verify checkpoint | (auto-approved) | — |

## Files Created/Modified

- `client/src/pages/PresentationViewer.tsx` — Full viewer (330 lines); replaced Plan 01 stub

## Decisions Made

- `resolveField(en, pt, lang)` helper declared above `SlideContent` — avoids repetition across 8 layout cases; `pt || en || ''` fallback chain is safe for optional fields.
- `image-focus` uses `zinc-800` solid background as graceful fallback — `imageUrl` is not in `slideBlockSchema`. Adding it would be safe (`.optional()`), but deferred to keep Phase 20 scoped to PRES-19 through PRES-22 without schema migration risk.
- Outfit font via `style={{ fontFamily: "'Outfit', sans-serif" }}` on all heading elements — UI-SPEC explicitly notes that `--font-display` is incorrectly mapped to `Inter` in `index.css`.
- `AUTO_CFG=true` was active — Task 3 human-verify checkpoint auto-approved per `workflow.auto_advance` setting.

## Deviations from Plan

None — plan executed exactly as written. The checker warning in the plan frontmatter (about `isPresentationRoute` in `must_haves.artifacts`) was correctly handled: that guard lives in App.tsx (Plan 01), not in PresentationViewer.tsx. The acceptance criteria correctly verified its ABSENCE from PresentationViewer.tsx.

## Known Stubs

None — all 8 layout variants are implemented. The `image-focus` layout uses a `zinc-800` background placeholder (not a stub — it renders a complete non-blank fullscreen section as required by PRES-19; the zinc-800 is the intentional fallback per RESEARCH.md Pitfall 6 decision).

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- v1.4 Admin Presentations Page is feature-complete: PRES-17 through PRES-22 all delivered across Plans 20-01 and 20-02.
- Ready for `/gsd:verify-work` → manual browser verification of the full `/p/:slug` flow.

---
*Phase: 20-public-viewer*
*Completed: 2026-04-22*
