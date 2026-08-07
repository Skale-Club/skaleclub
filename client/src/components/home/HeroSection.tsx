import type { CompanySettings, HomepageContent } from "@shared/schema";
import { useTranslation } from "@/hooks/useTranslation";
import { trackCTAClick } from "@/lib/analytics";
import { TrustBadges } from "@/components/home/TrustBadges";

interface HeroSectionProps {
  companySettings?: CompanySettings;
  homepageContent: Partial<HomepageContent>;
  onCtaClick: () => void;
  /**
   * Render the trust bar inside the hero. The homepage opts out and renders it
   * as its own section that bleeds up over the hero; dynamic landings using the
   * `hero` section type keep the badges inline.
   */
  showTrustBadges?: boolean;
}

export function HeroSection({ companySettings, homepageContent, onCtaClick, showTrustBadges = true }: HeroSectionProps) {
  const { t } = useTranslation();
  const heroImageUrl = (companySettings?.heroImageUrl || '').trim();
  const trustBadges = homepageContent.trustBadges || [];
  // ── Trust-bar bleed contract ──────────────────────────────────────────
  // Must exactly match Home.tsx's trust-bar `mt-[…]` bleed values (and its
  // fill div's `top-[…]`) at every breakpoint. Equal (not larger) so the
  // photo's bottom edge sits flush against the card's top edge — glued, not
  // floating with a gap, and not clipped by overlap either. If you change
  // one, change all three.
  const bottomPadding = showTrustBadges
    ? 'pb-[1.275rem] sm:pb-[1.7rem] lg:pb-[1.275rem]'
    : 'pb-[3.4rem] md:pb-[6.0625rem] lg:pb-[4.0625rem]';

  return (
    <section className={`relative flex flex-col justify-end pt-[5.95rem] sm:pt-[5.1rem] lg:pt-[2.55rem] ${bottomPadding} overflow-hidden bg-[#1C53A3] min-h-[100dvh]`}>
      <div className="container-custom mx-auto relative z-10">
        {/* Below tablet (770px): stacked, image full-width beneath the text
            (grid-cols-1). From tablet up: the photo is pinned at its full,
            frozen 560px — never shrunk — as an absolutely-positioned panel
            on the right (see the image wrapper below); the text stays at its
            own full 560px and simply overlaps it (z-20 over z-10) whenever
            the viewport isn't wide enough to fit both side by side. Nothing
            about either element's size changes across this range — only
            whether they happen to overlap. */}
        <div className="grid grid-cols-1 tablet:block relative gap-1 sm:gap-[1.275rem] lg:gap-[1.7rem] items-end">
          <div className="order-1 lg:order-1 text-white pt-[1.275rem] sm:pt-[1.7rem] tablet:pt-[3.4rem] pb-[3.4rem] sm:pb-[5.1rem] tablet:pb-[6.8rem] tablet:translate-y-0 sm:max-w-[420px] min-[963px]:max-w-[560px] relative z-20">
            {homepageContent.heroBadgeImageUrl ? (
              <div className="mt-[0.85rem] sm:mt-0 mb-3 tablet:mb-[1.275rem]">
                <img
                  src={homepageContent.heroBadgeImageUrl}
                  alt={homepageContent.heroBadgeAlt || ''}
                  className="h-5 sm:h-6 w-auto object-contain"
                />
              </div>
            ) : null}
            <h1 className="text-[9vw] sm:text-5xl font-bold mb-3 tablet:mb-[1.275rem] font-display leading-[1.05] sm:leading-[1.1]">
              {companySettings?.heroTitle ? (
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-blue-200">{t(companySettings.heroTitle)}</span>
              ) : null}
            </h1>
            <p className="text-base sm:text-xl text-blue-50/80 mb-[0.85rem] tablet:mb-[1.7rem] leading-relaxed max-w-xl">
              {companySettings?.heroSubtitle ? t(companySettings.heroSubtitle) : ""}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 tablet:gap-[1.0625rem] flex-wrap">
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
          <div className="order-2 lg:order-2 relative flex h-full items-end justify-center self-end w-full z-10 tablet:absolute tablet:inset-y-0 tablet:right-0 tablet:w-[560px]">
            {heroImageUrl ? (
              <img
                src={heroImageUrl}
                alt={companySettings?.companyName || ""}
                fetchPriority="high"
                loading="eager"
                className="w-[92vw] sm:w-[98%] tablet:w-full max-w-[380px] sm:max-w-[430px] tablet:max-w-[560px] object-contain drop-shadow-2xl origin-bottom"
              />
            ) : (
              <div className="w-[92vw] sm:w-[98%] tablet:w-full max-w-[380px] sm:max-w-[430px] tablet:max-w-[560px]" />
            )}
          </div>
        </div>

        {showTrustBadges && trustBadges.length > 0 && (
          <div className="mt-0">
            <TrustBadges badges={trustBadges} />
          </div>
        )}
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
