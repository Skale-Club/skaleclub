import { useQuery } from "@tanstack/react-query";
import type { z } from "zod";
import type { CompanySettings } from "@shared/schema";
import { reviewsPropsSchema } from "@shared/section-definitions";
import { ReviewsSection } from "@/components/home/ReviewsSection";


export function ReviewsAdapter({ props }: { props: z.infer<typeof reviewsPropsSchema> }) {
  const { data: settings } = useQuery<CompanySettings>({
    queryKey: ["/api/company-settings"],
  });

  const fallback = settings?.homepageContent?.reviewsSection;

  const embedUrl = props.embedUrl || fallback?.embedUrl || "";
  const title = props.title ?? fallback?.title;
  const subtitle = props.subtitle ?? fallback?.subtitle;

  if (!props.xphere && !embedUrl && !title && !subtitle) return null;

  return <ReviewsSection xphere={props.xphere} embedUrl={embedUrl} title={title} subtitle={subtitle} />;
}
