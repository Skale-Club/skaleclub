// `processStepper` section type.
// A reusable 4-step "how we work" grid. All copy is prop-driven with
// English defaults (the t() source language) so the /websites seed can pass
// `props: {}`; PT is served via translations.ts when language is 'pt'.

import { z } from "zod";
import {
  Search, Palette, Code2, Rocket,
  MessageCircle, PenTool, Factory, Truck,
  Nfc, Smartphone, QrCode, Star,
  CreditCard, Package, Link2, Check,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Band } from "@/components/editorial";
import { SectionHeading } from "@/components/layout/SectionHeading";
import { useTranslation } from "@/hooks/useTranslation";
import { sectionThemeSchema } from "./sectionTheme";

const stepSchema = z.object({
  title:       z.string(),
  description: z.string(),
});

// Optional per-step icon override. A closed enum allowlist keyed to a lucide
// component map (not free-form strings) so seeded props can never reference
// an icon that does not exist in the bundle.
export const processStepperIconNames = [
  "Search", "Palette", "Code2", "Rocket",
  "MessageCircle", "PenTool", "Factory", "Truck",
  "Nfc", "Smartphone", "QrCode", "Star",
  "CreditCard", "Package", "Link2", "Check",
] as const;
export type ProcessStepperIconName = (typeof processStepperIconNames)[number];

const ICON_MAP: Record<ProcessStepperIconName, LucideIcon> = {
  Search, Palette, Code2, Rocket,
  MessageCircle, PenTool, Factory, Truck,
  Nfc, Smartphone, QrCode, Star,
  CreditCard, Package, Link2, Check,
};

export const processStepperPropsSchema = z.object({
  eyebrow:     z.string().optional(),
  heading:     z.string().optional(),
  subheading:  z.string().optional(),
  steps:       z.array(stepSchema).length(4).optional(),
  icons:       z.array(z.enum(processStepperIconNames)).length(4).optional(),
  // In-page anchor (e.g. "how-it-works") so a hero button can scroll here.
  anchorId:    z.string().regex(/^[a-z][a-z0-9-]*$/).optional(),
  theme:       sectionThemeSchema,
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

// `cta-ink` is the accent on light surfaces, `cta-soft` on dark ones.
const LIGHT = {
  band:     "ice",
  grid:     "border-ink-700/10 bg-ink-700/10",
  cell:     "bg-white hover:bg-paper-ice/60",
  number:   "text-cta-ink",
  icon:     "text-ink-400",
  title:    "text-ink",
  body:     "text-ink-500",
} as const;

const DARK = {
  band:     "dark",
  grid:     "border-white/10 bg-white/10",
  cell:     "bg-navy-800 hover:bg-navy-700",
  number:   "text-cta-soft",
  icon:     "text-fog-400",
  title:    "text-fog-50",
  body:     "text-fog-400",
} as const;

export function ProcessStepperSection({ props }: { props: ProcessStepperProps }) {
  const { t } = useTranslation();
  const dark       = props.theme === "dark";
  const steps      = props.steps ?? DEFAULTS.steps;
  const icons      = props.icons ? props.icons.map((n) => ICON_MAP[n]) : ICONS;
  const c          = dark ? DARK : LIGHT;

  return (
    <div data-testid="section-process-stepper">
      <Band tone={c.band} id={props.anchorId} className="scroll-mt-24">
        <SectionHeading
          variant="editorial"
          tone={dark ? "dark" : "light"}
          eyebrow={props.eyebrow ?? DEFAULTS.eyebrow}
          title={props.heading ?? DEFAULTS.heading}
          subtitle={props.subheading ?? DEFAULTS.subheading}
        />

        <ol className={`mt-12 grid gap-px overflow-hidden border md:grid-cols-2 lg:grid-cols-4 ${c.grid}`}>
          {steps.map((step, idx) => {
            const Icon = icons[idx];
            const stepNumber = idx + 1;
            return (
              <li
                key={idx}
                className={`p-6 transition sm:p-7 ${c.cell}`}
                data-testid={`step-process-${stepNumber}`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-sm tabular-nums ${c.number}`}>{String(stepNumber).padStart(2, "0")}</span>
                  <Icon className={`h-5 w-5 ${c.icon}`} aria-hidden="true" />
                </div>
                <h3 className={`mt-8 font-display text-2xl font-semibold leading-tight ${c.title}`}>
                  {t(step.title)}
                </h3>
                <p className={`mt-4 text-sm leading-6 ${c.body}`}>{t(step.description)}</p>
              </li>
            );
          })}
        </ol>
      </Band>
    </div>
  );
}
