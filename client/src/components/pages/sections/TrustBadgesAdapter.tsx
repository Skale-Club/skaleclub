import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import type { CompanySettings } from "@shared/schema";
import { TrustBadges } from "@/components/home/TrustBadges";

export const trustBadgesPropsSchema = z.object({}).passthrough();

export function TrustBadgesAdapter({ props: _ }: { props: z.infer<typeof trustBadgesPropsSchema> }) {
  const { data: settings } = useQuery<CompanySettings>({
    queryKey: ["/api/company-settings"],
  });

  const badges = settings?.homepageContent?.trustBadges ?? [];
  if (badges.length === 0) return null;

  // TrustBadges is absolutely positioned and expects a relative parent (the
  // gradient wrapper on Home.tsx). Mirror that here so the badges sit at the
  // expected vertical offset under the hero.
  return (
    <div className="bg-gradient-to-br from-[#f7f9fc] via-white to-[#eaf1ff] relative w-full mt-0 pt-0">
      <TrustBadges badges={badges} />
    </div>
  );
}
