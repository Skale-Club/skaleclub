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

/** `page` without a leading or trailing brand, in whichever separator style it came. */
function stripBrand(page: string, brand: string): string {
  const escapedBrand = escapeRegExp(brand);
  const separator = "\\s*(?:\\||-|–|—|:)\\s*";
  return page
    .replace(new RegExp(`^${escapedBrand}${separator}`, "i"), "")
    .replace(new RegExp(`${separator}${escapedBrand}$`, "i"), "")
    .trim();
}

/**
 * Inner-page titles lead with the page's own words and end with the brand
 * (`Services | Skale Club`): the keyword comes first, so it survives when a
 * search result cuts the title. The input may be a bare page label, an old
 * `Brand | Page` title or an already-correct `Page | Brand` one. Numeric
 * whitespace entities are cleaned here too so a double-escaped `&#x20;` can
 * never leak into the tab.
 */
export function brandPageTitle(
  pageTitle: string | null | undefined,
  brandName: string | null | undefined = DEFAULT_BRAND,
): string {
  const brand = cleanTitleText(brandName) || DEFAULT_BRAND;
  const page = cleanTitleText(pageTitle);
  if (!page || page.localeCompare(brand, undefined, { sensitivity: "accent" }) === 0) return brand;
  const bare = stripBrand(page, brand);
  return bare ? `${bare} | ${brand}` : brand;
}

/**
 * The homepage form, `Brand | Tagline`: the brand IS the keyword there, so it
 * stays first. Only the homepage uses it.
 */
export function brandFirstTitle(
  pageTitle: string | null | undefined,
  brandName: string | null | undefined = DEFAULT_BRAND,
): string {
  const brand = cleanTitleText(brandName) || DEFAULT_BRAND;
  const page = cleanTitleText(pageTitle);
  if (!page || page.localeCompare(brand, undefined, { sensitivity: "accent" }) === 0) return brand;
  const bare = stripBrand(page, brand);
  return bare ? `${brand} | ${bare}` : brand;
}

/**
 * The homepage <title>.
 *
 * The admin's `seoTitle` is often just the brand ("Skale Club"), which is a
 * weak title for search results. When it looks bare — short, no separator —
 * the hero headline is appended. Every outcome is normalized brand-first (see brandFirstTitle).
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
  return brandFirstTitle(looksBare && tagline ? tagline : configured, brand);
}
