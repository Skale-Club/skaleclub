import { useEffect, useRef } from "react";
import { Star } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { SectionHeading } from "@/components/layout/SectionHeading";

interface ReviewsSectionProps {
  embedUrl?: string;
  title?: string;
  subtitle?: string;
}

type EmbedType = 'url' | 'iframe' | 'script';

function getEmbedType(embed: string): EmbedType {
  const t = embed.trim();
  if (t.includes('<iframe')) return 'iframe';
  if (t.includes('<script')) return 'script';
  return 'url';
}

function EmbedRenderer({ code }: { code: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const type = getEmbedType(code);

  useEffect(() => {
    if (type !== 'script') return;

    const parser = new DOMParser();
    const doc = parser.parseFromString(code, 'text/html');
    const scripts = Array.from(doc.querySelectorAll('script'));
    const injected: HTMLScriptElement[] = [];

    scripts.forEach((s) => {
      const el = document.createElement('script');
      Array.from(s.attributes).forEach((a) => el.setAttribute(a.name, a.value));
      el.textContent = s.textContent ?? '';
      document.body.appendChild(el);
      injected.push(el);
    });

    return () => injected.forEach((s) => s.remove());
  }, [code, type]);

  if (type === 'url') {
    return (
      <iframe
        className="lc_reviews_widget rounded-none"
        src={code}
        frameBorder="0"
        scrolling="no"
        style={{ minWidth: '100%', width: '100%', height: '488px', border: 'none', display: 'block', borderRadius: '0', background: 'var(--surface-dark)' }}
        onLoad={() => {
          const script = document.createElement('script');
          script.type = 'text/javascript';
          script.src = 'https://reputationhub.site/reputation/assets/review-widget.js';
          document.body.appendChild(script);
        }}
      />
    );
  }

  if (type === 'iframe') {
    return (
      <div
        className="w-full [&_iframe]:w-full [&_iframe]:min-w-full [&_iframe]:border-none [&_iframe]:block"
        dangerouslySetInnerHTML={{ __html: code }}
      />
    );
  }

  // script — inject via useEffect above; render any container HTML (divs, etc.)
  const containerHtml = code.replace(/<script[\s\S]*?<\/script>/gi, '').trim();
  return (
    <div
      ref={containerRef}
      className="w-full"
      dangerouslySetInnerHTML={{ __html: containerHtml }}
    />
  );
}

export function ReviewsSection({ embedUrl, title, subtitle }: ReviewsSectionProps) {
  const { t } = useTranslation();

  if (!embedUrl && !title && !subtitle) {
    return null;
  }

  return (
    <section className="section-y bg-surface-dark overflow-hidden mb-0 text-white">
      <div className="w-full space-y-[2.125rem]">
        <div className="container-custom mx-auto">
          <SectionHeading eyebrow="Reviews" icon={Star} title={title || ''} subtitle={subtitle || ''} />
        </div>
        {embedUrl ? (
          // Full-bleed like the services carousels: span the viewport edge to
          // edge at every breakpoint; the section's overflow-hidden clips the
          // scrollbar-width excess of w-screen.
          <div className="relative w-screen left-1/2 -translate-x-1/2">
            <div className="bg-surface-dark">
              <EmbedRenderer code={embedUrl.trim()} />
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
