import React from 'react';
import type { SlideBlock } from '@shared/schema';

// ─── Utilities ─────────────────────────────────────────────────────────────────

export function resolveField(
  en: string | undefined,
  pt: string | undefined,
  activeLang: string,
): string {
  if (activeLang === 'pt-BR') return pt || en || '';
  return en || '';
}

export function buildSlideStyle(s?: SlideBlock['style']): React.CSSProperties {
  if (!s) return {};
  const css: React.CSSProperties = {};
  if (s.textColor) css.color = s.textColor;
  if (s.bgImageUrl && !s.bgVideoUrl) {
    css.backgroundImage = `url(${s.bgImageUrl})`;
    css.backgroundSize = 'cover';
    css.backgroundPosition = 'center';
  } else if (s.bgColor) {
    css.background = s.bgColor;
  }
  return css;
}

function alignmentStyle(alignment?: 'left' | 'center' | 'right'): React.CSSProperties {
  if (!alignment) return {};
  return {
    textAlign: alignment,
    alignItems: alignment === 'left' ? 'flex-start' : alignment === 'right' ? 'flex-end' : 'center',
  };
}

// ─── SlideContent ──────────────────────────────────────────────────────────────

export function SlideContent({ slide, lang }: { slide: SlideBlock; lang: string }) {
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
          <div
            className="flex-1 bg-zinc-800 bg-cover bg-center"
            style={slide.style?.bgImageUrl ? { backgroundImage: `url(${slide.style.bgImageUrl})` } : {}}
          />
          <div className="flex-1 flex items-center justify-center md:justify-start px-8 py-12 md:py-0 md:px-16 lg:px-24">
            <div className="max-w-2xl" style={alignmentStyle(slide.style?.alignment)}>
              {heading && (
                <h2
                  style={{ fontFamily: "'Outfit', sans-serif", ...(slide.style?.headingColor ? { color: slide.style.headingColor } : {}) }}
                  className="text-4xl md:text-5xl lg:text-6xl font-semibold text-white mb-6 leading-tight"
                >{heading}</h2>
              )}
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

    case 'image-left':
      return (
        <div className="w-full h-full absolute inset-0 flex flex-col md:flex-row">
          <div
            className="md:w-2/5 bg-zinc-800 bg-cover bg-center"
            style={slide.style?.bgImageUrl ? { backgroundImage: `url(${slide.style.bgImageUrl})` } : {}}
          />
          <div className="md:w-3/5 flex items-center justify-start px-8 py-12 md:py-0 md:px-16 lg:px-24">
            <div className="max-w-2xl" style={alignmentStyle(slide.style?.alignment)}>
              {heading && (
                <h2
                  style={{ fontFamily: "'Outfit', sans-serif", ...(slide.style?.headingColor ? { color: slide.style.headingColor } : {}) }}
                  className="text-4xl md:text-5xl lg:text-6xl font-semibold text-white mb-6 leading-tight"
                >{heading}</h2>
              )}
              {body && <p className="text-lg md:text-xl lg:text-2xl text-zinc-400 leading-relaxed">{body}</p>}
            </div>
          </div>
        </div>
      );

    case 'image-right':
      return (
        <div className="w-full h-full absolute inset-0 flex flex-col md:flex-row">
          <div className="md:w-3/5 flex items-center justify-start px-8 py-12 md:py-0 md:px-16 lg:px-24">
            <div className="max-w-2xl" style={alignmentStyle(slide.style?.alignment)}>
              {heading && (
                <h2
                  style={{ fontFamily: "'Outfit', sans-serif", ...(slide.style?.headingColor ? { color: slide.style.headingColor } : {}) }}
                  className="text-4xl md:text-5xl lg:text-6xl font-semibold text-white mb-6 leading-tight"
                >{heading}</h2>
              )}
              {body && <p className="text-lg md:text-xl lg:text-2xl text-zinc-400 leading-relaxed">{body}</p>}
            </div>
          </div>
          <div
            className="md:w-2/5 bg-zinc-800 bg-cover bg-center"
            style={slide.style?.bgImageUrl ? { backgroundImage: `url(${slide.style.bgImageUrl})` } : {}}
          />
        </div>
      );

    case 'full-bleed-image':
      return (
        <div className="w-full h-full absolute inset-0">
          <div className="absolute inset-0 bg-black/30 z-0" />
          <div className="relative z-10 h-full flex items-center justify-center px-8 py-12">
            <div className="text-center max-w-4xl" style={alignmentStyle(slide.style?.alignment)}>
              {heading && (
                <h2
                  style={{ fontFamily: "'Outfit', sans-serif", ...(slide.style?.headingColor ? { color: slide.style.headingColor } : {}) }}
                  className="text-4xl md:text-5xl lg:text-6xl font-semibold text-white mb-6 leading-tight drop-shadow-lg"
                >{heading}</h2>
              )}
              {body && <p className="text-base md:text-lg lg:text-xl text-white/90 max-w-2xl mx-auto leading-relaxed drop-shadow">{body}</p>}
            </div>
          </div>
        </div>
      );

    case 'quote': {
      const attribution = resolveField(slide.attribution, slide.attributionPt, lang);
      return (
        <div className="text-center max-w-3xl mx-auto" style={alignmentStyle(slide.style?.alignment)}>
          <p
            style={{ fontFamily: "'Outfit', sans-serif", ...(slide.style?.headingColor ? { color: slide.style.headingColor } : {}) }}
            className="text-3xl md:text-4xl lg:text-5xl font-semibold text-white leading-snug mb-8"
          >
            &ldquo;{heading}&rdquo;
          </p>
          {attribution && (
            <p className="text-zinc-400 text-base md:text-lg uppercase tracking-widest">— {attribution}</p>
          )}
        </div>
      );
    }

    default:
      return <p className="text-zinc-400 text-base md:text-lg lg:text-xl">{heading}</p>;
  }
}

// ─── SlidePreview ──────────────────────────────────────────────────────────────
// Renders a slide scaled down to a thumbnail. scale=1 is 1280×720px.

const SLIDE_W = 1280;
const SLIDE_H = 720;

export function SlidePreview({
  slide,
  lang = 'en',
  scale = 0.38,
  className,
}: {
  slide: SlideBlock;
  lang?: string;
  scale?: number;
  className?: string;
}) {
  const outerW = Math.round(SLIDE_W * scale);
  const outerH = Math.round(SLIDE_H * scale);
  const slideStyle = buildSlideStyle(slide.style);

  return (
    <div
      className={className}
      style={{ width: outerW, height: outerH, overflow: 'hidden', position: 'relative', borderRadius: 6, flexShrink: 0 }}
    >
      <div
        style={{
          width: SLIDE_W,
          height: SLIDE_H,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          position: 'relative',
          backgroundColor: '#09090b',
          ...slideStyle,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 80,
          boxSizing: 'border-box',
          overflow: 'hidden',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        <SlideContent slide={slide} lang={lang} />
      </div>
    </div>
  );
}
