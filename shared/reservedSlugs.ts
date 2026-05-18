// Slugs that may NOT be used as a landing-page slug because they collide with
// existing routes, asset directories, or reserved future namespaces.
// Add new entries here — both the server route layer (43-02) and the admin
// UI (43-04) read this list.

export const RESERVED_SLUGS: readonly string[] = [
  "admin",
  "blog",
  "portfolio",
  "contact",
  "faq",
  "privacy",
  "terms",
  "e",          // /e/:slug — estimate viewer
  "p",          // /p/:slug — presentation viewer
  "f",          // /f/:slug — public form
  "links",
  "vcard",
  "xpot",
  "sites",
  "api",
  "assets",
  "skale-hub",  // existing hub root
];

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.includes(slug.toLowerCase().trim());
}
