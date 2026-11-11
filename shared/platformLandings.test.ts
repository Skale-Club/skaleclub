import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { PlatformLanding } from "../client/src/components/platforms/PlatformLanding.js";
import { catalogProducts, type CatalogItem } from "./catalog.js";
import type { PortfolioService } from "./schema.js";
import { XPEED_PLATFORM } from "./platformDefaults.js";
import { getPlatformLanding, PLATFORM_LANDING_SLUGS } from "./platformLandings.js";
import { platformSlug, platformDbSlug, platformPath, safePlatformUrl } from "./platforms.js";

Object.assign(globalThis, { React });
const rows = JSON.parse(readFileSync(new URL("./fixtures/platform-catalog.json", import.meta.url), "utf8")) as PortfolioService[];
const items = catalogProducts([...rows, { ...XPEED_PLATFORM, id: 100 } as PortfolioService]);
const render = (item: CatalogItem, language: "en" | "pt" = "en") => renderToStaticMarkup(React.createElement(PlatformLanding, { item, language }));

test("platform aliases keep canonical branded paths and allow future CMS entries", () => {
  for (const slug of PLATFORM_LANDING_SLUGS) {
    assert.equal(platformSlug(platformDbSlug(slug)!), slug);
    assert.equal(platformPath(platformDbSlug(slug)!), `/platforms/${slug}`);
  }
  assert.equal(platformDbSlug("future-tool"), "future-tool");
  for (const invalid of ["../apps", "a/b", "", "A", "a".repeat(81)]) assert.equal(platformPath(invalid), undefined);
});

test("platform access links accept web destinations and reject executable or credential URLs", () => {
  assert.equal(safePlatformUrl("xpeed.skale.club"), "https://xpeed.skale.club/");
  for (const invalid of ["javascript:alert(1)", "data:text/html,test", "mailto:a@test.com", "https://user:secret@test.com", "https://", ""]) assert.equal(safePlatformUrl(invalid), undefined);
});

test("all eight platform pages share one compact bilingual template and one CTA", () => {
  assert.equal(items.length, 8);
  for (const item of items) for (const language of ["en", "pt"] as const) {
    const html = render(item, language);
    const editorial = getPlatformLanding(platformSlug(item.slug!)!, language)!;
    assert.ok(editorial);
    assert.equal((html.match(/<h1\b/g) ?? []).length, 1);
    assert.equal((html.match(/<li\b/g) ?? []).length, 3);
    assert.equal((html.match(/data-testid="platform-primary-cta"/g) ?? []).length, 1);
    assert.ok(html.includes(editorial.headline));
    assert.ok(html.includes(`href="${language === "pt" ? "/br/apps" : "/apps"}"`));
    assert.ok(html.includes(editorial.ctaKind === "contact" ? `href="${language === "pt" ? "/br/contact" : "/contact"}"` : `href="${safePlatformUrl(item.site)}"`));
    assert.ok(!html.includes("/api/downloads/"));
  }
});

test("Xsites is excluded from platform listings, aliases and editorial pages", () => {
  for (const slug of ["xsites", "websites"]) {
    assert.equal(platformSlug(slug), undefined);
    assert.equal(platformDbSlug(slug), undefined);
    assert.equal(platformPath(slug), undefined);
    assert.equal(getPlatformLanding(slug, "en"), undefined);
  }
  assert.ok(rows.some((row) => row.slug === "websites"), "legacy snapshot exercises the exclusion");
  assert.ok(!items.some((item) => item.slug === "websites" || item.slug === "xsites"));
});

test("future platforms bound CMS copy and omit unsafe access links", () => {
  const item = { ...items[0], slug: "future-tool", subtitle: "A useful platform ".repeat(100), description: "Details ".repeat(1000), features: ["Benefit ".repeat(500)], site: "javascript:alert(1)" };
  const html = render(item);
  assert.ok(!html.includes('data-testid="platform-primary-cta"'));
  assert.ok(html.length < 15000);
  assert.ok((html.match(/<h1[^>]*>(.*?)<\/h1>/)?.[1].length ?? 0) <= 70);
  assert.equal((html.match(/<li\b/g) ?? []).length, 3);
  assert.ok(!render({ ...item, description: undefined }).includes(item.subtitle));
  const unbroken = render({ ...item, subtitle: "x".repeat(300) });
  assert.equal(unbroken.match(/<h1[^>]*>(.*?)<\/h1>/)?.[1].length, 70);
});
