import express, { type Express, type Request, type Response } from "express";
import fs from "fs";
import path from "path";
import { getLandingSeo, landingPathForSlug, slugForLandingPath } from "#shared/landingSeo.js";

function escapeHtmlAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function injectLandingSeo(html: string, pathname: string): string {
  const slug = slugForLandingPath(pathname);
  const seo = getLandingSeo(slug);
  if (!seo) return html;

  const canonicalOrigin = (process.env.VITE_CANONICAL_ORIGIN || "https://skale.club").replace(/\/$/, "");
  const canonical = `${canonicalOrigin}${landingPathForSlug(slug)}`;
  const lang = seo.locale === "pt_BR" ? "pt-BR" : "en";
  const replacements: Array<[RegExp, string]> = [
    [/<html lang="[^"]*"/, `<html lang="${lang}"`],
    [/<title>[^<]*<\/title>/, `<title>${seo.title}</title>`],
    [/<meta name="description" content="[^"]*"\s*\/?>/, `<meta name="description" content="${escapeHtmlAttribute(seo.description)}" />`],
    [/<link rel="canonical" href="[^"]*"\s*\/?>/, `<link rel="canonical" href="${canonical}" />`],
    [/<meta property="og:url" content="[^"]*"\s*\/?>/, `<meta property="og:url" content="${canonical}" />`],
    [/<meta property="og:locale" content="[^"]*"\s*\/?>/, `<meta property="og:locale" content="${seo.locale}" />`],
    [/<meta property="og:title" content="[^"]*"\s*\/?>/, `<meta property="og:title" content="${escapeHtmlAttribute(seo.title)}" />`],
    [/<meta property="og:description" content="[^"]*"\s*\/?>/, `<meta property="og:description" content="${escapeHtmlAttribute(seo.description)}" />`],
    [/<meta name="twitter:title" content="[^"]*"\s*\/?>/, `<meta name="twitter:title" content="${escapeHtmlAttribute(seo.title)}" />`],
    [/<meta name="twitter:description" content="[^"]*"\s*\/?>/, `<meta name="twitter:description" content="${escapeHtmlAttribute(seo.description)}" />`],
  ];

  return replacements.reduce(
    (document, [pattern, replacement]) => document.replace(pattern, replacement),
    html,
  );
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // Missing hashed assets (e.g. a stale tab requests an old chunk after deploy)
  // must 404 cleanly — otherwise the SPA fallback below would return index.html
  // with text/html, and the browser would reject the module script with
  // "Expected a JavaScript-or-Wasm module script but the server responded with
  // a MIME type of text/html". The client catches the 404 and reloads.
  app.use("/assets/", (_req: Request, res: Response) => {
    res.status(404).type("text/plain").send("asset not found");
  });

  const indexHtml = fs.readFileSync(path.resolve(distPath, "index.html"), "utf8");

  // Fall through to index.html for actual SPA routes (no extension / known UI paths).
  app.use("*", (req: Request, res: Response) => {
    // app.use("*") may trim req.url to "/" while handling the wildcard;
    // originalUrl keeps the actual landing path requested by the crawler.
    const pathname = req.originalUrl.split("?", 1)[0];
    res.type("html").send(injectLandingSeo(indexHtml, pathname));
  });
}
