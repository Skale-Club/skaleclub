import { useState } from "react";
import { z } from "zod";
import { LeadFormModal } from "@/components/LeadFormModal";
import { useTranslation } from "@/hooks/useTranslation";
import { sectionThemeSchema } from "./sectionTheme";

export const leadFormCtaPropsSchema = z.object({
  formSlug: z.string().min(1),
  ctaLabel: z.string().optional(),
  heading: z.string().optional(),
  subheading: z.string().optional(),
  // Quick 260906-qwl — this section was already dark (`bg-zinc-950`). The prop
  // exists only so it can join the same palette family as its dark neighbours;
  // heading, subheading and button styling are identical in both branches.
  theme: sectionThemeSchema,
});

// English defaults (the t() source language); PT served via translations.ts.
const DEFAULTS = {
  heading: "Let's talk about your website",
  subheading: "Tell us about your project in 1 minute. We'll reply within 24 hours with a proposal.",
  ctaLabel: "I want my website",
} as const;

// Only the section background differs between the branches — LIGHT is the
// pre-task value verbatim, DARK just matches the `#0f1014` neighbours.
const LIGHT = { section: "bg-zinc-950" } as const;
const DARK = { section: "bg-[#0f1014]" } as const;

export function LeadFormCtaAdapter({ props }: { props: z.infer<typeof leadFormCtaPropsSchema> }) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const heading = props.heading ?? DEFAULTS.heading;
  const subheading = props.subheading ?? DEFAULTS.subheading;
  const ctaLabel = props.ctaLabel ?? DEFAULTS.ctaLabel;
  const c = props.theme === "dark" ? DARK : LIGHT;

  return (
    <section className={`${c.section} py-20 text-center`}>
      <div className="container-custom mx-auto max-w-2xl px-6">
        {heading ? (
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">{t(heading)}</h2>
        ) : null}
        {subheading ? (
          <p className="text-zinc-300 text-lg mb-8">{t(subheading)}</p>
        ) : null}
        <button
          type="button"
          data-landing-lead-cta
          onClick={() => setIsOpen(true)}
          className="inline-flex items-center justify-center rounded-full bg-[#5173D6] px-8 py-4 text-base font-bold text-white hover:bg-[#3B5BBE] hover:scale-105 transition-all"
        >
          {t(ctaLabel)}
        </button>
      </div>
      <LeadFormModal
        open={isOpen}
        onClose={() => setIsOpen(false)}
        formSlug={props.formSlug}
      />
    </section>
  );
}
