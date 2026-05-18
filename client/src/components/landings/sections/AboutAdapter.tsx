import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import type { CompanySettings } from "@shared/schema";
import { AboutSection } from "@/components/AboutSection";

export const aboutPropsSchema = z.object({}).passthrough();

export function AboutAdapter({ props: _ }: { props: z.infer<typeof aboutPropsSchema> }) {
  const { data: settings } = useQuery<CompanySettings>({
    queryKey: ["/api/company-settings"],
  });

  if (!settings) return null;

  // Mirror the section wrapper used by Home.tsx (bg-white py-20 + id anchor).
  return (
    <section id="about" className="bg-white py-20">
      <AboutSection
        aboutImageUrl={settings.aboutImageUrl}
        content={settings.homepageContent?.aboutSection}
      />
    </section>
  );
}
