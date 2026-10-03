import type { Express, Request, Response, NextFunction } from "express";
import { legacyLanguagePath } from "#shared/languagePath.js";

/**
 * Host + path redirects that used to live in `vercel.json` → `redirects`.
 *
 * On Vercel these ran at the edge; in the container they have to run in
 * Express. Kept deliberately narrow: only `www.<canonical>` and `*.vercel.app`
 * are redirected, never "any host that isn't canonical". A broad rule would
 * also catch `127.0.0.1:8888` (the Docker HEALTHCHECK), the staging FQDN, and
 * localhost in dev — turning every one of those into a 301 to production.
 *
 * `CANONICAL_HOST` is unset in dev and on staging, which disables the host
 * redirects entirely. Path redirects always apply.
 */
const PATH_REDIRECTS: Record<string, string> = {
  "/skale-hub/grupo": "/grupo",
  "/skale-hub/group": "/grupo",
  "/br/skale-hub/grupo": "/grupo",
  "/br/skale-hub/group": "/grupo",
  // The old route name described only one part of the content. The replacement
  // is a complete product guide covering models, pricing, NFC and production.
  "/nfc-pricing": "/nfc-guide",
  "/br/nfc-pricing": "/br/nfc-guide",
  // /grupo is a Portuguese-only page: its /br twin is the same page, so it
  // canonicalises to the bare path (also what the sitemap lists).
  "/br/grupo": "/grupo",
  // The review-plaque product (scripts/seed-products-landing.ts) lives at
  // /products/nfc-review-plaque; its DB slug happens to equal that URL
  // segment, so the bare /:slug catch-all in App.tsx would ALSO resolve it
  // and serve a live, un-redirected duplicate at /nfc-review-plaque. 301 it
  // to the canonical /products/ URL. Not done for "nfc-keychains": that bare
  // segment already belongs to a different, existing page (the ads landing
  // at the top-level /nfc-keychains) and must keep serving it untouched.
  "/nfc-review-plaque": "/products/nfc-review-plaque",
  "/br/nfc-review-plaque": "/br/products/nfc-review-plaque",
  // The keychain product page was a thin duplicate of the keychain landing
  // (/nfc-keychains, first level; the /nfc-guide is its second level).
  "/products/nfc-keychains": "/nfc-keychains",
  "/br/products/nfc-keychains": "/br/nfc-keychains",
};

export function registerCanonicalHostRedirects(app: Express) {
  const canonicalHost = process.env.CANONICAL_HOST?.trim();

  app.use((req: Request, res: Response, next: NextFunction) => {
    // Old PT URL shapes (`/x/br`, `/x-br`) map to the `/br/x` prefix — page
    // navigations only. legacyLanguagePath() already exempts reserved slugs.
    const isNavigation = req.method === "GET" || req.method === "HEAD";
    // A legacy PT shape of a redirected path (`/nfc-pricing-br`) resolves in
    // one hop: legacy rewrite first, then the path table.
    const legacyPath = isNavigation ? legacyLanguagePath(req.path) : null;
    const newPath =
      PATH_REDIRECTS[req.path] ||
      (legacyPath ? PATH_REDIRECTS[legacyPath] || legacyPath : null);

    // req.hostname strips the port and honours X-Forwarded-Host (trust proxy
    // is set to 1 in supabaseAuth.ts, so this is the client-facing host).
    const host = req.hostname.toLowerCase();
    // Any host other than the canonical one (staging FQDN, raw IP, preview)
    // serves the same site: keep every response there out of search indexes.
    if (canonicalHost && host !== canonicalHost.toLowerCase()) {
      res.setHeader("X-Robots-Tag", "noindex");
    }
    const needsHostRedirect =
      !!canonicalHost && (host === `www.${canonicalHost}` || host.endsWith(".vercel.app"));

    if (!newPath && !needsHostRedirect) return next();

    // Combine both into a single hop: a path rewrite and a host swap never
    // need two separate 301s.
    const query = req.originalUrl.slice(req.path.length);
    const path = newPath ?? req.path;
    const target = needsHostRedirect ? `https://${canonicalHost}${path}${query}` : `${path}${query}`;
    return res.redirect(301, target);
  });
}
