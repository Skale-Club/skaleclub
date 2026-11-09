import test from "node:test";
import assert from "node:assert/strict";
import { formatSignInPhone, normalizePhone } from "./signInPhone.js";

test("US numbers normalize to E.164 with +1 as the default", () => {
  assert.equal(normalizePhone("(508) 555-0100"), "+15085550100");
  assert.equal(normalizePhone("1 508 555 0100"), "+15085550100");
  assert.equal(normalizePhone("+1 508-555-0100"), "+15085550100");
});

test("Brazil numbers use the chosen dial code", () => {
  assert.equal(normalizePhone("(11) 98765-4321", "+55"), "+5511987654321");
  assert.equal(normalizePhone("+55 11 98765-4321", "1"), "+5511987654321");
});

test("things that are not phones are refused", () => {
  for (const bad of ["", "   ", "abc", "508-555", "+0123456789", "(508) 555-01000", "+1 508 555", null, undefined]) {
    assert.equal(normalizePhone(bad), null, String(bad));
  }
});

test("formatting reads back the stored form", () => {
  assert.equal(formatSignInPhone("+15085550100"), "+1 (508) 555-0100");
  assert.equal(formatSignInPhone("+5511987654321"), "+55 11 98765-4321");
  assert.equal(formatSignInPhone("+351912345678"), "+351912345678");
  assert.equal(formatSignInPhone(null), "");
});
