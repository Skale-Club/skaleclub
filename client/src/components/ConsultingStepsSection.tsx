import type { ComponentType, MouseEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, CheckCircle2, LayoutGrid, LineChart, PhoneCall, Search, Sparkles, Target } from 'lucide-react';
import type { HomepageContent } from '@shared/schema';

type Props = {
  section?: HomepageContent['consultingStepsSection'] | null;
  onCtaClick?: () => void;
};

const iconMap: Record<string, ComponentType<{ className?: string }>> = {
  search: Search,
  sparkles: Sparkles,
  layout: LayoutGrid,
  layoutgrid: LayoutGrid,
  target: Target,
  phonecall: PhoneCall,
  phone: PhoneCall,
  linechart: LineChart,
  chart: LineChart,
};

function getStepIcon(icon?: string) {
  const key = (icon || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return iconMap[key] || Sparkles;
}

export function ConsultingStepsSection({ section, onCtaClick }: Props) {
  if (!section || section.enabled === false) return null;

  const sortedSteps = useMemo(() => {
    const steps = (section.steps || []).length ? [...(section.steps || [])] : [];
    return steps
      .sort((a, b) => (a.order || 0) - (b.order || 0) || a.numberLabel.localeCompare(b.numberLabel))
      .map((step, index) => ({
        ...step,
        numberLabel: step.numberLabel || String(index + 1).padStart(2, '0'),
      }));
  }, [section.steps]);

  if (sortedSteps.length === 0) return null;

  const stepsLoop = useMemo(() => [...sortedSteps, ...sortedSteps], [sortedSteps]);
  const practicalBullets = section.practicalBullets?.length ? section.practicalBullets : [];
  const ctaLabel = section.ctaButtonLabel || 'Agendar Conversa Gratuita';
  const ctaHref = section.ctaButtonLink || '#lead-quiz';
  const helperText = section.helperText;
  const sectionId = section.sectionId || 'como-funciona';
  const practicalTitle = section.practicalBlockTitle || 'Na prática';
  const [isPaused, setIsPaused] = useState(false);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<{ isDown: boolean; startX: number; startScroll: number }>({
    isDown: false,
    startX: 0,
    startScroll: 0,
  });
  const resumeTimerRef = useRef<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let animationFrame: number;
    const speed = 0.6;

    const step = () => {
      if (!isPaused) {
        track.scrollLeft += speed;
        const maxScroll = track.scrollWidth / 2;
        if (track.scrollLeft >= maxScroll) {
          track.scrollLeft -= maxScroll;
        }
      }
      animationFrame = requestAnimationFrame(step);
    };

    animationFrame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animationFrame);
  }, [isPaused, stepsLoop.length]);

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

  // Drag to scroll
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const handlePointerDown = (e: PointerEvent) => {
      pauseAutoScroll();
      setIsDragging(true);
      dragStateRef.current = {
        isDown: true,
        startX: e.clientX,
        startScroll: track.scrollLeft,
      };
      track.setPointerCapture?.(e.pointerId);
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!dragStateRef.current.isDown) return;
      e.preventDefault();
      const diff = e.clientX - dragStateRef.current.startX;
      track.scrollLeft = dragStateRef.current.startScroll - diff;
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (dragStateRef.current.isDown) {
        dragStateRef.current.isDown = false;
        track.releasePointerCapture?.(e.pointerId);
        resumeAutoScroll();
        setIsDragging(false);
      }
    };

    track.addEventListener('pointerdown', handlePointerDown);
    track.addEventListener('pointermove', handlePointerMove);
    track.addEventListener('pointerup', handlePointerUp);
    track.addEventListener('pointerleave', handlePointerUp);

    return () => {
      track.removeEventListener('pointerdown', handlePointerDown);
      track.removeEventListener('pointermove', handlePointerMove);
      track.removeEventListener('pointerup', handlePointerUp);
      track.removeEventListener('pointerleave', handlePointerUp);
    };
  }, []);

  const handleCta = (event: MouseEvent<HTMLAnchorElement>) => {
    if (onCtaClick) {
      event.preventDefault();
      onCtaClick();
    }
  };

  return (
    <section
      id={sectionId}
      className="relative py-14 md:py-16 bg-gradient-to-br from-[#f7f9fc] via-white to-[#eaf1ff] overflow-hidden"
    >
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute w-80 h-80 bg-primary/5 blur-3xl -left-20 top-0 rounded-full" />
        <div className="absolute w-[420px] h-[420px] bg-indigo-200/30 blur-3xl right-[-10%] bottom-[-20%] rounded-full" />
      </div>
      <div className="relative z-10 space-y-6 md:space-y-8 pb-4 md:pb-8">
        <div className="container-custom mx-auto px-4 sm:px-6 md:px-10">
          <div className="max-w-4xl space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/70 border border-slate-200 rounded-full shadow-sm text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span>Consultoria</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 leading-tight">
              {section.title || 'Como Funciona a Consultoria'}
            </h2>
            {section.subtitle && (
              <p className="text-lg md:text-xl text-slate-600 leading-relaxed">
                {section.subtitle}
              </p>
            )}
          </div>
        </div>

        <div
          className="relative w-screen left-1/2 -translate-x-1/2 px-4 sm:px-6 md:px-10 overflow-hidden"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          aria-label="Etapas da consultoria em carrossel"
        >
          <div className="pointer-events-none absolute left-0 top-0 h-full w-12 sm:w-16 bg-gradient-to-r from-[#f7f9fc] via-[#f7f9fc] to-transparent z-10" />
          <div className="pointer-events-none absolute right-0 top-0 h-full w-12 sm:w-16 bg-gradient-to-l from-[#f7f9fc] via-[#f7f9fc] to-transparent z-10" />
          <div
            ref={trackRef}
            className={`flex gap-6 md:gap-7 xl:gap-8 overflow-x-scroll overflow-y-visible no-scrollbar scroll-smooth pt-2 pb-10 select-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
          >
            {stepsLoop.map((step, index) => {
              const Icon = getStepIcon(step.icon);
              const numberLabel = step.numberLabel || String(index + 1).padStart(2, '0');
              return (
                <div
                  key={`${numberLabel}-${step.title}-${index}`}
                  className="group relative overflow-visible rounded-3xl bg-white/90 border border-slate-100 shadow-[0_24px_60px_-60px_rgba(15,23,42,0.45)] hover:-translate-y-2 hover:shadow-[0_28px_70px_-55px_rgba(23,37,84,0.4)] transition-all duration-300 backdrop-blur flex-shrink-0 w-[88%] sm:w-[70%] md:w-[52%] lg:w-[36%] xl:w-[30%]"
                >
                    <div className="absolute right-4 top-3 text-6xl font-black text-slate-100/80 pointer-events-none">
                      {numberLabel}
                    </div>
                  <div className="relative z-10 p-6 space-y-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 min-w-12 flex-shrink-0 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                          <Icon className="w-6 h-6" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500 font-semibold">Etapa {numberLabel}</p>
                          <h3 className="text-xl font-bold text-slate-900 leading-tight">{step.title}</h3>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-px">
                      <div className="rounded-t-2xl border border-slate-100 bg-slate-50/80 p-4">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500 font-semibold">O que fazemos</p>
                        <p className="text-slate-700 leading-relaxed mt-2 text-sm">{step.whatWeDo}</p>
                      </div>
                      <div className="rounded-b-2xl border border-blue-100 bg-gradient-to-r from-[#eef2ff] to-[#e0eaff] p-4">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-blue-700 font-semibold">Você sai com</p>
                        <p className="text-slate-800 leading-relaxed mt-2 text-sm font-semibold">{step.outcome}</p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="container-custom mx-auto px-4 sm:px-6 md:px-10 grid gap-6 lg:grid-cols-[2fr_1fr] items-stretch -mt-6 md:-mt-10">
          <div className="rounded-3xl bg-white/90 border border-slate-100 shadow-[0_24px_70px_-50px_rgba(15,23,42,0.45)] px-8 py-8 space-y-4 h-full">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <p className="text-lg font-bold text-slate-900">{practicalTitle}</p>
                <p className="text-sm text-slate-500">Como o trabalho acontece no dia a dia</p>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {practicalBullets.map((bullet, idx) => (
                <div
                  key={`${bullet}-${idx}`}
                  className="flex items-start gap-3 p-4 rounded-2xl bg-slate-50/90 border border-slate-100 shadow-sm"
                >
                  <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
                  <p className="text-sm text-slate-700 leading-relaxed">{bullet}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl bg-white/95 border border-slate-100 shadow-[0_24px_70px_-50px_rgba(15,23,42,0.45)] px-8 py-8 flex flex-col gap-4 justify-center h-full">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-700 uppercase tracking-[0.12em]">Próximo passo</p>
              <p className="text-xl font-bold text-slate-900 leading-tight">Agenda aberta para novos projetos</p>
            </div>
            <a
              href={ctaHref}
              onClick={handleCta}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-[#406EF1] hover:bg-[#355CD0] text-white font-semibold shadow-lg shadow-blue-500/20 transition-all hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#406EF1]"
              data-quiz-trigger="lead-quiz"
            >
              {ctaLabel}
              <ArrowRight className="w-4 h-4" />
            </a>
            {helperText && <p className="text-sm text-slate-600 leading-relaxed">{helperText}</p>}
          </div>
        </div>
      </div>
    </section>
  );
}
