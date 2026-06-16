import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import type { CompanySettings, HomepageContent } from "@shared/schema";
import { HeroSection } from "@/components/home/HeroSection";

// v1: no per-landing knobs; section inherits content from /api/company-settings.
// Future landing-specific overrides (e.g. /websites) get their own section type.
export const heroPropsSchema = z.object({}).passthrough();

export function HeroSectionAdapter({ props: _ }: { props: z.infer<typeof heroPropsSchema> }) {
  const { data: settings } = useQuery<CompanySettings>({
    queryKey: ["/api/company-settings"],
  });

  if (!settings) return null;

  const homepageContent: Partial<HomepageContent> = settings.homepageContent || {};

  return (
    <HeroSection
      companySettings={settings}
      homepageContent={homepageContent}
      onCtaClick={() => {
        // The leadFormCta section owns the modal. Hero's CTA also routes there
        // via the global `data-form-trigger="lead-form"` click handler — but on
        // dynamic landings there is no such handler, so we trigger a synthetic
        // click on the nearest leadFormCta button if present.
        const trigger = document.querySelector<HTMLElement>('[data-landing-lead-cta]');
        if (trigger) trigger.click();
      }}
    />
  );
}
