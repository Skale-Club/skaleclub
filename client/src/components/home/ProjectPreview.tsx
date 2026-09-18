import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { PortfolioService } from '@shared/schema';
import { getImageUrl } from '@/components/admin/shared/utils';
import { useTranslation } from '@/hooks/useTranslation';

const SLIDE_DURATION = 4500;

type PreviewState = {
  indexes: Record<number, number>;
  select: (id: number, index: number) => void;
  pause: (id: number, paused: boolean) => void;
};

const PreviewContext = createContext<PreviewState | null>(null);

/** One clock and selection per project, shared by the infinite carousel copies. */
export function ProjectPreviewProvider({ services, paused = false, children }: {
  services: PortfolioService[];
  paused?: boolean;
  children: ReactNode;
}) {
  const [indexes, setIndexes] = useState<Record<number, number>>({});
  const pauseCounts = useRef(new Map<number, number>());
  const deadlines = useRef(new Map<number, number>());
  const ids = useMemo(() => services
    .filter(service => service.homeImageUrl && service.dashboardImageUrl && service.homeImageUrl !== service.dashboardImageUrl)
    .map(service => service.id), [services]);

  const select = useCallback((id: number, index: number) => {
    deadlines.current.set(id, Date.now() + SLIDE_DURATION);
    setIndexes(previous => ({ ...previous, [id]: index }));
  }, []);

  const pause = useCallback((id: number, shouldPause: boolean) => {
    const count = pauseCounts.current.get(id) || 0;
    pauseCounts.current.set(id, Math.max(0, count + (shouldPause ? 1 : -1)));
    deadlines.current.set(id, Date.now() + SLIDE_DURATION);
  }, []);

  useEffect(() => {
    if (paused || ids.length === 0) return;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const resetDeadlines = () => ids.forEach(id => deadlines.current.set(id, Date.now() + SLIDE_DURATION));
    resetDeadlines();
    document.addEventListener('visibilitychange', resetDeadlines);
    motion.addEventListener('change', resetDeadlines);
    const timer = window.setInterval(() => {
      if (document.hidden || motion.matches) return;
      const now = Date.now();
      const advancing = ids.filter(id => !(pauseCounts.current.get(id) || 0)
        && now >= (deadlines.current.get(id) || 0));
      if (!advancing.length) return;
      advancing.forEach(id => deadlines.current.set(id, now + SLIDE_DURATION));
      setIndexes(previous => {
        const next = { ...previous };
        advancing.forEach(id => { next[id] = (previous[id] || 0) === 0 ? 1 : 0; });
        return next;
      });
    }, 250);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', resetDeadlines);
      motion.removeEventListener('change', resetDeadlines);
    };
  }, [ids, paused]);

  const value = useMemo(() => ({ indexes, select, pause }), [indexes, select, pause]);
  return <PreviewContext.Provider value={value}>{children}</PreviewContext.Provider>;
}

export function ProjectPreview({ service, fallback, className }: {
  service: PortfolioService;
  fallback: ReactNode;
  className: string;
}) {
  const state = useContext(PreviewContext);
  const { isEnglish } = useTranslation();
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [loaded, setLoaded] = useState<string[]>([]);
  const [failed, setFailed] = useState<string[]>([]);
  const slides = [
    { url: service.homeImageUrl, label: isEnglish ? 'Website home' : 'Home do site' },
    { url: service.dashboardImageUrl, label: 'Dashboard' },
  ].filter((slide, index, all) => slide.url && !failed.includes(slide.url)
    && all.findIndex(candidate => candidate.url === slide.url) === index) as { url: string; label: string }[];
  // Preserve old website cards until explicit previews are configured, without
  // classifying a legacy dashboard cover as a home (especially for print).
  if (!slides.length && service.imageUrl && !failed.includes(service.imageUrl)) {
    slides.push({ url: service.imageUrl, label: 'Preview' });
  }
  const index = slides.length > 1 ? (state?.indexes[service.id] || 0) : 0;
  // Keep the loaded home visible until the dashboard is ready.
  const visibleIndex = loaded.includes(slides[index]?.url) ? index : 0;
  const pause = state?.pause;

  useEffect(() => {
    if (!pause || !(hovered || focused)) return;
    pause(service.id, true);
    return () => pause(service.id, false);
  }, [pause, service.id, hovered, focused]);

  return (
    <div
      className={className}
      data-testid={`project-preview-${service.id}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
      }}
    >
      {slides.length ? slides.map((slide, slideIndex) => (
        <img
          key={slide.url}
          src={getImageUrl(slide.url, { width: 800, quality: 80 })}
          alt={`${service.title} — ${slide.label}`}
          aria-hidden={slideIndex !== visibleIndex}
          loading="lazy"
          decoding="async"
          draggable={false}
          onLoad={() => setLoaded(previous => previous.includes(slide.url) ? previous : [...previous, slide.url])}
          onError={() => setFailed(previous => previous.includes(slide.url) ? previous : [...previous, slide.url])}
          className={`absolute inset-0 h-full w-full object-cover object-center pointer-events-none transition-opacity duration-500 motion-reduce:transition-none ${slideIndex === visibleIndex ? 'opacity-100' : 'opacity-0'}`}
        />
      )) : fallback}
      {slides.length > 0 && (
        <span className="absolute top-2 left-2 rounded bg-black/70 px-2 py-1 text-[10px] font-medium text-white pointer-events-none">
          {slides[visibleIndex].label}
        </span>
      )}
      {slides.length > 1 && state && (
        <div className="absolute bottom-1 inset-x-0 flex justify-center" data-preview-controls>
          {slides.map((slide, slideIndex) => (
            <button
              key={slide.url}
              type="button"
              aria-label={`${isEnglish ? 'Show' : 'Mostrar'} ${slide.label} — ${service.title}`}
              aria-pressed={slideIndex === visibleIndex}
              data-testid={`project-preview-${service.id}-slide-${slideIndex}`}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-black/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
              onPointerDown={event => event.stopPropagation()}
              onKeyDown={event => event.stopPropagation()}
              onClick={event => {
                event.stopPropagation();
                state.select(service.id, slideIndex);
              }}
            >
              <span className={`h-1.5 rounded-full transition-all motion-reduce:transition-none ${slideIndex === visibleIndex ? 'w-4 bg-white' : 'w-1.5 bg-white/50'}`} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
