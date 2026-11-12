import type { CompanySettings, HomepageContent } from "@shared/schema";
import { useTranslation } from "@/hooks/useTranslation";
import { trackCTAClick } from "@/lib/analytics";
import { TrustBadges } from "@/components/home/TrustBadges";
import { Band, PillButton } from "@/components/editorial";

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
  // With the trust bar inline the hero keeps its own bottom padding. On the
  // homepage (showTrustBadges=false) the hero ends flush at the photo's bottom
  // edge and paints no background of its own: the wrapper in Home.tsx owns the
  // navy + grid so it runs unbroken behind the top half of the trust card,
  // which straddles the hero/next-section boundary.
  const bottomPadding = showTrustBadges ? 'pb-[1.275rem] min-[740px]:pb-[1.7rem] lg:pb-[1.275rem]' : 'bg-transparent';
  // Homepage photo panel (the file is cropped at the hips, 1024x1180).
  // Phones show the whole photo. Tablets hang the panel 2rem below the hero,
  // clipped at the trust card, with 1rem of air under the header. Desktop
  // (>=963px) makes the panel 14.56% taller than the space under the header
  // (1rem of air) and hangs that extra below the hero: the bottom 150/1180 of
  // the photo is hidden, so it reads as cropped at the waistband and the
  // people render larger. Percent heights keep the img's max-h-full resolvable.
  const photoInset = showTrustBadges
    ? 'min-[740px]:inset-y-0'
    : 'min-[740px]:top-auto min-[740px]:-bottom-8 min-[740px]:h-[calc(100%+1rem)] min-[963px]:h-[calc((100%-1rem)*1.1456)] min-[963px]:bottom-[calc((100%-1rem)*-0.1456)]';

  // From tablet up the text column is vertically centered in the hero's
  // *visible* band: the section pt matches the overlaying header's height
  // (--nav-offset, defined in index.css), so the flex centering inside splits
  // only the space the user actually sees.
  return (
    <Band
      tone="hero"
      heroVariant="homepage"
      pattern={showTrustBadges}
      className={`relative flex flex-col justify-end overflow-hidden border-b-0 ${bottomPadding} min-h-[min(100dvh,620px)] min-[740px]:min-h-[min(100dvh,500px)] tablet:min-h-[min(100dvh,540px)]`}
      containerClassName="relative z-10 pt-[calc(var(--nav-offset)+0.825rem)] min-[740px]:pt-[var(--nav-offset)] min-[740px]:flex-1 min-[740px]:flex min-[740px]:flex-col"
    >
        {/* Below 740px: stacked like a phone (grid-cols-1), text centred and
            the photo beneath it (full-bleed on phones, capped at 480px from
            560px). From 740px (iPad mini) up: side by side, the text on the
            left and the photo as an absolutely-positioned panel on the right
            (see the image wrapper below). Narrower than that, the two could
            not fit side by side without the text covering the photo. */}
        <div className="grid grid-cols-1 min-[740px]:flex min-[740px]:items-center min-[740px]:flex-1 relative gap-1 min-[740px]:gap-[1.275rem] lg:gap-[1.7rem] items-end">
          {/* container-editorial pads 20px on phones, so the photo column below
              pulls out with -mx-5 to stay full-bleed there. */}
          <div className="order-1 lg:order-1 text-white text-center min-[740px]:text-left pt-[1.275rem] min-[740px]:pt-0 pb-[1.7rem] min-[740px]:pb-0 tablet:translate-y-0 min-[740px]:self-center min-[740px]:max-w-[420px] min-[963px]:max-w-[540px] xl:max-w-[600px] relative z-20">
            {homepageContent.heroBadgeImageUrl ? (
              <div className="mt-[0.85rem] min-[740px]:mt-0 mb-3 tablet:mb-[1.275rem]">
                <img
                  src={homepageContent.heroBadgeImageUrl}
                  alt={homepageContent.heroBadgeAlt || ''}
                  width={96}
                  height={24}
                  className="h-5 min-[740px]:h-6 w-auto object-contain"
                />
              </div>
            ) : null}
            {/* Type ramp: fluid 9vw on phones (clamped so it never dips under
                34px or blows past 54px), fixed 48px from sm, 56px on wide
                desktops — where the column also widens so the title keeps
                breaking into two lines, not three. Below desktop (<963px) the
                title is capped at 8.4em (between "Repetitive Work." ≈7.3em and
                "Stop Doing Repetitive" ≈9.6em), so phones and tablets break it
                into three lines; em keeps it right as the font scales. */}
            <h1 className="max-w-[8.4em] mx-auto min-[740px]:mx-0 min-[963px]:max-w-none text-[clamp(2.125rem,9vw,3.375rem)] min-[740px]:text-[2.7rem] tablet:text-5xl min-[963px]:text-[3.5rem] font-display font-semibold tracking-[-0.04em] leading-[0.98] text-fog-50 mb-3 tablet:mb-[1.275rem]">
              {companySettings?.heroTitle ? (
                t(companySettings.heroTitle)
              ) : null}
            </h1>
            {/* text-balance distributes the copy evenly across however many
                lines it ends up on, instead of greedily filling each line and
                leaving a short orphan on the last one. Below desktop (<963px)
                it is capped at 17em so phones and tablets get three lines (and
                tablets keep it clear of the overlapping photo); desktop keeps
                max-w-xl and two lines. */}
            <p className="text-base min-[740px]:text-lg tablet:text-xl text-fog-400 mb-[0.85rem] tablet:mb-[1.7rem] leading-relaxed max-w-[17em] mx-auto min-[740px]:mx-0 min-[963px]:max-w-xl text-balance">
              {companySettings?.heroSubtitle ? t(companySettings.heroSubtitle) : ""}
            </p>
            <div className="flex flex-col min-[740px]:flex-row gap-3 tablet:gap-[1.0625rem] flex-wrap">
              {companySettings?.ctaText ? (
                <PillButton
                  data-form-trigger="lead-form"
                  data-floating-lead-source
                  className="w-full min-[740px]:w-auto shrink-0 whitespace-nowrap px-6 min-[740px]:px-8 py-3 min-[740px]:py-4 text-base min-[740px]:text-lg"
                  onClick={() => {
                    onCtaClick();
                    trackCTAClick('hero', companySettings?.ctaText || '');
                  }}
                  data-testid="button-hero-form"
                >
                  {t(companySettings.ctaText)}
                </PillButton>
              ) : null}
            </div>
          </div>
          {/* On the homepage (trust bar outside the hero) the photo panel
              starts a little below the header so the hair stays off it (see
              photoInset). Inline-badge heroes keep the full band height. */}
          <div className={`order-2 lg:order-2 -mx-5 min-[740px]:mx-0 relative flex h-full items-end justify-center self-end w-full z-10 min-[740px]:absolute ${photoInset} min-[740px]:right-0 tablet:right-[max(0px,calc((100%-900px)/2))] min-[963px]:right-0 min-[740px]:w-[min(460px,calc(100vw-300px))] tablet:w-[480px] min-[963px]:w-[560px]`}>
            {heroImageUrl ? (
              <img
                src={heroImageUrl}
                alt={companySettings?.companyName || ""}
                width={560}
                height={560}
                // React 18's DOM only forwards the lowercase attribute (camelCase
                // triggers an unknown-prop warning), but the TS types only know
                // the camelCase spelling — hence the spread.
                fetchPriority="high"
                loading="eager"
                // max-h caps the photo at the visible band's height so short
                // viewports scale it down instead of clipping the hair at the
                // section's top edge; object-bottom keeps it glued to the
                // trust bar while it shrinks.
                className="w-full max-w-none min-[560px]:max-w-[480px] min-[740px]:max-w-[460px] tablet:max-w-[480px] min-[963px]:max-w-[560px] min-[740px]:max-h-full object-contain object-bottom drop-shadow-2xl origin-bottom"
              />
            ) : (
              <div className="w-full max-w-none min-[560px]:max-w-[480px] min-[740px]:max-w-[460px] tablet:max-w-[480px] min-[963px]:max-w-[560px]" />
            )}
          </div>
        </div>

        {showTrustBadges && trustBadges.length > 0 && (
          <div className="mt-0">
            <TrustBadges badges={trustBadges} />
          </div>
        )}
    </Band>
  );
}
