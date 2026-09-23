import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import type { CompanySettings } from "@shared/schema";
import { TrustBadges, badgeIconMap } from "@/components/home/TrustBadges";
import { useTranslation } from "@/hooks/useTranslation";
import { DARK_HAIRLINE, DARK_SURFACE, sectionThemeSchema } from "./sectionTheme";

const badgeSchema = z.object({
  title: z.string(),
  description: z.string(),
  icon: z.string().optional(),
});

export const trustBadgesPropsSchema = z.object({
  theme: sectionThemeSchema,
  badges: z.array(badgeSchema).max(6).optional(),
}).passthrough();

type Badge = z.infer<typeof badgeSchema>;

export function TrustBadgesAdapter({ props }: { props: z.infer<typeof trustBadgesPropsSchema> }) {
  const { data: settings } = useQuery<CompanySettings>({
    queryKey: ["/api/company-settings"],
  });

  const badges = props.badges ?? settings?.homepageContent?.trustBadges ?? [];
  if (badges.length === 0) return null;

  if (props.theme === "dark") return <DarkBadgeBand badges={badges} />;

  // Light (the /websites and /barbershops landings): the homepage card, as before.
  return (
    <div className="container-custom mx-auto px-4 sm:px-6 py-6">
      <TrustBadges badges={badges} />
    </div>
  );
}

/**
 * Dark: a full-bleed band on the page's navy surface, hairlines top and bottom
 * and between items. The homepage card is not used here: its own #111 fill
 * inside a container-width wrapper left visible steps at the band's edges.
 */
function DarkBadgeBand({ badges }: { badges: Badge[] }) {
  const { t } = useTranslation();
  return (
    <div className={`${DARK_SURFACE} border-y ${DARK_HAIRLINE}`} data-testid="section-trust-badges">
      <div className="container-custom container-page mx-auto">
        <ul className={`grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x ${DARK_HAIRLINE} [&>li]:border-[rgba(180,192,216,0.14)]`}>
          {badges.map((badge, i) => {
            const Icon = badgeIconMap[(badge.icon || "").toLowerCase()] || badgeIconMap.star;
            return (
              <li key={i} className="flex items-start gap-4 py-6 md:py-8 md:px-8 first:md:pl-0 last:md:pr-0">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cta/15 text-blue-300">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span>
                  <span className="block font-semibold text-white">{t(badge.title)}</span>
                  <span className="mt-1 block text-sm leading-relaxed text-[#B4C0D8]">{t(badge.description)}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
