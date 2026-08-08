import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useMediaQuery } from '@/hooks/useMediaQuery';

const DRAG_THRESHOLD = 5;
const MOBILE_SCROLL_GAP = 24; // matches the track's gap-6 on mobile
const FADE_MASK = 'linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)';

interface ServicesCarouselProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  ariaLabel: string;
  paused?: boolean;
  dark?: boolean;
  /** Desktop auto-scroll speed in px/frame. Vary per instance so stacked
   *  carousels on the same page don't move in visible lockstep. */
  speed?: number;
}

function getFirstRealItem(track: HTMLElement): HTMLElement | undefined {
  return Array.from(track.children).find(
    (child) => !(child as HTMLElement).dataset.carouselSpacer
  ) as HTMLElement | undefined;
}

export function ServicesCarousel<T>({ items, renderItem, ariaLabel, paused, dark = true, speed = 0.6 }: ServicesCarouselProps<T>) {
  // Matches the `tablet` breakpoint (770px) used everywhere else — below it,
  // the carousel gets the touch/snap/arrows treatment; at and above it, the
  // continuous auto-scroll treatment.
  const isMobile = useMediaQuery('(max-width: 769px)');

  const desktopLoop = useMemo(() => [...items, ...items], [items]);
  // Three copies (not two): the mobile track needs a full real-item buffer on
  // BOTH sides of whatever's currently visible, not just ahead of it, since
  // the user can swipe either direction. Start parked at the middle copy
  // (see the layout effect below) so both directions always have real
  // content to reveal, then silently snap back by one copy's width whenever
  // the user scrolls into the leading or trailing copy — because the three
  // copies are pixel-identical, that jump is invisible.
  const mobileLoop = useMemo(() => (items.length ? [...items, ...items, ...items] : []), [items]);

  const [isPaused, setIsPaused] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const isPausedRef = useRef(isPaused);
  const resumeTimerRef = useRef<number | null>(null);
  const dragStateRef = useRef<{ isDown: boolean; startX: number; startScroll: number }>({
    isDown: false,
    startX: 0,
    startScroll: 0,
  });
  const velocityRef = useRef<number>(0);
  const lastMoveTimeRef = useRef<number>(0);
  const lastMoveXRef = useRef<number>(0);
  const momentumFrameRef = useRef<number | null>(null);
  const pendingDownRef = useRef<{ x: number; y: number; pointerId: number | null } | null>(null);

  useEffect(() => {
    if (isMobile) return;
    isPausedRef.current = isPaused || (paused ?? false);
    if (paused && momentumFrameRef.current !== null) {
      cancelAnimationFrame(momentumFrameRef.current);
      momentumFrameRef.current = null;
    }
  }, [isPaused, paused, isMobile]);

  const wrapScrollPosition = (track: HTMLDivElement) => {
    const maxScroll = track.scrollWidth / 2;
    if (track.scrollLeft >= maxScroll) {
      track.scrollLeft -= maxScroll;
    } else if (track.scrollLeft < 0) {
      track.scrollLeft += maxScroll;
    }
  };

  useEffect(() => {
    if (isMobile) return;
    const track = trackRef.current;
    if (!track) return;
    let animationFrame: number;
    // scrollLeft assignments snap to physical pixels (on DPR-1 displays,
    // `x + 0.42` rounds back to `x`, freezing the carousel), so fractional
    // speeds must be accumulated here and applied in whole pixels.
    let remainder = 0;

    const step = () => {
      if (!isPausedRef.current && track.scrollWidth > track.clientWidth) {
        remainder += speed;
        const px = Math.floor(remainder);
        if (px >= 1) {
          remainder -= px;
          track.scrollLeft += px;
          wrapScrollPosition(track);
        }
      }
      animationFrame = requestAnimationFrame(step);
    };

    animationFrame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animationFrame);
  }, [isMobile, desktopLoop.length, speed]);

  // Park the mobile track at the start of the middle copy before first
  // paint, so there's a full copy of real items to reveal in either swipe
  // direction right from the start (no dedicated edge-spacer needed — the
  // loop itself keeps every card centerable).
  useLayoutEffect(() => {
    if (!isMobile) return;
    const track = trackRef.current;
    if (!track) return;
    track.scrollLeft = track.scrollWidth / 3;
  }, [isMobile, mobileLoop.length]);

  // Once scrolling settles (drag, momentum, or an arrow click), silently
  // snap back into the middle copy if the user has wandered into the
  // leading or trailing copy — invisible, since all three copies are
  // pixel-identical, so this reads as an infinite loop in both directions.
  useEffect(() => {
    if (!isMobile) return;
    const track = trackRef.current;
    if (!track) return;
    let settleTimer: number | null = null;

    const wrapIfNeeded = () => {
      const third = track.scrollWidth / 3;
      if (third <= 0) return;
      // A viewport-width safety margin from the true edges, not the exact
      // 1/3 and 2/3 boundaries — CSS scroll-snap nudges the settled position
      // to the nearest card, which can land a few px on either side of an
      // exact third and would otherwise trigger a spurious wrap right after
      // the initial parked position settles.
      const margin = track.clientWidth;
      if (track.scrollLeft <= margin) {
        track.scrollLeft += third;
      } else if (track.scrollLeft >= track.scrollWidth - margin) {
        track.scrollLeft -= third;
      }
    };

    const handleScroll = () => {
      if (settleTimer) window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(wrapIfNeeded, 150);
    };

    track.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      track.removeEventListener('scroll', handleScroll);
      if (settleTimer) window.clearTimeout(settleTimer);
    };
  }, [isMobile, mobileLoop.length]);

  // Avoid getting stuck paused on touch devices (e.g., missed touchend)
  useEffect(() => {
    if (isMobile || !isPaused || dragStateRef.current.isDown) return;

    const resumeFallback = window.setTimeout(() => {
      setIsPaused(false);
    }, 1500);

    return () => window.clearTimeout(resumeFallback);
  }, [isPaused, isMobile]);

  const pauseAutoScroll = () => {
    setIsPaused(true);
    if (resumeTimerRef.current) {
      window.clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = null;
    }
  };

  const resumeAutoScroll = (delayMs = 800) => {
    if (resumeTimerRef.current) {
      window.clearTimeout(resumeTimerRef.current);
    }
    resumeTimerRef.current = window.setTimeout(() => {
      setIsPaused(false);
      resumeTimerRef.current = null;
    }, delayMs);
  };

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const supportsPointerEvents = typeof window !== 'undefined' && 'PointerEvent' in window;

    const applyMomentum = () => {
      const track = trackRef.current;
      if (!track) return;

      const friction = 0.92;
      velocityRef.current *= friction;

      if (Math.abs(velocityRef.current) > 0.3) {
        track.scrollLeft -= velocityRef.current;
        if (!isMobile) wrapScrollPosition(track);
        momentumFrameRef.current = requestAnimationFrame(applyMomentum);
      } else {
        velocityRef.current = 0;
        if (momentumFrameRef.current) {
          cancelAnimationFrame(momentumFrameRef.current);
          momentumFrameRef.current = null;
        }
        resumeAutoScroll(1200);
      }
    };

    const getClientX = (e: PointerEvent | TouchEvent): number => {
      if ('touches' in e) {
        return e.touches[0]?.clientX ?? 0;
      }
      return e.clientX;
    };

    const getClientY = (e: PointerEvent | TouchEvent): number => {
      if ('touches' in e) {
        return e.touches[0]?.clientY ?? 0;
      }
      return e.clientY;
    };

    const handleStart = (e: PointerEvent | TouchEvent) => {
      if (momentumFrameRef.current) {
        cancelAnimationFrame(momentumFrameRef.current);
        momentumFrameRef.current = null;
      }

      const clientX = getClientX(e);
      velocityRef.current = 0;

      dragStateRef.current = {
        isDown: false,
        startX: clientX,
        startScroll: track.scrollLeft,
      };
      pendingDownRef.current = {
        x: clientX,
        y: getClientY(e),
        pointerId: 'pointerId' in e ? e.pointerId : null,
      };
      lastMoveXRef.current = clientX;
      lastMoveTimeRef.current = Date.now();
    };

    const handleMove = (e: PointerEvent | TouchEvent) => {
      const clientX = getClientX(e);

      if (!dragStateRef.current.isDown) {
        if (!pendingDownRef.current) return;
        const dx = clientX - pendingDownRef.current.x;
        const dy = getClientY(e) - pendingDownRef.current.y;
        if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) {
          return;
        }
        if (Math.abs(dy) > Math.abs(dx)) {
          // Vertical intent (e.g. a finger swipe to scroll the page) — leave
          // this gesture to the browser instead of hijacking it.
          pendingDownRef.current = null;
          return;
        }
        // Crossed threshold with horizontal intent: NOW activate drag.
        pauseAutoScroll();
        setIsDragging(true);
        dragStateRef.current.isDown = true;
        if (pendingDownRef.current.pointerId !== null) {
          track.setPointerCapture?.(pendingDownRef.current.pointerId);
        }
      }

      if (('touches' in e && e.cancelable) || ('pointerType' in e && e.pointerType === 'touch')) {
        e.preventDefault();
      }

      const now = Date.now();
      const timeDelta = now - lastMoveTimeRef.current;
      const diff = clientX - dragStateRef.current.startX;

      if (timeDelta > 0) {
        const moveDelta = clientX - lastMoveXRef.current;
        velocityRef.current = moveDelta / Math.max(timeDelta, 1) * 10;
      }

      track.scrollLeft = dragStateRef.current.startScroll - diff;

      lastMoveXRef.current = clientX;
      lastMoveTimeRef.current = now;
    };

    const handleEnd = (e: PointerEvent | TouchEvent) => {
      const wasActiveDrag = dragStateRef.current.isDown;
      pendingDownRef.current = null;

      if (!wasActiveDrag) {
        return;
      }

      dragStateRef.current.isDown = false;

      if ('pointerId' in e) {
        track.releasePointerCapture?.(e.pointerId);
      }

      setIsDragging(false);

      if (Math.abs(velocityRef.current) > 1) {
        applyMomentum();
      } else {
        resumeAutoScroll(800);
      }
    };

    if (supportsPointerEvents) {
      track.addEventListener('pointerdown', handleStart);
      track.addEventListener('pointermove', handleMove);
      track.addEventListener('pointerup', handleEnd);
      track.addEventListener('pointerleave', handleEnd);
      track.addEventListener('pointercancel', handleEnd);
    } else {
      track.addEventListener('touchstart', handleStart, { passive: false });
      track.addEventListener('touchmove', handleMove, { passive: false });
      track.addEventListener('touchend', handleEnd);
      track.addEventListener('touchcancel', handleEnd);
    }

    return () => {
      if (supportsPointerEvents) {
        track.removeEventListener('pointerdown', handleStart);
        track.removeEventListener('pointermove', handleMove);
        track.removeEventListener('pointerup', handleEnd);
        track.removeEventListener('pointerleave', handleEnd);
        track.removeEventListener('pointercancel', handleEnd);
      } else {
        track.removeEventListener('touchstart', handleStart);
        track.removeEventListener('touchmove', handleMove);
        track.removeEventListener('touchend', handleEnd);
        track.removeEventListener('touchcancel', handleEnd);
      }

      if (momentumFrameRef.current) {
        cancelAnimationFrame(momentumFrameRef.current);
      }
    };
  }, [isMobile]);

  // Memoized so carousel-local state flips (isDragging/isPaused, or a parent
  // re-render with a stable renderItem) don't re-render every card in the
  // 2x/3x loop — that render cascade is what blocked the main thread on tap
  // (INP). Parents must pass a stable (useCallback) renderItem for this to
  // take effect.
  const renderedItems = useMemo(
    () => (isMobile ? mobileLoop : desktopLoop).map((item, idx) => renderItem(item, idx)),
    [isMobile, mobileLoop, desktopLoop, renderItem]
  );

  const scrollByCard = (direction: 1 | -1) => {
    const track = trackRef.current;
    if (!track) return;
    const firstReal = getFirstRealItem(track);
    const amount = firstReal ? firstReal.offsetWidth + MOBILE_SCROLL_GAP : track.clientWidth * 0.85;
    track.scrollBy({ left: direction * amount, behavior: 'smooth' });
  };

  const arrowButtonClass = `absolute top-1/2 -translate-y-1/2 -mt-4 z-10 flex h-10 w-10 items-center justify-center rounded-full border transition-colors ${
    dark
      ? 'border-white/20 bg-white/10 text-white hover:bg-white/20'
      : 'border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50'
  }`;

  return (
    <div
      className="relative w-screen left-1/2 -translate-x-1/2"
      onMouseEnter={isMobile ? undefined : () => setIsPaused(true)}
      onMouseLeave={isMobile ? undefined : () => setIsPaused(false)}
      aria-label={ariaLabel}
    >
      <div className="relative">
        <div
          ref={trackRef}
          style={{ maskImage: FADE_MASK, WebkitMaskImage: FADE_MASK }}
          className={`flex gap-6 md:gap-7 xl:gap-8 overflow-x-scroll overflow-y-visible no-scrollbar touch-pan-y pt-2 pb-[2.125rem] select-none [&>*]:snap-center ${
            isMobile ? (isDragging ? 'snap-none' : 'snap-x snap-mandatory') : 'snap-none'
          } ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        >
          {renderedItems}
        </div>

        {isMobile && (
          <>
            <button
              type="button"
              aria-label="Previous"
              onClick={() => scrollByCard(-1)}
              className={`${arrowButtonClass} left-1`}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              aria-label="Next"
              onClick={() => scrollByCard(1)}
              className={`${arrowButtonClass} right-1`}
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
