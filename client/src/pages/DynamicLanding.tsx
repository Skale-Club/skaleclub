import { useParams } from "wouter";
import { usePathname } from "wouter/use-browser-location";
import { useQuery } from "@tanstack/react-query";
import { lazy, Suspense, useEffect, useState } from "react";
import * as Sentry from "@sentry/react";
import { AppLoader } from "@/components/ui/spinner";
import { sectionRegistry } from "@/components/pages/sectionRegistry";
import { usePageLanguage } from "@/context/LanguageContext";
import { splitLanguagePath, withLanguage } from "@shared/languagePath";
import { getLandingSeo, landingPathForSlug, productDbSlugForUrlSlug } from "@shared/landingSeo";

import { SectionErrorBoundary } from "@/components/SectionErrorBoundary";

const NotFound = lazy(() => import("@/pages/not-found"));

const reportedSectionContractErrors = new Set<string>();

function reportSectionContractError(key: string, message: string, extra: Record<string, unknown>) {
  if (reportedSectionContractErrors.has(key)) return;
  reportedSectionContractErrors.add(key);
  Sentry.captureMessage(message, { level: "error", tags: { area: "managed-section" }, extra });
}

interface PageResponse {
  slug: string;
  name: string;
  sections: Array<{ type: string; props: Record<string, unknown> }>;
  isActive: boolean;
  language: "en" | "pt";
  alternateSlug?: string | null;
}

const BARBERSHOP_AI_RECEPTION_PREVIEW: PageResponse["sections"][number] = {
  type: "aiReception",
  props: {
    eyebrow: "AI reception for barbershops",
    heading: "Your barbershop keeps answering while you keep cutting",
    subheading:
      "The assistant talks to customers on the phone and responds to social messages. It answers routine questions and moves people toward a booking.",
    imageUrl: "/barbershops/ai-reception-barber-v3.webp",
    imageAlt: "Close view of a barber shaping a client's fade.",
    imageWidth: 1280,
    imageHeight: 960,
    imagePosition: "right",
    channels: [
      {
        icon: "phone",
        title: "Phone calls",
        description: "It answers when you cannot, shares hours and prices, and helps the customer book.",
        actionLabel: "Hear a real call",
        actionHref: "tel:+12245516131",
        actionNote: "(224) 551-6131",
      },
      {
        icon: "imessage",
        icons: ["imessage", "facebook", "instagram", "whatsapp", "messenger"],
        title: "Messages and social media",
        description: "It responds to messages, handles common questions, and keeps new inquiries from going cold.",
      },
    ],
    bandTone: "steel",
    theme: "dark",
  },
};

const BARBERSHOP_MONEY_FEATURE_PREVIEW = {
  en: {
    icon: "Star",
    brand: "google",
    title: "More Google reviews",
    description: "Happy clients can leave a review before they walk out, helping the next client choose your shop.",
  },
  pt: {
    icon: "Star",
    brand: "google",
    title: "Mais avaliações no Google",
    description: "Clientes satisfeitos podem avaliar antes de sair, ajudando o próximo cliente a escolher a sua barbearia.",
  },
} as const;

const BARBERSHOP_NFC_IMAGE_PREVIEW = [
  {
    imageUrl: "/barbershops/products/nfc-stands-barbershop-v2.webp",
    imageAlt: "Google review and Instagram NFC stands on a barbershop counter.",
  },
  {
    imageUrl: "/barbershops/products/custom-keychains-barbershop-v5.webp",
    imageAlt: "Three matte 3D-printed barbershop keychains with correctly attached metal rings.",
  },
  {
    imageUrl: "/barbershops/products/rotating-keychain-display-v3.webp",
    imageAlt: "Rotating countertop display stocked with custom barbershop keychains.",
  },
] as const;

