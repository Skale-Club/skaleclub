# Plan 25-01 Summary

**Status:** Complete
**Date:** 2026-04-29
**Commit:** `1c723f6`

## What changed

`client/src/components/home/ServicesCarousel.tsx` only.

### Tasks delivered

1. **Scaffolding** — added `DRAG_THRESHOLD = 5`, `FADE_MASK` linear-gradient constant, `pendingDownRef`, and the new `paused?: boolean` prop on `ServicesCarouselProps`.
2. **External pause wiring** — `isPausedRef.current = isPaused || (paused ?? false)` with dependency `paused` added; momentum frame is cancelled when external pause flips on.
3. **Click-vs-drag threshold** — `handleStart` no longer pauses scroll, no longer captures pointer, no longer flips `isDown=true` or `setIsDragging(true)`. Drag activates only when `handleMove` sees movement past 5px.
4. **Edge fade** — deleted both `pointer-events-none` overlay divs at the top of the desktop track; applied `style={{ maskImage: FADE_MASK, WebkitMaskImage: FADE_MASK }}` to the track div.

## Verification

- `npm run check` exits 0
- `grep -c "pointer-events-none absolute" ServicesCarousel.tsx` → 0
- `grep -c "maskImage: FADE_MASK" ServicesCarousel.tsx` → 1
- `grep -c "DRAG_THRESHOLD" ServicesCarousel.tsx` → 2 (declaration + usage)
- Mobile branch (`isMobile=true`) untouched

## Manual UAT pending

Browser-based verification deferred — requires running dev server and clicking cards on the homepage. Visual UAT items:
- Edge fade is smooth (no hard white blocks)
- Tap on card with no drag → click reaches `PortfolioCard.onClick`
- Drag past 5px → existing scroll/momentum behavior unchanged

Plan 25-02 is the consumer of the `paused` prop and completes the modal-open scenario.
