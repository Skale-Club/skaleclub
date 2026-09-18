import { useParams } from "wouter";
import { usePathname } from "wouter/use-browser-location";
import { useQuery } from "@tanstack/react-query";
import { lazy, Suspense, useEffect, useState } from "react";
import { AppLoader } from "@/components/ui/spinner";
import { sectionRegistry } from "@/components/pages/sectionRegistry";
import { usePageLanguage } from "@/context/LanguageContext";
import { splitLanguagePath } from "@shared/languagePath";

const NotFound = lazy(() => import("@/pages/not-found"));

interface PageResponse {
  slug: string;
  name: string;
  sections: Array<{ type: string; props: Record<string, unknown> }>;
  isActive: boolean;
  language: "en" | "pt";
  alternateSlug?: string | null;
}

const PAGE_SEO: Record<string, { title: string; description: string }> = {
  "nfc-keychains": {
    title: "Custom NFC Keychains for Businesses | Skale Club",
    description: "Custom 3D-printed NFC keychains that open your reviews, Instagram, menu, digital card, or website with one tap.",
  },
  "nfc-keychains-br": {
    title: "Chaveiros NFC Personalizados para Empresas | Skale Club",
    description: "Chaveiros NFC personalizados e impressos em 3D para abrir avaliações, Instagram, cardápio, cartão digital ou site com um toque.",
  },
  "nfc-pricing": {
    title: "NFC Keychain Pricing and Instructions | Skale Club",
    description: "See NFC keychain pricing, minimum order, setup process, compatible phones, and answers to common questions.",
  },
  "nfc-pricing-br": {
    title: "Preços e Instruções dos Chaveiros NFC | Skale Club",
    description: "Veja preços, pedido mínimo, processo de produção, celulares compatíveis e respostas sobre os chaveiros NFC.",
  },
};

// A managed bilingual pair stores single-segment slugs (`x` and `x-br`), but the PT
// member's canonical public URL is the `/br/x` prefix form (quick 260906-qwl).
// Legacy `/x-br` and `/x/br` URLs keep rendering; they simply self-report the
// `/br/x` canonical.
function landingPath(slug: string): string {
  return slug.endsWith("-br") ? `/br/${slug.slice(0, -3)}` : `/${slug}`;
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
    const alternatePath = pageAltSlug ? landingPath(pageAltSlug) : null;
    setPageLanguage({
      language: urlLanguage === "en" && pageLanguage === "pt" ? "pt" : undefined,
      alternatePath: alternatePath && alternatePath !== currentPath ? alternatePath : null,
    });
    setOverrideReadyFor(pageSlug);
    return () => setPageLanguage(null);
  }, [pageSlug, pageLanguage, pageAltSlug, urlLanguage, setPageLanguage]);

  // Inject hreflang alternates for the bilingual pair; remove them on unmount so
  // they don't leak onto other pages. Canonical stays managed globally by useSEO.
  const slugForSeo = data?.slug;
  const altSlug = data?.alternateSlug;
  useEffect(() => {
    if (!slugForSeo || !altSlug) return;
    const origin = window.location.origin;
    const selfHref = `${origin}${landingPath(slugForSeo)}`;
    const altHref = `${origin}${landingPath(altSlug)}`;
    const selfTag = pageLanguage === "en" ? "en" : "pt-BR";
    const altTag = pageLanguage === "en" ? "pt-BR" : "en";
    const xDefaultHref = pageLanguage === "en" ? selfHref : altHref;

    document
      .querySelectorAll('link[rel="alternate"][data-site-i18n], link[rel="alternate"][data-page-i18n]')
      .forEach((link) => link.remove());

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
  // canonicals for every campaign page.
  useEffect(() => {
    if (!slugForSeo) return;
    const seo = PAGE_SEO[slugForSeo];
    if (!seo) return;
    const canonical = `${window.location.origin}${landingPath(slugForSeo)}`;
    document.title = seo.title;

    const setMeta = (selector: string, attribute: "name" | "property", key: string, value: string) => {
      let node = document.querySelector<HTMLMetaElement>(selector);
      if (!node) {
        node = document.createElement("meta");
        node.setAttribute(attribute, key);
        document.head.appendChild(node);
      }
      node.content = value;
    };
    setMeta('meta[name="description"]', "name", "description", seo.description);
    setMeta('meta[property="og:title"]', "property", "og:title", seo.title);
    setMeta('meta[property="og:description"]', "property", "og:description", seo.description);
    setMeta('meta[property="og:url"]', "property", "og:url", canonical);
    setMeta('meta[name="twitter:title"]', "name", "twitter:title", seo.title);
    setMeta('meta[name="twitter:description"]', "name", "twitter:description", seo.description);

    let canonicalTag = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonicalTag) {
      canonicalTag = document.createElement("link");
      canonicalTag.rel = "canonical";
      document.head.appendChild(canonicalTag);
    }
    canonicalTag.href = canonical;
  }, [pageLanguage, slugForSeo]);

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
