import { getLandingSeo, landingPathForSlug, slugForLandingPath } from '@shared/landingSeo';
import { homepageTitle } from '@shared/seoTitle';
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';

interface SeoSettings {
  seoTitle: string | null;
  heroTitle?: string | null;
  seoDescription: string | null;
  ogImage: string | null;
  logoIcon: string | null;
  seoKeywords: string | null;
  seoAuthor: string | null;
  seoCanonicalUrl: string | null;
  seoRobotsTag: string | null;
  ogType: string | null;
  ogSiteName: string | null;
  twitterCard: string | null;
  twitterSite: string | null;
  twitterCreator: string | null;
  companyName: string | null;
  companyEmail: string | null;
  companyPhone: string | null;
  companyAddress: string | null;
}

function setMetaTag(property: string, content: string | null | undefined, isProperty = false) {
  if (!content) return;
  const selector = isProperty ? `meta[property="${property}"]` : `meta[name="${property}"]`;
  let meta = document.querySelector(selector);
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute(isProperty ? 'property' : 'name', property);
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', content);
}

function setLinkTag(rel: string, href: string | null | undefined) {
  if (!href) return;
  let link = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.rel = rel;
    document.head.appendChild(link);
  }
  link.href = href;
}

function createLocalBusinessSchema(settings: SeoSettings): string {
  const schema = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "name": settings.companyName || settings.ogSiteName || "Service Business",
    "description": settings.seoDescription || "",
    "@id": settings.seoCanonicalUrl || window.location.origin,
    "url": settings.seoCanonicalUrl || window.location.origin,
    ...(settings.companyPhone && { "telephone": settings.companyPhone }),
    ...(settings.companyEmail && { "email": settings.companyEmail }),
    ...(settings.companyAddress && {
      "address": {
        "@type": "PostalAddress",
        "streetAddress": settings.companyAddress
      }
    }),
    ...(settings.ogImage && { "image": settings.ogImage }),
    "priceRange": "$$",
    "serviceType": "Marketing Service"
  };
  
  return JSON.stringify(schema);
}

/**
 * The canonical URL for the page being viewed right now.
 *
 * `settings.seoCanonicalUrl` is the HOMEPAGE's canonical ("https://skale.club/"
 * in production). It used to be written onto every route, so after hydration a
 * blog post, the portfolio, contact and every paid-traffic landing all told
 * crawlers they were the homepage. The server injects the correct per-page tag
 * at build/serve time; this hook was overwriting it a few hundred milliseconds
 * later, and Google renders JS.
 *
 * The host comes from the configured canonical (so a visit on an alternate
 * hostname still points at the canonical one) and the path from the address
 * bar. Query strings and fragments are dropped: they are never canonical.
 */
function canonicalForCurrentPage(settings: SeoSettings): string {
  let origin = window.location.origin;
  try {
    if (settings.seoCanonicalUrl) {
      origin = new URL(settings.seoCanonicalUrl).origin;
    }
  } catch {
    // Malformed value in settings — the current origin is the better guess.
  }
  let path = window.location.pathname.replace(/\/+$/, '');
  // A landing reached by its legacy `/x-br` URL canonicalises to `/x/br`,
  // the same string DynamicLanding and the server injection produce; two
  // writers disagreeing here left the PT landing indexed twice.
  const landingSlug = slugForLandingPath(path || '/');
  if (landingSlug && getLandingSeo(landingSlug)) path = landingPathForSlug(landingSlug);
  return path ? `${origin}${path}` : `${origin}/`;
}

/** True only on the site root, which is what the settings row actually describes. */
function isHomepage(): boolean {
  return window.location.pathname.replace(/\/+$/, '') === '';
}

function setJsonLdSchema(settings: SeoSettings) {
  let script = document.querySelector('script[type="application/ld+json"]') as HTMLScriptElement | null;
  if (!script) {
    script = document.createElement('script');
    script.type = 'application/ld+json';
    document.head.appendChild(script);
  }
  script.textContent = createLocalBusinessSchema(settings);
}

// Set by usePageSeo for pages that must not be indexed, read by useSEO so it
// does not put a canonical back on them. Child effects run before the parent's,
// so the flag is in place by the time useSEO's effect fires for that route.
let pageNoindex = false;

