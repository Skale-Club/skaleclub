// `faqAccordion` section type.
// A single-open, collapsible FAQ list built on the Radix accordion. All copy
// is prop-driven with English defaults (the t() source language) so a bare
// `props: {}` still renders; PT is served via t() when the page language is 'pt'.

import { z } from "zod";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { ChevronDown } from "lucide-react";
import { Band } from "@/components/editorial";
import { SectionHeading } from "@/components/layout/SectionHeading";
import { useTranslation } from "@/hooks/useTranslation";
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

const LIGHT = {
  list:     "divide-ink-700/10 border-ink-700/10",
  question: "text-ink hover:text-ink-700 focus-visible:outline-cta-ink",
  answer:   "text-ink-500",
  chevron:  "text-cta-ink",
} as const;

const DARK = {
  list:     "divide-white/10 border-white/10",
  question: "text-fog-200 hover:text-white focus-visible:outline-cta-soft",
  answer:   "text-fog-400",
  chevron:  "text-cta-soft",
} as const;

export function FaqAccordionSection({ props }: { props: FaqAccordionProps }) {
  const { t } = useTranslation();
  const dark  = props.theme === "dark";
  const items = props.items ?? DEFAULTS.items;
  const c     = dark ? DARK : LIGHT;

  return (
    <div data-testid="section-faq-accordion">
      <Band tone={dark ? "dark" : "cream"}>
        <SectionHeading
          variant="editorial"
          tone={dark ? "dark" : "light"}
          eyebrow={props.eyebrow ?? DEFAULTS.eyebrow}
          title={props.heading ?? DEFAULTS.heading}
          subtitle={props.subheading ?? DEFAULTS.subheading}
        />

        <AccordionPrimitive.Root
          type="single"
          collapsible
          className={`mt-12 max-w-3xl divide-y border-y ${c.list}`}
        >
          {items.map((item, idx) => (
            <AccordionPrimitive.Item key={idx} value={`faq-${idx}`} data-testid={`faq-item-${idx + 1}`}>
              <AccordionPrimitive.Header className="flex">
                <AccordionPrimitive.Trigger
                  data-testid={`faq-trigger-${idx + 1}`}
                  className={`flex flex-1 items-start justify-between gap-5 py-5 text-left font-semibold leading-6 transition focus-visible:outline-2 focus-visible:outline-offset-2 [&[data-state=open]>svg]:rotate-180 ${c.question}`}
                >
                  {t(item.question)}
                  <ChevronDown className={`mt-0.5 h-5 w-5 shrink-0 transition-transform duration-200 ${c.chevron}`} aria-hidden="true" />
                </AccordionPrimitive.Trigger>
              </AccordionPrimitive.Header>
              <AccordionPrimitive.Content className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                <p className={`whitespace-pre-wrap pb-6 pr-8 text-sm leading-7 ${c.answer}`}>{t(item.answer)}</p>
              </AccordionPrimitive.Content>
            </AccordionPrimitive.Item>
          ))}
        </AccordionPrimitive.Root>
      </Band>
    </div>
  );
}
