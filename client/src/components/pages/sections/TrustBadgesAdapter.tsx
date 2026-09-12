import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import type { CompanySettings } from "@shared/schema";
import { TrustBadges } from "@/components/home/TrustBadges";
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

// Quick 260906-qwl — the underlying TrustBadges card is already dark
// (`bg-[#111111]`, shared with the homepage and NOT modified here). The dark
// branch only paints this wrapper so there is no light gutter around the card,
// and gives it a little more breathing room on a full-dark page.
const LIGHT = { wrapper: "py-6" } as const;
const DARK = { wrapper: "bg-[#0f1014] py-6 sm:py-8" } as const;

export function TrustBadgesAdapter({ props }: { props: z.infer<typeof trustBadgesPropsSchema> }) {
  const { data: settings } = useQuery<CompanySettings>({
    queryKey: ["/api/company-settings"],
  });

  const badges = props.badges ?? settings?.homepageContent?.trustBadges ?? [];
  if (badges.length === 0) return null;

  const c = props.theme === "dark" ? DARK : LIGHT;

  // TrustBadges renders as a plain block (no absolute overlap); provide its
  // own centered, padded container since it's used standalone here.
  return (
    <div className={`container-custom mx-auto px-4 sm:px-6 ${c.wrapper}`}>
      <TrustBadges badges={badges} />
    </div>
  );
}