function sectionsWithLocalBarbershopPreview(data: PageResponse) {
  const isBarbershopLanding = data.slug === "barbershops" || data.slug === "barbershops-br";

  if (!import.meta.env.DEV || !isBarbershopLanding) {
    return data.sections;
  }

  let sections = data.sections;
  const alreadyHasAiReception = sections.some((section) => section.type === "aiReception");

  if (!alreadyHasAiReception) {
    const heroIndex = sections.findIndex((section) => section.type === "heroWebsites");
    const insertionIndex = heroIndex >= 0 ? heroIndex + 1 : 0;
    sections = [
      ...sections.slice(0, insertionIndex),
      BARBERSHOP_AI_RECEPTION_PREVIEW,
      ...sections.slice(insertionIndex),
    ];
  }

  const moneyFeature = BARBERSHOP_MONEY_FEATURE_PREVIEW[data.language];
  const previewSections = sections.map((section) => {
    if (section.type === "aiReception") {
      const channels = Array.isArray(section.props.channels) ? section.props.channels : [];
      return {
        ...section,
        props: {
          ...section.props,
          channels: channels.map((channel, index) => {
            if (index !== 1 || typeof channel !== "object" || channel === null) return channel;
            return {
              ...channel,
              icon: "imessage",
              icons: ["imessage", "facebook", "instagram", "whatsapp", "messenger"],
              title: data.language === "pt" ? "Mensagens e redes sociais" : "Messages and social media",
            };
          }),
        },
      };
    }

    const eyebrow = section.props.eyebrow;
    const isMoneyGrid = section.type === "featureGrid" && (eyebrow === "More money" || eyebrow === "Mais dinheiro");
    const items = Array.isArray(section.props.items) ? section.props.items : [];
    const isNfcGrid = section.type === "featureGrid" && (
      eyebrow === "NFC for your shop" || eyebrow === "NFC para a sua barbearia"
    );

    if (isNfcGrid) {
      return {
        ...section,
        props: {
          ...section.props,
          items: items.map((item, index) => {
            if (typeof item !== "object" || item === null || index >= BARBERSHOP_NFC_IMAGE_PREVIEW.length) {
              return item;
            }
            const preview = BARBERSHOP_NFC_IMAGE_PREVIEW[index];
            return {
              ...item,
              ...preview,
              imageWidth: 1280,
              imageHeight: 960,
              ...(index === 2 ? {
                title: data.language === "pt" ? "Expositor giratório de chaveiros" : "Rotating keychain display",
              } : {}),
            };
          }),
        },
      };
    }

    const alreadyHasReviews = items.some((item) => (
      typeof item === "object" && item !== null && "title" in item &&
      (item.title === "More Google reviews" || item.title === "Mais avaliações no Google")
    ));

    if (!isMoneyGrid || alreadyHasReviews) return section;
    return { ...section, props: { ...section.props, items: [...items, moneyFeature] } };
  });

  const aboutIndex = previewSections.findIndex((section) => section.type === "about");
  const reviewsIndex = previewSections.findIndex((section) => section.type === "reviews");
  if (aboutIndex >= 0 && reviewsIndex > aboutIndex) {
    const reorderedSections = [...previewSections];
    [reorderedSections[aboutIndex], reorderedSections[reviewsIndex]] = [
      reorderedSections[reviewsIndex],
      reorderedSections[aboutIndex],
    ];
    return reorderedSections;
  }

  return previewSections;
}

export default function DynamicPage() {
  const { slug: routeSlug } = useParams<{ slug: string }>();
  const { path: langlessPath, language: urlLanguage } = splitLanguagePath(usePathname());
  // /products/<urlSlug> resolves through shared/landingSeo.ts's PRODUCT_ROUTES —
  // the same map server/seo/routes.ts uses — instead of querying the URL
  // segment as a DB slug directly. Two DIFFERENT pages can share a bare-slug
  // catch-all vs. a /products/ URL (e.g. "nfc-keychains"), so the segment is
  // never trusted as-is under this prefix: an unmapped one is a real 404, not
  // a lookup against some other row.
  const isProductRoute = langlessPath.startsWith("/products/");
  const dbSlug = isProductRoute ? (routeSlug ? productDbSlugForUrlSlug(routeSlug) : undefined) : routeSlug;
  const productRouteUnknown = isProductRoute && !dbSlug;
  const setPageLanguage = usePageLanguage();
  const [overrideReadyFor, setOverrideReadyFor] = useState<string | null>(null);
  // `/br/x` resolves the `x-br` row. The DB never stores a slash: shared/schema/pages.ts
  // slugPattern forbids it, so the prefix form lives only in the URL.
  const brSlug =
    urlLanguage === "pt" && dbSlug && !dbSlug.endsWith("-br") ? `${dbSlug}-br` : null;

  const brQuery = useQuery<PageResponse>({
    queryKey: [`/api/pages/slug/${brSlug}`],
    enabled: !!brSlug,
    retry: false,
  });
  // A page with no `-br` row still renders under `/br/x`: base content, Portuguese chrome.
  const baseQuery = useQuery<PageResponse>({
    queryKey: [`/api/pages/slug/${dbSlug}`],
    enabled: !!dbSlug && !productRouteUnknown && (!brSlug || brQuery.isError),
    retry: false,
  });
  const useBrRow = !!brSlug && !brQuery.isError;
  const data = useBrRow ? brQuery.data : baseQuery.data;
  const isLoading = !productRouteUnknown && (useBrRow ? brQuery.isLoading : baseQuery.isLoading);
  const error = productRouteUnknown ? new Error("Unknown /products/ slug") : data ? null : baseQuery.error;

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
      if (seo.robots) setMeta('meta[name="robots"]', "name", "robots", seo.robots);
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

  const sections = sectionsWithLocalBarbershopPreview(data);

  return (
    <>
      {sections.map((section, idx) => {
        const entry = sectionRegistry[section.type];
        if (!entry) {
          reportSectionContractError(
            `${data.slug}:${idx}:unknown:${section.type}`,
            "Managed page contains an unknown section type",
            { slug: data.slug, sectionIndex: idx, sectionType: section.type },
          );
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
          reportSectionContractError(
            `${data.slug}:${idx}:invalid:${section.type}`,
            "Managed page section props failed validation",
            { slug: data.slug, sectionIndex: idx, sectionType: section.type, issues: parsed.error.issues },
          );
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
        return (
          <SectionErrorBoundary key={`${data.slug}:${idx}:${section.type}`} section={section.type}>
            <Component props={parsed.data} />
          </SectionErrorBoundary>
        );
      })}
    </>
  );
}
