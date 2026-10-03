// Run: npx tsx --test shared/site-whatsapp.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { siteWhatsappMessage, whatsappPageRef } from "./site-whatsapp.js";

test("page ref is the normalised route path", () => {
  assert.equal(whatsappPageRef("/"), "home");
  assert.equal(whatsappPageRef(""), "home");
  assert.equal(whatsappPageRef("/portfolio"), "portfolio");
  assert.equal(whatsappPageRef("/Products/NFC-Review-Plaque/"), "products/nfc-review-plaque");
  assert.equal(whatsappPageRef("/websites-br?utm_source=x#top"), "websites-br");
});

test("message carries the page ref in each language", () => {
  assert.equal(
    siteWhatsappMessage("/contact", "en"),
    "Hi! I found you on the Skale Club website and would like to talk about my project. (Page: contact)",
  );
  assert.equal(
    siteWhatsappMessage("/", "pt"),
    "Olá! Vim pelo site da Skale Club e gostaria de conversar sobre meu projeto. (Página: home)",
  );
});
