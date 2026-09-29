// Run: npx tsx --test shared/phone.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { formatPhoneDisplay, telHref, toE164, whatsappHref } from "./phone.js";

test("10-digit US numbers get +1", () => {
  assert.equal(toE164("(508) 500-1095"), "+15085001095");
  assert.equal(toE164("508.500.1095"), "+15085001095");
  assert.equal(toE164("1 508 500 1095"), "+15085001095");
});

test("existing + is kept (Brazil)", () => {
  assert.equal(toE164("+55 (11) 91234-5678"), "+5511912345678");
  assert.equal(toE164("0055 11 91234 5678"), "+5511912345678");
});

test("already E.164 is unchanged", () => {
  assert.equal(toE164("+15085001095"), "+15085001095");
});

test("junk yields empty / placeholder hrefs", () => {
  assert.equal(toE164("call us"), "");
  assert.equal(toE164(null), "");
  assert.equal(telHref("n/a"), "#");
  assert.equal(whatsappHref(""), "#");
});

test("ambiguous numbers without country code are rejected", () => {
  assert.equal(toE164("(11) 91234-5678"), "");
  assert.equal(telHref("(11) 91234-5678"), "#");
});

test("extensions are stripped", () => {
  assert.equal(toE164("(508) 500-1095 ext 2"), "+15085001095");
  assert.equal(toE164("508-500-1095 x12"), "+15085001095");
  assert.equal(toE164("ext 2"), "");
});

test("hrefs", () => {
  assert.equal(telHref("(508) 500-1095"), "tel:+15085001095");
  assert.equal(whatsappHref("(508) 500-1095"), "https://wa.me/15085001095");
  assert.equal(whatsappHref("+55 11 91234-5678", "Oi, tudo bem?"), "https://wa.me/5511912345678?text=Oi%2C%20tudo%20bem%3F");
});

test("display formatting", () => {
  assert.equal(formatPhoneDisplay("5085001095"), "(508) 500-1095");
  assert.equal(formatPhoneDisplay("+15085001095"), "(508) 500-1095");
  assert.equal(formatPhoneDisplay("+55 11 91234-5678"), "+55 11 91234-5678");
});
