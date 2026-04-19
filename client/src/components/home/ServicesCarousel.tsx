import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useMediaQuery } from '@/hooks/useMediaQuery';

interface ServicesCarouselProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  ariaLabel: string;
}

export function ServicesCarousel<T>({ items, renderItem, ariaLabel }: ServicesCarouselProps<T>) {
  const isMobile = useMediaQuery('(max-width: 767px)');

  const desktopLoop = useMemo(() => [...items, ...items], [items]);

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

  useEffect(() => {
    if (isMobile) return;
    isPausedRef.current = isPaused;
  }, [isPaused, isMobile]);

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
    if (isMobile) return;
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
        wrapScrollPosition(track);
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

    const handleStart = (e: PointerEvent | TouchEvent) => {
      pauseAutoScroll();

      if (momentumFrameRef.current) {
        cancelAnimationFrame(momentumFrameRef.current);
        momentumFrameRef.current = null;
      }

      const clientX = getClientX(e);
      velocityRef.current = 0;
      setIsDragging(true);
      dragStateRef.current = {
        isDown: true,
        startX: clientX,
        startScroll: track.scrollLeft,
      };
      lastMoveXRef.current = clientX;
      lastMoveTimeRef.current = Date.now();

      if ('pointerId' in e) {
        track.setPointerCapture?.(e.pointerId);
      }
    };

    const handleMove = (e: PointerEvent | TouchEvent) => {
      if (!dragStateRef.current.isDown) return;

      if (('touches' in e && e.cancelable) || ('pointerType' in e && e.pointerType === 'touch')) {
        e.preventDefault();
      }

      const clientX = getClientX(e);
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
      if (dragStateRef.current.isDown) {
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

  return (
    <div
      className="relative w-screen left-1/2 -translate-x-1/2 px-4 sm:px-6 md:px-10"
      onMouseEnter={isMobile ? undefined : () => setIsPaused(true)}
      onMouseLeave={isMobile ? undefined : () => setIsPaused(false)}
      aria-label={ariaLabel}
    >
      {isMobile ? (
        <div className="flex flex-col items-center gap-6">
          {items.map((item, idx) => renderItem(item, idx))}
        </div>
      ) : (
        <>
          <div className="pointer-events-none absolute left-0 top-0 h-full w-12 sm:w-16 bg-gradient-to-r from-[#f7f9fc] via-[#f7f9fc] to-transparent z-10" />
          <div className="pointer-events-none absolute right-0 top-0 h-full w-12 sm:w-16 bg-gradient-to-l from-[#f7f9fc] via-[#f7f9fc] to-transparent z-10" />
          <div
            ref={trackRef}
            className={`flex gap-6 md:gap-7 xl:gap-8 overflow-x-scroll overflow-y-visible no-scrollbar pt-2 pb-10 select-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
          >
            {desktopLoop.map((item, idx) => renderItem(item, idx))}
          </div>
        </>
      )}
    </div>
  );
}
