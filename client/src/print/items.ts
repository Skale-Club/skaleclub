import type { OurServicesCard, PortfolioService } from "@shared/schema";

/**
 * One entry in the folder, whatever catalog it came from.
 *
 * The site keeps two separate catalogs: the X-branded products live in the
 * `portfolio_services` table (they have a price, a slug and their own page),
 * while the services we perform — Paid Advertising, Branding, 3D Printing —
 * live in `company_settings.homepage_content.ourServicesSection` and are
 * managed from the Website editor. A printed folder has no reason to care
 * about that split, so both are normalised into this shape before any template
 * sees them.
 */
export interface FolderItem {
  /** Stable identity for React keys and toolbar selection. Unique across sources. */
  key: string;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  /** Services carry no price; templates must handle its absence. */
  price?: string | null;
  priceLabel?: string | null;
  features: string[];
  imageUrl?: string | null;
  logoIconUrl?: string | null;
  source: FolderItemSource;
}

export type FolderItemSource = "product" | "service";

export const SOURCE_LABEL: Record<FolderItemSource, string> = {
  product: "Produtos",
  service: "Serviços",
};

export function fromPortfolioService(service: PortfolioService): FolderItem {
  return {
    key: `product:${service.id}`,
    title: service.title,
    subtitle: service.subtitle,
    description: service.description,
    price: service.price,
    priceLabel: service.priceLabel,
    features: service.features ?? [],
    // Print only the website home. Never use dashboard or popup gallery images.
    imageUrl: service.homeImageUrl,
    logoIconUrl: service.logoIconUrl,
    source: "product",
  };
}

/**
 * `OurServicesCard` has no id of its own, so the key is derived from the title.
 * Titles are what the admin UI shows and edits, and duplicates there would be a
 * content bug in their own right.
 */
export function fromOurServicesCard(card: OurServicesCard): FolderItem {
  return {
    key: `service:${card.title.trim().toLowerCase().replace(/\s+/g, "-")}`,
    title: card.title,
    subtitle: card.subtitle,
    description: card.description,
    price: null,
    priceLabel: null,
    features: card.features ?? [],
    imageUrl: card.imageUrl,
    logoIconUrl: null,
    source: "service",
  };
}

/** Products first, then services; each keeps its own catalog order. */
export function buildCatalog(
  services: PortfolioService[] | undefined,
  cards: OurServicesCard[] | undefined,
): FolderItem[] {
  const products = (services ?? [])
    .filter((s) => s.isActive)
    .map(fromPortfolioService);

  const performed = (cards ?? [])
    .filter((c) => c.enabled !== false)
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map(fromOurServicesCard);

  return [...products, ...performed];
}
