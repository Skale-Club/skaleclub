import type { MouseEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, CheckCircle2, Sparkles, X } from 'lucide-react';
import type { HomepageContent, PortfolioService } from '@shared/schema';
import { useTranslation } from '@/hooks/useTranslation';
import { useQuery } from '@tanstack/react-query';
import { PortfolioCard, badgeColorMap } from '@/components/PortfolioCard';

type Props = {
  section?: HomepageContent['consultingStepsSection'] | HomepageContent['horizontalScrollSection'] | null;
  mode?: 'steps' | 'services'; // Explicitly set mode
  onCtaClick?: () => void;
};

// Check color map for modal features
const checkColorMap: Record<string, string> = {
  blue: "text-blue-500",
  purple: "text-purple-400",
  green: "text-green-500",
  orange: "text-orange-500",
  red: "text-red-500",
};

// Service Detail Modal Component
function ServiceDetailModal({
  service,
  isOpen,
  onClose,
  onCta
}: {
  service: PortfolioService | null;
  isOpen: boolean;
  onClose: () => void;
  onCta: () => void;
}) {
  const { t } = useTranslation();

  if (!isOpen || !service) return null;

  const badgeColors = badgeColorMap[service.accentColor || 'blue'] || badgeColorMap.blue;
  const checkColor = checkColorMap[service.accentColor || 'blue'] || checkColorMap.blue;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Content */}
        <div className="p-8 md:p-12">
          <div className="flex flex-col md:flex-row gap-8">
            {/* Left Column - Text Content */}
            <div className="flex-1">
              {/* Badge */}
              <span className={`inline-block ${badgeColors.bg} ${badgeColors.text} text-xs font-bold px-3 py-1 rounded-full mb-4`}>
                {t(service.badgeText)}
              </span>

              {/* Title */}
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
                {t(service.title)}
              </h2>

              {/* Subtitle */}
              <p className="text-lg text-slate-600 mb-6">
                {t(service.subtitle)}
              </p>

              {/* Description */}
              <p className="text-slate-700 mb-8 leading-relaxed">
                {t(service.description)}
              </p>

              {/* Price Card */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 mb-8">
                <div className="flex items-baseline gap-2 mb-4 text-slate-900">
                  <span className="text-4xl font-extrabold">{service.price}</span>
                  <span className="text-slate-500 font-medium">{t(service.priceLabel)}</span>
                </div>
                <ul className="space-y-3">
                  {(service.features || []).map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle2 className={`w-5 h-5 ${checkColor} shrink-0 mt-0.5`} />
                      <span className="text-slate-700 font-medium">{t(item)}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* CTA Button */}
              <button
                onClick={() => {
                  onClose();
                  onCta();
                }}
                className="w-full px-8 py-4 bg-primary text-white font-bold rounded-full text-lg hover:shadow-lg hover:-translate-y-1 transition-all flex items-center justify-center gap-2"
              >
                {t(service.ctaText)}
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>

            {/* Right Column - Image */}
            {service.imageUrl && (
              <div className="flex-1 hidden md:block">
                <div className="aspect-square relative flex items-center justify-center bg-slate-100 border border-slate-200 rounded-3xl shadow-xl overflow-hidden">
                  <img
                    src={service.imageUrl}
                    alt={service.title}
                    className="w-[80%] h-[80%] object-cover rounded-2xl shadow-2xl"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const media = window.matchMedia(query);
    setMatches(media.matches);

    const listener = (event: MediaQueryListEvent) => setMatches(event.matches);
    media.addEventListener('change', listener);

    return () => {
      media.removeEventListener('change', listener);
    };
  }, [query]);

  return matches;
}

