import { useParams } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Loader2 } from '@/components/ui/loader';
import { LanguageSwitch, type LanguageSwitchValue } from '@/components/ui/LanguageSwitch';
import type { CompanySettings, SlideBlock } from '@shared/schema';

interface PublicPresentation {
  id: string;
  slug: string;
  title: string;
  slides: SlideBlock[];
  version: number;
  createdAt: string | null;
  updatedAt: string | null;
  guidelinesSnapshot: string | null;
}

function LoadingScreen() {
  return (
    <div className="h-screen bg-zinc-950 flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-zinc-400" aria-label="Loading" />
    </div>
  );
}

function NotFoundScreen() {
  return (
    <div className="h-screen bg-zinc-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4 text-center px-6">
        <p className="text-zinc-400 text-sm uppercase tracking-widest">Presentation not found</p>
        <h1 className="text-white text-3xl font-semibold">This link may have expired or been removed.</h1>
        <p className="text-zinc-400 text-sm">Contact Skale Club for a new link.</p>
      </div>
    </div>
  );
}

function EmptySlidesScreen() {
  return (
    <div className="h-screen bg-zinc-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4 text-center px-6">
        <p className="text-zinc-400 text-sm uppercase tracking-widest">Skale Club</p>
        <h1 className="text-white text-3xl font-semibold">No slides available yet.</h1>
        <p className="text-zinc-400 text-sm">This presentation is still being prepared.</p>
      </div>
    </div>
  );
}

function resolveField(en: string | undefined, pt: string | undefined, activeLang: string): string {
  if (activeLang === 'pt-BR') return pt || en || '';
  return en || '';
}

