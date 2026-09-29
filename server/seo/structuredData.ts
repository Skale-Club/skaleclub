import { normalizeSocialLinks } from "#shared/schema.js";
import type { CompanySettings } from "#shared/schema.js";
import { NFC_GUIDE_FAQ_EN, NFC_GUIDE_FAQ_PT } from "#shared/nfcGuideFaq.js";
import { NFC_QUANTITY, NFC_VOLUME_TIERS, NFC_CURRENCY } from "#shared/nfc-pricing.js";
import type { LandingRow } from "./data.js";

// Server-side JSON-LD. Emitted in the first response so crawlers that do not
// run JavaScript (and the ones that queue rendering) still see it.

const SCHEMA = "https://schema.org";
const PHONE = "+1-508-500-1095";
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
