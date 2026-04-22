import { useParams } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useEffect, useRef, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Loader2 } from '@/components/ui/loader';
import type { SlideBlock } from '@shared/schema';

interface PublicPresentation {
  id: string;
  slug: string;
  title: string;
  slides: SlideBlock[];
  hasAccessCode: boolean;
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

function AccessCodeGate({ presentationId, onUnlock }: { presentationId: string; onUnlock: () => void }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  const { mutate: verify, isPending } = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/presentations/${presentationId}/verify-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      if (res.status === 401) throw new Error('Incorrect code');
      if (!res.ok) throw new Error('Verification failed. Try again.');
    },
    onSuccess: () => onUnlock(),
    onError: (err: Error) => setError(err.message),
  });

  return (
    <div className="h-screen bg-zinc-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4 w-full max-w-sm px-6">
        <p className="text-zinc-400 text-sm uppercase tracking-widest">Skale Club</p>
        <h1 className="text-white text-3xl font-semibold text-center">Enter access code</h1>
        <Input
          type="text"
          value={code}
          onChange={(e) => { setCode(e.target.value); setError(''); }}
          className="bg-zinc-900 border-zinc-700 text-white text-center w-full"
          onKeyDown={(e) => e.key === 'Enter' && code && !isPending && verify()}
          aria-label="Access code"
        />
        {error && <p className="text-destructive text-sm">{error}</p>}
        <Button
          onClick={() => verify()}
          disabled={isPending || !code}
          className="bg-[#FFFF01] text-black font-bold rounded-full w-full hover:bg-[#e6e600]"
        >
          {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Unlock Presentation
        </Button>
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
          <p className="text-zinc-400 text-sm uppercase tracking-widest mb-2">Skale Club</p>
          <h1 style={{ fontFamily: "'Outfit', sans-serif" }} className="text-5xl font-semibold text-white leading-tight">{heading}</h1>
          {body && <p className="text-zinc-400 text-sm mt-6 max-w-md mx-auto">{body}</p>}
        </div>
      );

    case 'section-break':
      return (
        <div className="text-center">
          <p className="text-zinc-400 text-sm uppercase tracking-widest mb-2">{heading}</p>
          {body && <p className="text-base text-zinc-400 leading-relaxed mt-4">{body}</p>}
        </div>
      );

    case 'title-body':
      return (
        <div>
          <h2 style={{ fontFamily: "'Outfit', sans-serif" }} className="text-3xl font-semibold text-white mb-4">{heading}</h2>
          {body && <p className="text-base text-zinc-400 leading-relaxed">{body}</p>}
        </div>
      );

    case 'bullets':
      return (
        <div>
          <h2 style={{ fontFamily: "'Outfit', sans-serif" }} className="text-3xl font-semibold text-white mb-6">{heading}</h2>
          {bullets.length > 0 && (
            <ul className="space-y-3">
              {bullets.map((bullet, i) => (
                <li key={i} className="flex gap-2 text-sm text-zinc-300">
                  <span className="text-zinc-500 shrink-0">–</span>
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
          {heading && <h2 style={{ fontFamily: "'Outfit', sans-serif" }} className="text-3xl font-semibold text-white mb-8">{heading}</h2>}
          {slide.stats && slide.stats.length > 0 && (
            <dl className="grid grid-cols-2 gap-8">
              {slide.stats.map((stat, i) => (
                <div key={i}>
                  <dt className="text-5xl font-semibold text-white">{stat.value}</dt>
                  <dd className="text-sm text-zinc-400 mt-1">
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
        <div className="grid grid-cols-2 gap-16 w-full">
          <div>
            <h2 style={{ fontFamily: "'Outfit', sans-serif" }} className="text-3xl font-semibold text-white">{heading}</h2>
          </div>
          <div>
            {body && <p className="text-base text-zinc-400 leading-relaxed">{body}</p>}
          </div>
        </div>
      );

    case 'image-focus':
      return (
        <div className="w-full h-full absolute inset-0 flex flex-col">
          <div className="flex-1 bg-zinc-800" />
          <div className="flex-1 flex items-center justify-start px-8">
            <div className="max-w-xl">
              {heading && <h2 style={{ fontFamily: "'Outfit', sans-serif" }} className="text-3xl font-semibold text-white mb-4">{heading}</h2>}
              {body && <p className="text-base text-zinc-400 leading-relaxed">{body}</p>}
            </div>
          </div>
        </div>
      );

    case 'closing':
      return (
        <div className="text-center">
          <p className="text-zinc-400 text-sm uppercase tracking-widest mb-4">Skale Club</p>
          <h2 style={{ fontFamily: "'Outfit', sans-serif" }} className="text-3xl font-semibold text-white mb-4">{heading}</h2>
          {body && <p className="text-sm text-zinc-400 mt-2 max-w-md mx-auto">{body}</p>}
        </div>
      );

    default:
      return <p className="text-zinc-400 text-sm">{heading}</p>;
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

  const hasTrackedView = useRef(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [direction, setDirection] = useState(1);

  const { data, isLoading } = useQuery<PublicPresentation>({
    queryKey: [`/api/presentations/slug/${slug}`],
    enabled: !!slug,
    retry: false,
  });

  const { mutate: trackView } = useMutation({
    mutationFn: async () => {
      await fetch(`/api/presentations/${data!.id}/view`, { method: 'POST' });
    },
  });

  const isPreview = new URLSearchParams(window.location.search).has('preview');

  useEffect(() => {
    if (isPreview) return;
    if (data && (!data.hasAccessCode || isUnlocked) && !hasTrackedView.current) {
      hasTrackedView.current = true;
      trackView();
    }
  }, [data, isUnlocked]);

  const total = data?.slides.length ?? 0;

  const goTo = useCallback((idx: number) => {
    if (!data) return;
    const clamped = Math.max(0, Math.min(idx, total - 1));
    setDirection(clamped > activeIndex ? 1 : -1);
    setActiveIndex(clamped);
  }, [activeIndex, total, data]);

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
  if (!data) return <NotFoundScreen />;
  if (data.hasAccessCode && !isUnlocked) {
    return <AccessCodeGate presentationId={data.id} onUnlock={() => setIsUnlocked(true)} />;
  }

  const currentSlide = data.slides[activeIndex];

  return (
    <div className="h-screen bg-zinc-950 text-white overflow-hidden relative flex items-center justify-center">
      {/* Language switcher */}
      <div className="fixed top-4 right-16 z-50 flex gap-3">
        <button
          onClick={() => switchLang('en')}
          aria-label="Switch to English"
          className={lang === 'en' ? 'text-white font-semibold text-sm' : 'text-zinc-500 hover:text-zinc-300 text-sm cursor-pointer'}
        >EN</button>
        <button
          onClick={() => switchLang('pt-BR')}
          aria-label="Switch to Portuguese"
          className={lang === 'pt-BR' ? 'text-white font-semibold text-sm' : 'text-zinc-500 hover:text-zinc-300 text-sm cursor-pointer'}
        >PT</button>
      </div>

      {/* Navigation dots */}
      <div className="fixed right-4 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-50">
        {data.slides.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            aria-label={`Go to slide ${i + 1}`}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <span className={cn(
              'rounded-full transition-all duration-200',
              activeIndex === i ? 'w-3 h-3 bg-white scale-125' : 'w-2 h-2 bg-white/30 hover:bg-white/60'
            )} />
          </button>
        ))}
      </div>

      {/* Slide counter */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 text-zinc-500 text-xs tabular-nums">
        {activeIndex + 1} / {total}
      </div>

      {/* Arrow buttons */}
      {activeIndex > 0 && (
        <button
          onClick={prev}
          aria-label="Previous slide"
          className="fixed left-4 top-1/2 -translate-y-1/2 z-50 w-10 h-10 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-all duration-200"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      )}

      {activeIndex < total - 1 && (
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
            key={activeIndex}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
            className="relative z-10 px-8 max-w-xl mx-auto w-full"
          >
            <SlideContent slide={currentSlide} lang={lang} />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