export function ServicesSection({ section, mode: explicitMode, onCtaClick }: Props) {
  const { t } = useTranslation();
  const isMobile = useMediaQuery('(max-width: 767px)');

  // Determine mode: explicit prop > section.mode > fallback to 'steps'
  const displayMode = explicitMode || (section as any)?.mode || 'steps';

  // Fetch portfolio services from database for services mode
  const { data: portfolioServices } = useQuery<PortfolioService[]>({
    queryKey: ['/api/portfolio-services'],
    staleTime: 60000, // Cache for 1 minute
  });

  // Modal state
  const [selectedService, setSelectedService] = useState<PortfolioService | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Support both old 'steps' structure and new 'cards' structure
  const rawItems = (section as any)?.cards || (section as any)?.steps || [];

  const sortedSteps = useMemo(() => {
    const items = rawItems.length ? [...rawItems] : [];
    return items
      .sort((a, b) => (a.order || 0) - (b.order || 0) || a.numberLabel.localeCompare(b.numberLabel))
      .map((item, index) => ({
        ...item,
        numberLabel: item.numberLabel || String(index + 1).padStart(2, '0'),
      }));
  }, [rawItems]);

  const stepsLoop = useMemo(() => [...sortedSteps, ...sortedSteps], [sortedSteps]);

  // For services mode, use portfolio services
  const servicesLoop = useMemo(() => {
    if (!portfolioServices) return [];
    return [...portfolioServices, ...portfolioServices];
  }, [portfolioServices]);

  const practicalBullets = section?.practicalBullets?.length ? section.practicalBullets : [];
  const ctaLabel = section?.ctaButtonLabel || '';
  const ctaHref = section?.ctaButtonLink || '#lead-form';
  const helperText = section?.helperText;
  const tagLabel = section?.tagLabel || 'Consulting';
  const sectionId = section?.sectionId || 'how-it-works';
  const practicalTitle = section?.practicalBlockTitle || '';
  const stepLabel = section?.stepLabel || '';
  const whatWeDoLabel = section?.whatWeDoLabel || '';
  const outcomeLabel = section?.outcomeLabel || '';
  const practicalBlockSubtitle = section?.practicalBlockSubtitle || '';
  const nextStepLabel = section?.nextStepLabel || '';
  const nextStepText = section?.nextStepText || '';

  const [isPaused, setIsPaused] = useState(false);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<{ isDown: boolean; startX: number; startScroll: number }>({
    isDown: false,
    startX: 0,
    startScroll: 0,
  });
  const isPausedRef = useRef(isPaused);
  const resumeTimerRef = useRef<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const velocityRef = useRef<number>(0);
  const lastMoveTimeRef = useRef<number>(0);
  const lastMoveXRef = useRef<number>(0);
  const momentumFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (isMobile) return;
    isPausedRef.current = isPaused;
  }, [isPaused, isMobile]);

  // Helper to wrap scroll position for infinite loop
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
  }, [isMobile, stepsLoop.length, servicesLoop.length]);

  // Avoid getting stuck paused on touch devices (e.g., missed touchend)
  useEffect(() => {
    if (isMobile || !isPaused || dragStateRef.current.isDown) return;

    const resumeFallback = window.setTimeout(() => {
      setIsPaused(false);
    }, 1500);

    return () => window.clearTimeout(resumeFallback);
  }, [isPaused, isMobile]);

  // Helpers to pause/resume auto-scroll when user interacts
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

  // Drag to scroll with momentum (supports both mouse and touch)
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

  if (!section || section.enabled === false) return null;

  const handleCta = (event: MouseEvent<HTMLAnchorElement>) => {
    if (onCtaClick) {
      event.preventDefault();
      onCtaClick();
    }
  };

  const openServiceModal = (service: PortfolioService) => {
    setSelectedService(service);
    setIsModalOpen(true);
  };

  // Render service card using the shared PortfolioCard component
  const renderServiceCard = (service: PortfolioService, index: number) => {
    return (
      <div
        key={`service-${service.id}-${index}`}
        className="flex-shrink-0 w-full sm:w-[70%] md:w-[52%] lg:w-[36%] xl:w-[30%]"
      >
        <PortfolioCard
          service={service}
          variant="light"
          onClick={() => openServiceModal(service)}
        />
      </div>
    );
  };

  // Render step card (for steps mode - keeping original functionality)
  const renderStep = (step: any, index: number) => {
    const numberLabel = step.numberLabel || String(index + 1).padStart(2, '0');

    // Render for steps mode (default)
    return (
      <div
        key={`${numberLabel}-${step.title}-${index}`}
        className="group relative overflow-visible rounded-3xl bg-white/90 border border-slate-100 shadow-[0_24px_60px_-60px_rgba(15,23,42,0.45)] hover:-translate-y-2 hover:shadow-[0_28px_70px_-55px_rgba(23,37,84,0.4)] transition-all duration-300 backdrop-blur flex-shrink-0 w-full md:w-[88%] sm:w-[70%] md:w-[52%] lg:w-[36%] xl:w-[30%]"
      >
        <div className="absolute right-4 top-3 text-6xl font-black text-slate-100/80 pointer-events-none">
          {numberLabel}
        </div>
        <div className="relative z-10 p-6 space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 min-w-12 flex-shrink-0 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                <Sparkles className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500 font-semibold">{t(stepLabel)} {numberLabel}</p>
                <h3 className="text-xl font-bold text-slate-900 leading-tight">{t(step.title)}</h3>
              </div>
            </div>
          </div>
          <div className="space-y-5 pt-1">
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{t(whatWeDoLabel)}</p>
              <p className="text-slate-700 leading-relaxed">{t(step.whatWeDo)}</p>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-primary uppercase tracking-wider">{t(outcomeLabel)}</p>
              <p className="text-slate-900 leading-relaxed font-medium">{t(step.outcome)}</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Light background for services mode (original theme)
  if (displayMode === 'services') {
    const items = servicesLoop.length > 0 ? servicesLoop : [];

    if (items.length === 0) return null;

    return (
      <>
        <section
          id={sectionId}
          className="relative pt-0 pb-14 md:pb-16 bg-gradient-to-br from-[#f7f9fc] via-white to-[#eaf1ff] overflow-hidden"
        >
          {/* Background decorations */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute w-80 h-80 bg-primary/5 blur-3xl -left-20 top-0 rounded-full" />
            <div className="absolute w-[420px] h-[420px] bg-indigo-200/30 blur-3xl right-[-10%] bottom-[-20%] rounded-full" />
          </div>

          <div className="relative z-10 pt-64 sm:pt-[22rem] md:pt-48 lg:pt-24 space-y-6 md:space-y-8 pb-4 md:pb-8">
            <div className="container-custom mx-auto px-4 sm:px-6 md:px-10">
              <div className="max-w-4xl space-y-3">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/70 border border-slate-200 rounded-full shadow-sm text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  <span>{t(tagLabel)}</span>
                </div>
                <h2 className="text-3xl md:text-4xl font-bold text-slate-900 leading-tight">
                  {t(section?.title || '')}
                </h2>
                {section?.subtitle && (
                  <p className="text-lg md:text-xl text-slate-600 leading-relaxed">
                    {t(section.subtitle)}
                  </p>
                )}
              </div>
            </div>

            <div
              className="relative w-screen left-1/2 -translate-x-1/2 px-4 sm:px-6 md:px-10"
              onMouseEnter={isMobile ? undefined : () => setIsPaused(true)}
              onMouseLeave={isMobile ? undefined : () => setIsPaused(false)}
              aria-label="Services carousel"
            >
              {isMobile ? (
                <div className="flex flex-col items-center gap-6">
                  {(portfolioServices || []).map((service, idx) => renderServiceCard(service, idx))}
                </div>
              ) : (
                <>
                  <div className="pointer-events-none absolute left-0 top-0 h-full w-12 sm:w-16 bg-gradient-to-r from-[#f7f9fc] via-[#f7f9fc] to-transparent z-10" />
                  <div className="pointer-events-none absolute right-0 top-0 h-full w-12 sm:w-16 bg-gradient-to-l from-[#f7f9fc] via-[#f7f9fc] to-transparent z-10" />
                  <div
                    ref={trackRef}
                    className={`flex gap-6 md:gap-7 xl:gap-8 overflow-x-scroll overflow-y-visible no-scrollbar pt-2 pb-10 select-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                  >
                    {items.map((service, idx) => renderServiceCard(service, idx))}
                  </div>
                </>
              )}
            </div>

            <div className="container-custom mx-auto px-4 sm:px-6 md:px-10 grid gap-6 lg:grid-cols-[2fr_1fr] items-stretch -mt-6 md:-mt-10">
              <div className="rounded-3xl bg-white/90 border border-slate-100 shadow-[0_24px_70px_-50px_rgba(15,23,42,0.45)] px-8 py-8 space-y-4 h-full">
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 min-w-[44px] flex-shrink-0 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-lg font-bold text-slate-900">{t(practicalTitle)}</p>
                    <p className="text-sm text-slate-500">{t(practicalBlockSubtitle)}</p>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  {practicalBullets.map((bullet, idx) => (
                    <div
                      key={`${bullet}-${idx}`}
                      className="p-4 rounded-2xl bg-slate-50/90 border border-slate-100 shadow-sm"
                    >
                      <p className="text-sm text-slate-700 leading-relaxed">{t(bullet)}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl bg-white/95 border border-slate-100 shadow-[0_24px_70px_-50px_rgba(15,23,42,0.45)] px-8 py-8 flex flex-col gap-4 justify-center h-full">
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-slate-700 uppercase tracking-[0.12em]">{t(nextStepLabel)}</p>
                  <p className="text-xl font-bold text-slate-900 leading-tight">{t(nextStepText)}</p>
                </div>
                <a
                  href={ctaHref}
                  onClick={handleCta}
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-[#406EF1] hover:bg-[#355CD0] text-white font-semibold shadow-lg shadow-blue-500/20 transition-all hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#406EF1] whitespace-nowrap"
                  data-form-trigger="lead-form"
                >
                  {t(ctaLabel)}
                  <ArrowRight className="w-4 h-4 flex-shrink-0" />
                </a>
                {helperText && <p className="text-sm text-slate-600 leading-relaxed">{t(helperText)}</p>}
              </div>
            </div>
          </div>
        </section>

        {/* Service Detail Modal */}
        <ServiceDetailModal
          service={selectedService}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onCta={() => {
            if (onCtaClick) {
              onCtaClick();
            }
          }}
        />
      </>
    );
  }

  // Steps mode (default) - original light theme
  if (sortedSteps.length === 0) return null;

  return (
    <section
      id={sectionId}
      className="relative pt-0 pb-14 md:pb-16 bg-gradient-to-br from-[#f7f9fc] via-white to-[#eaf1ff] overflow-hidden"
    >
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute w-80 h-80 bg-primary/5 blur-3xl -left-20 top-0 rounded-full" />
        <div className="absolute w-[420px] h-[420px] bg-indigo-200/30 blur-3xl right-[-10%] bottom-[-20%] rounded-full" />
      </div>
      {/* Heavy top padding on mobile to guard against the absolute absolute overlay half (-translate-y-1/2) */}
      <div className="relative z-10 pt-64 sm:pt-[22rem] md:pt-48 lg:pt-24 space-y-6 md:space-y-8 pb-4 md:pb-8">
        <div className="container-custom mx-auto px-4 sm:px-6 md:px-10">
          <div className="max-w-4xl space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/70 border border-slate-200 rounded-full shadow-sm text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span>{t(tagLabel)}</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 leading-tight">
              {t(section?.title || '')}
            </h2>
            {section?.subtitle && (
              <p className="text-lg md:text-xl text-slate-600 leading-relaxed">
                {t(section.subtitle)}
              </p>
            )}
          </div>
        </div>

        <div
          className="relative w-screen left-1/2 -translate-x-1/2 px-4 sm:px-6 md:px-10"
          onMouseEnter={isMobile ? undefined : () => setIsPaused(true)}
          onMouseLeave={isMobile ? undefined : () => setIsPaused(false)}
          aria-label="Consulting steps"
        >
          {isMobile ? (
            <div className="flex flex-col items-center gap-6">
              {sortedSteps.map(renderStep)}
            </div>
          ) : (
            <>
              <div className="pointer-events-none absolute left-0 top-0 h-full w-12 sm:w-16 bg-gradient-to-r from-[#f7f9fc] via-[#f7f9fc] to-transparent z-10" />
              <div className="pointer-events-none absolute right-0 top-0 h-full w-12 sm:w-16 bg-gradient-to-l from-[#f7f9fc] via-[#f7f9fc] to-transparent z-10" />
              <div
                ref={trackRef}
                className={`flex gap-6 md:gap-7 xl:gap-8 overflow-x-scroll overflow-y-visible no-scrollbar pt-2 pb-10 select-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
              >
                {stepsLoop.map(renderStep)}
              </div>
            </>
          )}
        </div>

        <div className="container-custom mx-auto px-4 sm:px-6 md:px-10 grid gap-6 lg:grid-cols-[2fr_1fr] items-stretch -mt-6 md:-mt-10">
          <div className="rounded-3xl bg-white/90 border border-slate-100 shadow-[0_24px_70px_-50px_rgba(15,23,42,0.45)] px-8 py-8 space-y-4 h-full">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 min-w-[44px] flex-shrink-0 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <p className="text-lg font-bold text-slate-900">{t(practicalTitle)}</p>
                <p className="text-sm text-slate-500">{t(practicalBlockSubtitle)}</p>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {practicalBullets.map((bullet, idx) => (
                <div
                  key={`${bullet}-${idx}`}
                  className="p-4 rounded-2xl bg-slate-50/90 border border-slate-100 shadow-sm"
                >
                  <p className="text-sm text-slate-700 leading-relaxed">{t(bullet)}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl bg-white/95 border border-slate-100 shadow-[0_24px_70px_-50px_rgba(15,23,42,0.45)] px-8 py-8 flex flex-col gap-4 justify-center h-full">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-700 uppercase tracking-[0.12em]">{t(nextStepLabel)}</p>
              <p className="text-xl font-bold text-slate-900 leading-tight">{t(nextStepText)}</p>
            </div>
            <a
              href={ctaHref}
              onClick={handleCta}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-[#406EF1] hover:bg-[#355CD0] text-white font-semibold shadow-lg shadow-blue-500/20 transition-all hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#406EF1] whitespace-nowrap"
              data-form-trigger="lead-form"
            >
              {t(ctaLabel)}
              <ArrowRight className="w-4 h-4 flex-shrink-0" />
            </a>
            {helperText && <p className="text-sm text-slate-600 leading-relaxed">{t(helperText)}</p>}
          </div>
        </div>
      </div>
    </section>
  );
}
