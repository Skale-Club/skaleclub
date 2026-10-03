import type { CompanySettings, HomepageContent } from "@shared/schema";
import { useTranslation } from "@/hooks/useTranslation";
import { useSiteWhatsappHref } from "@/hooks/use-site-whatsapp";
import { trackCTAClick, trackEvent } from "@/lib/analytics";
import { TrustBadges } from "@/components/home/TrustBadges";
import { Band, PillButton, PillLink } from "@/components/editorial";

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
  const whatsappLink = useSiteWhatsappHref(companySettings?.companyPhone);
  const heroImageUrl = (companySettings?.heroImageUrl || '').trim();
  const trustBadges = homepageContent.trustBadges || [];
  // ── Trust-bar bleed contract ──────────────────────────────────────────
  // Source of truth: the `--trust-bleed` var set per breakpoint by
  // `.trust-bar-bleed` in index.css, applied on the wrapper around this
  // section + the trust bar in Home.tsx. Home.tsx's trust-bar `mt-[…]`
  // bleed and its fill div's `top-[…]` read the same var. Equal (not
  // larger) so the photo's bottom edge sits flush against the card's top
  // edge — glued, not floating with a gap, and not clipped by overlap
  // either. Change the var once in index.css to change all three.
  const bottomPadding = showTrustBadges
    ? 'pb-[1.275rem] sm:pb-[1.7rem] lg:pb-[1.275rem]'
    : 'pb-[var(--trust-bleed)]';

  // From tablet up the text column is vertically centered in the hero's
  // *visible* band: the section pt matches the overlaying header's height
  // (--nav-offset, defined in index.css) and the pb variants match the
  // trust-bar bleed, so the flex centering inside splits only the space the
  // user actually sees.
  return (
    <Band
      tone="hero"
      pattern
      className={`relative flex flex-col justify-end overflow-hidden border-b-0 ${bottomPadding} min-h-[min(100dvh,620px)] sm:min-h-[min(100dvh,540px)] tablet:min-h-[min(100dvh,620px)]`}
      containerClassName="relative z-10 pt-[calc(var(--nav-offset)+0.825rem)] sm:pt-[var(--nav-offset)] sm:flex-1 sm:flex sm:flex-col"
    >
        {/* Below tablet (770px): stacked, image full-width beneath the text
            (grid-cols-1). From tablet up: the photo is pinned at its full,
            frozen 560px — never shrunk — as an absolutely-positioned panel
            on the right (see the image wrapper below); the text keeps its
            own full 560px and simply overlaps it (z-20 over z-10) whenever
            the viewport isn't wide enough to fit both side by side. Nothing
            about either element's size changes across this range — only
            whether they happen to overlap. */}
        <div className="grid grid-cols-1 sm:flex sm:items-center sm:flex-1 relative gap-1 sm:gap-[1.275rem] lg:gap-[1.7rem] items-end">
          {/* container-editorial pads 20px on phones, so the photo column below
              pulls out with -mx-5 to stay full-bleed there. */}
          <div className="order-1 lg:order-1 text-white pt-[1.275rem] sm:pt-0 pb-[1.7rem] sm:pb-0 tablet:translate-y-0 sm:self-center sm:max-w-[420px] min-[963px]:max-w-[540px] xl:max-w-[600px] relative z-20">
            {homepageContent.heroBadgeImageUrl ? (
              <div className="mt-[0.85rem] sm:mt-0 mb-3 tablet:mb-[1.275rem]">
                <img
                  src={homepageContent.heroBadgeImageUrl}
                  alt={homepageContent.heroBadgeAlt || ''}
                  width={96}
                  height={24}
                  className="h-5 sm:h-6 w-auto object-contain"
                />
              </div>
            ) : null}
            {/* Type ramp: fluid 9vw on phones (clamped so it never dips under
                34px or blows past 54px), fixed 48px from sm, 56px on wide
                desktops — where the column also widens so the title keeps
                breaking into two lines, not three. */}
            <h1 className="text-[clamp(2.125rem,9vw,3.375rem)] sm:text-[2.7rem] tablet:text-5xl min-[963px]:text-[3.5rem] font-display font-semibold tracking-[-0.04em] leading-[0.98] text-fog-50 mb-3 tablet:mb-[1.275rem]">
              {companySettings?.heroTitle ? (
                t(companySettings.heroTitle)
              ) : null}
            </h1>
            {/* text-balance distributes the copy evenly across however many
                lines it ends up on, instead of greedily filling each line and
                leaving a short orphan on the last one. */}
            <p className="text-base sm:text-lg tablet:text-xl text-fog-400 mb-[0.85rem] tablet:mb-[1.7rem] leading-relaxed max-w-xl text-balance">
              {companySettings?.heroSubtitle ? t(companySettings.heroSubtitle) : ""}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 tablet:gap-[1.0625rem] flex-wrap">
              {companySettings?.ctaText ? (
                <PillButton
                  data-form-trigger="lead-form"
                  className="w-full sm:w-auto shrink-0 whitespace-nowrap px-6 sm:px-8 py-3 sm:py-4 text-base sm:text-lg"
                  onClick={() => {
                    onCtaClick();
                    trackCTAClick('hero', companySettings?.ctaText || '');
                  }}
                  data-testid="button-hero-form"
                >
                  {t(companySettings.ctaText)}
                </PillButton>
              ) : null}
              {companySettings?.companyPhone?.trim() ? (
                <PillLink
                  href={whatsappLink}
                  target="_blank"
                  variant="ghost"
                  className="w-full sm:w-auto shrink-0 whitespace-nowrap px-6 sm:px-8 py-3 sm:py-4 text-base sm:text-lg"
                  onClick={() => trackEvent('click_whatsapp', { location: 'hero' })}
                >
                  {t("Talk on WhatsApp")}
                </PillLink>
              ) : null}
            </div>
          </div>
          <div className="order-2 lg:order-2 -mx-5 sm:mx-0 relative flex h-full items-end justify-center self-end w-full z-10 sm:absolute sm:inset-y-0 sm:right-[-2.5rem] tablet:right-[max(0px,calc((100%-900px)/2))] min-[963px]:right-0 sm:w-[460px] tablet:w-[480px] min-[963px]:w-[560px]">
            {heroImageUrl ? (
              <img
                src={heroImageUrl}
                alt={companySettings?.companyName || ""}
                width={560}
                height={560}
                // React 18's DOM only forwards the lowercase attribute (camelCase
                // triggers an unknown-prop warning), but the TS types only know
                // the camelCase spelling — hence the spread.
                {...({ fetchpriority: "high" } as Record<string, string>)}
                loading="eager"
                // max-h caps the photo at the visible band's height so short
                // viewports scale it down instead of clipping the hair at the
                // section's top edge; object-bottom keeps it glued to the
                // trust bar while it shrinks.
                className="w-full max-w-none sm:max-w-[460px] tablet:max-w-[480px] min-[963px]:max-w-[560px] sm:max-h-full object-contain object-bottom drop-shadow-2xl origin-bottom"
              />
            ) : (
              <div className="w-full max-w-none sm:max-w-[460px] tablet:max-w-[480px] min-[963px]:max-w-[560px]" />
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
