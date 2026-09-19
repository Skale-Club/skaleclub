import { useParams } from "wouter";
import { usePathname } from "wouter/use-browser-location";
import { useQuery } from "@tanstack/react-query";
import { lazy, Suspense, useEffect, useState } from "react";
import { AppLoader } from "@/components/ui/spinner";
import { sectionRegistry } from "@/components/pages/sectionRegistry";
import { usePageLanguage } from "@/context/LanguageContext";
import { splitLanguagePath, withLanguage } from "@shared/languagePath";
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

export default function DynamicPage() {
  const { slug: routeSlug } = useParams<{ slug: string }>();
  const urlLanguage = splitLanguagePath(usePathname()).language;
  const setPageLanguage = usePageLanguage();
  const [overrideReadyFor, setOverrideReadyFor] = useState<string | null>(null);
  // `/br/x` resolves the `x-br` row. The DB never stores a slash: shared/schema/pages.ts
  // slugPattern forbids it, so the prefix form lives only in the URL.
  const brSlug =
    urlLanguage === "pt" && routeSlug && !routeSlug.endsWith("-br") ? `${routeSlug}-br` : null;

  const brQuery = useQuery<PageResponse>({
    queryKey: [`/api/pages/slug/${brSlug}`],
    enabled: !!brSlug,
    retry: false,
  });
  // A page with no `-br` row still renders under `/br/x`: base content, Portuguese chrome.
  const baseQuery = useQuery<PageResponse>({
    queryKey: [`/api/pages/slug/${routeSlug}`],
    enabled: !!routeSlug && (!brSlug || brQuery.isError),
    retry: false,
  });
  const useBrRow = !!brSlug && !brQuery.isError;
  const data = useBrRow ? brQuery.data : baseQuery.data;
  const isLoading = useBrRow ? brQuery.isLoading : baseQuery.isLoading;
  const error = data ? null : baseQuery.error;

  // The URL owns the language. A PT-only page (e.g. /grupo) overrides it for its own
  // path only — nothing is persisted, so it can't leak to the rest of the site.
  const pageLanguage = data?.language;
  const pageSlug = data?.slug;
  const pageAltSlug = data?.alternateSlug;
  useEffect(() => {
    if (!pageSlug) return;
    // When the `x-br` row is missing and the base `x` row renders as fallback,
    // the "alternate" is the URL we're already on — report null so the
    // language toggle falls through to the generic strip/prefix rule instead
    // of no-op'ing on the current path.
    const currentPath = window.location.pathname.length > 1
      ? window.location.pathname.replace(/\/$/, "")
      : window.location.pathname;
    const alternatePath = pageAltSlug ? landingPathForSlug(pageAltSlug) : null;
    setPageLanguage({
      language: urlLanguage === "en" && pageLanguage === "pt" ? "pt" : undefined,
      alternatePath: alternatePath && alternatePath !== currentPath ? alternatePath : null,
    });
    setOverrideReadyFor(pageSlug);
    return () => setPageLanguage(null);
  }, [pageSlug, pageLanguage, pageAltSlug, urlLanguage, setPageLanguage]);

  // Inject hreflang alternates for the bilingual pair; remove them on unmount so
  // they don't leak onto other pages.
  //
  // The comment here used to say canonical was left to useSEO, which the effect
  // fifty lines below contradicts — it writes its own. Both now derive the same
  // value from the current path, so whichever effect runs last agrees with the
  // other; useSEO also re-runs on navigation, so a stale landing canonical no
  // longer survives onto the next route.
  const slugForSeo = data?.slug;
  const altSlug = data?.alternateSlug;
  useEffect(() => {
    // Always clear any pre-existing hreflang tags first (server-injected or
    // left by a previous page) — a page with no pair still needs them gone.
    document
      .querySelectorAll('link[rel="alternate"][data-site-i18n], link[rel="alternate"][data-page-i18n]')
      .forEach((link) => link.remove());
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
    // `/br/<slug>` with no `-br` row renders the base row as a fallback: the
    // rendered slug doesn't carry "-br", but the URL is still Portuguese, so
    // the canonical must keep the `/br` prefix to match the address bar (and
    // what use-seo.ts's canonicalForCurrentPage computes for the same URL).
    const isBrFallback = urlLanguage === "pt" && !slugForSeo.endsWith("-br");
    const canonicalPath = isBrFallback
      ? withLanguage(landingPathForSlug(slugForSeo), "pt")
      : landingPathForSlug(slugForSeo);
    const canonical = `${window.location.origin}${canonicalPath}`;
    const previousTitle = document.title;

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
    };
  }, [pageLanguage, slugForSeo, urlLanguage]);

  // Hold the first paint until the language override is registered; otherwise a PT-only
  // page renders one frame as English and queues its copy for pt -> en translation.
  if (isLoading || (data && overrideReadyFor !== data.slug)) return <AppLoader />;

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
