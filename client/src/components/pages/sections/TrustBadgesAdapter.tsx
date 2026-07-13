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

  // TrustBadges renders as a plain block (no absolute overlap); provide its
  // own centered, padded container since it's used standalone here.
  return (
    <div className="container-custom mx-auto px-4 sm:px-6 py-6">
      <TrustBadges badges={badges} />
    </div>
  );
}
