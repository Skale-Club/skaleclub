import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { z } from "zod";
import type { CompanySettings, PortfolioService } from "@shared/schema";
import { catalogProducts, catalogServices, type CatalogItem } from "@shared/catalog";
import { ourServicesPropsSchema } from "@shared/section-definitions";
import { OurServicesSection } from "@/components/home/OurServicesSection";


// Renders the site's existing dark catalog carousel. With no local selection
// it shows the full admin-managed service catalog; managed landings may select
// and order existing product/service cards without copying their content.
export function OurServicesAdapter({ props }: { props: z.infer<typeof ourServicesPropsSchema> }) {
  const { data: settings } = useQuery<CompanySettings>({
    queryKey: ["/api/company-settings"],
  });
  const needsProducts = props.items?.some((item) => item.source === "product") ?? false;
  const { data: portfolioServices } = useQuery<PortfolioService[]>({
    queryKey: ["/api/portfolio-services"],
    enabled: needsProducts,
    staleTime: 60_000,
  });

  const globalSection = settings?.homepageContent?.ourServicesSection;
  const selectedItems = useMemo<CatalogItem[] | undefined>(() => {
    if (!props.items) return undefined;
    const products = catalogProducts(portfolioServices);
    const services = catalogServices(globalSection?.cards);
    return props.items.flatMap((selection) => {
      const match = selection.source === "product"
        ? products.find((item) => item.slug === selection.slug)
        : services.find((item) => item.title === selection.title);
      return match ? [match] : [];
    });
  }, [globalSection?.cards, portfolioServices, props.items]);

  if (!settings || (needsProducts && !portfolioServices)) return null;

  const section = {
    enabled: props.items ? true : globalSection?.enabled,
    title: props.title ?? globalSection?.title,
    subtitle: props.subtitle ?? globalSection?.subtitle,
    cards: globalSection?.cards,
  };

  return (
    <OurServicesSection
      section={section}
      itemsOverride={selectedItems}
      eyebrow={props.eyebrow}
      onCtaClick={() => document.querySelector<HTMLElement>('[data-landing-lead-cta]')?.click()}
    />
  );
}
