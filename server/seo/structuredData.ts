import { normalizeSocialLinks } from "#shared/schema.js";
import type { CompanySettings } from "#shared/schema.js";
import { NFC_GUIDE_FAQ_EN, NFC_GUIDE_FAQ_PT } from "#shared/nfcGuideFaq.js";
import { NFC_QUANTITY, NFC_VOLUME_TIERS, NFC_CURRENCY } from "#shared/nfc-pricing.js";
import { NFC_PLAQUE_CURRENCY, NFC_PLAQUE_PRICES } from "#shared/nfc-plaque-pricing.js";
import type { BlogRow, LandingRow } from "./data.js";

// Server-side JSON-LD. Emitted in the first response so crawlers that do not
// run JavaScript (and the ones that queue rendering) still see it.

const SCHEMA = "https://schema.org";
const PHONE = "+1-508-801-8190";
const ADDRESS = {
  "@type": "PostalAddress",
  streetAddress: "36 South St",
  addressLocality: "Framingham",
  addressRegion: "MA",
  postalCode: "01702",
  addressCountry: "US",
} as const;

const DAYS: Array<[string, string]> = [
  ["monday", "Monday"],
  ["tuesday", "Tuesday"],
  ["wednesday", "Wednesday"],
  ["thursday", "Thursday"],
  ["friday", "Friday"],
  ["saturday", "Saturday"],
  ["sunday", "Sunday"],
];

export function absoluteUrl(origin: string, value: string): string {
  return /^https?:\/\//i.test(value) ? value : `${origin}${value.startsWith("/") ? "" : "/"}${value}`;
}

// Only when the admin actually configured hours: days sharing the same window
// are merged into one OpeningHoursSpecification.
function openingHours(businessHours: unknown): object[] | undefined {
  if (!businessHours || typeof businessHours !== "object") return undefined;
  const groups = new Map<string, { opens: string; closes: string; days: string[] }>();
  for (const [key, label] of DAYS) {
    const day = (businessHours as Record<string, { isOpen?: boolean; start?: string; end?: string } | undefined>)[key];
    if (!day?.isOpen || !day.start || !day.end) continue;
    const id = `${day.start}-${day.end}`;
    const group = groups.get(id) ?? { opens: day.start, closes: day.end, days: [] };
    group.days.push(label);
    groups.set(id, group);
  }
  if (groups.size === 0) return undefined;
  return Array.from(groups.values()).map((group) => ({
    "@type": "OpeningHoursSpecification",
    dayOfWeek: group.days,
    opens: group.opens,
    closes: group.closes,
  }));
}

export function organizationGraph(origin: string, settings: CompanySettings | null, description: string): object {
  const name = settings?.companyName?.trim() || "Skale Club";
  const sameAs = normalizeSocialLinks(settings?.socialLinks)
    .map((link) => link.url)
    .filter((url) => /^https?:\/\//i.test(url));
  const logo = settings?.logoMain ? absoluteUrl(origin, settings.logoMain) : undefined;
  const email = settings?.companyEmail?.trim() || undefined;
  const hours = openingHours(settings?.businessHours);

  const organizationId = `${origin}/#organization`;
  return {
    "@context": SCHEMA,
    "@graph": [
      {
        "@type": "Organization",
        "@id": organizationId,
        name,
        url: `${origin}/`,
        ...(logo && { logo }),
        ...(email && { email }),
        telephone: PHONE,
        address: ADDRESS,
        ...(sameAs.length > 0 && { sameAs }),
      },
      {
        "@type": "LocalBusiness",
        "@id": `${origin}/#localbusiness`,
        name,
        url: `${origin}/`,
        description,
        ...(logo && { image: logo }),
        ...(email && { email }),
        telephone: PHONE,
        address: ADDRESS,
        ...(sameAs.length > 0 && { sameAs }),
        ...(hours && { openingHoursSpecification: hours }),
        parentOrganization: { "@id": organizationId },
      },
    ],
  };
}

export function faqPage(items: ReadonlyArray<{ question: string; answer: string }>): object | null {
  if (items.length === 0) return null;
  return {
    "@context": SCHEMA,
    "@type": "FAQPage",
    mainEntity: items.map(({ question, answer }) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: { "@type": "Answer", text: answer },
    })),
  };
}

export function nfcGuideFaq(language: "en" | "pt"): object | null {
  const groups = language === "pt" ? NFC_GUIDE_FAQ_PT : NFC_GUIDE_FAQ_EN;
  return faqPage(groups.flatMap((group) => group.items.map(([question, answer]) => ({ question, answer }))));
}

