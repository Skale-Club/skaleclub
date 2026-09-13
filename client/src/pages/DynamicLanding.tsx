import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { lazy, Suspense, useEffect, useRef } from "react";
import { AppLoader } from "@/components/ui/spinner";
import { sectionRegistry } from "@/components/pages/sectionRegistry";
import { useTranslation } from "@/hooks/useTranslation";
import { getLandingSeo, landingPathForSlug } from "@shared/landingSeo";

const NotFound = lazy(() => import("@/pages/not-found"));

interface PageResponse {
  slug: string;
  name: string;
  sections: Array<{ type: string; props: Record<string, unknown> }>;
  isActive: boolean;
  language: "en" | "pt";
  alternateSlug?: string | null;
}

export default function DynamicPage({ brVariant = false }: { brVariant?: boolean }) {
  const { slug: routeSlug } = useParams<{ slug: string }>();
  // `/x/br` resolves the `x-br` row. The DB never stores a slash: shared/schema/pages.ts
  // slugPattern forbids it, so the two-segment form lives only in the route.
  const slug =
    brVariant && routeSlug && !routeSlug.endsWith("-br") ? `${routeSlug}-br` : routeSlug;
  const { language, setLanguage } = useTranslation();

  const { data, isLoading, error } = useQuery<PageResponse>({
    queryKey: [`/api/pages/slug/${slug}`],
    enabled: !!slug,
    retry: false,
  });

  // Tracks whether the site chrome's language has been synced to this landing's
  // configured language yet. Until it has, the render path below shows a loader
  // instead of painting one frame in the wrong language (e.g. an EN ad visitor
  // briefly seeing Portuguese, the LanguageContext default for new visitors).
  const languageSyncedRef = useRef(false);

  // Re-sync when navigating between two different landings.
  useEffect(() => {
    languageSyncedRef.current = false;
  }, [slug]);

  // Drive the site chrome (Navbar/Footer/t()-based sections) from the page's
  // configured language. A fresh ad visitor lands directly in the right language.
  // `silent: true` — a page-driven language sync must not arm the "translating"
  // overlay meant for the manual language toggle.
  const pageLanguage = data?.language;
  useEffect(() => {
    if (pageLanguage === "en" || pageLanguage === "pt") {
      setLanguage(pageLanguage, { silent: true });
      languageSyncedRef.current = true;
    }
    // setLanguage is recreated each render but stable in behavior — re-run when
    // the page's language changes AND when the slug changes, so navigating between
    // two landings that share a language still re-syncs after a manual toggle
    // (otherwise the render gate below could hold the loader indefinitely).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, pageLanguage]);

  // Inject hreflang alternates for the bilingual pair; remove them on unmount so
  // they don't leak onto other pages. Canonical stays managed globally by useSEO.
  const slugForSeo = data?.slug;
  const altSlug = data?.alternateSlug;
  useEffect(() => {
    if (!slugForSeo || !altSlug) return;
    const origin = window.location.origin;
    const selfHref = `${origin}${landingPathForSlug(slugForSeo)}`;
    const altHref = `${origin}${landingPathForSlug(altSlug)}`;
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

  // Managed landing pages need their own search/social metadata; the global
  // site metadata points at the homepage and would otherwise create duplicate
  // canonicals for every campaign page. Canonical/og:url must be correct for
  // EVERY landing (even ones without curated copy below); title/description
  // only get overridden when this slug has curated SEO copy.
  useEffect(() => {
    if (!slugForSeo) return;
    const canonical = `${window.location.origin}${landingPathForSlug(slugForSeo)}`;
    const previousLang = document.documentElement.lang;
    const previousTitle = document.title;
    document.documentElement.lang = pageLanguage === "pt" ? "pt-BR" : "en";

    // Every node this effect touches is recorded so the cleanup can put the
    // global (homepage) values back on client-side navigation to a non-landing
    // route — useSEO only re-runs when the settings object changes, so it would
    // otherwise leave this landing's canonical/og:url on the next page.
    const restores: Array<() => void> = [];
    const setMeta = (selector: string, attribute: "name" | "property", key: string, value: string) => {
      let node = document.querySelector<HTMLMetaElement>(selector);
      if (!node) {
        const created = document.createElement("meta");
        created.setAttribute(attribute, key);
        document.head.appendChild(created);
        restores.push(() => created.remove());
        node = created;
      } else {
        const existing = node;
        const previous = existing.content;
        restores.push(() => { existing.content = previous; });
      }
      node.content = value;
    };

    let canonicalTag = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonicalTag) {
      const created = document.createElement("link");
      created.rel = "canonical";
      document.head.appendChild(created);
      restores.push(() => created.remove());
      canonicalTag = created;
    } else {
      const existing = canonicalTag;
      const previous = existing.href;
      restores.push(() => { existing.href = previous; });
    }
    canonicalTag.href = canonical;
    setMeta('meta[property="og:url"]', "property", "og:url", canonical);

    const seo = getLandingSeo(slugForSeo);
    if (seo) {
      document.title = seo.title;
      setMeta('meta[name="description"]', "name", "description", seo.description);
      setMeta('meta[property="og:title"]', "property", "og:title", seo.title);
      setMeta('meta[property="og:description"]', "property", "og:description", seo.description);
      setMeta('meta[property="og:locale"]', "property", "og:locale", seo.locale);
      setMeta('meta[name="twitter:title"]', "name", "twitter:title", seo.title);
      setMeta('meta[name="twitter:description"]', "name", "twitter:description", seo.description);
    }

    return () => {
      restores.reverse().forEach((restore) => restore());
      document.title = previousTitle;
      document.documentElement.lang = previousLang;
    };
  }, [pageLanguage, slugForSeo]);

  if (isLoading) return <AppLoader />;

  // Inactive pages come back as 404 from the public endpoint (43-02 contract).
  if (error || !data) {
    return (
      <Suspense fallback={<AppLoader />}>
        <NotFound />
      </Suspense>
    );
  }

  // Hold one extra tick until the site chrome's language matches this landing's
  // configured language, instead of painting a frame in the wrong language.
  if (
    !languageSyncedRef.current &&
    (data.language === "en" || data.language === "pt") &&
    language !== data.language
  ) {
    return <AppLoader />;
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
