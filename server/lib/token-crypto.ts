// server/lib/token-crypto.ts
//
// SOURCE OF TRUTH: xkedule/server/lib/token-crypto.ts — sync changes back.
// Ported here as part of the auto-blog parity work (autoblog-parity SC-10,
// MASTER D-06). The salt differs per product on purpose: the same SESSION_SECRET
// must not derive the same key in two codebases.
//
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

// Centralized AES-256-GCM encryption for secrets stored at rest. In this repo
// the caller is chat_integrations.api_key (OpenAI / Gemini / OpenRouter), which
// includes the key the blog generator bills against.
//
// Every caller shares the SAME key, so rotating TOKEN_ENCRYPTION_KEY — or
// relying on the SESSION_SECRET-derived fallback below and then rotating
// SESSION_SECRET — makes ALL stored secrets undecryptable at once, not just
// one feature. Set TOKEN_ENCRYPTION_KEY explicitly to decouple the two.
//
// Envelope format (self-describing, single string that fits the existing `text`
// columns): `v1:<iv_b64>:<tag_b64>:<ciphertext_b64>` — 4 colon-separated parts,
// the first literally `v1`. A random IV per value + the GCM auth tag stored
// alongside the ciphertext makes each write tamper-evident and non-deterministic.
//
// Backward compatibility: a value WITHOUT the `v1:` prefix is legacy plaintext
// and is returned unchanged on decrypt (lazy backfill — callers re-encrypt on
// the next write). A `v1:` value that fails authentication THROWS so the caller
// can flag reconnect rather than silently using garbage.

const VERSION = "v1";
const ALGO = "aes-256-gcm";
const IV_BYTES = 12; // standard GCM nonce length
const KEY_DERIVATION_SALT = "skaleclub-token-crypto-v1"; // fixed salt is fine: SESSION_SECRET is the entropy

let cachedKey: Buffer | null = null;

function resolveKey(): Buffer {
  if (cachedKey) return cachedKey;
  const explicit = process.env.TOKEN_ENCRYPTION_KEY?.trim();
  if (explicit) {
    // accept base64 or hex; must decode to exactly 32 bytes
    const asHex = /^[0-9a-fA-F]{64}$/.test(explicit) ? Buffer.from(explicit, "hex") : null;
    const asB64 = (() => {
      try {
        const b = Buffer.from(explicit, "base64");
        return b.length === 32 ? b : null;
      } catch {
        return null;
      }
    })();
    const buf = asHex ?? asB64;
    if (!buf || buf.length !== 32) {
      throw new Error("TOKEN_ENCRYPTION_KEY must be a 32-byte key encoded as hex (64 chars) or base64.");
    }
    cachedKey = buf;
    return cachedKey;
  }
  const sessionSecret = process.env.SESSION_SECRET?.trim();
  if (!sessionSecret) {
    throw new Error("Token encryption requires TOKEN_ENCRYPTION_KEY or SESSION_SECRET to be set.");
  }
  cachedKey = scryptSync(sessionSecret, KEY_DERIVATION_SALT, 32);
  return cachedKey;
}

export function isEncryptedToken(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith(`${VERSION}:`);
}

export function encryptToken(plaintext: string): string {
  const key = resolveKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${VERSION}:${iv.toString("base64")}:${tag.toString("base64")}:${ct.toString("base64")}`;
}

// Returns plaintext. Legacy (non-v1:) values pass through unchanged. A v1: value
// that cannot be decrypted THROWS (caller decides whether to flag reconnect).
export function decryptToken(value: string): string {
  if (!isEncryptedToken(value)) return value; // legacy plaintext passthrough
  const parts = value.split(":");
  if (parts.length !== 4) throw new Error("Malformed encrypted token envelope");
  const [, ivB64, tagB64, ctB64] = parts;
  const key = resolveKey();
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const ct = Buffer.from(ctB64, "base64");
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]); // throws on auth-tag mismatch
  return pt.toString("utf8");
}
