import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "net";
import { registerPasskeyRoutes } from "../passkeys.js";
import { resolveRelyingParty } from "../../lib/auth/webauthnConfig.js";
import {
  TRUSTED_RENEW_INTERVAL_MS,
  TRUSTED_SESSION_TTL_MS,
  deviceNameFromUserAgent,
  hashSessionId,
  markSessionTrusted,
  sanitizeDeviceName,
  shouldRenewTrusted,
  trustedSessionRenewal,
} from "../../lib/auth/trustedSession.js";

const ID = "11111111-1111-4111-8111-111111111111";

test("admin-only auth endpoints refuse anonymous callers", async () => {
  const app = express();
  app.use(express.json());
  registerPasskeyRoutes(app); // no session middleware: requireAdmin must stop these
  const server = app.listen(0);
  try {
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const calls: Array<[string, string]> = [
      ["POST", "/api/auth/trust-device"],
      ["GET", "/api/auth/trusted-devices"],
      ["DELETE", "/api/auth/trusted-devices/abc"],
      ["POST", "/api/auth/passkeys/register/options"],
      ["POST", "/api/auth/passkeys/register/verify"],
      ["POST", "/api/auth/passkeys/reauth/options"],
      ["POST", "/api/auth/passkeys/reauth/verify"],
      ["GET", "/api/auth/passkeys"],
      ["DELETE", `/api/auth/passkeys/${ID}`],
    ];
    for (const [method, path] of calls) {
      const res = await fetch(base + path, {
        method,
        headers: { "content-type": "application/json" },
        body: method === "POST" ? "{}" : undefined,
      });
      assert.equal(res.status, 401, `${method} ${path}`);
    }
  } finally {
    server.close();
  }
});

test("resolveRelyingParty maps hosts and refuses unknown ones", () => {
  const prod = { production: true };
  for (const host of ["skale.club", "www.skale.club", "skaleclub-stage.skale.club"]) {
    const rp = resolveRelyingParty(host, prod);
    assert.equal(rp?.rpID, "skale.club");
    assert.ok(rp?.origins.includes("https://skale.club"));
    assert.ok(rp?.origins.includes("https://skaleclub-stage.skale.club"));
  }
  assert.equal(resolveRelyingParty("localhost", prod), null);
  assert.equal(resolveRelyingParty("evil.com", prod), null);
  assert.equal(resolveRelyingParty("skale.club.evil.com", prod), null);
  assert.equal(resolveRelyingParty(undefined, prod), null);
  const dev = resolveRelyingParty("localhost", { production: false });
  assert.equal(dev?.rpID, "localhost");
  assert.deepEqual(dev?.origins, ["http://localhost:1000"]);
});

test("trusted session TTL, renewal window and marking", () => {
  assert.equal(TRUSTED_SESSION_TTL_MS, 180 * 86_400_000);
  const now = 1_000_000_000_000;
  assert.equal(shouldRenewTrusted(undefined, now), false);
  assert.equal(shouldRenewTrusted({ lastSeen: now - 1000 }, now), false);
  assert.equal(shouldRenewTrusted({ lastSeen: now - TRUSTED_RENEW_INTERVAL_MS }, now), true);

  const req: any = { session: { cookie: { maxAge: 7 * 86_400_000 } } };
  const t = markSessionTrusted(req, "iPhone Safari", now);
  assert.equal(req.session.cookie.maxAge, TRUSTED_SESSION_TTL_MS);
  assert.equal(t.createdAt, now);
  assert.equal(req.session.trusted.name, "iPhone Safari");
  // marking again keeps the original createdAt
  const again = markSessionTrusted(req, "iPhone Safari", now + 5);
  assert.equal(again.createdAt, now);
});

test("trustedSessionRenewal leaves plain sessions alone and renews stale trusted ones", () => {
  const plain: any = { session: { userId: "u", cookie: { maxAge: 7 * 86_400_000 } } };
  trustedSessionRenewal(plain, {} as any, () => {});
  assert.equal(plain.session.cookie.maxAge, 7 * 86_400_000);

  const fresh: any = { session: { userId: "u", trusted: { lastSeen: Date.now() }, cookie: { maxAge: 1 } } };
  trustedSessionRenewal(fresh, {} as any, () => {});
  assert.equal(fresh.session.cookie.maxAge, 1);

  const stale: any = { session: { userId: "u", trusted: { lastSeen: Date.now() - 2 * TRUSTED_RENEW_INTERVAL_MS }, cookie: { maxAge: 1 } } };
  let called = false;
  trustedSessionRenewal(stale, {} as any, () => { called = true; });
  assert.ok(called);
  assert.equal(stale.session.cookie.maxAge, TRUSTED_SESSION_TTL_MS);
});

test("device name helpers", () => {
  assert.equal(sanitizeDeviceName("  Meu iPhone  "), "Meu iPhone");
  assert.equal(sanitizeDeviceName("x".repeat(200)).length, 80);
  assert.equal(
    sanitizeDeviceName(undefined, "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit Version/17 Safari/604"),
    "iPhone Safari",
  );
  assert.equal(deviceNameFromUserAgent(undefined), "Aparelho");
  assert.equal(hashSessionId("abc").length, 24);
  assert.notEqual(hashSessionId("abc"), hashSessionId("abd"));
});
