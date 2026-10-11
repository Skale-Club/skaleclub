import type { z } from "zod";
import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowRight, ChevronLeft, ChevronRight, Phone } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { languageHref } from "@/lib/languageRouting";
import { Band, Eyebrow, PillButton, PillLink } from "@/components/editorial";
import { WhatsappCtaLink } from "./whatsappCta";
import { heroWebsitesPropsSchema } from "@shared/section-definitions";

// Pill CTAs follow the CLAUDE.md Brand Guidelines. Copy defaults are English (the t() source
// language); PT is served via translations.ts when language is 'pt'.
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
  "/industry-scenes/barbershop.webp": { width: 960, height: 640 },
  "/barbershops/hero-barbershop.webp": { width: 960, height: 960 },
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

function HeroCtas({
  props,
  ctaLabel,
  groupedSecondary = false,
}: {
  props: HeroWebsitesProps;
  ctaLabel: string;
  groupedSecondary?: boolean;
}) {
  const { t } = useTranslation();
  const secondaryHref = props.secondaryCtaHref;
  const isAnchor = !!secondaryHref?.startsWith("#");
  const isTel = !!secondaryHref?.startsWith("tel:");
  return (
    <div className="min-w-0">
      <div className={`mt-8 flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap ${groupedSecondary ? "sm:items-start" : ""}`}>
        <PillButton
          variant="primary"
          onClick={scrollToLeadCta}
          data-testid="button-hero-websites-cta"
          className="w-full min-w-0 sm:w-auto sm:whitespace-nowrap"
        >
          {t(ctaLabel)} <ArrowRight aria-hidden="true" className="h-4 w-4" />
        </PillButton>
        {props.secondaryCtaLabel && secondaryHref ? (
          <div className="min-w-0 sm:max-w-[22rem]">
            <PillLink
              href={isAnchor ? secondaryHref : languageHref(secondaryHref)}
              variant="ghost"
              className="w-full min-w-0 sm:w-auto sm:whitespace-nowrap"
            >
              {isTel && <Phone aria-hidden="true" className="h-4 w-4" />}
              {t(props.secondaryCtaLabel)}
              {isAnchor && <ArrowDown aria-hidden="true" className="h-4 w-4" />}
            </PillLink>
            {groupedSecondary && isTel && props.secondaryCtaNote && (
              <p className="mt-2 break-words px-2 text-xs leading-5 text-fog-400">{t(props.secondaryCtaNote)}</p>
            )}
          </div>
        ) : null}
      </div>
      {!groupedSecondary && isTel && props.secondaryCtaNote && (
        <p className="mt-3 max-w-md break-words text-sm leading-6 text-fog-400">{t(props.secondaryCtaNote)}</p>
      )}
    </div>
  );
}

/**
 * A lightweight barbershop signature for the industry landing. The striped
 * cylinder moves in CSS, so there is no Lottie runtime or extra image request.
 */
function BarberPoleMark({ inline = false }: { inline?: boolean }) {
  return (
    <span className={`barber-pole-mark${inline ? " barber-pole-mark--inline" : ""}`} aria-hidden="true">
      <span className="barber-pole-stripes" />
    </span>
  );
}

type HeroMediaItem = NonNullable<HeroWebsitesProps["mediaItems"]>[number];

const ASPECT_CLASSES = {
  square: "aspect-square",
  "4:3": "aspect-[4/3]",
  "3:2": "aspect-[3/2]",
  "16:9": "aspect-video",
} as const;

const RADIUS_CLASSES = {
  none: "rounded-none",
  medium: "rounded-2xl",
  large: "rounded-[1.75rem]",
} as const;

const FOCAL_POINT_CLASSES = {
  center: "object-center",
  top: "object-top",
  bottom: "object-bottom",
  left: "object-left",
  right: "object-right",
} as const;

/**
 * Reusable media frame for vertical-specific landing heroes. One image stays
 * static; adding more items in page data turns on the same accessible carousel
 * without changing the component or creating a new landing-page fork.
 */
