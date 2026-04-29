# Phase 25: Services Carousel Polish - Context

**Gathered:** 2026-04-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Polish the public homepage services carousel ([ServicesSection.tsx](../../../client/src/components/home/ServicesSection.tsx) in `services` mode) along three axes:

1. **Edge fade** — replace the hard white side blocks with a soft, content-aware fade so the auto-scroll loop reads as continuous and the section's own background gradient remains intact.
2. **Modal open-on-click** — restore the click-to-open behavior on `PortfolioCard`. Currently the carousel's `setPointerCapture` on `pointerdown` swallows the click before it reaches the card.
3. **Scroll lock while modal open** — when `ServiceDetailModal` is open, lock both vertical body scroll and the carousel's horizontal auto-scroll; release on close.

**Out of scope (do not expand here):**

- Redesigning the cards themselves (price layout, badges, image treatment).
- Adding carousel arrows / pagination dots.
- Multi-image gallery inside the modal.
- Mobile carousel rework — mobile already renders a vertical stack (no carousel), and the user reported no issue there. Touch-device tap-to-open must still work on mobile, but the carousel-specific fixes target the desktop path.

</domain>

<decisions>
## Implementation Decisions

### Modal Architecture

- **D-01:** Migrate `ServiceDetailModal` to the shadcn `Dialog` primitive ([client/src/components/ui/dialog.tsx](../../../client/src/components/ui/dialog.tsx), Radix-based). The current hand-rolled overlay is replaced. All visible UI (badge, title, price block, features list, CTA button, image column) is preserved — only the outer container, backdrop, and close button are swapped to `Dialog` / `DialogContent` / `DialogClose`.
- **D-02:** Close behaviors required (Radix gives the first three for free):
  - Click on backdrop (outside content) closes.
  - `ESC` key closes.
  - X button (top-right) closes.
  - **Browser back button on mobile closes.** Implementation: when modal opens, push a sentinel history entry (`history.pushState({ modal: 'service' }, '')`); when modal closes via any path, call `history.back()` if the sentinel is still on top, else no-op. Listen to `popstate` while open and treat it as a close signal. Net cost: ~10 lines in a small `useModalHistory` helper or inside the component itself.
- **D-03:** Focus management, animations, and ARIA roles inherit from Radix defaults. No custom `aria-*` plumbing needed.

### Scroll Lock

- **D-04:** Vertical body scroll lock is provided automatically by Radix Dialog (it sets `pointer-events: none` on the body and prevents scroll via inert attributes). No manual `document.body.style.overflow = 'hidden'` required (unlike the current `LeadFormModal.tsx:347-360` pattern).
- **D-05:** Horizontal carousel auto-scroll **pauses** while the modal is open and resumes on close. Implementation: `ServicesCarousel` accepts a new `paused` prop (boolean). `ServicesSection` passes `paused={isModalOpen}` so the existing `isPausedRef` gating in the rAF loop honors it. No new state machine — reuses the existing pause infrastructure.
- **D-06:** Pause behavior covers BOTH the rAF auto-scroll loop AND any in-flight momentum animation (cancel `momentumFrameRef` on open).

### Edge Fade

