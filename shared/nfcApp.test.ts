import test from "node:test";
import assert from "node:assert/strict";
import { classifyScan, decidePhoneWrite, guessDestinationType, normalizeUrlInput } from "./nfcApp.js";

test("classifyScan: Skale links, in either access method", () => {
  assert.deepEqual(classifyScan("https://skale.club/n/A7K3P9X2"), { kind: "skale", code: "A7K3P9X2", method: "nfc" });
  assert.deepEqual(classifyScan("https://www.skale.club/q/a7k3p9x2/"), { kind: "skale", code: "A7K3P9X2", method: "qr" });
  assert.deepEqual(classifyScan("https://skale.club/nfc/t/A7K3P9X2"), { kind: "skale", code: "A7K3P9X2", method: null });
});

test("classifyScan: a bare printed code is a Skale tag", () => {
  assert.deepEqual(classifyScan(" a7k3-p9x2 "), { kind: "skale", code: "A7K3P9X2", method: null });
});

test("classifyScan: staging hosts only count when passed in", () => {
  const url = "https://skaleclub-stage.skale.club/n/A7K3P9X2";
  assert.equal(classifyScan(url).kind, "direct");
  assert.equal(classifyScan(url, ["skaleclub-stage.skale.club"]).kind, "skale");
});

test("classifyScan: everything else on the web is a direct customer link", () => {
  assert.deepEqual(classifyScan("https://cliente.com/menu"), { kind: "direct", url: "https://cliente.com/menu" });
  // Other skale.club pages are not tags.
  assert.equal(classifyScan("https://skale.club/nfc-guide").kind, "direct");
  // A malformed code under /n is not a tag either.
  assert.equal(classifyScan("https://skale.club/n/nope").kind, "direct");
  assert.deepEqual(classifyScan("cliente.com.br/agendar"), { kind: "direct", url: "https://cliente.com.br/agendar" });
});

test("classifyScan: empty chips and non-link payloads", () => {
  assert.deepEqual(classifyScan(""), { kind: "empty" });
  assert.deepEqual(classifyScan(null), { kind: "empty" });
  assert.deepEqual(classifyScan("hello world"), { kind: "text", text: "hello world" });
  assert.equal(classifyScan("tel:+15085001095").kind, "text");
});

test("normalizeUrlInput adds https:// only to scheme-less hosts", () => {
  assert.equal(normalizeUrlInput("cliente.com/x"), "https://cliente.com/x");
  assert.equal(normalizeUrlInput("http://cliente.com"), "http://cliente.com");
  assert.equal(normalizeUrlInput("  "), "");
  assert.equal(normalizeUrlInput("not a link"), "not a link");
});

test("guessDestinationType", () => {
  assert.equal(guessDestinationType("https://g.page/r/CabcdEF/review"), "google_review");
  assert.equal(guessDestinationType("https://search.google.com/local/writereview?placeid=x"), "google_review");
  assert.equal(guessDestinationType("https://www.instagram.com/skale.club"), "social");
  assert.equal(guessDestinationType("https://calendly.com/skale/intro"), "booking");
  assert.equal(guessDestinationType("https://cliente.com/cardapio"), "menu");
  assert.equal(guessDestinationType("cliente.com"), "website");
  assert.equal(guessDestinationType("garbage"), "website");
});

test("decidePhoneWrite: verified only on an exact read-back", () => {
  const expected = "https://skale.club/n/A7K3P9X2";
  assert.deepEqual(decidePhoneWrite(expected, expected), { ok: true, status: "verified" });
  assert.deepEqual(decidePhoneWrite(expected, null), { ok: true, status: "programmed" });
  const bad = decidePhoneWrite(expected, "https://skale.club/n/OTHER123");
  assert.equal(bad.ok, false);
  assert.equal(bad.status, "failed");
});
