import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { AppLoader } from "@/components/ui/spinner";
import { sectionRegistry } from "@/components/landings/sectionRegistry";

const NotFound = lazy(() => import("@/pages/not-found"));

interface LandingResponse {
  slug: string;
  name: string;
  sections: Array<{ type: string; props: Record<string, unknown> }>;
  isActive: boolean;
}

export default function DynamicLanding() {
  const { slug } = useParams<{ slug: string }>();

  const { data, isLoading, error } = useQuery<LandingResponse>({
    queryKey: [`/api/landing-pages/slug/${slug}`],
    enabled: !!slug,
    retry: false,
  });

  if (isLoading) return <AppLoader />;

  // Inactive landings come back as 404 from the public endpoint (43-02 contract).
  if (error || !data) {
    return (
      <Suspense fallback={<AppLoader />}>
        <NotFound />
      </Suspense>
    );
  }

  return (
    <>
      {data.sections.map((section, idx) => {
        const entry = sectionRegistry[section.type];
        if (!entry) {
          if (import.meta.env.DEV) {
            return (
              <div
                key={idx}
                className="border border-red-500/40 bg-red-500/5 p-4 text-sm text-red-300"
              >
                Unknown section type: <code>{section.type}</code>
              </div>
            );
          }
          return null;
        }
        const parsed = entry.propsSchema.safeParse(section.props ?? {});
        if (!parsed.success) {
          if (import.meta.env.DEV) {
            return (
              <div
                key={idx}
                className="border border-amber-500/40 bg-amber-500/5 p-4 text-sm text-amber-300"
              >
                Invalid props for section <code>{section.type}</code> (index {idx}):{" "}
                {parsed.error.message}
              </div>
            );
          }
          return null;
        }
        const Component = entry.component;
        return <Component key={idx} props={parsed.data} />;
      })}
    </>
  );
}
