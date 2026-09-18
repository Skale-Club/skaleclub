/**
 * The homepage <title>.
 *
 * The admin's `seoTitle` is often just the brand ("Skale Club"), which is a
 * weak title for search results. When it looks bare — short, no separator —
 * the hero headline is appended, so the tab and the SERP say what the
 * business does. A deliberately written title (anything with a separator or
 * longer than a brand name) is used exactly as entered.
 */
export function homepageTitle(s: {
  seoTitle?: string | null;
  companyName?: string | null;
  heroTitle?: string | null;
}): string {
  const brand = (s.seoTitle || s.companyName || "Skale Club").trim();
  const looksBare = brand.length <= 24 && !/[|\-–—:]/.test(brand);
  if (!looksBare) return brand;
  const tagline = (s.heroTitle || "").trim().replace(/\s+/g, " ");
  return tagline ? `${brand} | ${tagline}` : brand;
}
