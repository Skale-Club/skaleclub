import express, { type Express, type Request, type Response } from "express";
import fs from "fs";
import path from "path";
import { legacyLanguagePath, splitLanguagePath, withLanguage } from "#shared/languagePath.js";
import { isCorePagePath } from "#shared/pageSlugs.js";
import { getLandingSeo, landingPathForSlug, slugForLandingPath } from "#shared/landingSeo.js";

function escapeHtmlAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function injectLandingSeo(html: string, pathname: string): string {
  const cleanPath = pathname.length > 1 ? pathname.replace(/\/$/, "") : pathname;
  // Legacy PT shapes (`/nfc-keychains/br`, `/nfc-keychains-br`) still render;
  // they just self-report the new `/br/...` canonical.
  const normalizedPath = legacyLanguagePath(cleanPath) ?? cleanPath;
  const slug = slugForLandingPath(normalizedPath);
  const seo = slug ? getLandingSeo(slug) : undefined;
  const { path: basePath, language } = splitLanguagePath(normalizedPath);
  const isCorePage = isCorePagePath(basePath);
  // A canonical/og:url is owed to every landing with curated SEO, every core
  // page, and any non-exempt `/br/...` URL (splitLanguagePath already forces
  // exempt remainders back to language "en", so this never fires for those).
  const hasSelfCanonical = Boolean(seo) || isCorePage || language === "pt";
  if (!hasSelfCanonical) return html;

  const canonicalOrigin = (process.env.VITE_CANONICAL_ORIGIN || "https://skale.club").replace(/\/$/, "");
  const canonical = `${canonicalOrigin}${normalizedPath}`;
  const lang = language === "pt" || seo?.locale === "pt_BR" ? "pt-BR" : "en";
  const replacements: Array<[RegExp, string]> = [
    [/<html lang="[^"]*"/, `<html lang="${lang}"`],
    [/<link rel="canonical" href="[^"]*"\s*\/?>/, `<link rel="canonical" href="${canonical}" />`],
    [/<meta property="og:url" content="[^"]*"\s*\/?>/, `<meta property="og:url" content="${canonical}" />`],
  ];

  // An hreflang triplet is only accurate when the en/pt pair actually exists:
  // a core page, or a managed landing whose base and `-br` slugs both carry
  // SEO entries. A PT-only landing (e.g. "grupo", no "grupo-br" row) gets a
  // self canonical above but no triplet.
  const baseSlug = slug.endsWith("-br") ? slug.slice(0, -3) : slug;
  const hasHreflangPair =
    isCorePage || (baseSlug !== "" && Boolean(getLandingSeo(baseSlug)) && Boolean(getLandingSeo(`${baseSlug}-br`)));
  if (hasHreflangPair) {
    const enHref = isCorePage ? `${canonicalOrigin}${basePath}` : `${canonicalOrigin}${landingPathForSlug(baseSlug)}`;
    const ptHref = isCorePage
      ? `${canonicalOrigin}${withLanguage(basePath, "pt")}`
      : `${canonicalOrigin}${landingPathForSlug(`${baseSlug}-br`)}`;
    replacements.push(
      [/<\/head>/, [
        `<link rel="alternate" hreflang="en" href="${enHref}" data-site-i18n="true" />`,
        `<link rel="alternate" hreflang="pt-BR" href="${ptHref}" data-site-i18n="true" />`,
        `<link rel="alternate" hreflang="x-default" href="${enHref}" data-site-i18n="true" />`,
        "</head>",
      ].join("\n")],
    );
  }
  if (seo) replacements.push(
    [/<title>[^<]*<\/title>/, `<title>${seo.title}</title>`],
    [/<meta name="description" content="[^"]*"\s*\/?>/, `<meta name="description" content="${escapeHtmlAttribute(seo.description)}" />`],
    [/<meta property="og:locale" content="[^"]*"\s*\/?>/, `<meta property="og:locale" content="${seo.locale}" />`],
    [/<meta property="og:title" content="[^"]*"\s*\/?>/, `<meta property="og:title" content="${escapeHtmlAttribute(seo.title)}" />`],
    [/<meta property="og:description" content="[^"]*"\s*\/?>/, `<meta property="og:description" content="${escapeHtmlAttribute(seo.description)}" />`],
    [/<meta name="twitter:title" content="[^"]*"\s*\/?>/, `<meta name="twitter:title" content="${escapeHtmlAttribute(seo.title)}" />`],
    [/<meta name="twitter:description" content="[^"]*"\s*\/?>/, `<meta name="twitter:description" content="${escapeHtmlAttribute(seo.description)}" />`],
  );

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
