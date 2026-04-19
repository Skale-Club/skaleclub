# Phase 9: Public Viewer - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-19
**Phase:** 09-public-viewer
**Areas discussed:** Viewer visual treatment, Access code gate, View tracking in admin, Section navigation

---

## Viewer Visual Treatment

| Option | Description | Selected |
|--------|-------------|----------|
| Dark immersive | `bg-zinc-950`, subtle gradient per section, consistent dark theme | ✓ |
| Light/clean | White or light-gray background, card sections | |
| Brand gradient | Vibrant colored gradients per service | |

**User's choice:** Dark immersive (accepted recommended option via "All good, create context")
**Notes:** No per-service color variations — consistent dark treatment across all sections.

---

## Access Code Gate

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal centered form | Logo + heading + input + submit, inline error on wrong code | ✓ |
| Branded overlay | Full-screen overlay with more visual treatment | |
| Toast on error | Show toast notification for wrong code | |

**User's choice:** Minimal centered form (accepted recommended option)
**Notes:** access_code stored as plain text (NOT bcrypt) — codes are simple like "20260419" or "9134", need to be readable for GHL automation.

---

## View Tracking in Admin

| Option | Description | Selected |
|--------|-------------|----------|
| Inline badges | "👁 N" count + "last seen X days ago" in the list row | ✓ |
| Separate column | Dedicated table columns for Views and Last Seen | |
| Hover tooltip | Show view details only on hover | |

**User's choice:** Inline badges (accepted recommended option)
**Notes:** Requires updating EstimatesSection.tsx (Phase 8 component). API must return viewCount + lastViewedAt.

---

## Section Navigation

| Option | Description | Selected |
|--------|-------------|----------|
| Navigation dots (right side) | Fixed dots, one per section, click to jump | ✓ |
| Arrow buttons | Previous/next arrow overlays | |
| Pure scroll only | No navigation UI — touch/scroll only | |

**User's choice:** Navigation dots on right side (accepted recommended option)
**Notes:** Primary nav is native scroll-snap. Dots are secondary click targets.

---

## Claude's Discretion

- Exact gradient CSS per section
- Dot size and active state styling
- Framer-motion animation specifics
- Loading spinner while data fetches
- Optional "Powered by Skale Club" footer in viewer

## Deferred Ideas

None surfaced during discussion.
