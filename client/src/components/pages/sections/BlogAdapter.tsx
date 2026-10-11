import { useQuery } from "@tanstack/react-query";
import type { z } from "zod";
import type { CompanySettings } from "@shared/schema";
import { blogPropsSchema } from "@shared/section-definitions";
import { BlogSection } from "@/components/home/BlogSection";


export function BlogAdapter({ props: _ }: { props: z.infer<typeof blogPropsSchema> }) {
  const { data: settings } = useQuery<CompanySettings>({
    queryKey: ["/api/company-settings"],
  });

  return <BlogSection content={settings?.homepageContent?.blogSection} />;
}
