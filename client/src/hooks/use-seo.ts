import { getLandingSeo, landingPathForSlug, slugForLandingPath } from '@shared/landingSeo';
import { homepageTitle } from '@shared/seoTitle';
import { CORE_SEO, coreKeyForPath, isNoindexPath } from '@shared/coreSeo';
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usePathname } from 'wouter/use-browser-location';
import { splitLanguagePath, withLanguage } from '@shared/languagePath';
import type { PageSlugs } from '@shared/pageSlugs';

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
  pageSlugs?: Partial<PageSlugs> | null;
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
  // A landing reached by its legacy `/x-br` URL canonicalises to `/br/x`,
  // the same string DynamicLanding and the server injection produce; two
  // writers disagreeing here left the PT landing indexed twice.
  const landingSlug = slugForLandingPath(path || '/');
  if (landingSlug && getLandingSeo(landingSlug)) path = landingPathForSlug(landingSlug);
  return path ? `${origin}${path}` : `${origin}/`;
}

/** True only on the site root (English or its `/br` Portuguese counterpart), which
 * is what the settings row actually describes. */
function isHomepage(): boolean {
  const path = window.location.pathname.replace(/\/+$/, '');
  return path === '' || path === '/br';
}

function isPortugueseHome(): boolean {
  return window.location.pathname.replace(/\/+$/, '') === '/br';
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
    // An empty title leaves the document title to the page (or the server-side
    // injection); the page only wants the noindex side effects below.
    if (title) {
      const fullTitle = `${title} | ${brand}`;
      document.title = fullTitle;
      setMetaTag('og:title', fullTitle, true);
      setMetaTag('twitter:title', fullTitle);
    }
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
  // Raw pathname: wouter's location has the `/br` prefix stripped, so `/` -> `/br`
  // would not re-run the effect and the canonical would go stale.
  const rawPath = usePathname();
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
    // The Portuguese home (`/br`) has its own copy (shared/coreSeo.ts); the
    // settings row is English.
    const homeCopy = isPortugueseHome() ? CORE_SEO.home.pt : null;
    const homeTitle = homeCopy?.title ?? homepageTitle(settings);
    const homeDescription = homeCopy?.description ?? settings.seoDescription;
    if (onHomepage) {
      document.title = homeTitle;
      setMetaTag('description', homeDescription);
      setMetaTag('robots', settings.seoRobotsTag);
    }

    // Site-wide, identical on every page.
    setMetaTag('keywords', settings.seoKeywords);
    setMetaTag('author', settings.seoAuthor);

    // Private / noindex routes carry no canonical (the server omits it too).
    const canonicalUrl = pageNoindex || isNoindexPath(window.location.pathname, settings.pageSlugs)
      ? null
      : canonicalForCurrentPage(settings);
    setLinkTag('canonical', canonicalUrl);

    const fullImageUrl = settings.ogImage
      ? (settings.ogImage.startsWith('http') ? settings.ogImage : `${window.location.origin}${settings.ogImage}`)
      : null;

    if (onHomepage) {
      setMetaTag('og:title', homeTitle, true);
      setMetaTag('og:description', homeDescription, true);
    }
    // The server injects the per-page share image (and its dimensions) into
    // the first response; the site-wide image only fills in when it is absent.
    if (!document.querySelector('meta[property="og:image"]')) {
      setMetaTag('og:image', fullImageUrl, true);
      if (fullImageUrl) {
        setMetaTag('og:image:width', '1200', true);
        setMetaTag('og:image:height', '630', true);
        setMetaTag('og:image:alt', settings.seoTitle || settings.ogSiteName || 'Company image', true);
      }
    }
    setMetaTag('og:type', settings.ogType || 'website', true);
    setMetaTag('og:site_name', settings.ogSiteName, true);
    if (canonicalUrl) setMetaTag('og:url', canonicalUrl, true);

    setMetaTag('twitter:card', settings.twitterCard || 'summary_large_image');
    if (onHomepage) {
      setMetaTag('twitter:title', homeTitle);
      setMetaTag('twitter:description', homeDescription);
    }
    if (!document.querySelector('meta[name="twitter:image"]')) setMetaTag('twitter:image', fullImageUrl);
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

  }, [settings, skipSeo, rawPath]);

  // Core pages exist as an en/pt pair (`/x` and `/br/x`): hreflang alternates.
  // Canonical/og:url for every route, `/br` included, are already handled by the
  // effect above (canonicalForCurrentPage reads the raw, un-stripped pathname) —
  // this effect only adds the hreflang links, which that one doesn't. Managed
  // landings get their own hreflang pair from DynamicLanding.
  useEffect(() => {
    if (!settings) return;
    const { path } = splitLanguagePath(rawPath);
    // Exact core pages only (blog posts are single-language, no pair).
    const coreKey = coreKeyForPath(path, settings.pageSlugs);
    if (!coreKey || coreKey === 'links') return;

    let origin = window.location.origin;
    try {
      if (settings.seoCanonicalUrl) origin = new URL(settings.seoCanonicalUrl).origin;
    } catch {
      // keep window origin
    }
    const enHref = `${origin}${path}`;
    const ptHref = `${origin}${withLanguage(path, 'pt')}`;

    document
      .querySelectorAll('link[rel="alternate"][data-site-i18n], link[rel="alternate"][data-page-i18n]')
      .forEach((link) => link.remove());
    const alternates = [['en', enHref], ['pt-BR', ptHref], ['x-default', enHref]].map(([hreflang, href]) => {
      const link = document.createElement('link');
      link.rel = 'alternate';
      link.hreflang = hreflang;
      link.href = href;
      link.setAttribute('data-site-i18n', 'true');
      document.head.appendChild(link);
      return link;
    });

    return () => {
      alternates.forEach((link) => link.remove());
    };
  }, [settings, rawPath]);

  return settings;
}
