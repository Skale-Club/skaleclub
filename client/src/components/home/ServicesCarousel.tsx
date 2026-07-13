import { useEffect, useMemo, useRef, useState } from 'react';
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
}

function getFirstRealItem(track: HTMLElement): HTMLElement | undefined {
  return Array.from(track.children).find(
    (child) => !(child as HTMLElement).dataset.carouselSpacer
  ) as HTMLElement | undefined;
}

export function ServicesCarousel<T>({ items, renderItem, ariaLabel, paused, dark = true }: ServicesCarouselProps<T>) {
  const isMobile = useMediaQuery('(max-width: 767px)');

  const desktopLoop = useMemo(() => [...items, ...items], [items]);

  const [isPaused, setIsPaused] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [edgeSpacer, setEdgeSpacer] = useState(0);
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
    const speed = 0.6;

    const step = () => {
      if (!isPausedRef.current && track.scrollWidth > track.clientWidth) {
        track.scrollLeft += speed;
        wrapScrollPosition(track);
      }
      animationFrame = requestAnimationFrame(step);
    };

    animationFrame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animationFrame);
  }, [isMobile, desktopLoop.length]);

  // Pad both ends of the mobile track so the first/last card can reach the
  // center of the viewport, matching how snap-centering works for the rest.
  useEffect(() => {
    if (!isMobile) {
      setEdgeSpacer(0);
      return;
    }
    const track = trackRef.current;
    if (!track) return;

    const measure = () => {
      const firstReal = getFirstRealItem(track);
      if (!firstReal) return;
      setEdgeSpacer(Math.max(0, (track.clientWidth - firstReal.offsetWidth) / 2));
    };

    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [isMobile, items.length]);

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
      className="relative w-screen left-1/2 -translate-x-1/2 px-4 sm:px-6 md:px-10"
      onMouseEnter={isMobile ? undefined : () => setIsPaused(true)}
      onMouseLeave={isMobile ? undefined : () => setIsPaused(false)}
      aria-label={ariaLabel}
    >
      <div className="relative">
        <div
          ref={trackRef}
          style={{ maskImage: FADE_MASK, WebkitMaskImage: FADE_MASK }}
          className={`flex gap-6 md:gap-7 xl:gap-8 overflow-x-scroll overflow-y-visible no-scrollbar touch-pan-y pt-2 pb-10 select-none [&>*]:snap-center ${
            isMobile ? (isDragging ? 'snap-none' : 'snap-x snap-mandatory') : 'snap-none'
          } ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        >
          {isMobile && edgeSpacer > 0 && (
            <div aria-hidden="true" data-carousel-spacer="true" style={{ width: edgeSpacer, flexShrink: 0, scrollSnapAlign: 'none' }} />
          )}
          {(isMobile ? items : desktopLoop).map((item, idx) => renderItem(item, idx))}
          {isMobile && edgeSpacer > 0 && (
            <div aria-hidden="true" data-carousel-spacer="true" style={{ width: edgeSpacer, flexShrink: 0, scrollSnapAlign: 'none' }} />
          )}
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
