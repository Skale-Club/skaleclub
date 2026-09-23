// `featureGrid` section type: a header and 2-6 icon cards (title + one line).
// Built for the NFC landing ("what the tap opens", "where to use it"). Copy is
// English (the t() source language); PT is served via t() on 'pt' pages.

import { z } from "zod";
import {
  Star, Instagram, IdCard, UtensilsCrossed, Globe, MessageCircle,
  Store, ConciergeBell, Car, KeyRound, Nfc, Smartphone,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { DARK_HAIRLINE, DARK_SURFACE, sectionThemeSchema } from "./sectionTheme";

// Closed allowlist, like processStepper: seeded props can never name an icon
// the bundle does not ship.
export const featureGridIconNames = [
  "Star", "Instagram", "IdCard", "UtensilsCrossed", "Globe", "MessageCircle",
  "Store", "ConciergeBell", "Car", "KeyRound", "Nfc", "Smartphone",
] as const;

const ICON_MAP: Record<(typeof featureGridIconNames)[number], LucideIcon> = {
  Star, Instagram, IdCard, UtensilsCrossed, Globe, MessageCircle,
  Store, ConciergeBell, Car, KeyRound, Nfc, Smartphone,
};

const itemSchema = z.object({
  icon:        z.enum(featureGridIconNames),
  title:       z.string(),
  description: z.string(),
});

export const featureGridPropsSchema = z.object({
  eyebrow:    z.string().optional(),
  heading:    z.string(),
  subheading: z.string().optional(),
  items:      z.array(itemSchema).min(2).max(6),
  theme:      sectionThemeSchema,
});
export type FeatureGridProps = z.infer<typeof featureGridPropsSchema>;

const LIGHT = {
  section:    "bg-white",
  eyebrow:    "text-cta",
  heading:    "text-zinc-900",
  subheading: "text-zinc-600",
  card:       "border-zinc-200 bg-zinc-50",
  icon:       "bg-cta/10 text-cta",
  title:      "text-zinc-900",
  body:       "text-zinc-600",
} as const;

const DARK = {
  section:    DARK_SURFACE,
  eyebrow:    "text-blue-300",
  heading:    "text-white",
  subheading: "text-[#B4C0D8]",
  card:       `${DARK_HAIRLINE} bg-white/[0.03] hover:bg-white/[0.05]`,
  icon:       "bg-cta/15 text-blue-300",
  title:      "text-white",
  body:       "text-[#B4C0D8]",
} as const;

export function FeatureGridSection({ props }: { props: FeatureGridProps }) {
  const { t } = useTranslation();
  const c = props.theme === "dark" ? DARK : LIGHT;
  // 4 items read best as 2x2 / 4-across; 3, 5 and 6 as rows of three.
  const cols = props.items.length === 4 ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-2 lg:grid-cols-3";

  return (
    <section className={`${c.section} py-14 md:py-20`} data-testid="section-feature-grid">
      <div className="container-custom container-page mx-auto">
        <div className="max-w-3xl mx-auto text-center mb-10 sm:mb-14">
          {props.eyebrow && (
            <p className={`text-sm font-semibold uppercase tracking-widest ${c.eyebrow} mb-3`}>{t(props.eyebrow)}</p>
          )}
          <h2 className={`text-3xl sm:text-4xl lg:text-5xl font-bold font-display ${c.heading} leading-tight text-balance`}>
            {t(props.heading)}
          </h2>
          {props.subheading && (
            <p className={`mt-4 text-base sm:text-lg ${c.subheading} leading-relaxed`}>{t(props.subheading)}</p>
          )}
        </div>

        <ul className={`grid grid-cols-1 ${cols} gap-4 sm:gap-5`}>
          {props.items.map((item, i) => {
            const Icon = ICON_MAP[item.icon];
            return (
              <li key={i} className={`rounded-2xl border p-6 transition-colors ${c.card}`}>
                <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${c.icon}`}>
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className={`mt-5 text-lg font-bold font-display ${c.title}`}>{t(item.title)}</h3>
                <p className={`mt-1.5 text-[15px] leading-relaxed ${c.body}`}>{t(item.description)}</p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
