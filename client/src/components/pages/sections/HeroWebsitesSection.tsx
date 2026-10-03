import { z } from "zod";
import { ArrowDown, ArrowRight, Phone } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { languageHref } from "@/lib/languageRouting";
import { Band, Eyebrow, PillButton, PillLink } from "@/components/editorial";
import { sectionThemeSchema } from "./sectionTheme";
import { WhatsappCtaLink, whatsappCtaSchema } from "./whatsappCta";

// Pill CTAs follow the CLAUDE.md Brand Guidelines. Copy defaults are English (the t() source
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
  // A site path ("/nfc-order"), an in-page anchor ("#how-it-works"), or a
  // "tel:" link ("tel:+12245516131") for a landing whose secondary CTA is a
  // phone number to call rather than a page to visit.
  secondaryCtaHref: z.string().regex(/^(\/[a-z0-9/-]*|#[a-z][a-z0-9-]*|tel:\+?[0-9]{7,15})$/).optional(),
  // Short line under the CTA row, shown only when secondaryCtaHref is a "tel:"
  // link (e.g. explaining what happens when you call it).
  secondaryCtaNote: z.string().optional(),
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
  subheadline: "We build fast, Google-optimized websites for service businesses, deployed in days, not months.",
  ctaLabel: "I want my website",
  // Served from client/public: language-neutral brand illustration.
  backgroundImageUrl: "/SkaleClub.webp",
} as const;

// Intrinsic dimensions for the two known hero images, so the browser can reserve
// the right aspect ratio before the image loads (avoids CLS). The className below
// still constrains the rendered size via max-w/object-contain: these only fix
// aspect-ratio reservation. Unknown/custom assets omit width/height entirely.
const KNOWN_IMAGE_SIZES: Record<string, { width: number; height: number }> = {
  "/nfc-keychains-hero.webp": { width: 1199, height: 1312 },
  "/SkaleClub.webp": { width: 1169, height: 1500 },
  "/nfc-plaque-pair.webp": { width: 1157, height: 852 },
  "/nfc-keychains-trio.webp": { width: 1200, height: 775 },
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

function HeroCtas({ props, ctaLabel }: { props: HeroWebsitesProps; ctaLabel: string }) {
  const { t } = useTranslation();
  const secondaryHref = props.secondaryCtaHref;
  const isAnchor = !!secondaryHref?.startsWith("#");
  const isTel = !!secondaryHref?.startsWith("tel:");
  return (
    <div>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <PillButton
          variant="primary"
          onClick={scrollToLeadCta}
          data-testid="button-hero-websites-cta"
          className="w-full whitespace-nowrap sm:w-auto"
        >
          {t(ctaLabel)} <ArrowRight aria-hidden="true" className="h-4 w-4" />
        </PillButton>
        {props.secondaryCtaLabel && secondaryHref ? (
          <PillLink
            href={isAnchor ? secondaryHref : languageHref(secondaryHref)}
            variant="ghost"
            className="w-full whitespace-nowrap sm:w-auto"
          >
            {isTel && <Phone aria-hidden="true" className="h-4 w-4" />}
            {t(props.secondaryCtaLabel)}
            {isAnchor && <ArrowDown aria-hidden="true" className="h-4 w-4" />}
          </PillLink>
        ) : null}
      </div>
      {isTel && props.secondaryCtaNote && (
        <p className="mt-3 max-w-md text-sm leading-6 text-fog-400">{t(props.secondaryCtaNote)}</p>
      )}
    </div>
  );
}

/**
 * NFC product hero: editorial hero band (navy + grid), copy on the left and
 * the product on the right. Below lg the product sits above the copy,
 * compact, so a phone sees what is being sold without scrolling past it.
 */
function DarkProductHero({ props }: { props: HeroWebsitesProps }) {
  const { t } = useTranslation();
  const headline = props.headline ?? DEFAULTS.headline;
  const bgUrl = props.backgroundImageUrl;
  // A landscape product shot (the plaque pair) would come out short in a column
  // sized for portrait photos (the keychains): give it a wider column and cap.
  const size = bgUrl ? KNOWN_IMAGE_SIZES[bgUrl] : undefined;
  const wide = Boolean(size && size.width > size.height * 1.15);

  return (
    <div data-testid="section-hero-websites">
      <Band tone="hero" pattern containerClassName="pt-nav">
        <div
          className={`grid items-center gap-6 py-8 sm:py-12 lg:min-h-[600px] lg:gap-12 lg:py-20 ${
            wide ? "lg:grid-cols-[.9fr_1.1fr]" : "lg:grid-cols-[1.05fr_.95fr]"
          }`}
        >
          <div className="order-2 lg:order-1">
            {props.eyebrow && <Eyebrow>{t(props.eyebrow)}</Eyebrow>}
            <h1 className="mt-4 font-display text-[2.4rem] font-semibold leading-[0.98] tracking-[-0.04em] text-fog-50 text-balance sm:text-5xl xl:text-6xl">
              {t(headline)}
            </h1>
            {props.subheadline && (
              <p className="mt-5 max-w-xl text-base leading-7 text-fog-400 sm:text-lg">{t(props.subheadline)}</p>
            )}
            <HeroCtas props={props} ctaLabel={props.ctaLabel ?? DEFAULTS.ctaLabel} />
            {props.whatsapp && (
              <div className="mt-5">
                <WhatsappCtaLink cta={props.whatsapp} location="hero" variant="link" />
              </div>
            )}
          </div>

          {bgUrl ? (
            <div
              className={`relative order-1 mx-auto w-full lg:order-2 ${
                wide ? "max-w-[340px] sm:max-w-[480px] lg:max-w-[680px]" : "max-w-[220px] sm:max-w-[300px] lg:max-w-[460px]"
              }`}
            >
              <img
                src={bgUrl}
                alt={t(props.backgroundImageAlt ?? "")}
                className="w-full object-contain drop-shadow-2xl"
                {...({ fetchpriority: "high" } as Record<string, string>)}
                decoding="async"
                loading="eager"
                {...(KNOWN_IMAGE_SIZES[bgUrl] ?? {})}
              />
            </div>
          ) : null}
        </div>
      </Band>
    </div>
  );
}

/** /websites and /barbershops hero: same band, image left and copy right. */
function WebsitesHero({ props }: { props: HeroWebsitesProps }) {
  const { t } = useTranslation();
  const headline = props.headline ?? DEFAULTS.headline;
  const subheadline = props.subheadline ?? DEFAULTS.subheadline;
  const bgUrl = props.backgroundImageUrl ?? DEFAULTS.backgroundImageUrl;
  const bgAlt = props.backgroundImageAlt ?? "";
  const bgVideoUrl = props.bgVideoUrl;

  return (
    // pt-nav clears the fixed navbar. From lg the band stretches full height
    // (items-stretch) so the text column can centre itself in the visible
    // band while the image stays glued to the bottom.
    <div data-testid="section-hero-websites">
      <Band
        tone="hero"
        pattern
        className="relative isolate flex min-h-[70vh] items-end overflow-hidden sm:min-h-[55vh] lg:min-h-[550px] lg:items-stretch"
        containerClassName="relative z-10 pt-nav"
      >
        {/* Video background: a flat scrim keeps the copy readable over it. */}
        {bgVideoUrl && (
          <>
            <video
              className="absolute inset-0 -z-20 h-full w-full object-cover"
              src={bgVideoUrl}
              autoPlay
              loop
              muted
              playsInline
            />
            <div aria-hidden="true" className="absolute inset-0 -z-10 bg-navy-950/75" />
          </>
        )}
        <div className="grid grid-cols-1 items-end gap-1 sm:gap-6 lg:h-full lg:grid-cols-2 lg:gap-12">
          <div className="relative z-20 order-1 pb-12 pt-9 sm:pb-16 sm:pt-10 lg:order-2 lg:self-center lg:pb-0 lg:pt-0">
            <h1 className="mb-3 font-display text-[9vw] font-semibold leading-[1.02] tracking-[-0.04em] text-fog-50 text-balance sm:text-5xl md:text-6xl lg:mb-6 lg:text-4xl xl:text-5xl">
              {t(headline)}
            </h1>
            <p className={`max-w-xl text-base leading-7 sm:text-xl ${bgVideoUrl ? "text-fog-300" : "text-fog-400"}`}>{t(subheadline)}</p>
            <HeroCtas props={props} ctaLabel={props.ctaLabel ?? DEFAULTS.ctaLabel} />
          </div>
          {/* The character stands on the band's bottom edge: no padding below
              the image column and the img is a block so no baseline gap. */}
          <div className="relative z-10 order-2 flex w-full items-end justify-center self-end lg:order-1 lg:min-h-[400px] lg:justify-end">
            {bgUrl ? (
              <img
                src={bgUrl}
                alt={t(bgAlt)}
                className="block w-[70vw] max-w-[260px] origin-bottom object-contain object-bottom drop-shadow-2xl sm:w-[75%] md:max-w-[300px] lg:w-full lg:max-w-[340px] xl:max-w-[380px]"
                // React 18 does not know the camelCase prop; the lowercase attribute reaches the DOM as-is.
                {...({ fetchpriority: "high" } as Record<string, string>)}
                decoding="async"
                loading="eager"
                {...(KNOWN_IMAGE_SIZES[bgUrl] ?? {})}
              />
            ) : null}
          </div>
        </div>
      </Band>
    </div>
  );
}