function IndustryHeroMedia({ props, fallbackUrl, fallbackAlt }: {
  props: HeroWebsitesProps;
  fallbackUrl: string;
  fallbackAlt: string;
}) {
  const { t } = useTranslation();
  const fallbackSize = KNOWN_IMAGE_SIZES[fallbackUrl];
  const items: HeroMediaItem[] = props.mediaItems?.length ? props.mediaItems : [{
    imageUrl: fallbackUrl,
    imageAlt: fallbackAlt,
    imageWidth: fallbackSize?.width,
    imageHeight: fallbackSize?.height,
    focalPoint: "center",
  }];
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const activeItem = items[activeIndex] ?? items[0];
  const mediaIdentity = items.map((item) => item.imageUrl).join("|");
  const autoplayMs = props.carouselAutoplayMs ?? 0;
  const step = (delta: number) => setActiveIndex((current) => (current + delta + items.length) % items.length);

  useEffect(() => setActiveIndex(0), [mediaIdentity]);

  useEffect(() => {
    if (items.length < 2 || autoplayMs === 0 || paused) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setActiveIndex((current) => (current + 1) % items.length), autoplayMs);
    return () => window.clearInterval(timer);
  }, [autoplayMs, items.length, paused]);

  if (!activeItem) return null;

  const aspectClass = ASPECT_CLASSES[props.mediaAspectRatio ?? "4:3"];
  const radiusClass = RADIUS_CLASSES[props.mediaRadius ?? "medium"];
  const focalPointClass = FOCAL_POINT_CLASSES[activeItem.focalPoint ?? "center"];

  return (
    <div
      className="relative w-full max-w-[640px]"
      role={items.length > 1 ? "region" : undefined}
      aria-roledescription={items.length > 1 ? "carousel" : undefined}
      aria-label={items.length > 1 ? t("Hero image carousel") : undefined}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPaused(false);
      }}
      onKeyDown={(event) => {
        if (items.length < 2 || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return;
        event.preventDefault();
        step(event.key === "ArrowRight" ? 1 : -1);
      }}
      onTouchStart={(event) => {
        touchStartX.current = event.touches[0]?.clientX ?? null;
        setPaused(true);
      }}
      onTouchEnd={(event) => {
        const startX = touchStartX.current;
        touchStartX.current = null;
        if (items.length < 2 || startX === null) return;
        const endX = event.changedTouches[0]?.clientX;
        if (endX === undefined || Math.abs(endX - startX) < 40) return;
        step(endX < startX ? 1 : -1);
      }}
    >
      <div className={`relative overflow-hidden border border-white/10 bg-navy-800 shadow-2xl ${aspectClass} ${radiusClass}`}>
        <img
          key={activeItem.imageUrl}
          src={activeItem.imageUrl}
          alt={t(activeItem.imageAlt ?? "")}
          className={`h-full w-full object-cover ${focalPointClass}`}
          {...(activeIndex === 0 ? ({ fetchpriority: "high" } as Record<string, string>) : {})}
          decoding="async"
          loading={activeIndex === 0 ? "eager" : "lazy"}
          width={activeItem.imageWidth ?? KNOWN_IMAGE_SIZES[activeItem.imageUrl]?.width}
          height={activeItem.imageHeight ?? KNOWN_IMAGE_SIZES[activeItem.imageUrl]?.height}
        />
      </div>

      {items.length > 1 && (
        <div className="mt-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2" role="group" aria-label={t("Choose hero image")}>
            {items.map((item, index) => (
              <button
                key={`${item.imageUrl}-${index}`}
                type="button"
                className={`h-2 rounded-full transition-[width,background-color] ${index === activeIndex ? "w-8 bg-cta-soft" : "w-2 bg-white/30 hover:bg-white/50"}`}
                aria-label={`${t("Show image")} ${index + 1}`}
                aria-current={index === activeIndex ? "true" : undefined}
                onClick={() => setActiveIndex(index)}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <button type="button" className="grid h-10 w-10 place-items-center rounded-full border border-white/20 text-fog-50 transition-colors hover:border-cta-soft hover:text-cta-soft" aria-label={t("Previous image")} onClick={() => step(-1)}>
              <ChevronLeft aria-hidden="true" className="h-4 w-4" />
            </button>
            <button type="button" className="grid h-10 w-10 place-items-center rounded-full border border-white/20 text-fog-50 transition-colors hover:border-cta-soft hover:text-cta-soft" aria-label={t("Next image")} onClick={() => step(1)}>
              <ChevronRight aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
      {items.length > 1 && (
        <span className="sr-only" aria-live="polite">
          {`${t("Image")} ${activeIndex + 1} ${t("of")} ${items.length}`}
        </span>
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
  const bgVideoUrl = props.bgVideoUrl;
  // A landscape product shot (the plaque pair) would come out short in a column
  // sized for portrait photos (the keychains): give it a wider column and cap.
  // A video (uploaded in Admin -> Pages) is assumed landscape.
  const size = bgUrl ? KNOWN_IMAGE_SIZES[bgUrl] : undefined;
  const wide = Boolean(bgVideoUrl || (size && size.width > size.height * 1.15));
  // Reduced-motion visitors get the still image as the video's poster.
  const reduceMotion = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  return (
    <div data-testid="section-hero-websites">
      <Band tone="hero" heroVariant="dark-product" pattern containerClassName="pt-nav">
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

          {bgVideoUrl ? (
            // The video takes the image's place; the image stays as its poster
            // so the slot is never empty while it loads.
            <div className="relative order-1 mx-auto w-full max-w-[340px] sm:max-w-[480px] lg:order-2 lg:max-w-[680px]">
              <video
                key={bgVideoUrl}
                src={bgVideoUrl}
                poster={bgUrl}
                aria-label={props.backgroundImageAlt ? t(props.backgroundImageAlt) : undefined}
                className="aspect-[3/2] w-full object-cover drop-shadow-2xl"
                autoPlay={!reduceMotion}
                loop
                muted
                playsInline
                preload="metadata"
              />
            </div>
          ) : bgUrl ? (
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

/**
 * Configurable hero for vertical landing pages (barbershops, salons, clinics,
 * and future niches). The floating-header clearance belongs to the outer flex
 * frame; the grid then centers inside the remaining visible hero area.
 */
function IndustryLandingHero({ props }: { props: HeroWebsitesProps }) {
  const { t } = useTranslation();
  const headline = props.headline ?? DEFAULTS.headline;
  const headlineLines = props.headlineLines?.length ? props.headlineLines : [{ text: headline }];
  const subheadline = props.subheadline ?? DEFAULTS.subheadline;
  const bgUrl = props.backgroundImageUrl ?? DEFAULTS.backgroundImageUrl;
  const bgAlt = props.backgroundImageAlt ?? "";

  return (
    <div data-testid="section-hero-websites">
      <Band
        tone="hero"
        heroVariant="industry"
        pattern
        className="relative isolate flex min-h-[720px] overflow-hidden tablet:min-h-[600px] lg:min-h-[620px] xl:min-h-[640px]"
        containerClassName="relative z-10 flex min-w-0 flex-1 pt-nav"
      >
        <div className="grid min-w-0 flex-1 grid-cols-1 content-center items-center gap-10 py-10 sm:py-14 lg:grid-cols-[.92fr_1.08fr] lg:gap-16 lg:py-12">
          <div className="order-2 min-w-0 lg:order-1">
            <IndustryHeroMedia props={props} fallbackUrl={bgUrl} fallbackAlt={bgAlt} />
          </div>

          <div className="order-1 min-w-0 lg:order-2">
            {props.eyebrow && (
              <div className="flex items-center gap-3">
                {props.accentMark === "barber-pole" && <BarberPoleMark inline />}
                <Eyebrow>{t(props.eyebrow)}</Eyebrow>
              </div>
            )}
            <h1 className={`${props.eyebrow ? "mt-5" : ""} font-display text-[clamp(2.25rem,8.5vw,3rem)] font-semibold leading-[0.98] tracking-[-0.045em] text-fog-50 lg:text-[clamp(2.5rem,3.6vw,3.25rem)]`}>
              {headlineLines.map((line, index) => (
                <span key={`${line.text}-${index}`} className={`block text-balance ${line.accent ? "text-cta-soft" : ""}`}>
                  {t(line.text)}
                </span>
              ))}
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-fog-300 sm:text-xl sm:leading-8">{t(subheadline)}</p>
            <HeroCtas props={props} ctaLabel={props.ctaLabel ?? DEFAULTS.ctaLabel} groupedSecondary />
          </div>
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
  const isBarbershopHero = bgUrl === "/barbershops/hero-barbershop.webp";

  if (props.layout === "industry") return <IndustryLandingHero props={props} />;

  return (
    // pt-nav clears the fixed navbar. From lg the band stretches full height
    // (items-stretch) so the text column can centre itself in the visible
    // band while the image stays glued to the bottom.
    <div data-testid="section-hero-websites">
      <Band
        tone="hero"
        heroVariant="split-landing"
        pattern
        className="relative isolate flex min-h-[70vh] items-end overflow-hidden sm:min-h-[55vh] lg:min-h-[550px] lg:items-stretch"
        containerClassName="relative z-10 min-w-0 pt-nav"
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
        <div className="grid min-w-0 grid-cols-1 items-end gap-1 sm:gap-6 lg:h-full lg:grid-cols-2 lg:gap-12">
          <div className="relative z-20 order-1 min-w-0 pb-12 pt-9 sm:pb-16 sm:pt-10 lg:order-2 lg:self-center lg:pb-0 lg:pt-0">
            <h1 className="mb-3 font-display text-[9vw] font-semibold leading-[1.02] tracking-[-0.04em] text-fog-50 text-balance sm:text-5xl md:text-6xl lg:mb-6 lg:text-4xl xl:text-5xl">
              {t(headline)}
            </h1>
            <p className={`max-w-xl text-base leading-7 sm:text-xl ${bgVideoUrl ? "text-fog-300" : "text-fog-400"}`}>{t(subheadline)}</p>
            <HeroCtas props={props} ctaLabel={props.ctaLabel ?? DEFAULTS.ctaLabel} />
          </div>
          {/* The character stands on the band's bottom edge: no padding below
              the image column and the img is a block so no baseline gap. */}
          <div className="relative z-10 order-2 flex min-w-0 w-full items-end justify-center self-end lg:order-1 lg:min-h-[400px] lg:justify-end">
            {bgUrl ? (
              <div className="relative w-fit">
                <img
                  src={bgUrl}
                  alt={t(bgAlt)}
                  className="block w-[70vw] max-w-[260px] origin-bottom object-contain object-bottom drop-shadow-2xl sm:w-[75vw] md:max-w-[300px] lg:w-[340px] lg:max-w-[340px] xl:w-[380px] xl:max-w-[380px]"
                  // React 18 does not know the camelCase prop; the lowercase attribute reaches the DOM as-is.
                  {...({ fetchpriority: "high" } as Record<string, string>)}
                  decoding="async"
                  loading="eager"
                  {...(KNOWN_IMAGE_SIZES[bgUrl] ?? {})}
                />
                {isBarbershopHero && <BarberPoleMark />}
              </div>
            ) : null}
          </div>
        </div>
      </Band>
    </div>
  );
}