function SlideContent({ slide, lang }: { slide: SlideBlock; lang: string }) {
  const heading = resolveField(slide.heading, slide.headingPt, lang);
  const body = resolveField(slide.body, slide.bodyPt, lang);
  const bullets =
    lang === 'pt-BR'
      ? (slide.bulletsPt?.length ? slide.bulletsPt : slide.bullets) ?? []
      : slide.bullets ?? [];

  switch (slide.layout) {
    case 'cover':
      return (
        <div className="text-center">
          <p className="text-zinc-400 text-sm md:text-base lg:text-lg uppercase tracking-widest mb-4">Skale Club</p>
          <h1 style={{ fontFamily: "'Outfit', sans-serif" }} className="text-5xl md:text-6xl lg:text-7xl font-semibold text-white leading-tight">{heading}</h1>
          {body && <p className="text-zinc-400 text-base md:text-lg lg:text-xl mt-6 max-w-2xl mx-auto">{body}</p>}
        </div>
      );

    case 'section-break':
      return (
        <div className="text-center">
          <p className="text-zinc-400 text-sm md:text-base lg:text-lg uppercase tracking-widest mb-4">{heading}</p>
          {body && <p className="text-lg md:text-xl lg:text-2xl text-zinc-400 leading-relaxed mt-6">{body}</p>}
        </div>
      );

    case 'title-body':
      return (
        <div>
          <h2 style={{ fontFamily: "'Outfit', sans-serif" }} className="text-4xl md:text-5xl lg:text-6xl font-semibold text-white mb-6 leading-tight">{heading}</h2>
          {body && <p className="text-lg md:text-xl lg:text-2xl text-zinc-400 leading-relaxed">{body}</p>}
        </div>
      );

    case 'bullets':
      return (
        <div>
          <h2 style={{ fontFamily: "'Outfit', sans-serif" }} className="text-4xl md:text-5xl lg:text-6xl font-semibold text-white mb-8 leading-tight">{heading}</h2>
          {bullets.length > 0 && (
            <ul className="space-y-4">
              {bullets.map((bullet, i) => (
                <li key={i} className="flex gap-3 text-base md:text-lg lg:text-xl text-zinc-300">
                  <span className="text-zinc-500 shrink-0 mt-1 md:mt-0 lg:mt-0">–</span>
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      );

    case 'stats':
      return (
        <div>
          {heading && <h2 style={{ fontFamily: "'Outfit', sans-serif" }} className="text-4xl md:text-5xl lg:text-6xl font-semibold text-white mb-12 leading-tight">{heading}</h2>}
          {slide.stats && slide.stats.length > 0 && (
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-8 md:gap-12 lg:gap-16">
              {slide.stats.map((stat, i) => (
                <div key={i}>
                  <dt className="text-6xl md:text-7xl lg:text-8xl font-semibold text-white">{stat.value}</dt>
                  <dd className="text-base md:text-lg lg:text-xl text-zinc-400 mt-2">
                    {lang === 'pt-BR' ? (stat.labelPt || stat.label) : stat.label}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      );

    case 'two-column':
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16 w-full">
          <div>
            <h2 style={{ fontFamily: "'Outfit', sans-serif" }} className="text-4xl md:text-5xl lg:text-6xl font-semibold text-white leading-tight">{heading}</h2>
          </div>
          <div>
            {body && <p className="text-lg md:text-xl lg:text-2xl text-zinc-400 leading-relaxed">{body}</p>}
          </div>
        </div>
      );

    case 'image-focus':
      return (
        <div className="w-full h-full absolute inset-0 flex flex-col md:flex-row">
          <div className="flex-1 bg-zinc-800" />
          <div className="flex-1 flex items-center justify-center md:justify-start px-8 py-12 md:py-0 md:px-16 lg:px-24">
            <div className="max-w-2xl">
              {heading && <h2 style={{ fontFamily: "'Outfit', sans-serif" }} className="text-4xl md:text-5xl lg:text-6xl font-semibold text-white mb-6 leading-tight">{heading}</h2>}
              {body && <p className="text-lg md:text-xl lg:text-2xl text-zinc-400 leading-relaxed">{body}</p>}
            </div>
          </div>
        </div>
      );

    case 'closing':
      return (
        <div className="text-center">
          <p className="text-zinc-400 text-sm md:text-base lg:text-lg uppercase tracking-widest mb-4 lg:mb-6">Skale Club</p>
          <h2 style={{ fontFamily: "'Outfit', sans-serif" }} className="text-4xl md:text-5xl lg:text-6xl font-semibold text-white mb-6 leading-tight">{heading}</h2>
          {body && <p className="text-base md:text-lg lg:text-xl text-zinc-400 mt-4 max-w-2xl mx-auto">{body}</p>}
        </div>
      );

    default:
      return <p className="text-zinc-400 text-base md:text-lg lg:text-xl">{heading}</p>;
  }
}

const slideVariants = {
  enter: (dir: number) => ({ y: dir > 0 ? '100%' : '-100%', opacity: 0 }),
  center: { y: 0, opacity: 1 },
  exit: (dir: number) => ({ y: dir > 0 ? '-100%' : '100%', opacity: 0 }),
};

export default function PresentationViewer() {
  const { slug } = useParams<{ slug: string }>();

  const [lang, setLang] = useState<'en' | 'pt-BR'>(() => {
    const p = new URLSearchParams(window.location.search);
    return p.get('lang') === 'pt-BR' ? 'pt-BR' : 'en';
  });

  function switchLang(newLang: 'en' | 'pt-BR') {
    setLang(newLang);
    const params = new URLSearchParams(window.location.search);
    if (newLang === 'en') params.delete('lang');
    else params.set('lang', 'pt-BR');
    const newSearch = params.toString();
    window.history.replaceState(null, '', window.location.pathname + (newSearch ? `?${newSearch}` : ''));
  }

  function switchViewerLang(newLang: LanguageSwitchValue) {
    switchLang(newLang === 'pt' ? 'pt-BR' : 'en');
  }

  const hasTrackedView = useRef(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [direction, setDirection] = useState(1);

  const isEditMode = new URLSearchParams(window.location.search).has('edit');
  const queryClient = useQueryClient();
  const queryKey = [`/api/presentations/slug/${slug}`, isEditMode];

  const { data, isLoading } = useQuery<PublicPresentation>({
    queryKey,
    enabled: !!slug,
    retry: false,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const response = await fetch(`/api/presentations/slug/${slug}`);
      if (!response.ok) throw new Error('Not found');
      const presentation = await response.json();

      // In edit mode, override slides with draft from localStorage (works across tabs)
      if (isEditMode) {
        const draftSlides = localStorage.getItem(`presentation_draft_${slug}`);
        if (draftSlides) {
          try {
            const slides = JSON.parse(draftSlides);
            return { ...presentation, slides };
          } catch (e) {
            console.error('Failed to parse draft slides:', e);
          }
        }
      }

      return presentation;
    },
  });

  // Live-reload preview tab when the editor updates the draft in localStorage
  useEffect(() => {
    if (!isEditMode || !slug) return;
    function handleStorage(e: StorageEvent) {
      if (e.key === `presentation_draft_${slug}`) {
        queryClient.invalidateQueries({ queryKey });
      }
    }
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [isEditMode, slug, queryClient]);

  const { data: companySettings } = useQuery<CompanySettings>({
    queryKey: ['/api/company-settings'],
  });

  const presentation = data;

  const { mutate: trackView } = useMutation({
    mutationFn: async () => {
      await fetch(`/api/presentations/${presentation!.id}/view`, { method: 'POST' });
    },
  });

  const isPreview = new URLSearchParams(window.location.search).has('preview');
  const isThumbnail = new URLSearchParams(window.location.search).has('thumbnail');

  useEffect(() => {
    if (isPreview) return;
    if (presentation && !hasTrackedView.current) {
      hasTrackedView.current = true;
      trackView();
    }
  }, [presentation, isPreview, trackView]);

  const total = presentation?.slides.length ?? 0;

  useEffect(() => {
    if (activeIndex >= total && total > 0) {
      setActiveIndex(total - 1);
    }
  }, [activeIndex, total]);

  useEffect(() => {
    if (!presentation?.title) return;
    const companyName = companySettings?.companyName?.trim() || 'Skale Club';
    document.title = `${presentation.title} | ${companyName}`;
  }, [presentation?.title, companySettings?.companyName]);

  const goTo = useCallback((idx: number) => {
    if (!presentation || total === 0) return;
    const clamped = Math.max(0, Math.min(idx, total - 1));
    setDirection(clamped > activeIndex ? 1 : -1);
    setActiveIndex(clamped);
  }, [activeIndex, total, presentation]);

  const prev = useCallback(() => goTo(activeIndex - 1), [activeIndex, goTo]);
  const next = useCallback(() => goTo(activeIndex + 1), [activeIndex, goTo]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next();
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') prev();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev]);

  const wheelLocked = useRef(false);
  useEffect(() => {
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      if (wheelLocked.current) return;
      wheelLocked.current = true;
      if (e.deltaY > 0) next();
      else prev();
      setTimeout(() => { wheelLocked.current = false; }, 750);
    }
    window.addEventListener('wheel', onWheel, { passive: false });
    return () => window.removeEventListener('wheel', onWheel);
  }, [next, prev]);

  if (isLoading) return <LoadingScreen />;
  if (!presentation) return <NotFoundScreen />;
  if (total === 0) return <EmptySlidesScreen />;

  if (isThumbnail) {
    return (
      <div className="h-screen bg-zinc-950 text-white flex items-center justify-center overflow-hidden">
        <div className="px-8 max-w-xl mx-auto w-full">
          <SlideContent slide={presentation.slides[0]} lang="en" />
        </div>
      </div>
    );
  }

  const currentIndex = Math.min(activeIndex, total - 1);
  const currentSlide = presentation.slides[currentIndex];

  return (
    <div className="h-screen bg-zinc-950 text-white overflow-hidden relative flex items-center justify-center">
      {/* Language switcher */}
      <div className="fixed top-4 right-16 z-50">
        <LanguageSwitch
          value={lang === 'pt-BR' ? 'pt' : 'en'}
          onValueChange={switchViewerLang}
        />
      </div>

      {/* Navigation dots */}
      <div className="fixed right-4 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-50">
        {presentation.slides.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            aria-label={`Go to slide ${i + 1}`}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <span className={cn(
              'rounded-full transition-all duration-200',
              currentIndex === i ? 'w-3 h-3 bg-white scale-125' : 'w-2 h-2 bg-white/30 hover:bg-white/60'
            )} />
          </button>
        ))}
      </div>

      {/* Slide counter */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 text-zinc-500 text-xs tabular-nums">
        {currentIndex + 1} / {total}
      </div>

      {/* Arrow buttons */}
      {currentIndex > 0 && (
        <button
          onClick={prev}
          aria-label="Previous slide"
          className="fixed left-4 top-1/2 -translate-y-1/2 z-50 w-10 h-10 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-all duration-200"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      )}

      {currentIndex < total - 1 && (
        <button
          onClick={next}
          aria-label="Next slide"
          className="fixed right-16 top-1/2 -translate-y-1/2 z-50 w-10 h-10 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-all duration-200"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      )}

      {/* Slide area */}
      <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-800/20 to-transparent pointer-events-none" />
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentIndex}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
            className="relative z-10 px-8 max-w-3xl md:max-w-4xl lg:max-w-5xl mx-auto w-full"
          >
            <SlideContent slide={currentSlide} lang={lang} />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
