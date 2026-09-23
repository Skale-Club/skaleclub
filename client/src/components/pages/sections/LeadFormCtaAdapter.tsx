import { useState } from "react";
import { z } from "zod";
import { LeadFormModal } from "@/components/LeadFormModal";
import { useTranslation } from "@/hooks/useTranslation";
import { DARK_HAIRLINE, sectionThemeSchema } from "./sectionTheme";

export const leadFormCtaPropsSchema = z.object({
  formSlug: z.string().min(1),
  ctaLabel: z.string().optional(),
  heading: z.string().optional(),
  subheading: z.string().optional(),
  // Dark only: a short line under the button (e.g. the entry price) and a
  // product image on the right. Both optional; without the image the dark
  // band centres its copy.
  note: z.string().optional(),
  imageUrl: z.string().regex(/^\//).optional(),
  imageAlt: z.string().optional(),
  theme: sectionThemeSchema,
});
type LeadFormCtaProps = z.infer<typeof leadFormCtaPropsSchema>;

// English defaults (the t() source language); PT served via translations.ts.
const DEFAULTS = {
  heading: "Let's talk about your website",
  subheading: "Tell us about your project in 1 minute. We'll reply within 24 hours with a proposal.",
  ctaLabel: "I want my website",
} as const;

export function LeadFormCtaAdapter({ props }: { props: LeadFormCtaProps }) {
  const [isOpen, setIsOpen] = useState(false);
  const modal = <LeadFormModal open={isOpen} onClose={() => setIsOpen(false)} formSlug={props.formSlug} />;
  return props.theme === "dark"
    ? <DarkCta props={props} onOpen={() => setIsOpen(true)}>{modal}</DarkCta>
    : <LightCta props={props} onOpen={() => setIsOpen(true)}>{modal}</LightCta>;
}

type VariantProps = { props: LeadFormCtaProps; onOpen: () => void; children: React.ReactNode };

/** /websites and /barbershops: unchanged. */
function LightCta({ props, onOpen, children }: VariantProps) {
  const { t } = useTranslation();
  const heading = props.heading ?? DEFAULTS.heading;
  const subheading = props.subheading ?? DEFAULTS.subheading;
  const ctaLabel = props.ctaLabel ?? DEFAULTS.ctaLabel;
  return (
    <section className="bg-zinc-950 py-16 md:py-24 text-center">
      <div className="container-custom mx-auto max-w-2xl px-6">
        {heading ? <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">{t(heading)}</h2> : null}
        {subheading ? <p className="text-zinc-300 text-lg mb-8">{t(subheading)}</p> : null}
        <button
          type="button"
          data-landing-lead-cta
          onClick={onOpen}
          className="inline-flex items-center justify-center rounded-full bg-cta px-8 py-4 text-base font-bold text-white hover:bg-cta-hover hover:scale-105 transition-all"
        >
          {t(ctaLabel)}
        </button>
      </div>
      {children}
    </section>
  );
}

/** NFC pages: a full-bleed closing band with a blue glow and the product photo. */
function DarkCta({ props, onOpen, children }: VariantProps) {
  const { t } = useTranslation();
  const heading = props.heading ?? DEFAULTS.heading;
  const ctaLabel = props.ctaLabel ?? DEFAULTS.ctaLabel;
  const hasImage = !!props.imageUrl;

  return (
    <section
      className={`relative overflow-hidden border-t ${DARK_HAIRLINE} bg-[#060e22]`}
      style={{
        backgroundImage: [
          "radial-gradient(55% 90% at 8% 110%, rgba(81,115,214,.62), transparent 64%)",
          "radial-gradient(45% 80% at 100% 105%, rgba(143,169,238,.26), transparent 66%)",
          "radial-gradient(40% 50% at 30% 0%, rgba(59,91,190,.16), transparent 70%)",
        ].join(","),
      }}
      data-testid="section-lead-form-cta"
    >
      <div
        className={`container-custom container-page mx-auto grid items-center gap-10 py-16 md:py-24 ${
          hasImage ? "lg:grid-cols-[1.1fr_.9fr]" : "max-w-3xl text-center"
        }`}
      >
        <div>
          <h2 className="font-display text-4xl sm:text-5xl font-extrabold leading-[1.02] tracking-tight text-white text-balance">
            {t(heading)}
          </h2>
          {props.subheading && (
            <p className={`mt-5 text-lg leading-relaxed text-[#B4C0D8] ${hasImage ? "max-w-xl" : "mx-auto max-w-2xl"}`}>
              {t(props.subheading)}
            </p>
          )}
          <div className={`mt-8 flex flex-col gap-3 ${hasImage ? "items-start" : "items-center"}`}>
            <button
              type="button"
              data-landing-lead-cta
              onClick={onOpen}
              className="inline-flex w-full sm:w-auto items-center justify-center gap-2 whitespace-nowrap rounded-full bg-cta px-8 py-4 text-base font-bold text-white transition-colors hover:bg-cta-hover"
            >
              {t(ctaLabel)} <span aria-hidden="true">→</span>
            </button>
            {props.note && <span className="text-sm font-medium text-[#B4C0D8]">{t(props.note)}</span>}
          </div>
        </div>

        {hasImage && (
          <div className="relative mx-auto w-full max-w-[300px] sm:max-w-[360px] lg:max-w-[420px]">
            <div aria-hidden="true" className="absolute inset-[12%] rounded-full bg-cta/40 blur-3xl" />
            <img
              src={props.imageUrl}
              alt={props.imageAlt ? t(props.imageAlt) : ""}
              loading="lazy"
              decoding="async"
              className="relative w-full object-contain drop-shadow-2xl"
            />
          </div>
        )}
      </div>
      {children}
    </section>
  );
}
