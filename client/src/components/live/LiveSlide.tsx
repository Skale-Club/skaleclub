import { useEffect, useRef } from 'react';
import { SlideContent, buildSlideStyle } from '@/components/SlideRenderer';
import { SectionContent } from '@/pages/EstimateViewer';
import type { LiveSnapshot, LiveState } from '@shared/liveSharing';

export function LiveSlide({ snapshot, state }: { snapshot: LiveSnapshot; state: LiveState }) {
  const scroll = useRef<HTMLDivElement>(null);
  useEffect(() => { scroll.current?.scrollTo({ top: 0, left: 0 }); }, [state.slideIndex]);
  const slide = snapshot.kind === 'presentation' ? snapshot.slides[state.slideIndex] : null;
  return <main ref={scroll} data-testid="live-slide" className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain bg-zinc-950 text-white"
    style={slide ? buildSlideStyle(slide.style, slide.layout) : undefined}>
    {slide?.style?.bgVideoUrl && <video key={slide.style.bgVideoUrl} autoPlay muted loop playsInline poster={slide.style.bgImageUrl || undefined}
      className="pointer-events-none absolute inset-0 h-full w-full object-cover" src={slide.style.bgVideoUrl} />}
    <div className="relative flex min-h-full items-center justify-center py-12 md:py-16">
      {snapshot.kind === 'estimate'
        ? <SectionContent index={state.slideIndex} data={snapshot.estimate} lang={state.language} siteSettings={snapshot.branding} />
        : slide && <div className="w-full max-w-5xl px-6 sm:px-8 md:px-12 lg:px-16"><SlideContent slide={slide} lang={state.language} brandName={snapshot.branding.companyName || undefined} /></div>}
    </div>
  </main>;
}
