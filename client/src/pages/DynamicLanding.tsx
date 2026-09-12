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
// member's canonical public URL is the two-segment `/x/br` form (quick 260906-qwl).
// Legacy `/x-br` URLs keep rendering; they simply self-report the `/x/br` canonical.
function landingPath(slug: string): string {
  return slug.endsWith("-br") ? `/${slug.slice(0, -3)}/br` : `/${slug}`;
}

export default function DynamicPage({ brVariant = false }: { brVariant?: boolean }) {
  const { slug: routeSlug } = useParams<{ slug: string }>();
  // `/x/br` resolves the `x-br` row. The DB never stores a slash: shared/schema/pages.ts
  // slugPattern forbids it, so the two-segment form lives only in the route.
  const slug =
    brVariant && routeSlug && !routeSlug.endsWith("-br") ? `${routeSlug}-br` : routeSlug;
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
    const selfHref = `${origin}${landingPath(slugForSeo)}`;
    const altHref = `${origin}${landingPath(altSlug)}`;
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
  // canonicals for every campaign page.
  useEffect(() => {
    if (!slugForSeo) return;
    const seo = PAGE_SEO[slugForSeo];
    if (!seo) return;
    const canonical = `${window.location.origin}${landingPath(slugForSeo)}`;
    document.title = seo.title;
    document.documentElement.lang = pageLanguage === "pt" ? "pt-BR" : "en";

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
