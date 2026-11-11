import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import postcss from "postcss";
import tailwindcss from "tailwindcss";
import { createRequire } from "node:module";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { isAbsolute, join, extname } from "node:path";
import { PlatformLanding } from "../client/src/components/platforms/PlatformLanding.js";
import { fromPortfolioService } from "../shared/catalog.js";
import type { PortfolioService } from "../shared/schema.js";
import { XPEED_PLATFORM } from "../shared/platformDefaults.js";
import { getPlatformLanding } from "../shared/platformLandings.js";
import { platformSlug } from "../shared/platforms.js";

// Offline rendering of the actual shared component and public catalog snapshot.
const output = process.argv[2];
if (!output || !isAbsolute(output)) throw new Error("Pass an absolute, dedicated preview output directory.");
Object.assign(globalThis, { React, require: createRequire(import.meta.url) });
const { default: config } = await import("../tailwind.config.ts");
mkdirSync(output, { recursive: true });
const source = readFileSync(new URL("../client/src/components/platforms/PlatformLanding.tsx", import.meta.url), "utf8");
const css = await postcss([tailwindcss({ ...config, content: [{ raw: source, extension: "tsx" }], plugins: [] })])
  .process("@tailwind base; @tailwind utilities;", { from: undefined });
const base = ":root{--font-sans:Inter,ui-sans-serif,system-ui,sans-serif;--font-display:Inter,ui-sans-serif,system-ui,sans-serif;--font-mono:monospace;--nav-offset:5rem}body{margin:0;background:#0a1221}.review-nav{position:absolute;top:16px;left:20px;right:20px;margin:auto;max-width:1100px;height:64px;display:flex;align-items:center;justify-content:space-between;border:1px solid #ffffff20;border-radius:40px;padding:0 24px;color:#f0f3fa;background:#111d32}.review-nav a{text-decoration:none;font-weight:600}";
writeFileSync(join(output, "styles.css"), css.css + base);
const rows = JSON.parse(readFileSync(new URL("../shared/fixtures/platform-catalog.json", import.meta.url), "utf8")) as PortfolioService[];
const links: string[] = [];
for (const row of [...rows, { ...XPEED_PLATFORM, id: 100 } as PortfolioService]) {
  const item = fromPortfolioService(row);
  const slug = platformSlug(row.slug)!;
  if (item.logo?.startsWith("/")) {
    const bytes = readFileSync(new URL(`../client/public${item.logo}`, import.meta.url));
    const mime: Record<string, string> = { ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp" };
    item.logo = `data:${mime[extname(item.logo)]};base64,${bytes.toString("base64")}`;
  }
  for (const language of ["pt", "en"] as const) {
    let markup = renderToStaticMarkup(React.createElement(PlatformLanding, { item, language }));
    markup = markup.replaceAll('href="/br/apps"', 'href="index.html"').replaceAll('href="/apps"', 'href="index.html"')
      .replaceAll('href="/br/contact"', 'href="https://skale.club/br/contact"').replaceAll('href="/contact"', 'href="https://skale.club/contact"')
      .replaceAll('href="/br"', 'href="https://skale.club/br"').replaceAll('href="/"', 'href="https://skale.club/"');
    const title = getPlatformLanding(slug, language)!.seo.title.replaceAll("&", "&amp;");
    writeFileSync(join(output, `${slug}-${language}.html`), `<!doctype html><html lang="${language === "pt" ? "pt-BR" : "en"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><link rel="stylesheet" href="styles.css"></head><body><nav class="review-nav"><a href="https://skale.club">Skale Club</a><a href="index.html">${language === "pt" ? "Plataformas" : "Platforms"}</a></nav>${markup}</body></html>`);
  }
  links.push(`<article><h2>${item.title}</h2><a href="${slug}-pt.html">Português</a> <a href="${slug}-en.html">English</a></article>`);
}
writeFileSync(join(output, "index.html"), `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Skale Club · Plataformas</title><style>body{background:#0a1221;color:#f0f3fa;font:16px/1.6 system-ui;margin:0;padding:48px 24px}main{max-width:960px;margin:auto}h1{font-size:40px;margin:8px 0}p{color:#aebbd1}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:18px;margin-top:32px}article{background:#111d32;border:1px solid #ffffff20;border-radius:20px;padding:24px}h2{margin-top:0}a{color:#a9bcef;margin-right:16px;text-decoration:none}</style></head><body><main><p>Skale Club · Prévia local</p><h1>Plataformas</h1><p>Um template. Nove páginas.</p><div class="grid">${links.join("")}</div></main></body></html>`);
console.log(`Created 18 bilingual platform previews and an index in ${output}. No database connection or application build.`);
