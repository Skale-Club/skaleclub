import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import type { CompanySettings } from "@shared/schema";
import { OurServicesSection } from "@/components/home/OurServicesSection";

export const ourServicesPropsSchema = z.object({});

// Renders the shared "Our Services" dark carousel section. Content is the
// single admin-managed instance (homepageContent.ourServicesSection), so
// editing it in Website → Our Services updates every page that uses it.
export function OurServicesAdapter(_props: { props: z.infer<typeof ourServicesPropsSchema> }) {
  const { data: settings } = useQuery<CompanySettings>({
    queryKey: ["/api/company-settings"],
  });

  if (!settings) return null;

  return <OurServicesSection section={settings.homepageContent?.ourServicesSection} />;
}
