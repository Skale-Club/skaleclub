import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import postcss from "postcss";
import tailwindcss from "@tailwindcss/postcss";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { AppLanding } from "../client/src/components/downloads/AppLanding.js";
import { APP_CATALOG } from "../shared/appCatalog.js";
import { publicDownloadableApp } from "../shared/schema/downloads.js";
import { getAppLanding } from "../shared/appLandings.js";

// Offline review of the actual component, without a dev server or database.
const output = process.argv[2];
if (!output || !isAbsolute(output)) throw new Error("Pass an absolute, dedicated preview output directory.");
Object.assign(globalThis, { React, require: createRequire(import.meta.url) });
mkdirSync(output, { recursive: true });
// Compile the same v4 entry/config as production so preview styles cannot drift.
const stylesheet = fileURLToPath(new URL("../client/src/index.css", import.meta.url));
const css = await postcss([tailwindcss()])
  .process(readFileSync(stylesheet, "utf8"), { from: stylesheet });
const base = ":root{--font-sans:Inter,ui-sans-serif,system-ui,sans-serif;--font-display:Inter,ui-sans-serif,system-ui,sans-serif;--font-mono:monospace;--nav-offset:5rem}html{scroll-behavior:smooth}body{margin:0;background:#0a1221}.review-nav{position:absolute;top:16px;left:20px;right:20px;margin:auto;max-width:1100px;height:64px;display:flex;align-items:center;justify-content:space-between;border:1px solid #ffffff20;border-radius:40px;padding:0 24px;color:#f0f3fa;background:#111d32}.review-nav a{text-decoration:none;font-weight:600}";
writeFileSync(join(output, "styles.css"), css.css + base);
const links: string[] = [];
for (const input of APP_CATALOG) {
  const app = publicDownloadableApp({ ...input, id: `preview-${input.slug}`, createdAt: new Date(0), updatedAt: new Date(0) });
  for (const language of ["pt", "en"] as const) {
    let markup = renderToStaticMarkup(React.createElement(AppLanding, { app, language }));
    markup = markup.replace(/(src|href)="(\/apps\/[^\"]+)"/g, (_all, attr: string, path: string) => {
      const bytes = readFileSync(new URL(`../client/public${path}`, import.meta.url));
      const mime = path.endsWith(".svg") ? "image/svg+xml" : "image/png";
      return `${attr}="data:${mime};base64,${bytes.toString("base64")}"`;
    });
    // A file preview has no API server. Its buttons link to the same pinned
    // public asset; the live component always uses the site's download guard.
    for (const release of app.releases) markup = markup.replaceAll(`/api/downloads/${app.slug}/${release.id}`, release.downloadUrl);
    markup = markup.replaceAll('href="/br/downloads"', 'href="index.html"').replaceAll('href="/downloads"', 'href="index.html"')
      .replaceAll('href="/br"', 'href="https://skale.club/br"').replaceAll('href="/"', 'href="https://skale.club/"');
    const title = getAppLanding(app.slug, language)!.seo.title.replaceAll("&", "&amp;");
    const html = `<!doctype html><html lang="${language === "pt" ? "pt-BR" : "en"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><link rel="stylesheet" href="styles.css"></head><body><nav class="review-nav"><a href="https://skale.club">Skale Club</a><a href="index.html">${language === "pt" ? "Aplicativos" : "Apps"}</a></nav>${markup}</body></html>`;
    writeFileSync(join(output, `${app.slug}-${language}.html`), html);
  }
  links.push(`<article><h2>${app.name}</h2><a href="${app.slug}-pt.html">Português</a> <a href="${app.slug}-en.html">English</a></article>`);
}
writeFileSync(join(output, "index.html"), `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Skale Club · Aplicativos</title><style>body{background:#0a1221;color:#f0f3fa;font:16px/1.6 system-ui;margin:0;padding:48px 24px}main{max-width:960px;margin:auto}h1{font-size:40px;margin:8px 0}p{color:#aebbd1}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:18px;margin-top:32px}article{background:#111d32;border:1px solid #ffffff20;border-radius:20px;padding:24px}h2{margin-top:0}a{color:#a9bcef;margin-right:16px;text-decoration:none}</style></head><body><main><p>Skale Club · Prévia local</p><h1>Aplicativos</h1><p>Um template. Seis páginas.</p><div class="grid">${links.join("")}</div></main></body></html>`);
console.log(`Created 12 bilingual page previews and an index in ${output}. No database connection or application build.`);
