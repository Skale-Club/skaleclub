import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Trash2, RefreshCw, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Loader2 } from '@/components/ui/loader';
import { LanguageSwitch, type LanguageSwitchValue } from '@/components/ui/LanguageSwitch';
import type { CompanySettings, SlideBlock } from '@shared/schema';
import { SlideContent, buildSlideStyle, resolveField } from '@/components/SlideRenderer';

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
  const [inlineEditIndex, setInlineEditIndex] = useState<number | null>(null);
  const [inlineHeading, setInlineHeading] = useState('');
  const [inlineBody, setInlineBody] = useState('');
  const [isRedoing, setIsRedoing] = useState(false);
  const inlineSavePending = useRef(false);

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

  // D-17: Delete slide — remove from array, clamp index, persist
  async function handleDeleteSlide(index: number) {
    if (!presentation) return;
    const newSlides = presentation.slides.filter((_, i) => i !== index);
    // Clamp immediately (Pitfall 7)
    setActiveIndex(Math.min(activeIndex, Math.max(0, newSlides.length - 1)));
    // Optimistic cache update
    queryClient.setQueryData<PublicPresentation>(queryKey, (old) =>
      old ? { ...old, slides: newSlides } : old
    );
    try {
      await fetch(`/api/presentations/${presentation.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slides: newSlides }),
      });
    } catch (err) {
      console.error('Failed to delete slide', err);
      queryClient.invalidateQueries({ queryKey });
    }
  }

  // D-18: AI-redo — call existing Claude chat endpoint with targeted instruction
  async function handleRedoSlide(index: number) {
    if (!presentation || isRedoing) return;
    setIsRedoing(true);
    try {
      const res = await fetch(`/api/presentations/${presentation.id}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Regenerate only slide at index ${index}. Keep all other slides identical.`,
        }),
      });
      if (!res.body) return;
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === 'done' && event.slides) {
              queryClient.setQueryData<PublicPresentation>(queryKey, (old) =>
                old ? { ...old, slides: event.slides } : old
              );
            }
          } catch {}
        }
      }
    } catch (err) {
      console.error('AI redo failed', err);
    } finally {
      setIsRedoing(false);
    }
  }

  // D-19: Inline save — called on blur or Enter in contenteditable
  async function handleInlineSave(index: number) {
    if (!presentation || inlineSavePending.current) return;
    inlineSavePending.current = true;
    const updatedSlides = presentation.slides.map((s, i) =>
      i === index ? { ...s, heading: inlineHeading, body: inlineBody } : s
    );
    setInlineEditIndex(null);
    queryClient.setQueryData<PublicPresentation>(queryKey, (old) =>
      old ? { ...old, slides: updatedSlides } : old
    );
    try {
      await fetch(`/api/presentations/${presentation.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slides: updatedSlides }),
      });
    } catch (err) {
      console.error('Inline save failed', err);
      queryClient.invalidateQueries({ queryKey });
    } finally {
      inlineSavePending.current = false;
    }
  }

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
        {currentSlide.style?.bgVideoUrl && (
          <video
            key={currentSlide.style.bgVideoUrl}
            autoPlay
            muted
            loop
            playsInline
            className="absolute inset-0 w-full h-full object-cover pointer-events-none z-0"
            onError={(e) => { (e.target as HTMLVideoElement).style.display = 'none'; }}
          >
            <source src={currentSlide.style.bgVideoUrl} />
          </video>
        )}
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
            className="relative z-10 px-8 max-w-3xl md:max-w-4xl lg:max-w-5xl mx-auto w-full group"
            style={buildSlideStyle(currentSlide.style)}
          >
            {isEditMode && (
              <div className="absolute top-2 right-2 z-50 flex gap-1 bg-black/60 rounded-md p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  title="Delete slide"
                  onClick={() => handleDeleteSlide(currentIndex)}
                  className="p-1.5 rounded hover:bg-white/10 text-white/70 hover:text-white transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  title="AI redo"
                  onClick={() => handleRedoSlide(currentIndex)}
                  disabled={isRedoing}
                  className="p-1.5 rounded hover:bg-white/10 text-white/70 hover:text-white transition-colors disabled:opacity-40"
                >
                  <RefreshCw className={`w-4 h-4 ${isRedoing ? 'animate-spin' : ''}`} />
                </button>
                <button
                  type="button"
                  title="Edit text"
                  onClick={() => {
                    setInlineEditIndex(currentIndex);
                    setInlineHeading(currentSlide.heading ?? '');
                    setInlineBody(currentSlide.body ?? '');
                  }}
                  className="p-1.5 rounded hover:bg-white/10 text-white/70 hover:text-white transition-colors"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              </div>
            )}
            <SlideContent slide={currentSlide} lang={lang} />
          </motion.div>
        </AnimatePresence>
        {isEditMode && inlineEditIndex === currentIndex && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-4 px-8 bg-zinc-950/95">
            <p className="text-zinc-400 text-xs uppercase tracking-widest">Editing slide {currentIndex + 1}</p>
            <div
              contentEditable
              suppressContentEditableWarning
              onInput={(e) => setInlineHeading(e.currentTarget.textContent ?? '')}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleInlineSave(currentIndex); } }}
              onBlur={() => handleInlineSave(currentIndex)}
              className="w-full max-w-2xl text-3xl font-semibold text-white outline-none border-b border-white/20 pb-2 empty:before:content-['Heading...'] empty:before:text-zinc-600"
            >
              {inlineHeading}
            </div>
            <div
              contentEditable
              suppressContentEditableWarning
              onInput={(e) => setInlineBody(e.currentTarget.textContent ?? '')}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleInlineSave(currentIndex); } }}
              onBlur={() => handleInlineSave(currentIndex)}
              className="w-full max-w-2xl text-lg text-zinc-300 outline-none border-b border-white/10 pb-2 empty:before:content-['Body text...'] empty:before:text-zinc-600"
            >
              {inlineBody}
            </div>
            <button
              type="button"
              onClick={() => setInlineEditIndex(null)}
              className="text-xs text-zinc-500 hover:text-zinc-300"
            >
              Cancel (Esc)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
