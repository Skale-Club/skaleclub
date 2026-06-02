import { z } from "zod";
import { useTranslation } from "@/hooks/useTranslation";

// Hero variant for the /websites landing.
// Mirrors the visual tone of the Home hero (brand blue + gradient overlay,
// white gradient headline) and ships a brand-blue (#406EF1) pill CTA per the
// CLAUDE.md Brand Guidelines. Copy defaults are English (the t() source
// language); PT is served via translations.ts when language is 'pt'.
export const heroWebsitesPropsSchema = z.object({
  headline: z.string().optional(),
  subheadline: z.string().optional(),
  ctaLabel: z.string().optional(),
  backgroundImageUrl: z.string().url().optional(),
  bgVideoUrl: z.string().url().optional(),
});
export type HeroWebsitesProps = z.infer<typeof heroWebsitesPropsSchema>;

const DEFAULTS = {
  headline: "Is your website still stuck in the Stone Age?",
  subheadline: "We build fast, Google-optimized websites for service businesses — deployed in days, not months.",
  ctaLabel: "I want my website",
  // Served from client/public — language-neutral brand illustration.
  backgroundImageUrl: "/SkaleClub.webp",
} as const;

export function HeroWebsitesSection({ props }: { props: HeroWebsitesProps }) {
  const { t } = useTranslation();
  const headline = props.headline ?? DEFAULTS.headline;
  const subheadline = props.subheadline ?? DEFAULTS.subheadline;
  const ctaLabel = props.ctaLabel ?? DEFAULTS.ctaLabel;
  const bgUrl = props.backgroundImageUrl ?? DEFAULTS.backgroundImageUrl;
  const bgVideoUrl = props.bgVideoUrl;

  const handleCtaClick = () => {
    const trigger = document.querySelector<HTMLElement>('[data-landing-lead-cta]');
    if (trigger) {
      trigger.click();
    } else {
      // Fallback: scroll to bottom (where leadFormCta typically lives)
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    }
  };

  return (
    <section
      className="relative flex items-end pt-28 sm:pt-24 lg:pt-16 pb-36 sm:pb-48 lg:pb-4 overflow-hidden bg-[#1C53A3] min-h-[70vh] sm:min-h-[55vh] lg:min-h-[550px]"
      data-testid="section-hero-websites"
    >
      <div className="container-custom mx-auto relative z-10 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-1 sm:gap-6 lg:gap-8 items-end">
          <div className="order-1 lg:order-2 text-white pt-6 sm:pt-8 lg:pt-16 pb-16 sm:pb-24 lg:pb-32 relative z-20">
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
                className="w-full sm:w-auto shrink-0 px-6 sm:px-8 py-3 sm:py-4 bg-[#406EF1] hover:bg-[#355CD0] hover:scale-105 text-white font-bold rounded-full transition-all flex items-center justify-center gap-2 text-base sm:text-lg whitespace-nowrap"
              >
                {t(ctaLabel)}
              </button>
            </div>
          </div>
          <div className="order-2 lg:order-1 relative flex h-full items-end justify-center lg:justify-end self-end w-full lg:min-h-[400px] z-10 lg:ml-[-3%]">
            {bgUrl ? (
              <img
                src={bgUrl}
                alt=""
                className="w-[70vw] sm:w-[75%] lg:w-full max-w-[260px] sm:max-w-[260px] md:max-w-[300px] lg:max-w-[340px] xl:max-w-[380px] object-contain drop-shadow-2xl origin-bottom"
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
