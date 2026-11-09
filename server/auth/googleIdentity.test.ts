import test from "node:test";
import assert from "node:assert/strict";
import { googleAuthConfig, identityFromVerifiedClaims } from "./googleIdentity.js";

const phoneClaims = {
  sub: "uid-phone-1",
  phone_number: "+15085550100",
  firebase: { sign_in_provider: "phone", identities: { phone: ["+15085550100"] } },
};
const googleClaims = {
  sub: "uid-google-1",
  email: "Ana@Example.com",
  email_verified: true,
  name: "Ana",
  firebase: { sign_in_provider: "google.com" },
};

test("a phone token yields the verified E.164 phone", () => {
  assert.deepEqual(identityFromVerifiedClaims(phoneClaims), {
    uid: "uid-phone-1",
    provider: "phone",
    phone: "+15085550100",
    email: undefined,
    name: undefined,
  });
});

test("a phone token without a valid phone is refused", () => {
  assert.throws(() => identityFromVerifiedClaims({ ...phoneClaims, phone_number: undefined }), /phone/i);
  assert.throws(() => identityFromVerifiedClaims({ ...phoneClaims, phone_number: "5085550100" }), /phone/i);
  assert.throws(() => identityFromVerifiedClaims({ ...phoneClaims, phone_number: "+0123456789" }), /phone/i);
});

test("a Google token yields its email only when Google verified it", () => {
  assert.equal(identityFromVerifiedClaims(googleClaims).email, "Ana@Example.com");
  assert.equal(identityFromVerifiedClaims(googleClaims).name, "Ana");
  assert.equal(identityFromVerifiedClaims({ ...googleClaims, email_verified: false }).email, undefined);
  assert.equal(identityFromVerifiedClaims({ ...googleClaims, email_verified: "true" }).email, undefined);
});

test("other sign-in providers are refused", () => {
  for (const provider of ["password", "anonymous", "custom", "facebook.com", undefined]) {
    assert.throws(
      () => identityFromVerifiedClaims({ ...googleClaims, firebase: { sign_in_provider: provider } }),
      /Unsupported/,
      String(provider),
    );
  }
  assert.throws(() => identityFromVerifiedClaims({ ...googleClaims, firebase: undefined }), /Unsupported/);
});

test("a token from a Firebase tenant is refused", () => {
  assert.throws(
    () => identityFromVerifiedClaims({ ...googleClaims, firebase: { sign_in_provider: "google.com", tenant: "t-1" } }),
    /Unsupported/,
  );
});

test("the subject must be a short string", () => {
  assert.throws(() => identityFromVerifiedClaims({ ...googleClaims, sub: undefined }), /Unsupported/);
  assert.throws(() => identityFromVerifiedClaims({ ...googleClaims, sub: 42 }), /Unsupported/);
  assert.throws(() => identityFromVerifiedClaims({ ...googleClaims, sub: "x".repeat(129) }), /Unsupported/);
  assert.equal(identityFromVerifiedClaims({ ...googleClaims, sub: "x".repeat(128) }).uid.length, 128);
});

test("config is off by default and fails closed when enabled but incomplete", () => {
  const keys = [
    "GOOGLE_AUTH_ENABLED",
    "GOOGLE_AUTH_PROJECT_ID",
    "FIREBASE_API_KEY",
    "FIREBASE_AUTH_DOMAIN",
    "GOOGLE_WEB_CLIENT_ID",
  ];
  const saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  try {
    for (const key of keys) delete process.env[key];
    assert.equal(googleAuthConfig().enabled, false);
    process.env.GOOGLE_AUTH_ENABLED = "true";
    assert.throws(() => googleAuthConfig(), /incomplete/);
    process.env.GOOGLE_AUTH_PROJECT_ID = "skaleclub";
    process.env.FIREBASE_API_KEY = "k";
    process.env.FIREBASE_AUTH_DOMAIN = "skaleclub.firebaseapp.com";
    process.env.GOOGLE_WEB_CLIENT_ID = "id.apps.googleusercontent.com";
    assert.equal(googleAuthConfig().enabled, true);
    assert.equal(googleAuthConfig().projectId, "skaleclub");
  } finally {
    for (const key of keys) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
});
