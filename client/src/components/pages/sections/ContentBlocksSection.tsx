// Quick 260906-fu3 — `contentBlocks` section type.
// A long-form explainer: a section header followed by a vertical stack of
// heading + paragraphs (+ optional check-list bullets) blocks. All copy is
// prop-driven with English defaults (the t() source language) so a bare
// `props: {}` still renders; PT is served via t() when the page language
// is 'pt'.

import { z } from "zod";
import { Check } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { sectionThemeSchema } from "./sectionTheme";

const contentBlockSchema = z.object({
  heading:    z.string(),
  paragraphs: z.array(z.string()),
  bullets:    z.array(z.string()).optional(),
});

export const contentBlocksPropsSchema = z.object({
  eyebrow:    z.string().optional(),
  heading:    z.string().optional(),
  subheading: z.string().optional(),
  blocks:     z.array(contentBlockSchema).min(1).optional(),
  theme:      sectionThemeSchema,
});
export type ContentBlocksProps = z.infer<typeof contentBlocksPropsSchema>;

const DEFAULTS = {
  eyebrow:    "How it works",
  heading:    "Everything you need to know",
  subheading: "A plain-language walkthrough of what you get and how the process works.",
  blocks: [
    {
      heading:    "What it is",
      paragraphs: [
        "A short explanation of the product and what it does for your business.",
      ],
      bullets: [] as string[],
    },
    {
      heading:    "How it works",
      paragraphs: [
        "A step-by-step description of the process from first contact to delivery.",
      ],
      bullets: [] as string[],
    },
    {
      heading:    "What we need from you",
      paragraphs: [
        "The few things you provide so we can get started right away.",
      ],
      bullets: [] as string[],
    },
  ],
} as const;

// Quick 260906-qwl — LIGHT is copied verbatim from the pre-task classNames, so
// `theme` undefined renders exactly as before.
const LIGHT = {
  section:      "bg-white",
  eyebrow:      "text-[#1C53A3]",
  heading:      "text-zinc-900",
  subheading:   "text-zinc-600",
  blockHeading: "text-zinc-900",
  paragraph:    "text-zinc-600",
  bulletIcon:   "text-[#1C53A3]",
  bulletText:   "text-zinc-700",
} as const;

const DARK = {
  section:      "bg-[#111111]",
  eyebrow:      "text-blue-300",
  heading:      "text-white",
  subheading:   "text-zinc-300",
  blockHeading: "text-white",
  paragraph:    "text-zinc-300",
  bulletIcon:   "text-blue-300",
  bulletText:   "text-zinc-200",
} as const;

export function ContentBlocksSection({ props }: { props: ContentBlocksProps }) {
  const { t } = useTranslation();
  const eyebrow    = props.eyebrow    ?? DEFAULTS.eyebrow;
  const heading    = props.heading    ?? DEFAULTS.heading;
  const subheading = props.subheading ?? DEFAULTS.subheading;
  const blocks     = props.blocks     ?? DEFAULTS.blocks;
  const c          = props.theme === "dark" ? DARK : LIGHT;

  return (
    <section
      className={`${c.section} py-20 sm:py-24`}
      data-testid="section-content-blocks"
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

        <div className="max-w-3xl mx-auto space-y-10">
          {blocks.map((block, idx) => (
            <div key={idx} data-testid={`content-block-${idx + 1}`}>
              <h3 className={`text-xl sm:text-2xl font-bold font-display ${c.blockHeading} mb-4`}>
                {t(block.heading)}
              </h3>
              <div className="space-y-4">
                {block.paragraphs.map((paragraph, pIdx) => (
                  <p key={pIdx} className={`text-base ${c.paragraph} leading-relaxed`}>
                    {t(paragraph)}
                  </p>
                ))}
              </div>
              {block.bullets && block.bullets.length > 0 && (
                <ul className="mt-5 space-y-3">
                  {block.bullets.map((bullet, bIdx) => (
                    <li key={bIdx} className="flex items-start gap-3">
                      <Check className={`h-5 w-5 ${c.bulletIcon} shrink-0 mt-0.5`} />
                      <span className={`text-base ${c.bulletText} leading-relaxed`}>
                        {t(bullet)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
