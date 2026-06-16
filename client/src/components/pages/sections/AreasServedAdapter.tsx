import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import type { CompanySettings } from "@shared/schema";
import { AreasServedMap } from "@/components/AreasServedMap";

export const areasServedPropsSchema = z.object({}).passthrough();

export function AreasServedAdapter({ props: _ }: { props: z.infer<typeof areasServedPropsSchema> }) {
  const { data: settings } = useQuery<CompanySettings>({
    queryKey: ["/api/company-settings"],
  });

  if (!settings) return null;

  const areasServedSection = settings.homepageContent?.areasServedSection;
  const hasContent =
    !!settings.mapEmbedUrl ||
    !!areasServedSection?.heading ||
    !!areasServedSection?.description;

  if (!hasContent) return null;

  return (
    <section id="areas-served" className="bg-white py-20">
      <AreasServedMap
        mapEmbedUrl={settings.mapEmbedUrl}
        content={areasServedSection}
      />
    </section>
  );
}
