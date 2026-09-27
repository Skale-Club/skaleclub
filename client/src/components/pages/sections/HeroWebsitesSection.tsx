import { z } from "zod";
import { useTranslation } from "@/hooks/useTranslation";
import { languageHref } from "@/lib/languageRouting";
import { DARK_HAIRLINE, sectionThemeSchema } from "./sectionTheme";
import { WhatsappCtaLink, whatsappCtaSchema } from "./whatsappCta";

// Hero variant for the /websites landing.
// Mirrors the visual tone of the Home hero (brand blue + gradient overlay,
// white gradient headline) and ships a brand-blue (`cta` token) pill CTA per the
// CLAUDE.md Brand Guidelines. Copy defaults are English (the t() source
// language); PT is served via translations.ts when language is 'pt'.
// Tolerant optional URL: treats null and "" as "absent" so a removed asset
// (the editor may persist null, and JSON has no `undefined`) never fails
// validation and breaks the page render.
const optionalUrl = z.preprocess(
  (v) => (v === null || v === "" ? undefined : v),
  z.string().refine(
    (value) => value.startsWith("/") || z.string().url().safeParse(value).success,
    "Expected an absolute URL or a root-relative asset path",
  ).optional(),
);

export const heroWebsitesPropsSchema = z.object({
  headline: z.string().optional(),
  subheadline: z.string().optional(),
  ctaLabel: z.string().optional(),
  secondaryCtaLabel: z.string().optional(),
  // A site path ("/nfc-order") or an in-page anchor ("#how-it-works").
  secondaryCtaHref: z.string().regex(/^(\/[a-z0-9/-]*|#[a-z][a-z0-9-]*)$/).optional(),
  eyebrow: z.string().optional(),
  backgroundImageUrl: optionalUrl,
  backgroundImageAlt: z.string().optional(),
  bgVideoUrl: optionalUrl,
  // Dark hero only: a quiet "Talk to us on WhatsApp" link under the buttons.
  whatsapp: whatsappCtaSchema,
  // "dark" = the NFC product hero (copy left, product right, navy). Absent =
  // the /websites hero, unchanged.
  theme: sectionThemeSchema,
});
export type HeroWebsitesProps = z.infer<typeof heroWebsitesPropsSchema>;

const DEFAULTS = {
  headline: "Is your website still stuck in the Stone Age?",
  subheadline: "We build fast, Google-optimized websites for service businesses — deployed in days, not months.",
  ctaLabel: "I want my website",
  // Served from client/public — language-neutral brand illustration.
  backgroundImageUrl: "/SkaleClub.webp",
} as const;

// Intrinsic dimensions for the two known hero images, so the browser can reserve
// the right aspect ratio before the image loads (avoids CLS). The className below
// still constrains the rendered size via max-w/object-contain — these only fix
// aspect-ratio reservation. Unknown/custom assets omit width/height entirely.
const KNOWN_IMAGE_SIZES: Record<string, { width: number; height: number }> = {
  "/nfc-keychains-hero.webp": { width: 1199, height: 1312 },
  "/SkaleClub.webp": { width: 1169, height: 1500 },
};

const scrollToLeadCta = () => {
  const trigger = document.querySelector<HTMLElement>('[data-landing-lead-cta]');
  if (trigger) trigger.click();
  else window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
};

export function HeroWebsitesSection({ props }: { props: HeroWebsitesProps }) {
  if (props.theme === "dark") return <DarkProductHero props={props} />;
  return <WebsitesHero props={props} />;
}

/**
 * NFC product hero: navy with a blue glow rising from the base, copy on the
 * left and the product on the right. Below lg the product sits above the copy,
 * compact, so a phone sees what is being sold without scrolling past it.
 */
function DarkProductHero({ props }: { props: HeroWebsitesProps }) {
  const { t } = useTranslation();
  const headline = props.headline ?? DEFAULTS.headline;
  const bgUrl = props.backgroundImageUrl;
  const secondaryHref = props.secondaryCtaHref;

  return (
    <section
      className={`relative overflow-hidden pt-nav bg-[#09152d] border-b ${DARK_HAIRLINE}`}
      style={{
        backgroundImage: [
          "radial-gradient(46% 60% at 30% 108%, rgba(81,115,214,.45), transparent 72%)",
          "radial-gradient(40% 55% at 85% 20%, rgba(100,135,215,.22), transparent 70%)",
          "linear-gradient(180deg, #09152d 0%, #0a1428 100%)",
        ].join(","),
      }}
      data-testid="section-hero-websites"
    >
      <div className="container-custom container-page mx-auto grid items-center gap-6 lg:gap-12 py-8 sm:py-12 lg:py-20 lg:grid-cols-[1.05fr_.95fr] lg:min-h-[600px]">
        <div className="order-2 lg:order-1">
          {props.eyebrow && (
            <span className="inline-flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.18em] text-blue-300">
              <span aria-hidden="true" className="h-[3px] w-7 rounded-full bg-cta" />
              {t(props.eyebrow)}
            </span>
          )}
          <h1 className="mt-4 font-display text-[2.4rem] sm:text-5xl xl:text-6xl font-extrabold leading-[1.02] tracking-tight text-white text-balance">
            {t(headline)}
          </h1>
          {props.subheadline && (
            <p className="mt-5 max-w-xl text-base sm:text-lg leading-relaxed text-[#B4C0D8]">{t(props.subheadline)}</p>
          )}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={scrollToLeadCta}
              data-testid="button-hero-websites-cta"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-cta px-8 py-4 text-base sm:text-lg font-bold text-white transition-colors hover:bg-cta-hover"
            >
              {t(props.ctaLabel ?? DEFAULTS.ctaLabel)} <span aria-hidden="true">→</span>
            </button>
            {props.secondaryCtaLabel && secondaryHref ? (
              <a
                href={secondaryHref.startsWith("#") ? secondaryHref : languageHref(secondaryHref)}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 bg-white/[0.04] px-8 py-4 text-base sm:text-lg font-bold text-white transition-colors hover:bg-white/10"
              >
                {t(props.secondaryCtaLabel)}
                {secondaryHref.startsWith("#") && <span aria-hidden="true">↓</span>}
              </a>
            ) : null}
          </div>
          {props.whatsapp && (
            <div className="mt-5">
              <WhatsappCtaLink cta={props.whatsapp} location="hero" variant="link" />
            </div>
          )}
        </div>

        {bgUrl ? (
          <div className="order-1 lg:order-2 relative mx-auto w-full max-w-[220px] sm:max-w-[300px] lg:max-w-[460px]">
            <div aria-hidden="true" className="absolute inset-[14%] rounded-full bg-cta/45 blur-3xl" />
            <img
              src={bgUrl}
              alt={t(props.backgroundImageAlt ?? "")}
              className="relative w-full object-contain drop-shadow-2xl"
              {...({ fetchpriority: "high" } as Record<string, string>)}
              decoding="async"
              loading="eager"
              {...(KNOWN_IMAGE_SIZES[bgUrl] ?? {})}
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}

function WebsitesHero({ props }: { props: HeroWebsitesProps }) {
  const { t } = useTranslation();
  const headline = props.headline ?? DEFAULTS.headline;
  const subheadline = props.subheadline ?? DEFAULTS.subheadline;
  const ctaLabel = props.ctaLabel ?? DEFAULTS.ctaLabel;
  const bgUrl = props.backgroundImageUrl ?? DEFAULTS.backgroundImageUrl;
  const bgAlt = props.backgroundImageAlt ?? "";
  const bgVideoUrl = props.bgVideoUrl;

  const handleCtaClick = scrollToLeadCta;

  return (
    // pt-nav clears the fixed navbar; below lg the text column adds its own
    // pt for a comfortable gap under it (mirrors HeroSection.tsx). From lg
    // the section stretches full height (items-stretch) so the text column
    // can vertically center itself (self-center) in the visible band, same
    // approach as the home hero, while the image stays glued to the bottom.
    <section
      className="relative flex items-end lg:items-stretch pt-nav pb-36 sm:pb-48 lg:pb-4 overflow-hidden bg-[#1C53A3] min-h-[70vh] sm:min-h-[55vh] lg:min-h-[550px]"
      data-testid="section-hero-websites"
    >
      {/* No `lg:h-full` here: the section sizes itself with min-height, so a
          percentage height would resolve to auto AND suppress the flex
          stretch, leaving the column short of the band. Letting
          align-items: stretch do the work gives it a definite height, which
          the grid's own h-full can then resolve against. */}
      <div className="container-custom mx-auto relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-1 sm:gap-6 lg:gap-12 items-end lg:h-full">
          {/* container-custom has no lateral padding below 770px, so the text
              column carries its own — the image stays full-bleed. */}
          <div className="order-1 lg:order-2 text-white px-4 sm:px-6 tablet:px-0 pt-9 sm:pt-10 pb-16 sm:pb-24 lg:self-center lg:pt-0 lg:pb-0 relative z-20">
            <h1 className="text-[9vw] sm:text-5xl md:text-6xl lg:text-4xl xl:text-5xl font-bold mb-3 lg:mb-6 font-display leading-[1.05] sm:leading-[1.1]">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-blue-200">
                {t(headline)}
              </span>
            </h1>
            <p className="text-base sm:text-xl text-blue-50/80 mb-4 lg:mb-8 leading-relaxed max-w-xl">
              {t(subheadline)}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 lg:gap-5 flex-wrap">
              <button
                type="button"
                onClick={handleCtaClick}
                data-testid="button-hero-websites-cta"
                className="w-full sm:w-auto shrink-0 px-6 sm:px-8 py-3 sm:py-4 bg-cta hover:bg-cta-hover hover:scale-105 text-white font-bold rounded-full transition-all flex items-center justify-center gap-2 text-base sm:text-lg whitespace-nowrap"
              >
                {t(ctaLabel)}
              </button>
              {props.secondaryCtaLabel && props.secondaryCtaHref ? (
                <a
                  href={languageHref(props.secondaryCtaHref)}
                  className="w-full sm:w-auto shrink-0 px-6 sm:px-8 py-3 sm:py-4 border border-white/30 hover:bg-white/10 text-white font-bold rounded-full transition-all flex items-center justify-center text-base sm:text-lg whitespace-nowrap"
                >
                  {t(props.secondaryCtaLabel)}
                </a>
              ) : null}
            </div>
          </div>
          <div className="order-2 lg:order-1 relative flex h-full items-end justify-center lg:justify-end self-end w-full lg:min-h-[400px] z-10 lg:ml-[-3%]">
            {bgUrl ? (
              <img
                src={bgUrl}
                alt={t(bgAlt)}
                className="w-[70vw] sm:w-[75%] lg:w-full max-w-[260px] sm:max-w-[260px] md:max-w-[300px] lg:max-w-[340px] xl:max-w-[380px] object-contain drop-shadow-2xl origin-bottom"
                // React 18 does not know the camelCase prop; the lowercase attribute reaches the DOM as-is.
                {...({ fetchpriority: "high" } as Record<string, string>)}
                decoding="async"
                loading="eager"
                {...(KNOWN_IMAGE_SIZES[bgUrl] ?? {})}
              />
            ) : null}
          </div>
        </div>
      </div>

      {/* Video background — renders below the gradient overlay */}
      {bgVideoUrl && (
        <video
          className="absolute inset-0 w-full h-full object-cover"
          src={bgVideoUrl}
          autoPlay
          loop
          muted
          playsInline
        />
      )}

      <div
        className="absolute inset-0"
        style={{
          background: bgVideoUrl
            ? `linear-gradient(to right bottom, rgba(9,21,45,0.75), rgba(28,83,163,0.55))`
            : `
              radial-gradient(ellipse at center, transparent 40%, rgba(0, 0, 0, 0.35) 80%, rgba(0, 0, 0, 0.85) 100%),
              radial-gradient(circle at 65% 10%, rgba(100, 135, 215, 0.30) 0%, transparent 60%),
              linear-gradient(
                to right bottom,
                #09152d, #0b152a, #0d1427, #0f1424, #101421, #121622,
                #151723, #171924, #1c1c29, #21202e, #262332, #2c2637
              )
            `,
        }}
      />
    </section>
  );
}
