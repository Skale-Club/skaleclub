// Run: npx tsx --test shared/landingSeo.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { productDbSlugForUrlSlug, slugForLandingPath, landingPathForSlug, getLandingSeo } from "./landingSeo.js";

// A plain `PRODUCT_ROUTES[urlSlug]` lookup inherits Object.prototype: these
// three keys return a function/object instead of undefined, which crashed
// server/seo/routes.ts's resolver (TypeError) and would have made the
// fail-open catch there serve /br/products/constructor as an indexable 200.
test("productDbSlugForUrlSlug: prototype-polluting keys resolve to undefined, not inherited members", () => {
  assert.equal(productDbSlugForUrlSlug("constructor"), undefined);
  assert.equal(productDbSlugForUrlSlug("__proto__"), undefined);
  assert.equal(productDbSlugForUrlSlug("toString"), undefined);
  assert.equal(productDbSlugForUrlSlug("hasOwnProperty"), undefined);
});

test("productDbSlugForUrlSlug: real routes still resolve", () => {
  assert.equal(productDbSlugForUrlSlug("nfc-review-plaque"), "nfc-review-plaque");
  assert.equal(productDbSlugForUrlSlug("nfc-keychains"), "nfc-custom-keychains");
});

test("slugForLandingPath: /products/<prototype-polluting key> is not a landing (404 elsewhere)", () => {
  assert.equal(slugForLandingPath("/products/constructor"), "");
  assert.equal(slugForLandingPath("/products/__proto__"), "");
  assert.equal(slugForLandingPath("/br/products/constructor"), "");
  assert.equal(slugForLandingPath("/br/products/toString"), "");
});

test("slugForLandingPath: real /products/<slug> URLs resolve to their DB slug, EN and PT", () => {
  assert.equal(slugForLandingPath("/products/nfc-review-plaque"), "nfc-review-plaque");
  assert.equal(slugForLandingPath("/br/products/nfc-review-plaque"), "nfc-review-plaque-br");
  assert.equal(slugForLandingPath("/products/nfc-keychains"), "nfc-custom-keychains");
  assert.equal(slugForLandingPath("/br/products/nfc-keychains"), "nfc-custom-keychains-br");
});

test("landingPathForSlug: product DB slugs (EN and PT) report their /products/<urlSlug> path", () => {
  assert.equal(landingPathForSlug("nfc-review-plaque"), "/products/nfc-review-plaque");
  assert.equal(landingPathForSlug("nfc-review-plaque-br"), "/br/products/nfc-review-plaque");
  assert.equal(landingPathForSlug("nfc-custom-keychains"), "/products/nfc-keychains");
  assert.equal(landingPathForSlug("nfc-custom-keychains-br"), "/br/products/nfc-keychains");
});

test("landingPathForSlug: a non-product slug is unaffected", () => {
  assert.equal(landingPathForSlug("barbershops"), "/barbershops");
  assert.equal(landingPathForSlug("barbershops-br"), "/br/barbershops");
});

test("getLandingSeo: every product slug (EN and PT) has curated SEO copy", () => {
  for (const slug of ["products", "products-br", "nfc-review-plaque", "nfc-review-plaque-br", "nfc-custom-keychains", "nfc-custom-keychains-br"]) {
    assert.ok(getLandingSeo(slug), `missing LANDING_SEO entry for "${slug}"`);
  }
});
