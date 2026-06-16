import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { lazy, Suspense, useEffect } from "react";
import { AppLoader } from "@/components/ui/spinner";
import { sectionRegistry } from "@/components/pages/sectionRegistry";
import { useTranslation } from "@/hooks/useTranslation";

const NotFound = lazy(() => import("@/pages/not-found"));

interface PageResponse {
  slug: string;
  name: string;
  sections: Array<{ type: string; props: Record<string, unknown> }>;
  isActive: boolean;
  language: "en" | "pt";
  alternateSlug?: string | null;
}

export default function DynamicPage() {
  const { slug } = useParams<{ slug: string }>();
  const { setLanguage } = useTranslation();

  const { data, isLoading, error } = useQuery<PageResponse>({
    queryKey: [`/api/pages/slug/${slug}`],
    enabled: !!slug,
    retry: false,
  });

  // Drive the site chrome (Navbar/Footer/t()-based sections) from the page's
  // configured language. A fresh ad visitor lands directly in the right language.
  const pageLanguage = data?.language;
  useEffect(() => {
    if (pageLanguage === "en" || pageLanguage === "pt") {
      setLanguage(pageLanguage);
    }
    // setLanguage is recreated each render but stable in behavior — re-run only
    // when the page's language changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageLanguage]);

  // Inject hreflang alternates for the bilingual pair; remove them on unmount so
  // they don't leak onto other pages. Canonical stays managed globally by useSEO.
  const slugForSeo = data?.slug;
  const altSlug = data?.alternateSlug;
  useEffect(() => {
    if (!slugForSeo || !altSlug) return;
    const origin = window.location.origin;
    const selfHref = `${origin}/${slugForSeo}`;
    const altHref = `${origin}/${altSlug}`;
    const selfTag = pageLanguage === "en" ? "en" : "pt-BR";
    const altTag = pageLanguage === "en" ? "pt-BR" : "en";
    const xDefaultHref = pageLanguage === "en" ? selfHref : altHref;

    const created: HTMLLinkElement[] = [];
    const add = (hreflang: string, href: string) => {
      const link = document.createElement("link");
      link.rel = "alternate";
      link.hreflang = hreflang;
      link.href = href;
      link.setAttribute("data-page-i18n", "true");
      document.head.appendChild(link);
      created.push(link);
    };
    add(selfTag, selfHref);
    add(altTag, altHref);
    add("x-default", xDefaultHref);

    return () => created.forEach((l) => l.remove());
  }, [slugForSeo, altSlug, pageLanguage]);

  if (isLoading) return <AppLoader />;

  // Inactive pages come back as 404 from the public endpoint (43-02 contract).
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
