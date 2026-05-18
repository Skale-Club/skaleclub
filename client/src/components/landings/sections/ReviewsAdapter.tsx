import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import type { CompanySettings } from "@shared/schema";
import { ReviewsSection } from "@/components/home/ReviewsSection";

export const reviewsPropsSchema = z.object({
  embedUrl: z.string().url().optional(),
  title: z.string().optional(),
  subtitle: z.string().optional(),
});

export function ReviewsAdapter({ props }: { props: z.infer<typeof reviewsPropsSchema> }) {
  const { data: settings } = useQuery<CompanySettings>({
    queryKey: ["/api/company-settings"],
  });

  const fallback = settings?.homepageContent?.reviewsSection;

  const embedUrl = props.embedUrl || fallback?.embedUrl || "";
  const title = props.title ?? fallback?.title;
  const subtitle = props.subtitle ?? fallback?.subtitle;

  if (!embedUrl && !title && !subtitle) return null;

  return <ReviewsSection embedUrl={embedUrl} title={title} subtitle={subtitle} />;
}
