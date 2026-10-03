// `featureGrid` section type: a header and 2-6 icon cards (title + one line).
// Built for the NFC landing ("what the tap opens", "where to use it"). Copy is
// English (the t() source language); PT is served via t() on 'pt' pages.

import { z } from "zod";
import {
  Star, Instagram, IdCard, UtensilsCrossed, Globe, MessageCircle,
  Store, ConciergeBell, Car, KeyRound, Nfc, Smartphone,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Band, EditorialCard } from "@/components/editorial";
import { SectionHeading } from "@/components/layout/SectionHeading";
import { useTranslation } from "@/hooks/useTranslation";
import { languageHref } from "@/lib/languageRouting";
import { sectionThemeSchema } from "./sectionTheme";

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
  // Optional editorial photo. Kept local/root-relative so managed page content
  // cannot turn this component into a third-party tracking surface.
  imageUrl:    z.string().regex(/^\/(?![\/\\])/).optional(),
  imageAlt:    z.string().optional(),
  // Optional: makes the card a link to a site path (e.g. a group page's cards
  // pointing at each item's own page). Root-relative only, same convention as
  // leadFormCta's imageUrl, but tighter: `/^\/` alone also passed "//evil.com"
  // (protocol-relative, i.e. an external URL). The negative lookahead blocks
  // a second leading slash (or backslash, which browsers treat the same way).
  // Absent = the plain, non-interactive card (every existing use of this section).
  href:        z.string().regex(/^\/(?![\/\\])[a-z0-9/-]*$/).optional(),
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
  icon:  "bg-cta-ink/10 text-cta-ink",
  title: "text-ink",
  body:  "text-ink-500",
} as const;

const DARK = {
  icon:  "bg-white/5 text-cta-soft",
  title: "text-fog-50",
  body:  "text-fog-400",
} as const;

export function FeatureGridSection({ props }: { props: FeatureGridProps }) {
  const { t } = useTranslation();
  const dark = props.theme === "dark";
  const c = dark ? DARK : LIGHT;
  // 4 items read best as 2x2 / 4-across; 3, 5 and 6 as rows of three.
  const cols = props.items.length === 4 ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-2 lg:grid-cols-3";

  return (
    <div data-testid="section-feature-grid">
      <Band tone={dark ? "dark" : "cream"}>
        <SectionHeading
          variant="editorial"
          tone={dark ? "dark" : "light"}
          eyebrow={props.eyebrow}
          title={props.heading}
          subtitle={props.subheading}
        />

        <ul className={`mt-12 grid grid-cols-1 gap-4 sm:gap-5 ${cols}`}>
          {props.items.map((item, i) => {
            const Icon = ICON_MAP[item.icon];
            const hasImage = !!item.imageUrl;
            const card = (
              <EditorialCard
                tone={dark ? "dark" : "light"}
                // With a photo the card drops its own padding (both p-6 AND sm:p-8,
                // or the text ends up double-padded): the photo runs edge to edge
                // on top and the copy below gets one even inset.
                className={hasImage ? "flex h-full flex-col overflow-hidden p-0 sm:p-0" : "h-full"}
              >
                {item.imageUrl && (
                  <div className={`aspect-[4/3] w-full overflow-hidden border-b ${dark ? "border-white/10" : "border-ink-700/10"}`}>
                    <img
                      src={item.imageUrl}
                      alt={item.imageAlt ? t(item.imageAlt) : t(item.title)}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover transition-transform duration-500 motion-safe:group-hover:scale-[1.025]"
                      sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                    />
                  </div>
                )}
                <div className={hasImage ? "flex flex-1 flex-col p-6" : undefined}>
                  <span className={`flex h-11 w-11 items-center justify-center rounded-full ${c.icon}`}>
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className={`mt-5 font-display text-xl font-semibold leading-tight ${c.title}`}>{t(item.title)}</h3>
                  <p className={`mt-2 text-sm leading-6 ${c.body}`}>{t(item.description)}</p>
                </div>
              </EditorialCard>
            );
            return (
              <li key={i}>
                {item.href ? <a href={languageHref(item.href)} className="group block h-full">{card}</a> : card}
              </li>
            );
          })}
        </ul>
      </Band>
    </div>
  );
}
