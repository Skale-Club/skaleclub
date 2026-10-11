import { useQuery } from "@tanstack/react-query";
import type { z } from "zod";
import type { CompanySettings } from "@shared/schema";
import { aboutPropsSchema } from "@shared/section-definitions";
import { AboutSection } from "@/components/AboutSection";


export function AboutAdapter({ props }: { props: z.infer<typeof aboutPropsSchema> }) {
  const { data: settings } = useQuery<CompanySettings>({
    queryKey: ["/api/company-settings"],
  });

  if (!settings) return null;

  return (
    <AboutSection
      aboutImageUrl={settings.aboutImageUrl}
      content={settings.homepageContent?.aboutSection}
      tone={props.tone}
    />
  );
}
