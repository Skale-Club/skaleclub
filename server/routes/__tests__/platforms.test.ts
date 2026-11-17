import assert from "node:assert/strict";
import { after, test } from "node:test";
import { readFileSync } from "node:fs";
import express from "express";
import type { AddressInfo } from "node:net";
import type { PortfolioService } from "#shared/schema.js";
import { XPEED_PLATFORM } from "#shared/platformDefaults.js";
import { PLATFORM_LANDING_SLUGS, getPlatformLanding } from "#shared/platformLandings.js";
import { platformSlug } from "#shared/platforms.js";
import { getPageSlugsValidationError } from "#shared/pageSlugs.js";
import { isReservedSlug } from "#shared/reservedSlugs.js";
import { registerPlatformRoutes } from "../platforms.js";
import { storage } from "../../storage.js";
import { resolveRoute } from "../../seo/routes.js";
import { injectSeo } from "../../seo/inject.js";
import { collectSitemapUrls } from "../../seo/sitemap.js";
import { escapeHtml } from "../../seo/head.js";

const snapshot = JSON.parse(readFileSync(new URL("../../../shared/fixtures/platform-catalog.json", import.meta.url), "utf8")) as PortfolioService[];
const rows = [...snapshot, { ...XPEED_PLATFORM, id: 100 } as PortfolioService].map((row) => ({ ...row, createdAt: new Date(0), updatedAt: new Date(0) }));
const store = { async getPortfolioServiceBySlug(slug: string) { return rows.find((row) => row.slug === slug); } };
const app = express();
registerPlatformRoutes(app, store);
const server = app.listen(0, "127.0.0.1");
await new Promise<void>((resolve) => server.once("listening", resolve));
const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
after(() => new Promise<void>((resolve) => server.close(() => resolve())));

test("public platform API resolves all eight branded URLs and legacy aliases", async () => {
  for (const slug of PLATFORM_LANDING_SLUGS) {
    const response = await fetch(`${base}/api/platforms/${slug}`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal((await response.json()).slug, slug);
  }
  assert.equal((await (await fetch(`${base}/api/platforms/scheduling-system`)).json()).slug, "xkedule");
});

test("platform publication is checked on each request; missing and malformed pages stay hidden", async () => {
  const row = rows[0];
  row.isActive = false;
  try { assert.equal((await fetch(`${base}/api/platforms/xkedule`)).status, 404); }
  finally { row.isActive = true; }
  assert.equal((await fetch(`${base}/api/platforms/xkedule`)).status, 200);
  for (const slug of ["missing-tool", "bad_slug", "a%2Fb", "xsites", "websites"]) assert.equal((await fetch(`${base}/api/platforms/${slug}`)).status, 404);
});

test("server SEO resolves active platforms and emits localized canonical metadata", async () => {
  const original = storage.getPortfolioServiceBySlug;
  storage.getPortfolioServiceBySlug = store.getPortfolioServiceBySlug;
  try {
    for (const row of rows) for (const language of ["en", "pt"] as const) {
      const slug = platformSlug(row.slug);
      if (!slug) {
        for (const alias of ["websites", "xsites"]) assert.equal((await resolveRoute(`${language === "pt" ? "/br" : ""}/platforms/${alias}`)).status, 404);
        continue;
      }
      const path = `${language === "pt" ? "/br" : ""}/platforms/${slug}`;
      const route = await resolveRoute(path);
      assert.equal(route.status, 200);
      const html = injectSeo("<html><head><title>Site</title></head><body></body></html>", path, { settings: null, route });
      assert.ok(html.includes(`https://skale.club${path}`));
      assert.ok(html.includes('hreflang="pt-BR"'));
      assert.ok(html.includes(escapeHtml(getPlatformLanding(slug, language)!.seo.description)));
    }
    rows[0].isActive = false;
    assert.equal((await resolveRoute("/platforms/xkedule")).status, 404);
    assert.equal((await resolveRoute("/platforms/missing")).noindex, true);
  } finally { rows[0].isActive = true; storage.getPortfolioServiceBySlug = original; }
});

test("sitemap lists active platforms in both languages using canonical slugs", () => {
  const urls = collectSitemapUrls({ pages: [], posts: [], platforms: [...rows, { slug: "hidden", isActive: false, updatedAt: null }] });
  const paths = urls.map((url) => url.path);
  for (const slug of PLATFORM_LANDING_SLUGS) {
    assert.ok(paths.includes(`/platforms/${slug}`));
    assert.ok(paths.includes(`/br/platforms/${slug}`));
  }
  assert.ok(!paths.includes("/platforms/hidden"));
  assert.ok(!paths.includes("/platforms/scheduling-system"));
  for (const prefix of ["", "/br"]) for (const slug of ["xsites", "websites"]) assert.ok(!paths.includes(`${prefix}/platforms/${slug}`));
  assert.ok(isReservedSlug("platforms"));
  assert.ok(getPageSlugsValidationError({ contact: "platforms" }));
});
