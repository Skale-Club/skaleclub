import type { Express, Request, Response, NextFunction } from "express";

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
};

export function registerCanonicalHostRedirects(app: Express) {
  const canonicalHost = process.env.CANONICAL_HOST?.trim();

  app.use((req: Request, res: Response, next: NextFunction) => {
    const pathRedirect = PATH_REDIRECTS[req.path];
    if (pathRedirect) {
      const query = req.originalUrl.slice(req.path.length);
      return res.redirect(301, `${pathRedirect}${query}`);
    }

    if (!canonicalHost) return next();

    // req.hostname strips the port and honours X-Forwarded-Host (trust proxy
    // is set to 1 in supabaseAuth.ts, so this is the client-facing host).
    const host = req.hostname.toLowerCase();
    const isWww = host === `www.${canonicalHost}`;
    const isVercelAlias = host.endsWith(".vercel.app");

    if (isWww || isVercelAlias) {
      return res.redirect(301, `https://${canonicalHost}${req.originalUrl}`);
    }

    return next();
  });
}
