import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

interface SeoSettings {
  seoTitle: string | null;
  seoDescription: string | null;
  ogImage: string | null;
}

function setMetaTag(property: string, content: string, isProperty = false) {
  const selector = isProperty ? `meta[property="${property}"]` : `meta[name="${property}"]`;
  let meta = document.querySelector(selector);
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute(isProperty ? 'property' : 'name', property);
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', content);
}

export function useSEO() {
  const { data: settings } = useQuery<SeoSettings>({
    queryKey: ['/api/company-settings'],
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    if (settings?.seoTitle) {
      document.title = settings.seoTitle;
      setMetaTag('og:title', settings.seoTitle, true);
      setMetaTag('twitter:title', settings.seoTitle, true);
    }

    if (settings?.seoDescription) {
      setMetaTag('description', settings.seoDescription);
      setMetaTag('og:description', settings.seoDescription, true);
      setMetaTag('twitter:description', settings.seoDescription, true);
    }

    if (settings?.ogImage) {
      const fullUrl = settings.ogImage.startsWith('http') 
        ? settings.ogImage 
        : `${window.location.origin}${settings.ogImage}`;
      setMetaTag('og:image', fullUrl, true);
      setMetaTag('twitter:image', fullUrl, true);
      setMetaTag('twitter:card', 'summary_large_image', true);
    }

    setMetaTag('og:type', 'website', true);
    setMetaTag('og:url', window.location.href, true);
  }, [settings?.seoTitle, settings?.seoDescription, settings?.ogImage]);

  return settings;
}
