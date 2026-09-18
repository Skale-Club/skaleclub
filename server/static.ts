import express, { type Express, type Request, type Response } from "express";
import fs from "fs";
import path from "path";
import { legacyLanguagePath, splitLanguagePath, withLanguage } from "#shared/languagePath.js";
import { isCorePagePath } from "#shared/pageSlugs.js";

type SeoConfig = {
  title: string;
  description: string;
  locale: "en_US" | "pt_BR";
};

const landingSeo: Record<string, SeoConfig> = {
  "/nfc-keychains": {
    title: "Custom NFC Keychains for Businesses | Skale Club",
    description:
      "Turn every tap into a review, follow, booking, or sale with custom NFC keychains designed, programmed, and tested by Skale Club.",
    locale: "en_US",
  },
  "/br/nfc-keychains": {
    title: "Chaveiros NFC personalizados para empresas | Skale Club",
    description:
      "Transforme cada toque em avaliação, seguidor, agendamento ou venda com chaveiros NFC personalizados, programados e testados pela Skale Club.",
    locale: "pt_BR",
  },
  "/nfc-pricing": {
    title: "NFC Keychain Pricing & Instructions | Skale Club",
    description:
      "See custom NFC keychain pricing, setup instructions, delivery details, and answers to common questions before requesting your design.",
    locale: "en_US",
  },
  "/br/nfc-pricing": {
    title: "Preços e instruções dos chaveiros NFC | Skale Club",
    description:
      "Veja preços, instruções de uso, detalhes de entrega e respostas às principais dúvidas antes de solicitar seu chaveiro NFC personalizado.",
    locale: "pt_BR",
  },
};

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
  const seo = landingSeo[normalizedPath];
  const { path: basePath, language } = splitLanguagePath(normalizedPath);
  const hasAlternates = Boolean(seo) || isCorePagePath(basePath);
  if (!hasAlternates && language === "en") return html;

  const canonicalOrigin = (process.env.VITE_CANONICAL_ORIGIN || "https://skale.club").replace(/\/$/, "");
  const canonical = `${canonicalOrigin}${normalizedPath}`;
  const lang = language === "pt" || seo?.locale === "pt_BR" ? "pt-BR" : "en";
  const replacements: Array<[RegExp, string]> = [[/<html lang="[^"]*"/, `<html lang="${lang}"`]];
  if (hasAlternates) {
    const enHref = `${canonicalOrigin}${basePath}`;
    const ptHref = `${canonicalOrigin}${withLanguage(basePath, "pt")}`;
    replacements.push(
      [/<link rel="canonical" href="[^"]*"\s*\/?>/, `<link rel="canonical" href="${canonical}" />`],
      [/<meta property="og:url" content="[^"]*"\s*\/?>/, `<meta property="og:url" content="${canonical}" />`],
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
