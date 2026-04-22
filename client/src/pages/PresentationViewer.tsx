import { useParams, useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Loader2 } from '@/components/ui/loader';
import type { SlideBlock } from '@shared/schema';

// Shape returned by GET /api/presentations/slug/:slug (accessCode stripped, hasAccessCode added)
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

// Placeholder replaced in Task 2 with full 8-layout implementation
function SlideContent({ slide, lang }: { slide: SlideBlock; lang: string }) {
  return (
    <p className="text-zinc-400 text-sm uppercase tracking-widest">{slide.layout}</p>
  );
}

export default function PresentationViewer() {
  const { slug } = useParams<{ slug: string }>();
  const [location, navigate] = useLocation();

  // Language derived from URL search param — never from global context
  const searchParams = new URLSearchParams(location.includes('?') ? location.split('?')[1] : '');
  const lang = searchParams.get('lang') === 'pt-BR' ? 'pt-BR' : 'en';

  function switchLang(newLang: 'en' | 'pt-BR') {
    const params = new URLSearchParams(location.includes('?') ? location.split('?')[1] : '');
    if (newLang === 'en') params.delete('lang');
    else params.set('lang', 'pt-BR');
    const newSearch = params.toString();
    navigate(location.split('?')[0] + (newSearch ? `?${newSearch}` : ''), { replace: true });
  }

  const hasTrackedView = useRef(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const sectionRefs = useRef<(HTMLElement | null)[]>([]);

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

  useEffect(() => {
    if (data && (!data.hasAccessCode || isUnlocked) && !hasTrackedView.current) {
      hasTrackedView.current = true;
      trackView();
    }
  }, [data, isUnlocked]);

  useEffect(() => {
    if (!data) return;
    const refs = sectionRefs.current.slice(0, data.slides.length);

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = refs.indexOf(entry.target as HTMLElement);
            if (idx !== -1) setActiveIndex(idx);
          }
        });
      },
      { threshold: 0.5 }
    );

    refs.forEach((ref) => { if (ref) observer.observe(ref); });
    return () => observer.disconnect();
  }, [data, isUnlocked]);

  if (isLoading) return <LoadingScreen />;
  if (!data) return <NotFoundScreen />;
  if (data.hasAccessCode && !isUnlocked) {
    return <AccessCodeGate presentationId={data.id} onUnlock={() => setIsUnlocked(true)} />;
  }

  const contentAnimation = {
    initial: { opacity: 0, y: 20 },
    whileInView: { opacity: 1, y: 0 },
    transition: { duration: 0.5, ease: 'easeOut' },
    viewport: { once: true },
  };

  const gradientOverlay = (
    <div className="absolute inset-0 bg-gradient-to-b from-zinc-800/20 to-transparent pointer-events-none" />
  );

  return (
    <div className="h-screen overflow-y-scroll snap-y snap-mandatory bg-zinc-950 text-white">
      {/* Language switcher — fixed top-right, left of nav dots */}
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

      {/* Navigation dots — fixed right sidebar */}
      <div className="fixed right-4 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-50">
        {data.slides.map((_, i) => (
          <button
            key={i}
            onClick={() => sectionRefs.current[i]?.scrollIntoView({ behavior: 'smooth' })}
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

      {/* Slide sections */}
      {data.slides.map((slide, i) => (
        <section
          key={i}
          ref={(el) => { sectionRefs.current[i] = el; }}
          className="h-screen w-full snap-start relative flex items-center justify-center"
        >
          {gradientOverlay}
          <motion.div {...contentAnimation} className="relative z-10 px-8 max-w-xl mx-auto w-full">
            <SlideContent slide={slide} lang={lang} />
          </motion.div>
        </section>
      ))}
    </div>
  );
}
