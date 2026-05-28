import { useParams } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Loader2 } from '@/components/ui/loader';
import { LanguageSwitch, type LanguageSwitchValue } from '@/components/ui/LanguageSwitch';
import { useThemeColor } from '@/hooks/use-theme-color';
import type { CompanySettings, EstimateServiceItem } from '@shared/schema';

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

const accessGateCopy = {
  en: {
    title: 'Enter access code',
    unlock: 'Unlock Proposal',
    incorrectCode: 'Incorrect code',
    verificationFailed: 'Verification failed',
  },
  pt: {
    title: 'Digite o código de acesso',
    unlock: 'Desbloquear proposta',
    incorrectCode: 'Código incorreto',
    verificationFailed: 'Falha na verificação',
  },
};

function AccessCodeGate({
  estimateId,
  lang,
  onLanguageChange,
  onUnlock,
  companyName,
  clientName,
  siteSettings,
}: {
  estimateId: number;
  lang: 'en' | 'pt-BR';
  onLanguageChange: (value: LanguageSwitchValue) => void;
  onUnlock: () => void;
  companyName?: string | null;
  clientName?: string | null;
  siteSettings?: CompanySettings | null;
}) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const t = lang === 'pt-BR' ? accessGateCopy.pt : accessGateCopy.en;

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
    onError: (err: Error) => {
      setError(err.message === 'Incorrect code' ? t.incorrectCode : t.verificationFailed);
    },
  });

  return (
    <div className="h-screen bg-zinc-950 flex items-center justify-center relative">
      <div className="fixed top-4 right-16 z-50">
        <LanguageSwitch
          value={lang === 'pt-BR' ? 'pt' : 'en'}
          onValueChange={onLanguageChange}
        />
      </div>
      <div className="flex flex-col items-center gap-4 w-full max-w-sm px-6">
        {(() => {
          const gateLogo = siteSettings?.logoAvatarFull || siteSettings?.logoDark || siteSettings?.logoMain;
          return gateLogo ? (
            <img
              src={gateLogo}
              alt={siteSettings?.companyName || 'Skale Club'}
              className="h-20 md:h-24 w-auto object-contain mb-2"
            />
          ) : (
            <p className="text-zinc-400 text-sm uppercase tracking-widest">{siteSettings?.companyName || 'Skale Club'}</p>
          );
        })()}
        {(companyName || clientName) && (
          <div className="text-center -mt-1 mb-2">
            {companyName && <p className="text-white text-lg font-semibold leading-tight">{companyName}</p>}
            {clientName && <p className="text-zinc-400 text-sm mt-0.5">{clientName}</p>}
          </div>
        )}
        <h1 className="text-white text-2xl md:text-3xl font-semibold text-center">{t.title}</h1>
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
          {t.unlock}
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
    aboutBody: 'Skale Club is a company that helps businesses automate growth, close more deals, and deliver standout client experiences.',
    serviceOf: (n: number, total: number) => `Service ${n} of ${total}`,
    closing: "Let's grow your business.",
    closingBody: 'Ready when you are.',
  },
  pt: {
    proposalFor: 'Proposta para',
    about: 'Sobre a Skale Club',
    tagline: 'Ajudamos empresas a crescerem de forma mais inteligente.',
    aboutBody: 'A Skale Club é uma agência de marketing digital e vendas que ajuda empresas a automatizar o crescimento, fechar mais negócios e oferecer experiências excepcionais aos clientes.',
    serviceOf: (n: number, total: number) => `Serviço ${n} de ${total}`,
    closing: 'Vamos fazer seu negócio crescer.',
    closingBody: 'Quando você estiver pronto, nós estamos.',
  },
};

