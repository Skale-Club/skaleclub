// Slugs that may NOT be used as a landing-page slug because they collide with
// existing routes, asset directories, or reserved future namespaces.
// Add new entries here — both the server route layer (43-02) and the admin
// UI (43-04) read this list.

export const RESERVED_SLUGS: readonly string[] = [
  "admin",
  "blog",
  "portfolio",
  "apps",       // /apps — portfolio category page
  "services",   // /services — portfolio category page
  "contact",
  "faq",
  "privacy",
  "terms",
  "e",          // /e/:slug — estimate viewer
  "p",          // /p/:slug — presentation viewer
  "f",          // /f/:slug — public form
  "q",          // /q/:code — smart tag QR redirect
  "n",          // /n/:code — smart tag NFC redirect
  "links",
  "vcard",
  "xpot",
  "sites",
  "api",
  "assets",
  "skale-hub",  // existing hub root
  "br",         // /br — Portuguese home (URL language suffix)
  "svg",        // /svg — public logo vectorizer
];

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.includes(slug.toLowerCase().trim());
}
