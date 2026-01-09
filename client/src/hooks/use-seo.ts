import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

interface SeoSettings {
  seoTitle: string | null;
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
    "name": settings.companyName || settings.ogSiteName || "Cleaning Service",
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
    "serviceType": "Cleaning Service"
  };
  
  return JSON.stringify(schema);
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

export function useSEO() {
  const { data: settings } = useQuery<SeoSettings>({
    queryKey: ['/api/company-settings'],
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    if (!settings) return;

    if (settings.seoTitle) {
      document.title = settings.seoTitle;
    }

    setMetaTag('description', settings.seoDescription);
    setMetaTag('keywords', settings.seoKeywords);
    setMetaTag('author', settings.seoAuthor);
    setMetaTag('robots', settings.seoRobotsTag);

    if (settings.seoCanonicalUrl) {
      setLinkTag('canonical', settings.seoCanonicalUrl);
    }

    const fullImageUrl = settings.ogImage 
      ? (settings.ogImage.startsWith('http') ? settings.ogImage : `${window.location.origin}${settings.ogImage}`)
      : null;

    setMetaTag('og:title', settings.seoTitle, true);
    setMetaTag('og:description', settings.seoDescription, true);
    setMetaTag('og:image', fullImageUrl, true);
    setMetaTag('og:type', settings.ogType || 'website', true);
    setMetaTag('og:site_name', settings.ogSiteName, true);
    setMetaTag('og:url', settings.seoCanonicalUrl || window.location.href, true);

    setMetaTag('twitter:card', settings.twitterCard || 'summary_large_image');
    setMetaTag('twitter:title', settings.seoTitle);
    setMetaTag('twitter:description', settings.seoDescription);
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

  }, [settings]);

  return settings;
}
