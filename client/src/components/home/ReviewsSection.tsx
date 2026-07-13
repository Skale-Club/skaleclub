import { useEffect, useRef } from "react";
import { useTranslation } from "@/hooks/useTranslation";

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
        style={{ minWidth: '100%', width: '100%', height: '488px', border: 'none', display: 'block', borderRadius: '0', background: '#111111' }}
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
    <section className="pt-20 pb-20 bg-[#111111] overflow-hidden mb-0 text-white">
      <div className="w-full space-y-10">
        <div className="container-custom mx-auto text-center">
          <h2 className="text-3xl md:text-5xl font-bold mb-4 text-white">
            {t(title || '')}
          </h2>
          <p className="text-slate-300 max-w-2xl mx-auto text-lg">
            {t(subtitle || '')}
          </p>
        </div>
        {embedUrl ? (
          <div className="w-full px-0">
            <div className="bg-[#111111]">
              <EmbedRenderer code={embedUrl.trim()} />
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
