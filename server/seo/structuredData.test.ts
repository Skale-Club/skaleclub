import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { CompanySettings } from "#shared/schema.js";
import { injectSeo } from "./inject.js";
import { faqsForPage } from "./shell.js";
import type { RouteResolution } from "./routes.js";

const template = readFileSync(path.resolve("client/index.html"), "utf8");
const settings = { companyName: "Skale Club", pageSlugs: null, socialLinks: [], logoMain: "/logo.png" } as unknown as CompanySettings;
const ok = (extra: Partial<RouteResolution> = {}): RouteResolution => ({ status: 200, noindex: false, landing: null, alternate: null, blog: null, ...extra });
const landingRow = (slug: string, language: "en" | "pt" = "en") =>
  ({ slug, language, alternateSlug: null, sections: [], updatedAt: null }) as never;

/** Every JSON-LD block of the injected head, parsed (so invalid JSON fails the test). */
function blocks(html: string): Array<Record<string, any>> {
  return [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
}
const typeOf = (b: Record<string, any>) => b["@type"] ?? (b["@graph"] ? "graph" : undefined);

test("FAQPage on /faq and /br/faq, from the rows the page renders", async () => {
  const data = {
    faqs: async () => [{ id: 1, question: "What do you do?", answer: "We automate.", order: 0 }] as never,
    ptTranslations: async () => new Map([["What do you do?", "O que voces fazem?"]]),
  };
  const en = await faqsForPage("/faq", settings, data);
  assert.deepEqual(en, [{ question: "What do you do?", answer: "We automate." }]);
  const pt = await faqsForPage("/br/faq", settings, data);
  assert.equal(pt?.[0].question, "O que voces fazem?");
  assert.equal(await faqsForPage("/blog", settings, data), undefined);

  const html = injectSeo(template, "/faq", { settings, route: ok(), faqs: en });
  const faq = blocks(html).find((b) => typeOf(b) === "FAQPage")!;
  assert.equal(faq.mainEntity[0].name, "What do you do?");
  assert.equal(faq.mainEntity[0].acceptedAnswer.text, "We automate.");
  // No rows, no empty FAQPage.
  assert.ok(!blocks(injectSeo(template, "/faq", { settings, route: ok(), faqs: [] })).some((b) => typeOf(b) === "FAQPage"));
});

test("Product with an Offer on the review plaque, in both languages", () => {
  const cases = [
    ["/products/nfc-review-plaque", "nfc-review-plaque", "en"],
    ["/br/products/nfc-review-plaque", "nfc-review-plaque-br", "pt"],
  ] as const;
  for (const [url, slug, lang] of cases) {
    const html = injectSeo(template, url, { settings, route: ok({ landing: landingRow(slug, lang) }) });
    const product = blocks(html).find((b) => typeOf(b) === "Product")!;
    assert.ok(product, url);
    assert.equal(product.offers.priceCurrency, "USD");
    assert.equal(product.offers.lowPrice, 49);
    assert.equal(product.offers.highPrice, 89);
    assert.equal(product.offers.availability, "https://schema.org/InStock");
  }
});

test("ItemList on /products", () => {
  const html = injectSeo(template, "/products", { settings, route: ok({ landing: landingRow("products") }) });
  const list = blocks(html).find((b) => typeOf(b) === "ItemList")!;
  assert.equal(list.itemListElement.length, 2);
  assert.equal(list.itemListElement[0].url, "https://skale.club/products/nfc-review-plaque");
  const pt = injectSeo(template, "/br/products", { settings, route: ok({ landing: landingRow("products-br", "pt") }) });
  assert.equal(blocks(pt).find((b) => typeOf(b) === "ItemList")!.itemListElement[0].url, "https://skale.club/br/products/nfc-review-plaque");
});

test("BlogPosting with headline, dates, author and image", () => {
  const blog = {
    slug: "hello",
    title: "Hello Post",
    metaDescription: "About hello",
    excerpt: null,
    featureImageUrl: "/storage/hello.webp",
    authorName: "Ana",
    publishedAt: new Date("2026-03-01T10:00:00Z"),
    updatedAt: new Date("2026-03-02T10:00:00Z"),
  };
  const html = injectSeo(template, "/blog/hello", { settings, route: ok({ blog }) });
  const post = blocks(html).find((b) => typeOf(b) === "BlogPosting")!;
  assert.equal(post.headline, "Hello Post");
  assert.equal(post.datePublished, "2026-03-01T10:00:00.000Z");
  assert.equal(post.dateModified, "2026-03-02T10:00:00.000Z");
  assert.equal(post.author.name, "Ana");
  assert.deepEqual(post.image, ["https://skale.club/storage/hello.webp"]);
  assert.equal(post.mainEntityOfPage["@id"], "https://skale.club/blog/hello");
});

test("Service with the Organization as provider on /services, /websites and /barbershops", () => {
  const cases: Array<[string, RouteResolution]> = [
    ["/services", ok()],
    ["/websites", ok({ landing: landingRow("websites") })],
    ["/barbershops", ok({ landing: landingRow("barbershops") })],
    ["/br/websites", ok({ landing: landingRow("websites-br", "pt") })],
  ];
  for (const [url, route] of cases) {
    const service = blocks(injectSeo(template, url, { settings, route })).find((b) => typeOf(b) === "Service")!;
    assert.ok(service, url);
    assert.equal(service.provider["@type"], "Organization");
    assert.equal(service.provider.name, "Skale Club");
    assert.ok(service.description.length > 50, url);
  }
});

test("pages without a schema type get only their breadcrumb", () => {
  const html = injectSeo(template, "/contact", { settings, route: ok() });
  assert.deepEqual(blocks(html).map(typeOf), ["BreadcrumbList"]);
});
