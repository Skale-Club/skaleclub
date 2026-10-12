const DEFAULT_BRAND = "Skale Club";

function cleanTitleText(value: string | null | undefined): string {
  return (value ?? "")
    .replace(/&amp;#(?:x20|32);/gi, " ")
    .replace(/&#(?:x20|32);|&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Browser-tab titles always lead with the site identity. The input may be a
 * bare page label, an old `Page | Brand` title, or an already-correct
 * `Brand | Page` title. Numeric whitespace entities are cleaned here too so a
 * double-escaped `&#x20;` can never leak into the tab.
 */
export function brandPageTitle(
  pageTitle: string | null | undefined,
  brandName: string | null | undefined = DEFAULT_BRAND,
): string {
  const brand = cleanTitleText(brandName) || DEFAULT_BRAND;
  let page = cleanTitleText(pageTitle);
  if (!page || page.localeCompare(brand, undefined, { sensitivity: "accent" }) === 0) return brand;

  const escapedBrand = escapeRegExp(brand);
  const separator = "\\s*(?:\\||-|–|—|:)\\s*";
  page = page
    .replace(new RegExp(`^${escapedBrand}${separator}`, "i"), "")
    .replace(new RegExp(`${separator}${escapedBrand}$`, "i"), "")
    .trim();

  return page ? `${brand} | ${page}` : brand;
}

/**
 * The homepage <title>.
 *
 * The admin's `seoTitle` is often just the brand ("Skale Club"), which is a
 * weak title for search results. When it looks bare — short, no separator —
 * the hero headline is appended. Every outcome is normalized brand-first.
 */
export function homepageTitle(s: {
  seoTitle?: string | null;
  companyName?: string | null;
  heroTitle?: string | null;
}): string {
  const brand = cleanTitleText(s.companyName) || DEFAULT_BRAND;
  const configured = cleanTitleText(s.seoTitle) || brand;
  const looksBare = configured.length <= 24 && !/[|\-–—:]/.test(configured);
  const tagline = cleanTitleText(s.heroTitle);
  return brandPageTitle(looksBare && tagline ? tagline : configured, brand);
}
