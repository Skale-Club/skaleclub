import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import type { CompanySettings } from "@shared/schema";
import { badgeIconMap } from "@/components/home/TrustBadges";
import { Band } from "@/components/editorial";
import { useTranslation } from "@/hooks/useTranslation";
import { sectionThemeSchema } from "./sectionTheme";

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

  return <BadgeBand badges={badges} dark={props.theme === "dark"} />;
}

/**
 * A slim full-bleed band (navy or cream) with hairlines between items. The
 * light variant is used by the /websites and /barbershops landings.
 */
function BadgeBand({ badges, dark }: { badges: Badge[]; dark: boolean }) {
  const { t } = useTranslation();
  return (
    <div data-testid="section-trust-badges">
      <Band tone={dark ? "dark" : "cream"} className="py-8 sm:py-10">
        <ul
          className={`grid grid-cols-1 divide-y md:grid-cols-3 md:divide-x md:divide-y-0 ${
            dark ? "divide-white/10" : "divide-ink-700/10"
          }`}
        >
          {badges.map((badge, i) => {
            const Icon = badgeIconMap[(badge.icon || "").toLowerCase()] || badgeIconMap.star;
            return (
              <li key={i} className="flex items-start gap-4 py-5 first:pt-0 last:pb-0 md:px-8 md:py-0 md:first:pl-0 md:last:pr-0">
                <Icon
                  className={`mt-0.5 h-6 w-6 shrink-0 ${dark ? "text-cta-soft" : "text-cta-ink"}`}
                  aria-hidden="true"
                />
                <span>
                  <span className={`block font-semibold ${dark ? "text-fog-50" : "text-ink"}`}>{t(badge.title)}</span>
                  <span className={`mt-1 block text-sm leading-6 ${dark ? "text-fog-400" : "text-ink-500"}`}>
                    {t(badge.description)}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      </Band>
    </div>
  );
}
