import { useState } from "react";
import { z } from "zod";
import { LeadFormModal } from "@/components/LeadFormModal";

export const leadFormCtaPropsSchema = z.object({
  formSlug: z.string().min(1),
  ctaLabel: z.string().optional(),
  heading: z.string().optional(),
  subheading: z.string().optional(),
});

export function LeadFormCtaAdapter({ props }: { props: z.infer<typeof leadFormCtaPropsSchema> }) {
  const [isOpen, setIsOpen] = useState(false);
  const ctaLabel = props.ctaLabel || "Get started";

  return (
    <section className="bg-zinc-950 py-20 text-center">
      <div className="container-custom mx-auto max-w-2xl px-6">
        {props.heading ? (
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">{props.heading}</h2>
        ) : null}
        {props.subheading ? (
          <p className="text-zinc-300 text-lg mb-8">{props.subheading}</p>
        ) : null}
        <button
          type="button"
          data-landing-lead-cta
          onClick={() => setIsOpen(true)}
          className="inline-flex items-center justify-center rounded-full bg-[#FFFF01] px-8 py-4 text-base font-bold text-black hover:scale-105 transition-transform"
        >
          {ctaLabel}
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
