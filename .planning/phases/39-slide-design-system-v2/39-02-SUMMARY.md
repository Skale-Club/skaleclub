---
phase: 39-slide-design-system-v2
plan: 02
subsystem: client,api
tags: [presentations, viewer, layouts, style, anthropic-tool]

# Dependency graph
requires:
  - 39-01
provides:
  - PresentationViewer renders all 12 layout variants (image-left, image-right, full-bleed-image, quote added)
  - buildSlideStyle helper applies bgColor/textColor/bgImageUrl to motion.div slide wrapper via inline CSS
  - alignmentStyle helper applies text-align and flex alignment to content containers
  - Background video rendering with autoplay/muted/loop + onError hide fallback
  - UPDATE_SLIDES_TOOL with all 12 layout values in enum and style object with 6 fields
  - buildSystemPrompt instructs AI on new layout semantics and style object usage
affects:
  - /p/:slug public presentation viewer (all 4 new layouts now renderable)
  - Admin chat editor (AI can now generate slides with rich visual properties)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "buildSlideStyle: converts SlideBlock.style to React.CSSProperties for inline style application"
    - "alignmentStyle: maps 'left'|'center'|'right' enum to textAlign + alignItems CSS properties"
    - "Absolute inset-0 layout pattern: image-left, image-right, full-bleed-image escape max-w-5xl wrapper by positioning absolutely relative to outer container"
    - "bgVideoUrl video element pattern: autoPlay muted loop playsInline + onError display:none fallback"
    - "Hand-written JSON schema extension: static UPDATE_SLIDES_TOOL updated manually (zod-to-json-schema not installed)"

key-files:
  created: []
  modified:
    - client/src/pages/PresentationViewer.tsx
    - server/routes/presentationsChat.ts

key-decisions:
  - "React default import added (not named) to support React.CSSProperties type annotation in buildSlideStyle and alignmentStyle helpers"
  - "full-bleed-image uses buildSlideStyle on the motion.div wrapper (not inline on the layout div) — bgImageUrl set there covers the full slide background; scrim and content overlay added inside the case"
  - "image-left/image-right/image-focus apply bgImageUrl directly on the image panel div — separate from buildSlideStyle which applies to the outer wrapper to avoid double application"
  - "quote case uses block scope { } to allow const attribution declaration without TypeScript case-scoping errors"
  - "bgVideoUrl video element inserted as first child in slide area div — renders behind gradient overlay and AnimatePresence motion.div"

# Metrics
duration: ~2.5min
completed: 2026-05-15
---

# Phase 39 Plan 02: Slide Design System v2 — Viewer & Tool Sync Summary

**PresentationViewer updated with 4 new layout cases (image-left, image-right, full-bleed-image, quote), buildSlideStyle/alignmentStyle helpers, and bgVideoUrl video rendering; UPDATE_SLIDES_TOOL and buildSystemPrompt synced to expose all 12 layouts and style object to the AI**

## Performance

- **Duration:** ~2.5 min
- **Started:** 2026-05-15T23:48:41Z
- **Completed:** 2026-05-15T23:51:09Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

### Task 1: PresentationViewer.tsx
- Added `buildSlideStyle` helper: converts `SlideBlock.style` to `React.CSSProperties` — applies textColor, bgColor (when no bgImageUrl), and bgImageUrl+bgSize+bgPosition
- Added `alignmentStyle` helper: maps alignment enum to `textAlign` + `alignItems` CSS properties for content containers
- Updated `image-focus` case: image panel now renders `style.bgImageUrl` as background-image; headingColor and alignment applied
- Added `image-left` layout: ~40% image panel (left) + ~60% text panel (right) with bgImageUrl, headingColor, alignment support
- Added `image-right` layout: ~60% text panel (left) + ~40% image panel (right) with bgImageUrl, headingColor, alignment support
- Added `full-bleed-image` layout: bgImageUrl applied via `buildSlideStyle` on motion.div wrapper + dark scrim (`bg-black/30`) + text overlay
- Added `quote` layout: large centered pull-quote from `heading` field with `&ldquo;&rdquo;` marks, optional `attribution/attributionPt` below
- Added bgVideoUrl video element: `autoPlay muted loop playsInline` + `onError` display:none fallback, inserted before gradient div
- Applied `buildSlideStyle(currentSlide.style)` to motion.div wrapper as `style` prop
- Added `React` default import to support `React.CSSProperties` type annotation

### Task 2: presentationsChat.ts
- Extended `layout` enum in UPDATE_SLIDES_TOOL from 8 to 12 values: adds `image-left`, `image-right`, `full-bleed-image`, `quote`
- Added `attribution` and `attributionPt` string properties to the slide item schema
- Added `style` object property with 6 fields: `bgColor`, `textColor`, `headingColor`, `alignment` (enum), `bgImageUrl`, `bgVideoUrl`
- Updated `buildSystemPrompt` to list all 12 layouts in the layout field instruction
- Added semantic descriptions of the 4 new layouts to the system prompt
- Added style object usage instructions (bgColor, textColor, headingColor, alignment, bgImageUrl, bgVideoUrl)
- Added attribution/attributionPt usage instruction for quote layout

## Task Commits

Each task was committed atomically:

1. **Task 1: Update PresentationViewer — style rendering, new layouts, video background** - `b6876b1` (feat)
2. **Task 2: Sync UPDATE_SLIDES_TOOL and buildSystemPrompt** - `bdb9226` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `client/src/pages/PresentationViewer.tsx` — 128 insertions, 4 deletions; 4 new layout cases, 2 helper functions, video background, style prop on motion.div
- `server/routes/presentationsChat.ts` — 18 insertions, 2 deletions; extended layout enum, added style/attribution schema, updated system prompt

## Decisions Made

- React default import added (not named) to support `React.CSSProperties` type annotation in helper functions — consistent with TypeScript strict mode project
- `full-bleed-image` applies bgImageUrl via `buildSlideStyle` on the motion.div wrapper, not on the layout div — this achieves full-slide background coverage; the layout case only adds the dark scrim and content overlay
- `image-left`, `image-right`, `image-focus` apply bgImageUrl directly on the image panel div via inline style — separate from `buildSlideStyle` to avoid applying the image twice (once on wrapper, once on panel)
- `quote` case block-scoped with `{ }` to allow `const attribution` declaration without TypeScript's case fall-through scoping errors
- bgVideoUrl video element placed before the gradient div as first child of slide area — renders at z-0, behind the gradient (z implicit), behind the motion.div (z-10)
- No `additionalProperties: false` added to UPDATE_SLIDES_TOOL style object — follows existing schema style (none of the existing properties use it)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness

- PRES2-03 satisfied: `PresentationViewer.tsx` renders all 4 new layouts and all 6 style visual properties
- PRES2-04 satisfied: `UPDATE_SLIDES_TOOL` exposes all 12 layouts, style object with 6 fields, and attribution pair; `buildSystemPrompt` instructs AI on new capabilities
- Phase 39 plans 2/2 complete — all requirements PRES2-01 through PRES2-04 delivered
- Manual browser QA recommended: load existing presentation (backward compat check), then inject test slide via localStorage `?edit` mode with `layout: "image-left"` and `style.bgImageUrl` set to a public image URL

---
*Phase: 39-slide-design-system-v2*
*Completed: 2026-05-15*
