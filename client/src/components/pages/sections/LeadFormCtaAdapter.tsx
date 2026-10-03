import { useState } from "react";
import { z } from "zod";
import { ArrowRight } from "lucide-react";
import { LeadFormModal } from "@/components/LeadFormModal";
import { Band, Eyebrow, PillButton, PillLink } from "@/components/editorial";
import { languageHref } from "@/lib/languageRouting";
import { useTranslation } from "@/hooks/useTranslation";
import { sectionThemeSchema } from "./sectionTheme";
import { WhatsappCtaLink, whatsappCtaSchema } from "./whatsappCta";
import { defaultWhatsappCtaForForm } from "@shared/nfc-whatsapp";

export const leadFormCtaPropsSchema = z.object({
  formSlug: z.string().min(1),
  ctaLabel: z.string().optional(),
  heading: z.string().optional(),
  subheading: z.string().optional(),
  // Dark only: a short line under the buttons (e.g. the entry price) and a
  // small product image between the copy and the buttons (lg and up).
  note: z.string().optional(),
  imageUrl: z.string().regex(/^\//).optional(),
  imageAlt: z.string().optional(),
  // Dark only: a "Talk to us on WhatsApp" button beside the form button.
  whatsapp: whatsappCtaSchema,
  // Dark only: a quiet link under the buttons to a second-level page (e.g. the
  // keychain landing pointing at its full guide). Site path only.
  secondaryLabel: z.string().optional(),
  secondaryHref: z.string().regex(/^\/[a-z0-9/-]*$/).optional(),
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

/** /websites and /barbershops: centred closing band with one button. */
function LightCta({ props, onOpen, children }: VariantProps) {
  const { t } = useTranslation();
  const heading = props.heading ?? DEFAULTS.heading;
  const subheading = props.subheading ?? DEFAULTS.subheading;
  const ctaLabel = props.ctaLabel ?? DEFAULTS.ctaLabel;
  return (
    <div data-testid="section-lead-form-cta">
      <Band tone="cta" className="text-center">
        <div className="mx-auto max-w-2xl">
          {heading ? (
            <h2 className="font-display text-4xl font-semibold leading-tight text-white sm:text-5xl">{t(heading)}</h2>
          ) : null}
          {subheading ? <p className="mt-4 text-base leading-7 text-fog-300 sm:text-lg">{t(subheading)}</p> : null}
          <PillButton variant="primary" data-landing-lead-cta onClick={onOpen} className="mt-8">
            {t(ctaLabel)}
          </PillButton>
        </div>
        {children}
      </Band>
    </div>
  );
}

/** NFC pages: the guide's closing band, copy on the left and buttons on the right. */
function DarkCta({ props, onOpen, children }: VariantProps) {
  const { t } = useTranslation();
  const heading = props.heading ?? DEFAULTS.heading;
  const ctaLabel = props.ctaLabel ?? DEFAULTS.ctaLabel;
  const whatsapp = props.whatsapp ?? defaultWhatsappCtaForForm(props.formSlug);
  const hasImage = !!props.imageUrl;

  return (
    <div data-testid="section-lead-form-cta">
      <Band tone="cta">
        <div
          className={`grid items-center gap-8 ${
            hasImage ? "lg:grid-cols-[1fr_auto_auto] lg:gap-12" : "lg:grid-cols-[1fr_auto]"
          }`}
        >
          <div>
            <Eyebrow className="tracking-[0.22em] text-cta-softer">{t("Ready when you are")}</Eyebrow>
            <h2 className="mt-4 max-w-2xl font-display text-4xl font-semibold leading-tight text-balance sm:text-5xl">
              {t(heading)}
            </h2>
            {props.subheading && (
              <p className="mt-4 max-w-2xl text-sm leading-6 text-fog-300">{t(props.subheading)}</p>
            )}
          </div>

          {hasImage && (
            <img
              src={props.imageUrl}
              alt={props.imageAlt ? t(props.imageAlt) : ""}
              loading="lazy"
              decoding="async"
              className="mx-auto hidden h-44 w-44 object-contain lg:block"
            />
          )}

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
              <PillButton
                variant="primary"
                data-landing-lead-cta
                onClick={onOpen}
                className="w-full whitespace-nowrap sm:w-auto"
              >
                {t(ctaLabel)}
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </PillButton>
              {whatsapp && <WhatsappCtaLink cta={whatsapp} location="lead_form_cta" variant="button" />}
            </div>
            {props.note && <span className="text-sm font-medium text-fog-400">{t(props.note)}</span>}
            {props.secondaryLabel && props.secondaryHref && (
              <PillLink href={languageHref(props.secondaryHref)} variant="ghost" className="w-full whitespace-nowrap sm:w-auto">
                {t(props.secondaryLabel)}
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </PillLink>
            )}
          </div>
        </div>
        {children}
      </Band>
    </div>
  );
}
