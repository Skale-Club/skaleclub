// Desktop NFC provisioning against a real Postgres. Skipped unless
// SMART_TAG_INTEGRATION=1 (see flow.integration.test.ts for the database setup;
// it also needs supabase/migrations/20261001130000_smart_tag_provisioning.sql).
import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "net";

const enabled = process.env.SMART_TAG_INTEGRATION === "1";

test("provisioning: pair → job → write → server-verified → tap QA → revoke", { skip: !enabled }, async () => {
  const { registerSmartTagAdminRoutes, registerSmartTagPublicRoutes } = await import("../../../routes/smartTags.js");
  const { registerSmartTagProvisioningRoutes } = await import("../../../routes/smartTagProvisioning.js");
  const { db, pool } = await import("../../../db.js");
  const { sql } = await import("drizzle-orm");

  await db.execute(sql`TRUNCATE smart_tag_provisioning_events, smart_tag_provisioning_jobs, smart_tag_provisioning_devices,
    smart_tag_events, smart_tag_destination_history, smart_tags, smart_tag_batches, smart_tag_customers CASCADE`);

  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).session = { userId: req.get("x-test-user") };
    next();
  });
  registerSmartTagPublicRoutes(app);
  registerSmartTagAdminRoutes(app);
  registerSmartTagProvisioningRoutes(app);
  const server = app.listen(0);
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  const call = async (method: string, path: string, opts: { body?: unknown; user?: string; token?: string; protocol?: string | null } = {}) => {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (opts.user) headers["x-test-user"] = opts.user;
    if (opts.token) headers.authorization = `Bearer ${opts.token}`;
    if (opts.protocol !== null) headers["x-provisioner-protocol"] = opts.protocol ?? "1";
    const res = await fetch(`${base}${path}`, { method, headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) });
    const text = await res.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch { /* empty */ }
    return { status: res.status, json, text };
  };
  const admin = (method: string, path: string, body?: unknown) => call(method, path, { body, user: "admin-1" });

  try {
    // A batch of 3 tags to program.
    const batch = await admin("POST", "/api/admin/smart-tag-batches", { name: "NFC run", productType: "google_review_sign", quantity: 3 });
    const tags = (await admin("GET", `/api/admin/smart-tag-batches/${batch.json.id}`)).json.tags;
    const [t1, t2, t3] = tags;
    assert.equal(t1.nfcStatus, "not_programmed");

    // ── Pairing ──
    assert.equal((await call("POST", "/api/admin/smart-tag-provisioners", { body: { deviceName: "x" }, user: "user-2" })).status, 403);
    const pairing = await admin("POST", "/api/admin/smart-tag-provisioners", { deviceName: "Workshop PC" });
    assert.equal(pairing.status, 201, pairing.text);
    assert.match(pairing.json.pairingCode, /^[0-9A-Z]{4}-[0-9A-Z]{4}$/);
    assert.equal((await call("POST", "/api/provisioner/pair", { body: { pairingCode: "ZZZZ-ZZZZ" } })).status, 401);
    assert.equal((await call("POST", "/api/provisioner/pair", { body: { pairingCode: pairing.json.pairingCode }, protocol: "0" })).status, 426);
    const paired = await call("POST", "/api/provisioner/pair", {
      body: { pairingCode: pairing.json.pairingCode.toLowerCase(), platform: "win32", appVersion: "0.1.0" },
    });
    assert.equal(paired.status, 201, paired.text);
    const tokenA: string = paired.json.token;
    assert.match(tokenA, /^snp_/);
    assert.equal(paired.json.device.deviceName, "Workshop PC");
    // Codes are single-use.
    assert.equal((await call("POST", "/api/provisioner/pair", { body: { pairingCode: pairing.json.pairingCode } })).status, 401);
    // The device token is not an admin credential.
    assert.equal((await call("GET", "/api/admin/smart-tags", { token: tokenA })).status, 401);
    assert.equal((await call("GET", "/api/provisioner/session", { token: "snp_nope" })).status, 401);
    assert.equal((await call("GET", "/api/provisioner/session", { token: tokenA, protocol: null })).status, 426);
    const session = await call("GET", "/api/provisioner/session", { token: tokenA });
    assert.equal(session.json.device.deviceName, "Workshop PC");
    // Only hashes are stored.
    const stored = await db.execute(sql`SELECT token_hash, token_prefix FROM smart_tag_provisioning_devices WHERE status = 'active'`);
    assert.notEqual((stored.rows[0] as any).token_hash, tokenA);

    // Second device for targeting / race tests.
    const pairingB = await admin("POST", "/api/admin/smart-tag-provisioners", { deviceName: "Laptop" });
    const tokenB = (await call("POST", "/api/provisioner/pair", { body: { pairingCode: pairingB.json.pairingCode } })).json.token;

    // ── Nothing to do yet ──
    assert.equal((await call("POST", "/api/provisioner/jobs/claim", { token: tokenA })).status, 204);

    // ── Job 1: a write whose read-back does not match is rejected by the server ──
    const created = await admin("POST", `/api/admin/smart-tags/${t1.id}/provisioning-jobs`, {});
    assert.equal(created.status, 201, created.text);
    assert.equal(created.json.jobs[0].status, "pending");
    const claim1 = await call("POST", "/api/provisioner/jobs/claim", { token: tokenA });
    assert.equal(claim1.status, 200);
    assert.equal(claim1.json.expectedUrl, `https://skale.club/n/${t1.publicCode}`);
    assert.equal(claim1.json.publicCode, t1.publicCode);
    // The other device cannot take the same job.
    assert.equal((await call("POST", "/api/provisioner/jobs/claim", { token: tokenB })).status, 204);
    // …nor report on it.
    assert.equal((await call("POST", `/api/provisioner/jobs/${claim1.json.id}/complete`, { token: tokenB, body: { outcome: "succeeded", readbackUrl: claim1.json.expectedUrl } })).status, 404);
    // Restarting the app resumes the held job.
    assert.equal((await call("POST", "/api/provisioner/jobs/claim", { token: tokenA })).json.id, claim1.json.id);

    const ev = await call("POST", "/api/provisioner/events", { token: tokenA, body: { jobId: claim1.json.id, type: "write_started", detail: { tagType: "NTAG213", blob: { nested: true } } } });
    assert.equal(ev.json.jobStatus, "writing");
    assert.equal((await call("POST", "/api/provisioner/events", { token: tokenA, body: { jobId: claim1.json.id, type: "write_completed" } })).json.jobStatus, "verifying");
    const wrong = await call("POST", `/api/provisioner/jobs/${claim1.json.id}/complete`, {
      token: tokenA,
      body: { outcome: "succeeded", readbackUrl: `https://skale.club/n/${t2.publicCode}`, tagType: "NTAG213" },
    });
    assert.equal(wrong.json.status, "failed");
    assert.equal(wrong.json.errorCode, "verification_mismatch");
    let state = (await admin("GET", `/api/admin/smart-tags/${t1.id}/provisioning`)).json;
    assert.equal(state.status, "failed");
    assert.deepEqual(state.jobs[0].events.map((e: any) => e.type), ["job_created", "job_claimed", "write_started", "write_completed", "verification_failed"]);
    // Nested objects in event detail are dropped (no blobs stored).
    assert.deepEqual(state.jobs[0].events[2].detail, { tagType: "NTAG213" });
    // Closed jobs cannot be reported again.
    assert.equal((await call("POST", `/api/provisioner/jobs/${claim1.json.id}/complete`, { token: tokenA, body: { outcome: "succeeded", readbackUrl: claim1.json.expectedUrl } })).status, 409);

    // ── Job 2: correct write → verified ──
    await admin("POST", `/api/admin/smart-tags/${t1.id}/provisioning-jobs`, {});
    const claim2 = await call("POST", "/api/provisioner/jobs/claim", { token: tokenA });
    await call("POST", "/api/provisioner/events", { token: tokenA, body: { jobId: claim2.json.id, type: "write_started" } });
    const ok = await call("POST", `/api/provisioner/jobs/${claim2.json.id}/complete`, {
      token: tokenA,
      body: { outcome: "succeeded", readbackUrl: claim2.json.expectedUrl, tagType: "NTAG215" },
    });
    assert.equal(ok.json.status, "succeeded");
    state = (await admin("GET", `/api/admin/smart-tags/${t1.id}/provisioning`)).json;
    assert.equal(state.status, "verified");
    assert.equal(state.deviceName, "Workshop PC");
    assert.ok(state.verifiedAt);
    assert.equal(state.tapTestAt, null);

    // Final QA: a real tap and scan after verification show up on the tag.
    await fetch(`${base}/n/${t1.publicCode}`, { redirect: "manual", headers: { "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) Mobile/15E148 Safari/604.1" } });
    await fetch(`${base}/q/${t1.publicCode}`, { redirect: "manual", headers: { "user-agent": "Mozilla/5.0 (Linux; Android 14) Chrome/126.0 Mobile Safari/537.36" } });
    await new Promise((r) => setTimeout(r, 150));
    state = (await admin("GET", `/api/admin/smart-tags/${t1.id}/provisioning`)).json;
    assert.ok(state.tapTestAt, "nfc tap recorded after verification");
    assert.ok(state.qrTestAt, "qr scan recorded after verification");

    // ── Failure before any write leaves the chip status alone ──
    await admin("POST", `/api/admin/smart-tags/${t2.id}/provisioning-jobs`, {});
    const claim3 = await call("POST", "/api/provisioner/jobs/claim", { token: tokenA });
    const early = await call("POST", `/api/provisioner/jobs/${claim3.json.id}/complete`, { token: tokenA, body: { outcome: "failed", errorCode: "unsupported_tag", errorMessage: "Mifare Classic" } });
    assert.equal(early.json.status, "failed");
    assert.equal((await admin("GET", `/api/admin/smart-tags/${t2.id}/provisioning`)).json.status, "not_programmed");

    // ── Targeted jobs only go to their device; re-sending supersedes ──
    const devices = (await admin("GET", "/api/admin/smart-tag-provisioners")).json;
    const laptop = devices.find((d: any) => d.deviceName === "Laptop");
    await admin("POST", `/api/admin/smart-tags/${t3.id}/provisioning-jobs`, { deviceId: laptop.id });
    assert.equal((await call("POST", "/api/provisioner/jobs/claim", { token: tokenA })).status, 204);
    await admin("POST", `/api/admin/smart-tags/${t3.id}/provisioning-jobs`, { deviceId: laptop.id });
    const t3jobs = (await admin("GET", `/api/admin/smart-tags/${t3.id}/provisioning`)).json.jobs;
    assert.deepEqual(t3jobs.map((j: any) => j.status), ["pending", "cancelled"]);
    const claimB = await call("POST", "/api/provisioner/jobs/claim", { token: tokenB });
    assert.equal(claimB.json.tagId, t3.id);

    // ── Expiry ──
    await db.execute(sql`UPDATE smart_tag_provisioning_jobs SET expires_at = now() - interval '1 minute' WHERE id = ${claimB.json.id}`);
    assert.equal((await call("POST", `/api/provisioner/jobs/${claimB.json.id}/complete`, { token: tokenB, body: { outcome: "succeeded", readbackUrl: claimB.json.expectedUrl } })).status, 409);
    assert.equal((await call("POST", "/api/provisioner/jobs/claim", { token: tokenB })).status, 204);
    const expired = (await admin("GET", `/api/admin/smart-tags/${t3.id}/provisioning`)).json.jobs[0];
    assert.deepEqual([expired.status, expired.errorCode], ["failed", "expired"]);

    // ── Revocation: token dies, open jobs are cancelled ──
    await admin("POST", `/api/admin/smart-tags/${t2.id}/provisioning-jobs`, {});
    const claimR = await call("POST", "/api/provisioner/jobs/claim", { token: tokenA });
    assert.equal(claimR.status, 200);
    const workshop = devices.find((d: any) => d.deviceName === "Workshop PC");
    const revoked = await admin("POST", `/api/admin/smart-tag-provisioners/${workshop.id}/revoke`);
    assert.equal(revoked.json.status, "revoked");
    assert.equal((await call("GET", "/api/provisioner/session", { token: tokenA })).status, 401);
    const afterRevoke = (await admin("GET", `/api/admin/smart-tags/${t2.id}/provisioning`)).json.jobs[0];
    assert.deepEqual([afterRevoke.status, afterRevoke.errorCode], ["cancelled", "device_revoked"]);
    // A revoked device cannot be targeted.
    assert.equal((await admin("POST", `/api/admin/smart-tags/${t2.id}/provisioning-jobs`, { deviceId: workshop.id })).status, 409);

    // ── Admin cancel ──
    await admin("POST", `/api/admin/smart-tags/${t2.id}/provisioning-jobs`, {});
    const open = (await admin("GET", `/api/admin/smart-tags/${t2.id}/provisioning`)).json.jobs[0];
    assert.equal((await admin("POST", `/api/admin/smart-tag-provisioning-jobs/${open.id}/cancel`)).json.status, "cancelled");
    assert.equal((await admin("POST", `/api/admin/smart-tag-provisioning-jobs/${open.id}/cancel`)).status, 409);

    // Lists surface the chip state.
    const list = (await admin("GET", `/api/admin/smart-tags?batchId=${batch.json.id}`)).json;
    assert.equal(list.find((t: any) => t.id === t1.id).nfcStatus, "verified");
    const batches = (await admin("GET", "/api/admin/smart-tag-batches")).json;
    assert.equal(batches[0].nfcVerifiedCount, 1);

    // A failed NFC write never touched the tag's destination or public URL.
    const t1detail = (await admin("GET", `/api/admin/smart-tags/${t1.id}`)).json;
    assert.equal(t1detail.nfcUrl, `https://skale.club/n/${t1.publicCode}`);
    assert.equal(t1detail.status, "inventory");
  } finally {
    server.close();
    await pool.end();
  }
});
