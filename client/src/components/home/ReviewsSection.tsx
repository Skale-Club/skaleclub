import { useTranslation } from "@/hooks/useTranslation";

interface ReviewsSectionProps {
  embedUrl?: string;
  title?: string;
  subtitle?: string;
}

export function ReviewsSection({ embedUrl, title, subtitle }: ReviewsSectionProps) {
  const { t } = useTranslation();

  if (!embedUrl && !title && !subtitle) {
    return null;
  }

  return (
    <section className="pt-6 sm:pt-10 lg:pt-12 pb-0 bg-[#111111] overflow-hidden mb-0 text-white">
      <div className="w-full">
        <div className="container-custom mx-auto mb-16 text-center">
          <h2 className="text-3xl md:text-5xl font-bold mb-4 text-white">
            {t(title || '')}
          </h2>
          <p className="text-slate-300 max-w-2xl mx-auto text-lg">
            {t(subtitle || '')}
          </p>
        </div>
        {embedUrl ? (
          <div className="w-full px-0">
            <div className="pb-0 bg-[#111111] -mt-6 sm:-mt-8 lg:-mt-10">
              <iframe
                className="lc_reviews_widget rounded-none"
                src={embedUrl}
                frameBorder='0'
                scrolling='no'
                style={{ minWidth: '100%', width: '100%', height: '488px', border: 'none', display: 'block', borderRadius: '0', background: '#111111' }}
                onLoad={() => {
                  const script = document.createElement('script');
                  script.type = 'text/javascript';
                  script.src = 'https://reputationhub.site/reputation/assets/review-widget.js';
                  document.body.appendChild(script);
                }}
              ></iframe>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
