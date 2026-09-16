/**
 * Auto-blog parity SC-10 — the envelope that now protects chat_integrations
 * api keys at rest, including the OpenRouter key the blog generator bills
 * against. Ported with server/lib/token-crypto.ts from Xkedule.
 *
 * The two properties that matter operationally are the lazy backfill (a value
 * written before this landed must keep working) and the refusal to silently
 * return garbage on a tampered or wrongly-keyed value.
 */
import test from "node:test";
import { strict as assert } from "node:assert";

process.env.SESSION_SECRET ||= "test-session-secret-for-token-crypto";

const { encryptToken, decryptToken, isEncryptedToken } = await import("../../lib/token-crypto.js");

test("a round trip returns exactly what went in", () => {
  const secret = "sk-or-v1-abcdef0123456789";
  const envelope = encryptToken(secret);
  assert.notEqual(envelope, secret, "the stored value is not the plaintext");
  assert.equal(decryptToken(envelope), secret);
});

test("the same input encrypts differently every time", () => {
  // A random IV per write is what stops two tenants with the same key being
  // identifiable from the ciphertext alone.
  const a = encryptToken("same");
  const b = encryptToken("same");
  assert.notEqual(a, b);
  assert.equal(decryptToken(a), decryptToken(b));
});

test("legacy plaintext decrypts unchanged — this is the lazy backfill", () => {
  // Every key stored before this shipped has no v1: prefix. If this threw, the
  // migration would have to be a flag day.
  assert.equal(decryptToken("sk-plaintext-from-before"), "sk-plaintext-from-before");
  assert.equal(isEncryptedToken("sk-plaintext-from-before"), false);
});

test("an envelope is recognisable, so a re-encrypt does not double-wrap", () => {
  assert.equal(isEncryptedToken(encryptToken("x")), true);
  assert.equal(isEncryptedToken(null), false);
  assert.equal(isEncryptedToken(undefined), false);
});

test("a tampered envelope throws rather than returning garbage", () => {
  // Silently handing back a corrupted key would show up as an unexplained
  // provider error days later; failing here names the real problem.
  const envelope = encryptToken("sk-real");
  const parts = envelope.split(":");
  parts[3] = Buffer.from("tampered").toString("base64");
  assert.throws(() => decryptToken(parts.join(":")));
});
