import type { OurServicesCard, PortfolioService } from "./schema.js";

/**
 * One catalog entry, whatever table it came from.
 *
 * The site keeps two catalogs: the X-branded apps live in `portfolio_services`
 * (price, slug, logo), while the services we perform live as JSON in
 * `company_settings.homepage_content.ourServicesSection.cards`. Every surface
 * that shows them (home carousels, /portfolio, the popup, the print folder)
 * reads this shape instead, so a card never has to know which catalog it is
 * rendering. Storage stays split on purpose: unifying it is a production data
 * migration for a gain this normalisation already delivers.
 */
export const CATALOG_CATEGORIES = ["ai", "websites", "systems", "crm", "marketing", "brand"] as const;
export type CatalogCategory = (typeof CATALOG_CATEGORIES)[number];

/** English keys; the UI passes them through t(). */
export const CATALOG_CATEGORY_LABEL: Record<CatalogCategory, string> = {
  ai: "AI & Automation",
  websites: "Websites",
  systems: "Systems & Booking",
  crm: "CRM & Sales",
  marketing: "Marketing",
  brand: "Branding",
};

export const isCatalogCategory = (value: unknown): value is CatalogCategory =>
  typeof value === "string" && (CATALOG_CATEGORIES as readonly string[]).includes(value);

/**
 * Content limits. Restricting content is design: a title that fits one line
 * and three short features are what let every card share one layout.
 */
export const CATALOG_LIMITS = {
  title: 24,
  subtitle: 48,
  features: 3,
  feature: 22,
} as const;

export type CatalogKind = "product" | "service";

export interface CatalogPrice {
  value: string;
  label?: string;
  setup?: string;
}

export interface CatalogItem {
  /** "product:12" | "service:paid-advertising" — unique across both catalogs. */
  key: string;
  kind: CatalogKind;
  /** Explicit, never guessed from the title or slug. Absent = no label. */
  category?: CatalogCategory;
  slug?: string;
  title: string;
  subtitle?: string;
  description?: string;
  features: string[];
  /** The one cover image: a product's website home, a service's artwork. */
  cover?: string;
  /** Popup gallery. `[]` is a valid, designed state. */
  screens: string[];
  logo?: string;
  /** Absent means no price — never a placeholder. */
  price?: CatalogPrice;
  badge?: string;
  /** Label only; the colour belongs to the design system. */
  cta: { label: string };
  /** Live sites using the product ("Live at"). */
  links: string[];
  /** The product's own site; its domain labels the cover window. */
  site?: string;
}

/** "https://www.xkedule.com/pricing" -> "xkedule.com". */
export function siteDomain(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
}

const clean = (value: string | null | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

const uniq = (values: (string | null | undefined)[]) =>
  Array.from(new Set(values.map(clean).filter((v): v is string => Boolean(v))));

export const serviceCardKey = (title: string) =>
  `service:${title.trim().toLowerCase().replace(/\s+/g, "-")}`;

export function fromPortfolioService(service: PortfolioService): CatalogItem {
  const price = clean(service.price);
  return {
    key: `product:${service.id}`,
    kind: "product",
    category: isCatalogCategory(service.category) ? service.category : undefined,
    slug: service.slug,
    title: service.title,
    subtitle: clean(service.subtitle),
    description: clean(service.description),
    features: uniq(service.features ?? []),
    // Only the explicit home. The legacy `imageUrl` is often a dashboard or a
    // stock render, and the cover is what the print folder uses too.
    cover: clean(service.homeImageUrl),
    screens: uniq([service.dashboardImageUrl, ...(service.popupSliderImages ?? [])]),
    logo: clean(service.logoIconUrl),
    price: price
      ? { value: price, label: clean(service.priceLabel), setup: clean(service.setupPrice) }
      : undefined,
    badge: clean(service.badgeText),
    cta: { label: clean(service.ctaText) ?? "Get Started" },
    links: uniq(service.popupUrls ?? []),
    site: clean(service.toolUrl),
  };
}

export function fromOurServicesCard(card: OurServicesCard): CatalogItem {
  return {
    key: serviceCardKey(card.title),
    kind: "service",
    category: isCatalogCategory(card.category) ? card.category : undefined,
    title: card.title,
    subtitle: clean(card.subtitle),
    description: clean(card.description),
    features: uniq(card.features ?? []),
    cover: clean(card.imageUrl),
    screens: [],
    cta: { label: "Talk to us" },
    links: [],
  };
}

export function catalogProducts(services: PortfolioService[] | undefined): CatalogItem[] {
  return (services ?? [])
    .filter((s) => s.isActive !== false)
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map(fromPortfolioService);
}

export function catalogServices(cards: OurServicesCard[] | undefined): CatalogItem[] {
  return (cards ?? [])
    .filter((c) => c.enabled !== false)
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map(fromOurServicesCard);
}

/** Products first, then services; each keeps its own catalog order. */
export function buildCatalog(
  services: PortfolioService[] | undefined,
  cards: OurServicesCard[] | undefined,
): CatalogItem[] {
  return [...catalogProducts(services), ...catalogServices(cards)];
}
