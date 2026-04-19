import type { CompanySettings, HomepageContent } from "@shared/schema";
import { useTranslation } from "@/hooks/useTranslation";
import { trackCTAClick } from "@/lib/analytics";

interface HeroSectionProps {
  companySettings?: CompanySettings;
  homepageContent: Partial<HomepageContent>;
  onCtaClick: () => void;
}

export function HeroSection({ companySettings, homepageContent, onCtaClick }: HeroSectionProps) {
  const { t } = useTranslation();
  const heroImageUrl = (companySettings?.heroImageUrl || '').trim();

  return (
    <section className="relative flex items-end pt-28 sm:pt-24 lg:pt-16 pb-36 sm:pb-48 lg:pb-4 overflow-hidden bg-[#1C53A3] min-h-[70vh] sm:min-h-[55vh] lg:min-h-[550px]">
      <div className="container-custom mx-auto relative z-10 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-1 sm:gap-6 lg:gap-8 items-end">
          <div className="order-1 lg:order-2 text-white pt-6 sm:pt-8 lg:pt-16 pb-16 sm:pb-24 lg:pb-32 lg:translate-y-0 relative z-20">
            {homepageContent.heroBadgeImageUrl ? (
              <div className="mt-4 sm:mt-0 mb-3 lg:mb-6">
                <img
                  src={homepageContent.heroBadgeImageUrl}
                  alt={homepageContent.heroBadgeAlt || ''}
                  className="h-5 sm:h-6 w-auto object-contain"
                />
              </div>
            ) : null}
            <h1 className="text-[9vw] sm:text-5xl md:text-6xl lg:text-4xl xl:text-5xl font-bold mb-3 lg:mb-6 font-display leading-[1.05] sm:leading-[1.1]">
              {companySettings?.heroTitle ? (
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-blue-200">{t(companySettings.heroTitle)}</span>
              ) : null}
            </h1>
            <p className="text-base sm:text-xl text-blue-50/80 mb-4 lg:mb-8 leading-relaxed max-w-xl">
              {companySettings?.heroSubtitle ? t(companySettings.heroSubtitle) : ""}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 lg:gap-5 flex-wrap">
              {companySettings?.ctaText ? (
                <button
                  data-form-trigger="lead-form"
                  className="w-full sm:w-auto shrink-0 px-6 sm:px-8 py-3 sm:py-4 bg-[#406EF1] hover:bg-[#355CD0] hover:scale-105 text-white font-bold rounded-full transition-all flex items-center justify-center gap-2 text-base sm:text-lg whitespace-nowrap"
                  onClick={() => {
                    onCtaClick();
                    trackCTAClick('hero', companySettings?.ctaText || '');
                  }}
                  data-testid="button-hero-form"
                >
                  {t(companySettings.ctaText)}
                </button>
              ) : null}
            </div>
          </div>
          <div className="order-2 lg:order-1 relative flex h-full items-end justify-center lg:justify-end self-end w-full lg:min-h-[400px] z-10 lg:ml-[-3%]">
            {heroImageUrl ? (
              <img
                src={heroImageUrl}
                alt={companySettings?.companyName || ""}
                className="w-[92vw] sm:w-[98%] lg:w-full max-w-[380px] sm:max-w-[360px] md:max-w-[430px] lg:max-w-[500px] xl:max-w-[560px] object-contain drop-shadow-2xl origin-bottom"
              />
            ) : (
              <div className="w-[92vw] sm:w-[98%] lg:w-full max-w-[380px] sm:max-w-[360px] md:max-w-[430px] lg:max-w-[500px] xl:max-w-[560px]" />
            )}
          </div>
        </div>
      </div>

      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse at center, transparent 40%, rgba(0, 0, 0, 0.35) 80%, rgba(0, 0, 0, 0.85) 100%),
            radial-gradient(circle at 65% 10%, rgba(100, 135, 215, 0.30) 0%, transparent 60%),
            linear-gradient(
              to right bottom,
              #09152d,
              #0b152a,
              #0d1427,
              #0f1424,
              #101421,
              #121622,
              #151723,
              #171924,
              #1c1c29,
              #21202e,
              #262332,
              #2c2637
            )
          `
        }}
      ></div>
    </section>
  );
}