/**
 * Page-level title and description. useSEO only writes the site-wide title
 * on the homepage, so every inner page carried the homepage title verbatim.
 */
export function usePageSeo(opts: { title: string; description?: string; noindex?: boolean }) {
  const { data: settings } = useQuery<SeoSettings>({ queryKey: ['/api/company-settings'] });
  const { title, description, noindex } = opts;
  useEffect(() => {
    const brand = settings?.ogSiteName || settings?.seoTitle || settings?.companyName || 'Skale Club';
    const fullTitle = title ? `${title} | ${brand}` : brand;
    document.title = fullTitle;
    setMetaTag('og:title', fullTitle, true);
    setMetaTag('twitter:title', fullTitle);
    if (description) {
      setMetaTag('description', description);
      setMetaTag('og:description', description, true);
      setMetaTag('twitter:description', description);
    }
    if (noindex) {
      pageNoindex = true;
      setMetaTag('robots', 'noindex, nofollow');
      document.querySelector('link[rel="canonical"]')?.remove();
    }
    return () => {
      if (noindex) {
        pageNoindex = false;
        setMetaTag('robots', settings?.seoRobotsTag || 'index, follow');
      }
    };
  }, [settings, title, description, noindex]);
}

export function useSEO() {
  const skipSeo = false;
  // Re-runs on client-side navigation, so the canonical follows the route
  // instead of freezing on whatever page was loaded first.
  const [location] = useLocation();
  const { data: settings } = useQuery<SeoSettings>({
    queryKey: ['/api/company-settings'],
    staleTime: 1000 * 60 * 5,
    // Prioritize this query to load SEO data as early as possible
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!settings || skipSeo) return;

    const onHomepage = isHomepage();

    // Title, description and robots describe the homepage. On any other route
    // the server has already injected the right ones (or the page sets its own),
    // so leave them alone rather than replacing them with the homepage's — that
    // is what made every route self-report as the homepage, and what would
    // silently flip a `noindex` page to `index, follow`.
    if (onHomepage) {
      document.title = homepageTitle(settings);
      setMetaTag('description', settings.seoDescription);
      setMetaTag('robots', settings.seoRobotsTag);
    }

    // Site-wide, identical on every page.
    setMetaTag('keywords', settings.seoKeywords);
    setMetaTag('author', settings.seoAuthor);

    const canonicalUrl = pageNoindex ? null : canonicalForCurrentPage(settings);
    setLinkTag('canonical', canonicalUrl);

    const fullImageUrl = settings.ogImage 
      ? (settings.ogImage.startsWith('http') ? settings.ogImage : `${window.location.origin}${settings.ogImage}`)
      : null;

    if (onHomepage) {
      setMetaTag('og:title', homepageTitle(settings), true);
      setMetaTag('og:description', settings.seoDescription, true);
    }
    setMetaTag('og:image', fullImageUrl, true);
    if (fullImageUrl) {
      setMetaTag('og:image:width', '1200', true);
      setMetaTag('og:image:height', '630', true);
      setMetaTag('og:image:alt', settings.seoTitle || settings.ogSiteName || 'Company image', true);
    }
    setMetaTag('og:type', settings.ogType || 'website', true);
    setMetaTag('og:site_name', settings.ogSiteName, true);
    setMetaTag('og:url', canonicalUrl, true);

    setMetaTag('twitter:card', settings.twitterCard || 'summary_large_image');
    if (onHomepage) {
      setMetaTag('twitter:title', homepageTitle(settings));
      setMetaTag('twitter:description', settings.seoDescription);
    }
    setMetaTag('twitter:image', fullImageUrl);
    setMetaTag('twitter:site', settings.twitterSite);
    setMetaTag('twitter:creator', settings.twitterCreator);

    if (settings.logoIcon) {
      let favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement | null;
      if (!favicon) {
        favicon = document.createElement('link');
        favicon.rel = 'icon';
        document.head.appendChild(favicon);
      }
      favicon.type = 'image/png';
      favicon.href = settings.logoIcon;
    }

    setJsonLdSchema(settings);

  }, [settings, skipSeo, location]);

  return settings;
}
