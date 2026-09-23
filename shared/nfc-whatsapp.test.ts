// The WhatsApp button's pre-filled message is what wakes the Xphere NFC agent
// (keyword activation). If a message ever stops containing a keyword, visitors
// who tap the button get no answer — so this guards both languages.
//
// Run: npx tsx --test shared/nfc-whatsapp.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import {
  NFC_WHATSAPP_CTA,
  NFC_WHATSAPP_MESSAGES,
  NFC_WHATSAPP_NUMBER,
  nfcAgentKeywordsIn,
  nfcWhatsappHref,
} from "./nfc-whatsapp";

test("the English message triggers the agent with an English keyword", () => {
  const hits = nfcAgentKeywordsIn(NFC_WHATSAPP_MESSAGES.en);
  assert.ok(hits.includes("keychains"), `got ${JSON.stringify(hits)}`);
});

test("the Portuguese message triggers the agent with a Portuguese keyword", () => {
  const hits = nfcAgentKeywordsIn(NFC_WHATSAPP_MESSAGES.pt);
  assert.ok(hits.includes("chaveiros"), `got ${JSON.stringify(hits)}`);
});

test("each message is written in its own language (no cross-language keyword)", () => {
  assert.ok(!nfcAgentKeywordsIn(NFC_WHATSAPP_MESSAGES.en).some((k) => k.startsWith("chaveir")));
  assert.ok(!nfcAgentKeywordsIn(NFC_WHATSAPP_MESSAGES.pt).some((k) => k.startsWith("key")));
});

test("keyword matching ignores case and accents but needs whole words", () => {
  assert.deepEqual(nfcAgentKeywordsIn("CHAVÊIROS!"), ["chaveiros"]);
  assert.deepEqual(nfcAgentKeywordsIn("quero um site"), []);
  assert.deepEqual(nfcAgentKeywordsIn("chaveiroso"), []);
});

test("links are wa.me with the language's message URL-encoded", () => {
  const en = new URL(nfcWhatsappHref("en"));
  const pt = new URL(nfcWhatsappHref("pt"));
  assert.equal(en.origin + en.pathname, `https://wa.me/${NFC_WHATSAPP_NUMBER}`);
  assert.equal(en.searchParams.get("text"), NFC_WHATSAPP_MESSAGES.en);
  assert.equal(pt.searchParams.get("text"), NFC_WHATSAPP_MESSAGES.pt);
});

test("the section prop carries both languages", () => {
  assert.deepEqual(Object.keys(NFC_WHATSAPP_CTA.messages).sort(), ["en", "pt"]);
  assert.match(NFC_WHATSAPP_CTA.number, /^\d{11}$/);
});
