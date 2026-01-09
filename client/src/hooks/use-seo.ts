import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

interface SeoSettings {
  seoTitle: string | null;
  seoDescription: string | null;
}

export function useSEO() {
  const { data: settings } = useQuery<SeoSettings>({
    queryKey: ['/api/company-settings'],
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    if (settings?.seoTitle) {
      document.title = settings.seoTitle;
    }

    if (settings?.seoDescription) {
      let metaDescription = document.querySelector('meta[name="description"]');
      if (!metaDescription) {
        metaDescription = document.createElement('meta');
        metaDescription.setAttribute('name', 'description');
        document.head.appendChild(metaDescription);
      }
      metaDescription.setAttribute('content', settings.seoDescription);
    }
  }, [settings?.seoTitle, settings?.seoDescription]);

  return settings;
}
