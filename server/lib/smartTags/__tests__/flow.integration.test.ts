// End-to-end Smart Tags flow against a real Postgres. Skipped unless
// SMART_TAG_INTEGRATION=1 and DATABASE_URL points at a disposable database
// that has supabase/migrations/20261001120000_smart_tags.sql applied plus a
// `users` table with an admin 'admin-1' and a non-admin 'user-2':
//
//   SMART_TAG_INTEGRATION=1 DATABASE_URL=postgresql://postgres@127.0.0.1:5433/st \
//     npx tsx --test server/lib/smartTags/__tests__/flow.integration.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "net";
import { unzipSync, strFromU8 } from "fflate";

const enabled = process.env.SMART_TAG_INTEGRATION === "1";
const PHONE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

test("smart tags: batch → assign → activate → redirect → analytics → lifecycle", { skip: !enabled }, async () => {
  const { registerSmartTagAdminRoutes, registerSmartTagPublicRoutes } = await import("../../../routes/smartTags.js");
  const { db, pool } = await import("../../../db.js");
  const { sql } = await import("drizzle-orm");

  await db.execute(sql`TRUNCATE smart_tag_events, smart_tag_destination_history, smart_tags, smart_tag_batches, smart_tag_customers CASCADE`);

  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).session = { userId: req.get("x-test-user") };
    next();
  });
  registerSmartTagPublicRoutes(app);
  registerSmartTagAdminRoutes(app);
  const server = app.listen(0);
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  const api = async (method: string, path: string, body?: unknown, user = "admin-1") => {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: { "content-type": "application/json", "x-test-user": user },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch { /* binary/csv */ }
    return { status: res.status, json, text, res };
  };
  const scan = (path: string, method = "GET") =>
    fetch(`${base}${path}`, { method, redirect: "manual", headers: { "user-agent": PHONE_UA } });
  const settle = () => new Promise((r) => setTimeout(r, 150)); // event write happens after the response

  try {
    // Non-admin cannot mutate.
    assert.equal((await api("POST", "/api/admin/smart-tag-batches", { name: "x", productType: "custom", quantity: 1 }, "user-2")).status, 403);

    // Batch of 100 inventory tags.
    const batch = await api("POST", "/api/admin/smart-tag-batches", { name: "First run", productType: "google_review_sign", quantity: 100, vendor: "Shenzhen Co" });
    assert.equal(batch.status, 201, batch.text);
    assert.match(batch.json.batchCode, /^REV-\d{4}-001$/);
    const detail = await api("GET", `/api/admin/smart-tag-batches/${batch.json.id}`);
    const tags = detail.json.tags as Array<{ id: string; publicCode: string; serialNumber: number; status: string; customerId: string | null }>;
    assert.equal(tags.length, 100);
    assert.equal(new Set(tags.map((t) => t.publicCode)).size, 100);
    assert.deepEqual(tags.map((t) => t.serialNumber), Array.from({ length: 100 }, (_, i) => i + 1));
    assert.ok(tags.every((t) => t.status === "inventory" && t.customerId === null));

    // Duplicate batch code → 409.
    assert.equal((await api("POST", "/api/admin/smart-tag-batches", { name: "dup", batchCode: batch.json.batchCode, productType: "keychain", quantity: 1 })).status, 409);

    // Manufacturing CSV + ZIP.
    const csv = await api("GET", `/api/admin/smart-tag-batches/${batch.json.id}/export.csv`);
    const lines = csv.text.trim().split("\r\n");
    assert.equal(lines.length, 101);
    const first = tags[0].publicCode;
    assert.equal(lines[1], `${batch.json.batchCode},001,${first},https://skale.club/q/${first},https://skale.club/n/${first},${first}.svg`);
    const zipRes = await fetch(`${base}/api/admin/smart-tag-batches/${batch.json.id}/qr-assets.zip`, { headers: { "x-test-user": "admin-1" } });
    const zip = unzipSync(new Uint8Array(await zipRes.arrayBuffer()));
    assert.equal(Object.keys(zip).filter((f) => f.endsWith(".svg")).length, 100);
    assert.equal(strFromU8(zip[`${batch.json.batchCode}/manifest.csv`]).trim().split("\r\n").length, 101);

    const tag = tags[0];

    // Lookup by a hand-typed lowercase code.
    const lookup = await api("GET", `/api/admin/smart-tags/lookup/${tag.publicCode.toLowerCase()}`);
    assert.equal(lookup.json.id, tag.id);

    // Inventory scan: activation page, no redirect.
    const inv = await scan(`/q/${tag.publicCode}`);
    assert.equal(inv.status, 200);
    assert.match(await inv.text(), /not been activated/);

    // Assign (creating the customer inline), then activation is blocked until a destination exists.
    const assigned = await api("POST", `/api/admin/smart-tags/${tag.id}/assign`, { customer: { businessName: "John's Barber Shop", phone: "+1 508 500 1095" } });
    assert.equal(assigned.status, 200, assigned.text);
    assert.equal(assigned.json.status, "assigned");
    const customerId = assigned.json.customerId;
    assert.equal((await api("POST", `/api/admin/smart-tags/${tag.id}/activate`)).status, 409);

    // Dangerous scheme rejected; a valid review link is stored with history.
    assert.equal((await api("PATCH", `/api/admin/smart-tags/${tag.id}`, { destinationType: "google_review", destinationUrl: "javascript:alert(1)" })).status, 400);
    const review = "https://g.page/r/CXjohns/review";
    const patched = await api("PATCH", `/api/admin/smart-tags/${tag.id}`, { destinationType: "google_review", destinationUrl: review });
    assert.equal(patched.status, 200, patched.text);
    assert.equal(patched.json.history.length, 1);

    // Activate → QR and NFC both 302 to the review link.
    const active = await api("POST", `/api/admin/smart-tags/${tag.id}/activate`);
    assert.equal(active.json.status, "active");
    let r = await scan(`/q/${tag.publicCode}`);
    assert.equal(r.status, 302);
    assert.equal(r.headers.get("location"), review);
    assert.equal(r.headers.get("cache-control"), "no-store");
    r = await scan(`/n/${tag.publicCode}`);
    assert.equal(r.headers.get("location"), review);
    await scan(`/q/${tag.publicCode}`, "HEAD"); // not counted
    await settle();

    // Destination change: same physical URLs, new target, history grows.
    const site = "https://johnsbarber.com/book";
    const changed = await api("PATCH", `/api/admin/smart-tags/${tag.id}`, { destinationType: "booking", destinationUrl: site, utmEnabled: true, utmCampaign: "Johns Barber", reason: "Moved to booking" });
    assert.equal(changed.json.history.length, 2);
    assert.equal(changed.json.history[0].reason, "Moved to booking");
    assert.equal(changed.json.history[0].changedByEmail, "admin@skale.club");
    r = await scan(`/n/${tag.publicCode}`);
    const target = new URL(r.headers.get("location")!);
    assert.equal(`${target.origin}${target.pathname}`, site);
    assert.equal(target.searchParams.get("utm_medium"), "nfc");
    assert.equal(target.searchParams.get("utm_campaign"), "johns-barber");
    await settle();

    // History rows cannot be edited, even directly in SQL.
    await assert.rejects(
      db.execute(sql`UPDATE smart_tag_destination_history SET reason = 'x'`),
      // Drizzle wraps the driver error; the trigger's message is on `cause`.
      (err: Error) => /immutable/.test(`${err.message} ${(err.cause as Error | undefined)?.message ?? ""}`),
    );

    // An active tag cannot lose its destination or move to another customer.
    assert.equal((await api("PATCH", `/api/admin/smart-tags/${tag.id}`, { destinationUrl: null })).status, 400);
    const other = await api("POST", "/api/admin/smart-tag-customers", { businessName: "Other Co", email: "" });
    assert.equal(other.status, 201, other.text);
    assert.equal((await api("POST", `/api/admin/smart-tags/${tag.id}/assign`, { customerId: other.json.id })).status, 409);

    // Disable → unavailable; re-activate → redirects again.
    await api("POST", `/api/admin/smart-tags/${tag.id}/disable`);
    assert.equal((await scan(`/q/${tag.publicCode}`)).status, 410);
    await api("POST", `/api/admin/smart-tags/${tag.id}/activate`);
    assert.equal((await scan(`/q/${tag.publicCode}`)).status, 302);
    await settle();

    // Analytics: QR scans and NFC taps counted separately; HEAD and inactive scans are not interactions.
    const analytics = await api("GET", `/api/admin/smart-tags/${tag.id}/analytics?range=today`);
    assert.equal(analytics.status, 200, analytics.text);
    assert.equal(analytics.json.totals.qr, 2);
    assert.equal(analytics.json.totals.nfc, 2);
    assert.equal(analytics.json.totals.interactions, 4);
    assert.equal(analytics.json.totals.approxUnique, 1);
    assert.equal(analytics.json.totals.inactiveScans, 2); // inventory + disabled
    const rawIp = await db.execute(sql`SELECT count(*)::int AS n FROM smart_tag_events WHERE visitor_day_key LIKE '%127.0.0.1%' OR referrer LIKE '%127.0.0.1%'`);
    assert.equal((rawIp.rows[0] as any).n, 0);

    const customerAnalytics = await api("GET", `/api/admin/smart-tags/analytics?customerId=${customerId}`);
    assert.equal(customerAnalytics.json.totals.interactions, 4);
    const batchAnalytics = await api("GET", `/api/admin/smart-tags/analytics?batchId=${batch.json.id}`);
    assert.equal(batchAnalytics.json.totals.interactions, 4);
    assert.equal(batchAnalytics.json.topTags[0].publicCode, tag.publicCode);

    const overview = await api("GET", "/api/admin/smart-tags/overview");
    assert.equal(overview.json.counts.total, 100);
    assert.equal(overview.json.counts.active, 1);
    assert.equal(overview.json.counts.inventory, 99);
    assert.equal(overview.json.interactions.today, 4);
    assert.equal(overview.json.split30.qr, 2);
    assert.ok(overview.json.recentEvents.length >= 4);
    assert.equal(overview.json.recentActivations[0].publicCode, tag.publicCode);

    const customers = await api("GET", "/api/admin/smart-tag-customers");
    const john = customers.json.find((c: any) => c.id === customerId);
    assert.deepEqual([john.tagCount, john.activeTags, john.interactions], [1, 1, 4]);

    const list = await api("GET", `/api/admin/smart-tags?search=${encodeURIComponent("barber")}`);
    assert.equal(list.json.length, 1);
    assert.equal(list.json[0].qrInteractions, 2);
    assert.equal((await api("GET", "/api/admin/smart-tags?status=inventory")).json.length, 99);
    assert.equal((await api("GET", "/api/admin/smart-tags?method=nfc")).json.length, 1);

    const batches = await api("GET", "/api/admin/smart-tag-batches");
    assert.deepEqual([batches.json[0].inventoryCount, batches.json[0].assignedCount, batches.json[0].activeCount], [99, 1, 1]);

    // Retire is terminal until an explicit restore.
    await api("POST", `/api/admin/smart-tags/${tag.id}/retire`);
    assert.equal((await scan(`/q/${tag.publicCode}`)).status, 410);
    assert.equal((await api("POST", `/api/admin/smart-tags/${tag.id}/activate`)).status, 409);
    assert.equal((await api("PATCH", `/api/admin/smart-tags/${tag.id}`, { label: "x" })).status, 400);
    const restored = await api("POST", `/api/admin/smart-tags/${tag.id}/restore`);
    assert.equal(restored.json.status, "assigned");

    // Unassign returns a clean inventory piece; history records the clearing.
    const back = await api("POST", `/api/admin/smart-tags/${tag.id}/unassign`);
    assert.equal(back.json.status, "inventory");
    assert.equal(back.json.customerId, null);
    assert.equal(back.json.destinationUrl, null);
    assert.equal(back.json.utmEnabled, false);
    assert.equal(back.json.history.length, 3);
    // Past interactions stay with the customer who owned the piece then.
    assert.equal((await api("GET", `/api/admin/smart-tags/analytics?customerId=${customerId}`)).json.totals.interactions, 4);

    // Standalone tag + QR image endpoint.
    const single = await api("POST", "/api/admin/smart-tags", { productType: "business_card", label: "Vanildo card" });
    assert.equal(single.status, 201, single.text);
    assert.equal(single.json.status, "inventory");
    assert.equal(single.json.qrUrl, `https://skale.club/q/${single.json.publicCode}`);
    const svg = await fetch(`${base}/api/admin/smart-tags/${single.json.id}/qr.svg`, { headers: { "x-test-user": "admin-1" } });
    assert.equal(svg.headers.get("content-type"), "image/svg+xml; charset=utf-8");

    // Validation errors are 4xx with a readable message.
    const bad = await api("POST", "/api/admin/smart-tag-batches", { name: "x", productType: "nope", quantity: 5000 });
    assert.equal(bad.status, 400);
    assert.ok(typeof bad.json.message === "string");
  } finally {
    server.close();
    await pool.end();
  }
});
