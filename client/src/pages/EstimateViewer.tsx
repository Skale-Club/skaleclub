import { useParams } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Loader2 } from '@/components/ui/loader';
import type { EstimateServiceItem } from '@shared/schema';

interface PublicEstimate {
  id: number;
  clientName: string;
  companyName: string | null;
  contactName: string | null;
  slug: string;
  note: string | null;
  services: EstimateServiceItem[];
  createdAt: string | null;
  hasAccessCode: boolean;
}

function LoadingScreen() {
  return (
    <div className="h-screen bg-zinc-950 flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
    </div>
  );
}

function NotFoundScreen() {
  return (
    <div className="h-screen bg-zinc-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4 text-center px-6">
        <p className="text-zinc-400 text-sm uppercase tracking-widest">Proposal not found</p>
        <h1 className="text-white text-3xl font-semibold">This link may have expired or been removed.</h1>
        <p className="text-zinc-400 text-sm">Contact Skale Club for a new proposal link.</p>
      </div>
    </div>
  );
}

function AccessCodeGate({ estimateId, onUnlock }: { estimateId: number; onUnlock: () => void }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  const { mutate: verify, isPending } = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/estimates/${estimateId}/verify-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      if (res.status === 401) throw new Error('Incorrect code');
      if (!res.ok) throw new Error('Verification failed');
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
        />
        {error && <p className="text-destructive text-sm">{error}</p>}
        <Button
          onClick={() => verify()}
          disabled={isPending || !code}
          className="w-full"
        >
          {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Unlock Proposal
        </Button>
      </div>
    </div>
  );
}

const slideVariants = {
  enter: (dir: number) => ({ y: dir > 0 ? '100%' : '-100%', opacity: 0 }),
  center: { y: 0, opacity: 1 },
  exit: (dir: number) => ({ y: dir > 0 ? '-100%' : '100%', opacity: 0 }),
};

const i18n = {
  en: {
    proposalFor: 'Proposal for',
    about: 'About Skale Club',
    tagline: 'We help businesses grow smarter.',
    aboutBody: 'Skale Club is a digital marketing and sales agency helping businesses automate growth, close more deals, and deliver standout client experiences.',
    serviceOf: (n: number, total: number) => `Service ${n} of ${total}`,
    closing: "Let's build something great together.",
    closingBody: 'Reach out to discuss next steps.',
  },
  pt: {
    proposalFor: 'Proposta para',
    about: 'Sobre a Skale Club',
    tagline: 'Ajudamos empresas a crescerem de forma mais inteligente.',
    aboutBody: 'A Skale Club é uma agência de marketing digital e vendas que ajuda empresas a automatizar o crescimento, fechar mais negócios e oferecer experiências excepcionais aos clientes.',
    serviceOf: (n: number, total: number) => `Serviço ${n} de ${total}`,
    closing: 'Vamos construir algo incrível juntos.',
    closingBody: 'Entre em contato para discutir os próximos passos.',
  },
};

function SectionContent({ index, data, lang }: { index: number; data: PublicEstimate; lang: 'en' | 'pt-BR' }) {
  const t = lang === 'pt-BR' ? i18n.pt : i18n.en;

  const gradientOverlay = (
    <div className="absolute inset-0 bg-gradient-to-b from-zinc-800/20 to-transparent pointer-events-none" />
  );

  // Cover
  if (index === 0) {
    const company = data.companyName?.trim();
    const contact = data.contactName?.trim();
    const headline = company || contact || data.clientName;
    const subtitle = company && contact ? contact : null;
    return (
      <>
        {gradientOverlay}
        <div className="text-center px-8 max-w-xl mx-auto w-full">
          <p className="text-zinc-400 text-sm uppercase tracking-widest mb-6">{t.proposalFor}</p>
          <h1 style={{ fontFamily: "'Outfit', sans-serif" }} className="text-5xl font-semibold text-white leading-tight">
            {headline}
          </h1>
          {subtitle && (
            <p className="text-zinc-300 text-xl mt-4">{subtitle}</p>
          )}
          <p className="text-zinc-500 text-xs uppercase tracking-widest mt-8">Skale Club</p>
        </div>
      </>
    );
  }

  // Intro
  if (index === 1) return (
    <>
      {gradientOverlay}
      <div className="px-8 max-w-xl mx-auto w-full">
        <p className="text-zinc-400 text-sm uppercase tracking-widest mb-4">{t.about}</p>
        <h2 className="text-3xl font-semibold text-white mb-6">{t.tagline}</h2>
        <p className="text-base text-zinc-400 leading-relaxed">{t.aboutBody}</p>
      </div>
    </>
  );

  // Services
  const serviceIndex = index - 2;
  if (serviceIndex >= 0 && serviceIndex < data.services.length) {
    const service = data.services[serviceIndex];
    return (
      <>
        {gradientOverlay}
        <div className="px-8 max-w-xl mx-auto w-full">
          <p className="text-zinc-400 text-sm uppercase tracking-widest mb-2">
            {t.serviceOf(serviceIndex + 1, data.services.length)}
          </p>
          <h2 className="text-3xl font-semibold text-white mb-2">{service.title}</h2>
          <p className="text-base text-zinc-400 leading-relaxed mb-4">{service.description}</p>
          <p className="text-3xl font-semibold text-white mb-6">{service.price}</p>
          {service.features.length > 0 && (
            <ul className="space-y-2">
              {service.features.map((feature, fi) => (
                <li key={fi} className="flex items-start gap-2 text-sm text-zinc-300">
                  <span className="text-zinc-500 shrink-0">–</span>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </>
    );
  }

  // Closing
  return (
    <>
      {gradientOverlay}
      <div className="text-center px-8 max-w-xl mx-auto w-full">
        <p className="text-zinc-400 text-sm uppercase tracking-widest mb-4">Skale Club</p>
        <h2 className="text-3xl font-semibold text-white mb-4">{t.closing}</h2>
        <p className="text-sm text-zinc-400">{t.closingBody}</p>
      </div>
    </>
  );
}

export default function EstimateViewer() {
  const { slug } = useParams<{ slug: string }>();
  const hasTrackedView = useRef(false);

  const { data, isLoading } = useQuery<PublicEstimate>({
    queryKey: [`/api/estimates/slug/${slug}`],
    enabled: !!slug,
    retry: false,
  });

  const [isUnlocked, setIsUnlocked] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [direction, setDirection] = useState(1);
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

  const { mutate: trackView } = useMutation({
    mutationFn: async () => {
      await fetch(`/api/estimates/${data!.id}/view`, { method: 'POST' });
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

  const total = data ? 2 + data.services.length + 1 : 0;

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
    return <AccessCodeGate estimateId={data.id} onUnlock={() => setIsUnlocked(true)} />;
  }

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
        {Array.from({ length: total }).map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            aria-label={`Go to section ${i + 1}`}
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
          aria-label="Previous section"
          className="fixed left-4 top-1/2 -translate-y-1/2 z-50 w-10 h-10 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-all duration-200"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      )}

      {activeIndex < total - 1 && (
        <button
          onClick={next}
          aria-label="Next section"
          className="fixed right-16 top-1/2 -translate-y-1/2 z-50 w-10 h-10 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-all duration-200"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      )}

      {/* Slide area */}
      <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={activeIndex}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
            className="relative z-10 w-full h-full flex items-center justify-center"
          >
            <SectionContent index={activeIndex} data={data} lang={lang} />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