// FAQ of a managed landing: the items its `faqAccordion` section carries.
export function landingFaq(row: LandingRow | null): object | null {
  const section = row?.sections.find((entry) => entry.type === "faqAccordion");
  const items = (section?.props as { items?: unknown } | undefined)?.items;
  if (!Array.isArray(items)) return null;
  return faqPage(
    items.filter(
      (item): item is { question: string; answer: string } =>
        !!item && typeof item.question === "string" && typeof item.answer === "string",
    ),
  );
}

// Unit prices of the volume tiers an order can actually reach today.
export function nfcProduct(origin: string, name: string, description: string, imagePath: string, url: string): object {
  const prices = NFC_VOLUME_TIERS.filter(
    (tier) => tier.minQuantity >= NFC_QUANTITY.min && tier.minQuantity <= NFC_QUANTITY.max,
  ).map((tier) => tier.unitPriceCents / 100);
  return {
    "@context": SCHEMA,
    "@type": "Product",
    name,
    description,
    image: absoluteUrl(origin, imagePath),
    url,
    brand: { "@type": "Brand", name: "Skale Club" },
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: NFC_CURRENCY,
      lowPrice: Math.min(...prices),
      highPrice: Math.max(...prices),
      offerCount: prices.length,
      availability: "https://schema.org/InStock",
    },
  };
}

// The review plaque is sold as two designs: our ready-made one (standard unit price) and a
// custom one (price of the first piece, which carries the artwork). Both are real prices
// from shared/nfc-plaque-pricing.ts, the same numbers the order form quotes.
export function nfcPlaqueProduct(origin: string, name: string, description: string, imagePath: string, url: string): object {
  const prices = [NFC_PLAQUE_PRICES.standardUnitCents, NFC_PLAQUE_PRICES.customFirstCents].map((cents) => cents / 100);
  return {
    "@context": SCHEMA,
    "@type": "Product",
    name,
    description,
    image: absoluteUrl(origin, imagePath),
    url,
    brand: { "@type": "Brand", name: "Skale Club" },
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: NFC_PLAQUE_CURRENCY,
      lowPrice: Math.min(...prices),
      highPrice: Math.max(...prices),
      offerCount: prices.length,
      availability: "https://schema.org/InStock",
      url,
    },
  };
}

/** The product list of /products, in the order the page shows it. */
export function productsItemList(origin: string, items: Array<{ name: string; path: string }>): object {
  return {
    "@context": SCHEMA,
    "@type": "ItemList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      url: absoluteUrl(origin, item.path),
    })),
  };
}

export function blogPosting(
  origin: string,
  settings: CompanySettings | null,
  post: BlogRow,
  url: string,
  imageUrl: string | undefined,
  language: "en" | "pt",
): object {
  const publisherName = settings?.companyName?.trim() || "Skale Club";
  const logo = settings?.logoMain ? absoluteUrl(origin, settings.logoMain) : undefined;
  const published = post.publishedAt?.toISOString();
  const modified = (post.updatedAt ?? post.publishedAt)?.toISOString();
  return {
    "@context": SCHEMA,
    "@type": "BlogPosting",
    headline: post.title,
    ...(post.metaDescription || post.excerpt ? { description: post.metaDescription || post.excerpt } : {}),
    ...(imageUrl && { image: [imageUrl] }),
    ...(published && { datePublished: published }),
    ...(modified && { dateModified: modified }),
    author: { "@type": "Person", name: post.authorName?.trim() || publisherName },
    publisher: {
      "@type": "Organization",
      "@id": `${origin}/#organization`,
      name: publisherName,
      ...(logo && { logo: { "@type": "ImageObject", url: logo } }),
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    url,
    inLanguage: language === "pt" ? "pt-BR" : "en",
  };
}

/** A service the company sells, with the Organization as its provider. */
export function serviceSchema(
  origin: string,
  settings: CompanySettings | null,
  service: { name: string; description: string; url: string; language: "en" | "pt" },
): object {
  return {
    "@context": SCHEMA,
    "@type": "Service",
    name: service.name,
    description: service.description,
    url: service.url,
    inLanguage: service.language === "pt" ? "pt-BR" : "en",
    provider: {
      "@type": "Organization",
      "@id": `${origin}/#organization`,
      name: settings?.companyName?.trim() || "Skale Club",
      url: `${origin}/`,
    },
  };
}

export function breadcrumbs(origin: string, crumbs: Array<{ name: string; path: string }>): object {
  return {
    "@context": SCHEMA,
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: `${origin}${crumb.path === "/" ? "/" : crumb.path}`,
    })),
  };
}