- **D-07:** Use **CSS `mask-image`** on the scrolling track itself, not overlay divs:
  ```css
  mask-image: linear-gradient(to right,
    transparent 0%,
    black 8%,
    black 92%,
    transparent 100%);
  -webkit-mask-image: same;
  ```
  Apply via Tailwind arbitrary values or a small inline `style`. The existing two overlay divs at [ServicesCarousel.tsx:238-239](../../../client/src/components/home/ServicesCarousel.tsx#L238-L239) are deleted entirely.
- **D-08:** Fade width: **~8% per side** (moderate). On a 1440px viewport ≈ 115px; on 1024px ≈ 82px. Cards visibly peek-through-fade as they enter and leave the viewport.
- **D-09:** Mobile (vertical stack) is unaffected — mask only applies in the desktop branch (`!isMobile`).

### Click-vs-Drag Detection

- **D-10:** Defer `setPointerCapture` until pointer movement exceeds **5px** from `pointerdown` origin. Below threshold, the native click reaches `PortfolioCard.onClick` normally. Above threshold, capture activates and drag/scroll proceeds as today.
- **D-11:** Same 5px threshold for both mouse and touch. Aligns with the project's existing `@dnd-kit` `activationConstraint: { distance: 6 }` ([Phase 12-03 prior decision](../../../.planning/STATE.md)) — close enough to be consistent without over-engineering.
- **D-12:** Velocity tracking and momentum scrolling remain unchanged. The threshold only gates `setPointerCapture` and the `dragStateRef.current.isDown = true` flip; once activated, all existing drag logic runs as today.

### Translations

- **D-13:** No new visible strings are introduced. The modal already uses `t()` on all text via existing keys. Migration to shadcn Dialog touches structural JSX, not copy.

### Claude's Discretion

- Exact Tailwind class composition for the masked track (whether to use `[mask-image:...]` arbitrary value vs. an inline `style={{ maskImage: ... }}`). Pick whichever reads cleaner.
- Whether to extract a tiny `useModalHistory` hook or inline the popstate logic in the modal — judge by line count and reuse potential.
- Whether the new `paused` prop on `ServicesCarousel` becomes `controlledPaused` or stays simple boolean — prefer the simpler API unless naming becomes ambiguous.

### Folded Todos

None — `gsd-tools todo match-phase 25` returned 0 matches.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Carousel & Modal Components (target files)

- `client/src/components/home/ServicesCarousel.tsx` — pointer/touch handlers, rAF auto-scroll, edge fade overlays. All three issues touch this file.
- `client/src/components/home/ServiceDetailModal.tsx` — current custom overlay; will be migrated to shadcn Dialog.
- `client/src/components/home/ServicesSection.tsx` — wires `isModalOpen` state; will pass `paused` prop down.
- `client/src/components/PortfolioCard.tsx` — receives `onClick`; verify nothing in the card swallows clicks (image already has `pointer-events-none`).

### Reusable Primitives

- `client/src/components/ui/dialog.tsx` — shadcn Dialog (Radix); used by 10+ admin sections. Source of D-01/D-02/D-04.
- `client/src/components/LeadFormModal.tsx:347-360` — reference for the *current* manual scroll-lock pattern (NOT used here, but useful to know existed).

### Project-Level

- `CLAUDE.md` — Brand colors, fonts, CTA style guidelines.
- `.planning/codebase/CONVENTIONS.md` — Naming + import order.
- `.planning/STATE.md` — Phase 12-03 prior decision on `@dnd-kit activationConstraint distance: 6` (relevant to D-11 threshold).

### User-Memory Constraints

- "No solid black/white borders — use --border token" — relevant to fade mask design (don't recreate hard edges).
- "Translation rule" — no new visible strings introduced (D-13).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **shadcn `Dialog` primitive** — handles portal, overlay, animations, body scroll lock, ESC, outside-click, focus trap, ARIA. Drop-in replacement for the custom overlay (D-01).
- **`isPausedRef` pause infrastructure** in `ServicesCarousel.tsx:33,52,75-91` — already gates the rAF loop. Reused by D-05 (just needs an external pause input).
- **`dragStateRef` + velocity/momentum machinery** at `ServicesCarousel.tsx:21-29,99-117` — kept as-is; only the *activation* of drag is gated by D-10.

### Established Patterns

- Custom overlays in this codebase manually lock body scroll via `document.body.style.overflow = 'hidden'` (LeadFormModal). Migrating to shadcn Dialog standardizes on Radix-managed lock instead — fewer foot-guns going forward.
- `@dnd-kit` `activationConstraint: { distance: 6 }` ([Phase 12-03 STATE](../../../.planning/STATE.md)) sets precedent for distance-threshold gating of drag/click — D-10/D-11 follow the same philosophy with 5px (close enough; consistency without bikeshedding).

### Integration Points

- `ServicesSection.tsx:53-92` — single source of `isModalOpen` state. Passes to both `<ServicesCarousel paused={isModalOpen}>` and `<ServiceDetailModal>`.
- `ServicesCarousel.tsx` desktop branch (`!isMobile`) only — mobile branch (lines 232-235) renders a vertical stack with no track ref, so mask + pointer changes are no-ops on mobile.

</code_context>

<specifics>
## Specific Ideas

- The visual goal of the edge fade is "infinite scroll feel" — half a card peeks in/out on each side rather than appearing/disappearing at a hard line.
- Browser back-button-to-close was explicitly requested for mobile traffic ergonomics; do not silently drop it.
- Pause behavior on modal open is one-way: opening pauses, closing resumes the rAF loop. No need to remember position — the loop is naturally circular.

</specifics>

<deferred>
## Deferred Ideas

- **Carousel arrow controls** — not requested; defer to a future "Carousel UX" phase if user behavior data shows users want explicit nav.
- **Modal share / deep-link to a specific service** — would require URL state coordination; defer.
- **`useScrollLock` reusable hook** — only worth extracting if a third modal needs it; for now Radix handles this in the new ServiceDetailModal and `LeadFormModal` keeps its existing manual lock.

### Reviewed Todos (not folded)

None — no pending todos matched Phase 25 scope.

</deferred>

---

*Phase: 25-services-carousel-polish*
*Context gathered: 2026-04-28*
