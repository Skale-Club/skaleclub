import express, { type Express, type Request, type Response } from "express";
import compression from "compression";
import fs from "fs";
import path from "path";
import { isNoindexPath } from "#shared/coreSeo.js";
import { injectSeo } from "./seo/inject.js";
import { resolveRoute } from "./seo/routes.js";
import { getSeoSettings } from "./seo/data.js";

// Database-free variant: no 404s and no settings-driven JSON-LD, but the same
// per-page head for known routes.
export function injectLandingSeo(html: string, pathname: string): string {
  return injectSeo(html, pathname, {
    settings: null,
    route: { status: 200, noindex: isNoindexPath(pathname), landing: null, alternate: null, blog: null },
  });
}

const COMPRESSIBLE = /text\/|javascript|json|xml|svg/i;

// Files that must always be revalidated: the service worker and manifest change
// without a new hash in their name, and index.html points at the hashed assets.
const NO_CACHE_FILE = /(^|[\\/])(sw\.js|index\.html)$|\.webmanifest$/i;

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(
    compression({
      filter: (_req, res) => COMPRESSIBLE.test(String(res.getHeader("Content-Type") ?? "")),
    }),
  );

  // Hashed build output never changes under the same name: cache it for a year.
  // fallthrough:false makes a missing file an error here instead of a fall
  // through to the SPA handler; the error handler below answers it as text.
  // Otherwise a stale tab requesting an old chunk after a deploy would get
  // index.html as text/html and the browser would reject the module script
  // ("Expected a JavaScript-or-Wasm module script but the server responded
  // with a MIME type of text/html"). The client catches the 404 and reloads.
  app.use(
    "/assets",
    express.static(path.join(distPath, "assets"), { immutable: true, maxAge: "1y", fallthrough: false }),
    (err: { status?: number }, _req: Request, res: Response, next: express.NextFunction) => {
      if (err?.status === 404) return res.status(404).type("text/plain").send("asset not found");
      return next(err);
    },
  );

  // redirect: false: a public/ asset folder sharing a route's name (e.g.
  // public/nfc-guide/ images vs the /nfc-guide page) must not 301 the page to a
  // trailing-slash URL. index: false: "/" goes through the SPA handler below so
  // the homepage gets its per-page head like every other route.
  // The raw shell has no per-page head: send crawlers to the real homepage.
  app.get("/index.html", (_req: Request, res: Response) => res.redirect(301, "/"));

  app.use(
    express.static(distPath, {
      redirect: false,
      index: false,
      maxAge: 0,
      setHeaders: (res, filePath) => {
        if (NO_CACHE_FILE.test(filePath)) res.setHeader("Cache-Control", "no-cache");
      },
    }),
  );

  // Unknown API routes answer JSON, never the SPA shell.
  app.use("/api", (_req: Request, res: Response) => {
    res.status(404).json({ message: "Not found" });
  });

  const indexHtml = fs.readFileSync(path.resolve(distPath, "index.html"), "utf8");

  // Fall through to index.html for SPA routes. Unknown URLs still get the shell
  // (so the client's 404 page renders) but with a real 404 status and noindex.
  app.use("*", async (req: Request, res: Response) => {
    // app.use("*") may trim req.url to "/" while handling the wildcard;
    // originalUrl keeps the actual path requested by the crawler.
    const pathname = req.originalUrl.split("?", 1)[0];

    let settings = null;
    try {
      settings = await getSeoSettings();
    } catch (err) {
      console.error("[seo] company settings unavailable:", (err as Error).message);
    }
    const route = await resolveRoute(pathname, settings?.pageSlugs);

    if (route.noindex || route.status === 404) {
      const existing = String(res.getHeader("X-Robots-Tag") ?? "");
      if (!/noindex/i.test(existing)) res.setHeader("X-Robots-Tag", "noindex, nofollow");
    }
    // The shell embeds per-page tags: let browsers and CDNs revalidate it.
    res.setHeader("Cache-Control", "no-cache");
    res.status(route.status).type("html").send(injectSeo(indexHtml, pathname, { settings, route }));
  });
}
