# Phase 25: Services Carousel Polish - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `25-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-04-28
**Phase:** 25-services-carousel-polish
**Areas discussed:** Modal architecture, Edge fade technique, Auto-scroll while modal open, Click-vs-drag detection
**Mode:** Interactive (areas 1-2), Auto (areas 3-4 — auto-mode activated mid-discussion)

---

## Modal Architecture

### Question 1: Should ServiceDetailModal be migrated to the shadcn Dialog primitive, or kept as a custom overlay with surgical fixes?

| Option | Description | Selected |
|--------|-------------|----------|
| Migrate to shadcn Dialog (Recommended) | Replace ServiceDetailModal internals with Dialog/DialogContent. Get scroll lock, ESC-to-close, outside-click-to-close, focus trap, ARIA, animations for free. Refactor cost: ~1 file, preserves all visible UI. | ✓ |
| Keep custom, add fixes manually | Add useEffect for body scroll lock + ESC handler + focus management to the existing custom overlay. Smaller diff, but reinvents what Radix already gives you. | |
| Custom overlay + extract a useScrollLock hook | Stay custom but extract the scroll-lock logic into a reusable hook (also usable by future modals). LeadFormModal could later adopt the same hook. | |

**User's choice:** Migrate to shadcn Dialog
**Notes:** Foundational decision — affects close-behavior implementation, scroll lock approach, and a11y posture for the rest of the phase.

### Question 2 (multi-select): Which close behaviors must work?

| Option | Description | Selected |
|--------|-------------|----------|
| Click outside backdrop | Already works in custom; Dialog does too. Default expectation. | ✓ |
| ESC key | Currently missing in custom modal. Free with shadcn Dialog. | ✓ |
| X button (top-right) | Already present. Keep. | ✓ |
| Browser back button on mobile | Push history state on open, listen for popstate. Adds complexity — only worth it if users complain. | ✓ |

**User's choice:** All four
**Notes:** Browser back-button support adds ~10 lines (push/pop history sentinel) but matches mobile-heavy traffic expectations.

### Continuation question

**Asked:** "More questions about Modal architecture, or move to Edge fade?"
**User's choice:** Move to Edge fade

---

## Edge Fade Technique

### Question 1: Which technique should we use for the carousel edge fade?

| Option | Description | Selected |
|--------|-------------|----------|
| CSS mask-image on the track (Recommended) | Modern, content-aware. The cards themselves fade to transparent at the edges — the section gradient stays untouched. No more color matching. | ✓ |
| Fix the gradient overlay (no via-) | Cheapest fix. Remove the duplicated `via-` and match each side to the section's actual bg color. Edges fade properly but it's still an overlay rectangle covering content. | |
| No fade — let cards clip at edges | Remove the overlay entirely. Cards just stop at the viewport edge with no visual softening. Simplest but loses the 'infinite scroll feel'. | |

**User's choice:** CSS mask-image on the track
**Notes:** Wins because the section background is itself a gradient (`from-[#f7f9fc] via-white to-[#eaf1ff]`), so flat-color overlay divs would never match cleanly on both sides. Mask-image bypasses the color-matching problem entirely.

### Question 2: How wide should the fade be at desktop breakpoints?

| Option | Description | Selected |
|--------|-------------|----------|
| Subtle (~5% / ~64px) | Just a hint of fade. Users barely notice it but the hard edge is gone. | |
| Moderate (~8% / ~96px) (Recommended) | Clearly visible fade, content peeks through on the way in/out. Standard 'infinite carousel' feel. | ✓ |
| Strong (~12% / ~140px) | Pronounced cinematic fade. Half a card width visible in faded state. | |

**User's choice:** Moderate (~8%)

---

## Auto-Scroll While Modal Open  *(auto-resolved)*

| Option | Description | Selected |
|--------|-------------|----------|
| Pause auto-scroll on open, resume on close (Recommended) | Continuous motion behind a dim backdrop is distracting; pausing matches industry convention (Apple/Stripe modals). | ✓ |
| Keep auto-scrolling under the backdrop | Visual continuity, but slightly distracting. | |
| Reset to start position on close | Unnecessary state churn. | |

**Auto-selected:** Pause on open, resume on close.
**Reasoning:** Best UX, lowest implementation cost (reuses existing `isPausedRef` infrastructure), and avoids motion-sickness edge cases.

---

## Click-vs-Drag Detection  *(auto-resolved)*

### Q1: How to distinguish click from drag?

| Option | Description | Selected |
|--------|-------------|----------|
| Distance threshold 5px before pointer-capture (Recommended) | Native click fires below threshold; drag activates only after intentional movement. Matches `@dnd-kit activationConstraint` precedent (Phase 12-03). | ✓ |
| Time threshold (touch-and-release < 200ms = click) | Less reliable on slow taps (older users, accessibility). | |
| Combination of both | Over-engineered for this case. | |

**Auto-selected:** Distance threshold 5px.
**Reasoning:** Industry standard, consistent with existing `@dnd-kit` usage at distance: 6, simplest fix.

### Q2: Touch devices — same threshold?

| Option | Description | Selected |
|--------|-------------|----------|
| Same 5px (Recommended) | Forgiving without making drag feel sticky. | ✓ |
| Larger threshold (10-15px) for touch | Touch motion is naturally bigger; could reduce false drags. | |

**Auto-selected:** Same 5px for both.

---

## Claude's Discretion

- Exact Tailwind composition for the masked track (`[mask-image:...]` arbitrary value vs. inline `style`).
- Whether to extract a `useModalHistory` hook for the back-button logic or inline it.
- Naming of the new pause prop on `ServicesCarousel` (`paused` vs. `controlledPaused`).

## Deferred Ideas

- Carousel arrow controls (defer to future Carousel UX phase).
- Modal deep-link / share URL (defer — needs URL state coordination).
- Reusable `useScrollLock` hook (defer until 3rd modal needs it).
