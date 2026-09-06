// Quick 260906-fu3 — `faqAccordion` section type.
// A single-open, collapsible FAQ list built on the shared Radix accordion
// primitives. All copy is prop-driven with English defaults (the t() source
// language) so a bare `props: {}` still renders; PT is served via t() when
// the page language is 'pt'.

import { z } from "zod";
import { useTranslation } from "@/hooks/useTranslation";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { sectionThemeSchema } from "./sectionTheme";

const faqItemSchema = z.object({
  question: z.string(),
  answer:   z.string(),
});

export const faqAccordionPropsSchema = z.object({
  eyebrow:    z.string().optional(),
  heading:    z.string().optional(),
  subheading: z.string().optional(),
  items:      z.array(faqItemSchema).min(1).optional(),
  theme:      sectionThemeSchema,
});
export type FaqAccordionProps = z.infer<typeof faqAccordionPropsSchema>;

const DEFAULTS = {
  eyebrow:    "FAQ",
  heading:    "Common questions",
  subheading: "Quick answers to what people usually ask before ordering.",
  items: [
    {
      question: "How do I get started?",
      answer:   "Fill out the short form on this page and we will reach out on WhatsApp to confirm the details of your order.",
    },
    {
      question: "Can I see the design before it goes to production?",
      answer:   "Yes. We send you the artwork for approval, and nothing is produced until you say it is good to go.",
    },
    {
      question: "What if I have more questions?",
      answer:   "Just message us on WhatsApp. We answer every question before you commit to anything.",
    },
  ],
} as const;

// Quick 260906-qwl — LIGHT is copied verbatim from the pre-task classNames, so
// `theme` undefined renders exactly as before.
const LIGHT = {
  section:    "bg-white",
  eyebrow:    "text-[#1C53A3]",
  heading:    "text-zinc-900",
  subheading: "text-zinc-600",
  item:       "border-zinc-200",
  question:   "text-zinc-900",
  answer:     "text-zinc-600",
} as const;

const DARK = {
  section:    "bg-[#111111]",
  eyebrow:    "text-blue-300",
  heading:    "text-white",
  subheading: "text-zinc-300",
  item:       "border-white/10",
  question:   "text-white",
  answer:     "text-zinc-300",
} as const;

export function FaqAccordionSection({ props }: { props: FaqAccordionProps }) {
  const { t } = useTranslation();
  const eyebrow    = props.eyebrow    ?? DEFAULTS.eyebrow;
  const heading    = props.heading    ?? DEFAULTS.heading;
  const subheading = props.subheading ?? DEFAULTS.subheading;
  const items      = props.items      ?? DEFAULTS.items;
  const c          = props.theme === "dark" ? DARK : LIGHT;

  return (
    <section
      className={`${c.section} py-20 sm:py-24`}
      data-testid="section-faq-accordion"
    >
      <div className="container-custom mx-auto px-6">
        <div className="max-w-3xl mx-auto text-center mb-12 sm:mb-16">
          <p className={`text-sm font-semibold uppercase tracking-widest ${c.eyebrow} mb-3`}>
            {t(eyebrow)}
          </p>
          <h2 className={`text-3xl sm:text-4xl lg:text-5xl font-bold font-display ${c.heading} leading-tight mb-4`}>
            {t(heading)}
          </h2>
          <p className={`text-base sm:text-lg ${c.subheading} leading-relaxed`}>
            {t(subheading)}
          </p>
        </div>

        <div className="max-w-3xl mx-auto">
          <Accordion type="single" collapsible className="w-full">
            {items.map((item, idx) => (
              <AccordionItem
                key={idx}
                value={`faq-${idx}`}
                className={c.item}
                data-testid={`faq-item-${idx + 1}`}
              >
                <AccordionTrigger className={`text-left text-base sm:text-lg font-semibold ${c.question} hover:no-underline py-5`}>
                  {t(item.question)}
                </AccordionTrigger>
                <AccordionContent className={`text-base ${c.answer} leading-relaxed pb-5`}>
                  {t(item.answer)}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
}
