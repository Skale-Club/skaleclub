import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import type { CompanySettings } from "@shared/schema";
import { BlogSection } from "@/components/home/BlogSection";

export const blogPropsSchema = z.object({}).passthrough();

export function BlogAdapter({ props: _ }: { props: z.infer<typeof blogPropsSchema> }) {
  const { data: settings } = useQuery<CompanySettings>({
    queryKey: ["/api/company-settings"],
  });

  return <BlogSection content={settings?.homepageContent?.blogSection} />;
}
