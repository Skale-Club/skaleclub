// Phase 44 — `processStepper` section type.
// A reusable 4-step "how we work" stepper. All copy is prop-driven with
// English defaults (the t() source language) so the /websites seed can pass
// `props: {}`; PT is served via translations.ts when language is 'pt'.

import { z } from "zod";
import { Search, Palette, Code2, Rocket } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

const stepSchema = z.object({
  title:       z.string(),
  description: z.string(),
});

export const processStepperPropsSchema = z.object({
  eyebrow:     z.string().optional(),
  heading:     z.string().optional(),
  subheading:  z.string().optional(),
  steps:       z.array(stepSchema).length(4).optional(),
});
export type ProcessStepperProps = z.infer<typeof processStepperPropsSchema>;

const DEFAULTS = {
  eyebrow:    "How we work",
  heading:    "From briefing to launch in 4 steps",
  subheading: "A clear process, with deadlines and deliverables agreed from the first contact.",
  steps: [
    {
      title:       "Discovery",
      description: "We understand your business, target audience, and website goals. You get a briefing with scope and timeline.",
    },
    {
      title:       "Design",
      description: "We create visual prototypes aligned with your brand. You approve before any code is written.",
    },
    {
      title:       "Build",
      description: "We develop the website focused on speed, SEO, and conversion. You follow the progress in a staging environment.",
    },
    {
      title:       "Launch",
      description: "We publish with your own domain, analytics integration, and forms connected to your CRM. Post-launch support included.",
    },
  ],
} as const;

const ICONS = [Search, Palette, Code2, Rocket] as const;

export function ProcessStepperSection({ props }: { props: ProcessStepperProps }) {
  const { t } = useTranslation();
  const eyebrow    = props.eyebrow    ?? DEFAULTS.eyebrow;
  const heading    = props.heading    ?? DEFAULTS.heading;
  const subheading = props.subheading ?? DEFAULTS.subheading;
  const steps      = props.steps      ?? DEFAULTS.steps;

  return (
    <section
      className="bg-zinc-50 py-20 sm:py-24"
      data-testid="section-process-stepper"
    >
      <div className="container-custom mx-auto px-6">
        <div className="max-w-3xl mx-auto text-center mb-12 sm:mb-16">
          <p className="text-sm font-semibold uppercase tracking-widest text-[#1C53A3] mb-3">
            {t(eyebrow)}
          </p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold font-display text-zinc-900 leading-tight mb-4">
            {t(heading)}
          </h2>
          <p className="text-base sm:text-lg text-zinc-600 leading-relaxed">
            {t(subheading)}
          </p>
        </div>

        <ol className="relative grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-6">
          {/* Connecting line — only on lg, sits behind the numbered circles */}
          <div
            aria-hidden="true"
            className="hidden lg:block absolute top-8 left-[12.5%] right-[12.5%] h-px bg-zinc-300"
          />

          {steps.map((step, idx) => {
            const Icon = ICONS[idx];
            const stepNumber = idx + 1;
            return (
              <li
                key={idx}
                className="relative flex flex-col items-center text-center"
                data-testid={`step-process-${stepNumber}`}
              >
                <div className="relative z-10 flex h-16 w-16 items-center justify-center rounded-full bg-[#1C53A3] text-white shadow-lg shadow-[#1C53A3]/20 mb-5">
                  <Icon className="h-7 w-7" />
                  <span className="absolute -top-2 -right-2 flex h-7 w-7 items-center justify-center rounded-full bg-[#406EF1] text-xs font-bold text-white border-2 border-zinc-50">
                    {stepNumber}
                  </span>
                </div>
                <h3 className="text-lg sm:text-xl font-bold font-display text-zinc-900 mb-2">
                  {t(step.title)}
                </h3>
                <p className="text-sm sm:text-base text-zinc-600 leading-relaxed max-w-xs">
                  {t(step.description)}
                </p>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
