# Phase 39: Slide Design System v2 — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-15
**Phase:** 39-slide-design-system-v2
**Areas discussed:** Philosophy, Color model, Image/video handling, Visual properties, New layouts

---

## Philosophy

| Option | Description | Selected |
|--------|-------------|----------|
| PowerPoint-like editor | Manual controls for everything | |
| AI-only design | No manual UI — AI sets visual properties | ✓ |

**User's choice:** "You have to consider that everything will be done through AI — it's not a PowerPoint-type tool where I have the power to change everything, but the AI needs the ability to make necessary changes to produce an organized and beautiful presentation."

---

## Image & Video Handling

| Option | Description | Selected |
|--------|-------------|----------|
| URL only | AI sets public image URL | ✓ |
| Upload + AI references | Admin uploads first, AI references | |
| AI generates prompts | imagePrompt field, no actual images | |
| Skip media for Phase 39 | Focus on colors/alignment only | |

**User's choice:** URL only (confirmed recommended option)

---

## Visual Properties

| Option | Description | Selected |
|--------|-------------|----------|
| Background color/gradient | AI sets per-slide background | ✓ |
| Text color | AI sets heading/body colors | ✓ |
| Content alignment | AI sets left/center/right | ✓ |
| Background image/video URL | AI sets full-slide bg media | ✓ |

**User's choice:** All 4 visual properties — "do recommended, but it's important that the AI uses a coherent color system with our branding."

---

## New Layout Variants

| Option | Description | Selected |
|--------|-------------|----------|
| image-left / image-right | Split image+text layouts | ✓ (Claude's choice) |
| full-bleed-image | Full-screen bg image + text overlay | ✓ (Claude's choice) |
| quote | Large pull-quote with attribution | ✓ (Claude's choice) |
| Keep 8 existing only | No new layouts | |

**User's choice:** "Do what you think is best based on the scope." → Claude selected all 3 new layout variants.

---

## Claude's Discretion

- New layout selection (image-left, image-right, full-bleed-image, quote) — user deferred to Claude
- CSS gradient syntax, exact responsive proportions, precise Tailwind classes for new layouts
- Whether style.bgImageUrl or a top-level imageUrl field is used (Claude chose style sub-object for consistency)

## Deferred Ideas

- Manual visual editor (explicitly out of scope per user)
- Image upload within slides (URL-only decided)
- AI image generation (future milestone)