function SectionContent({ index, data, lang, siteSettings }: { index: number; data: PublicEstimate; lang: 'en' | 'pt-BR'; siteSettings?: CompanySettings | null }) {
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
        <div className="text-center px-6 sm:px-8 md:px-12 lg:px-16 max-w-2xl md:max-w-3xl lg:max-w-4xl mx-auto w-full">
          <p className="text-zinc-400 text-sm md:text-base lg:text-lg uppercase tracking-widest mb-6 lg:mb-8">{t.proposalFor}</p>
          <h1 style={{ fontFamily: "'Outfit', sans-serif" }} className="text-5xl md:text-6xl lg:text-7xl font-semibold text-white leading-tight">
            {headline}
          </h1>
          {subtitle && (
            <p className="text-zinc-300 text-xl md:text-2xl lg:text-3xl mt-6">{subtitle}</p>
          )}
          <a
            href="https://skale.club"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-12 transition-opacity hover:opacity-80"
            aria-label={`Visit ${siteSettings?.companyName || 'Skale Club'} website`}
          >
            {(() => {
              const coverLogo = siteSettings?.logoAvatarFull || siteSettings?.logoDark || siteSettings?.logoMain;
              return coverLogo ? (
                <img
                  src={coverLogo}
                  alt={siteSettings?.companyName || 'Skale Club'}
                  className="mx-auto h-16 md:h-20 lg:h-24 w-auto object-contain"
                />
              ) : (
                <p className="text-zinc-500 text-xs md:text-sm lg:text-base uppercase tracking-widest">
                  {siteSettings?.companyName || 'Skale Club'}
                </p>
              );
            })()}
          </a>
        </div>
      </>
    );
  }

  // Intro
  if (index === 1) return (
    <>
      {gradientOverlay}
      <div className="px-6 sm:px-8 md:px-12 lg:px-16 max-w-2xl md:max-w-3xl lg:max-w-4xl mx-auto w-full">
        <p className="text-zinc-400 text-sm md:text-base lg:text-lg uppercase tracking-widest mb-4 lg:mb-6">{t.about}</p>
        <h2 className="text-4xl md:text-5xl lg:text-6xl font-semibold text-white mb-6 lg:mb-8 leading-tight">{t.tagline}</h2>
        <p className="text-lg md:text-xl lg:text-2xl text-zinc-400 leading-relaxed">{t.aboutBody}</p>
      </div>
    </>
  );

  // Services
  const serviceIndex = index - 2;
  if (serviceIndex >= 0 && serviceIndex < data.services.length) {
    const service = data.services[serviceIndex];
    // Bilingual resolver — falls back to EN field when PT is missing.
    const pick = (en: string, pt?: string) => (lang === 'pt-BR' && pt ? pt : en);
    const pickArr = (en: string[], pt?: string[]) =>
      lang === 'pt-BR' && pt && pt.length === en.length ? pt : en;
    const sectionLabel = service.section ? pick(service.section, service.sectionPt) : null;
    const titleLabel = pick(service.title, service.titlePt);
    const subtitleLabel = service.subtitle ? pick(service.subtitle, service.subtitlePt) : null;
    const descriptionLabel = pick(service.description, service.descriptionPt);
    const priceLabel = pick(service.price, service.pricePt);
    const featuresLabel = pickArr(service.features, service.featuresPt);
    return (
      <>
        {gradientOverlay}
        <div className="px-6 sm:px-8 md:px-12 lg:px-16 max-w-2xl md:max-w-3xl lg:max-w-4xl mx-auto w-full">
          <p className="text-zinc-400 text-sm md:text-base lg:text-lg uppercase tracking-widest mb-4">
            {t.serviceOf(serviceIndex + 1, data.services.length)}
          </p>
          {sectionLabel && (
            <p className="text-primary text-xs md:text-sm uppercase tracking-widest font-semibold mb-3">
              {sectionLabel}
            </p>
          )}
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-semibold text-white mb-2 leading-tight">{titleLabel}</h2>
          {subtitleLabel && (
            <p className="text-zinc-400 text-sm md:text-base lg:text-lg uppercase tracking-widest mb-4">
              {subtitleLabel}
            </p>
          )}
          <p className="text-lg md:text-xl lg:text-2xl text-zinc-400 leading-relaxed mb-6 lg:mb-8">{descriptionLabel}</p>
          <p className="text-4xl md:text-5xl lg:text-6xl font-semibold text-white mb-8 lg:mb-10">{priceLabel}</p>
          {featuresLabel.length > 0 && (
            <ul className="space-y-3 lg:space-y-4">
              {featuresLabel.map((feature, fi) => (
                <li key={fi} className="flex items-start gap-3 md:gap-4 text-base md:text-lg lg:text-xl text-zinc-300">
                  <span className="text-zinc-500 shrink-0 mt-1 md:mt-0 lg:mt-0">–</span>
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
      <div className="text-center px-6 sm:px-8 md:px-12 lg:px-16 max-w-2xl md:max-w-3xl lg:max-w-4xl mx-auto w-full">
        {(() => {
          const closingLogo = siteSettings?.logoAvatarMark || siteSettings?.logoIcon;
          return closingLogo ? (
            <img
              src={closingLogo}
              alt={siteSettings?.companyName || 'Skale Club'}
              className="mx-auto mb-6 lg:mb-8 h-12 md:h-14 lg:h-16 w-auto object-contain"
            />
          ) : (
            <p className="text-zinc-400 text-sm md:text-base lg:text-lg uppercase tracking-widest mb-6 lg:mb-8">
              {siteSettings?.companyName || 'Skale Club'}
            </p>
          );
        })()}
        <h2 className="text-4xl md:text-5xl lg:text-6xl font-semibold text-white mb-6 leading-tight">{t.closing}</h2>
        <p className="text-base md:text-lg lg:text-xl text-zinc-400">{t.closingBody}</p>
      </div>
    </>
  );
}

export default function EstimateViewer() {
  // Tint iOS Safari URL bar + status bar to match the slide background (#09090B = zinc-950).
  // Prevents the white Safari chrome from clashing with the dark full-bleed slides on mobile.
  useThemeColor('#09090B');

  const { slug } = useParams<{ slug: string }>();
  const hasTrackedView = useRef(false);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const { data, isLoading } = useQuery<PublicEstimate>({
    queryKey: [`/api/estimates/slug/${slug}`],
    enabled: !!slug,
    retry: false,
  });

  const { data: siteSettings } = useQuery<CompanySettings>({
    queryKey: ['/api/company-settings'],
  });

  const [isUnlocked, setIsUnlocked] = useState(false);
  // Initial slide is read from the URL hash (1-based, e.g. #3 = slide 3).
  // Falls back to 0 (cover) when hash is missing or invalid. Refresh and
  // browser back/forward both restore the slide via the hashchange handler below.
  const [activeIndex, setActiveIndex] = useState(() => {
    const n = parseInt(window.location.hash.slice(1), 10);
    return Number.isFinite(n) && n > 0 ? n - 1 : 0;
  });
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
    window.history.replaceState(
      null,
      '',
      window.location.pathname + (newSearch ? `?${newSearch}` : '') + window.location.hash,
    );
  }

  function switchViewerLang(newLang: LanguageSwitchValue) {
    switchLang(newLang === 'pt' ? 'pt-BR' : 'en');
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

  useEffect(() => {
    if (!data) return;
    const estimateName = data.companyName?.trim() || data.contactName?.trim() || data.clientName?.trim();
    if (!estimateName) return;
    const companyName = siteSettings?.companyName?.trim() || 'Skale Club';
    document.title = `${estimateName} | ${companyName}`;
  }, [data, siteSettings?.companyName]);

  const goTo = useCallback((idx: number) => {
    if (!data) return;
    const clamped = Math.max(0, Math.min(idx, total - 1));
    setDirection(clamped > activeIndex ? 1 : -1);
    setActiveIndex(clamped);
    // Persist slide to URL hash (1-based) so refresh + back/forward + sharing
    // all land the viewer on the same slide.
    const newHash = `#${clamped + 1}`;
    if (window.location.hash !== newHash) {
      window.history.replaceState(
        null,
        '',
        window.location.pathname + window.location.search + newHash,
      );
    }
  }, [activeIndex, total, data]);

  const prev = useCallback(() => goTo(activeIndex - 1), [activeIndex, goTo]);
  const next = useCallback(() => goTo(activeIndex + 1), [activeIndex, goTo]);

  // Browser back/forward updates the hash — sync activeIndex from it.
  useEffect(() => {
    function onHashChange() {
      const n = parseInt(window.location.hash.slice(1), 10);
      if (!Number.isFinite(n) || n <= 0) return;
      const newIdx = n - 1;
      setActiveIndex((current) => {
        if (newIdx === current) return current;
        setDirection(newIdx > current ? 1 : -1);
        return newIdx;
      });
    }
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // Clamp activeIndex once data loads (handles e.g. #99 with only 8 slides).
  useEffect(() => {
    if (!data) return;
    if (activeIndex > total - 1) {
      goTo(total - 1);
    }
  }, [data, total, activeIndex, goTo]);

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

  // Touch swipe — both axes navigate. Horizontal: left=next, right=prev.
  // Vertical: up=next, down=prev. Matches the wheel scroll direction.
  const touchStartRef = useRef<{ x: number; y: number; t: number } | null>(null);
  useEffect(() => {
    function onTouchStart(e: TouchEvent) {
      const t = e.touches[0];
      if (!t) return;
      touchStartRef.current = { x: t.clientX, y: t.clientY, t: Date.now() };
    }
    function onTouchEnd(e: TouchEvent) {
      const start = touchStartRef.current;
      touchStartRef.current = null;
      if (!start) return;
      const t = e.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      const dt = Date.now() - start.t;
      if (dt > 800) return; // too slow to be a swipe — probably a long press
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);
      const THRESHOLD = 40; // px — generous so small drags don't count
      if (absX < THRESHOLD && absY < THRESHOLD) return;
      if (absX > absY) {
        // Horizontal: always navigates (no horizontal scroll inside slides)
        if (dx > 0) prev(); else next();
      } else {
        // Vertical: only navigate if the current slide isn't mid-scroll.
        // If content fits in viewport (no overflow), the boundary checks are
        // trivially true and behave like before.
        const el = scrollContainerRef.current;
        const atTop = !el || el.scrollTop <= 1;
        const atBottom = !el || el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
        if (dy > 0 && atTop) prev();          // swipe down at top → prev
        else if (dy < 0 && atBottom) next();  // swipe up at bottom → next
        // else: native scroll already moved the content; do not nav
      }
    }
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [next, prev]);

  if (isLoading) return <LoadingScreen />;
  if (!data) return <NotFoundScreen />;
  if (data.hasAccessCode && !isUnlocked) {
    return (
      <AccessCodeGate
        estimateId={data.id}
        lang={lang}
        onLanguageChange={switchViewerLang}
        onUnlock={() => setIsUnlocked(true)}
        companyName={data.companyName}
        clientName={data.contactName ?? data.clientName}
        siteSettings={siteSettings}
      />
    );
  }

  return (
    <div className="h-screen bg-zinc-950 text-white overflow-hidden relative flex items-center justify-center">
      {/* Language switcher */}
      <div className="fixed top-4 right-16 z-50">
        <LanguageSwitch
          value={lang === 'pt-BR' ? 'pt' : 'en'}
          onValueChange={switchViewerLang}
        />
      </div>

      {/* Navigation dots — subtle on mobile, hugs the right edge; same as before on desktop */}
      <div className="fixed right-1 md:right-4 top-1/2 -translate-y-1/2 flex flex-col gap-1 md:gap-2 z-50">
        {Array.from({ length: total }).map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            aria-label={`Go to section ${i + 1}`}
            className="min-w-[32px] min-h-[32px] md:min-w-[44px] md:min-h-[44px] flex items-center justify-center"
          >
            <span className={cn(
              'rounded-full transition-all duration-200',
              activeIndex === i
                ? 'w-2 h-2 md:w-3 md:h-3 bg-white/80 md:bg-white scale-110 md:scale-125'
                : 'w-1.5 h-1.5 md:w-2 md:h-2 bg-white/20 md:bg-white/30 hover:bg-white/60'
            )} />
          </button>
        ))}
      </div>

      {/* Desktop: counter centered at bottom, arrows on the sides at middle */}
      <div className="hidden md:block fixed bottom-6 left-1/2 -translate-x-1/2 z-50 text-zinc-500 text-xs tabular-nums">
        {activeIndex + 1} / {total}
      </div>

      {activeIndex > 0 && (
        <button
          onClick={prev}
          aria-label="Previous section"
          className="hidden md:flex fixed left-4 top-1/2 -translate-y-1/2 z-50 w-10 h-10 rounded-full items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-all duration-200"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      )}

      {activeIndex < total - 1 && (
        <button
          onClick={next}
          aria-label="Next section"
          className="hidden md:flex fixed right-16 top-1/2 -translate-y-1/2 z-50 w-10 h-10 rounded-full items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-all duration-200"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      )}

      {/* Mobile: prev + counter + next all together at bottom (left | center | right) */}
      <div className="md:hidden fixed bottom-4 left-0 right-0 z-50 flex items-center justify-center gap-4">
        <button
          onClick={prev}
          disabled={activeIndex === 0}
          aria-label="Previous section"
          className="w-9 h-9 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-all disabled:opacity-30"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="text-zinc-500 text-xs tabular-nums min-w-[48px] text-center">
          {activeIndex + 1} / {total}
        </span>
        <button
          onClick={next}
          disabled={activeIndex === total - 1}
          aria-label="Next section"
          className="w-9 h-9 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-all disabled:opacity-30"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Slide area — outer keeps overflow-hidden so motion.div animations stay clipped;
          the inner scroll container handles overflow per slide when content is too tall. */}
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
            className="relative z-10 w-full h-full"
          >
            <div
              ref={scrollContainerRef}
              className="h-full w-full overflow-y-auto overscroll-contain"
            >
              <div className="min-h-full flex items-center justify-center py-12 md:py-16 pb-24 md:pb-16">
                <SectionContent index={activeIndex} data={data} lang={lang} siteSettings={siteSettings} />
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
