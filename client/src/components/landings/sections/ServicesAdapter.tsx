import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import type { CompanySettings } from "@shared/schema";
import { ServicesSection } from "@/components/home/ServicesSection";

export const servicesPropsSchema = z.object({
  mode: z.enum(["steps", "services"]).optional(),
});

export function ServicesAdapter({ props }: { props: z.infer<typeof servicesPropsSchema> }) {
  const { data: settings } = useQuery<CompanySettings>({
    queryKey: ["/api/company-settings"],
  });

  if (!settings) return null;

  const homepageContent = settings.homepageContent || {};
  const consultingStepsSection = homepageContent.consultingStepsSection;
  const section = homepageContent.horizontalScrollSection || consultingStepsSection;

  return (
    <ServicesSection
      section={section}
      mode={props.mode}
      onCtaClick={() => {
        const trigger = document.querySelector<HTMLElement>('[data-landing-lead-cta]');
        if (trigger) trigger.click();
      }}
    />
  );
}
