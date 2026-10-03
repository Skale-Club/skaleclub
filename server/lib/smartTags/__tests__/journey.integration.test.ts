// Smart Tags Journey against a real Postgres. Skipped unless
// SMART_TAG_INTEGRATION=1 and DATABASE_URL points at a disposable database
// with the smart_tag_* migrations applied (through 20261003150000_smart_tag_journey.sql)
// and a `users` table holding an admin 'admin-1':
//
//   SMART_TAG_INTEGRATION=1 DATABASE_URL=postgresql://postgres@127.0.0.1:5433/st \
//     npx tsx --test server/lib/smartTags/__tests__/journey.integration.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "net";

const enabled = process.env.SMART_TAG_INTEGRATION === "1";

test("journey: mutations leave a trail, entries and plans tell a scope's story", { skip: !enabled }, async () => {
  const repo = await import("../repository.js");
  const journey = await import("../journey.js");
  const { registerSmartTagAdminRoutes } = await import("../../../routes/smartTags.js");
  const { db, pool } = await import("../../../db.js");
  const { sql } = await import("drizzle-orm");

  await db.execute(sql`TRUNCATE smart_tag_journey_entries, smart_tag_plans, smart_tag_events, smart_tag_destination_history, smart_tags, smart_tag_batches, smart_tag_customers CASCADE`);

  try {
    // ── The site's own mutations write executions ────────────────────────────
    const batch = await repo.createBatch({ name: "Plaquinhas Google Small", productType: "google_review_sign", quantity: 2 }, null, "mcp");
    const [first, second] = await repo.listTags({ batchId: batch.id });
    const tagA = first.serialNumber === 1 ? first : second;
    const tagB = first.serialNumber === 1 ? second : first;

    let story = await journey.listJourneyEntries({ batchId: batch.id });
    assert.equal(story.length, 1);
    assert.equal(story[0].action, "batch_created");
    assert.equal(story[0].title, `Batch ${batch.batchCode} created: 2 × Google Review sign`);
    assert.equal(story[0].source, "mcp");
    assert.equal(story[0].actor, "ai");
    assert.equal(story[0].batchCode, batch.batchCode);

    const customer = await repo.createCustomer({ businessName: "Padaria Central" }, "admin-1");
    await repo.assignTag(tagA.id, customer.id, "admin-1");
    await repo.updateTag(tagA.id, { destinationType: "google_review", destinationUrl: "https://g.page/r/padaria/review", reason: "Client's review link" }, "admin-1");
    await repo.transitionTag(tagA.id, "activate", "admin-1");
    await repo.updateTag(tagA.id, { label: "Counter" }, "admin-1"); // no destination change → no entry
    await repo.updateBatch(batch.id, { status: "completed" }, "admin-1");
    await repo.updateBatch(batch.id, { notes: "no status change" }, "admin-1");

    const tagStory = await journey.listJourneyEntries({ tagId: tagA.id });
    const actions = tagStory.map((e) => e.action).reverse();
    // A tag's story includes the batch-wide entries of its batch.
    assert.deepEqual(actions, ["batch_created", "tag_assigned", "destination_changed", "tag_activated", "batch_status_changed"]);
    const assigned = tagStory.find((e) => e.action === "tag_assigned")!;
    assert.equal(assigned.title, `Tag ${tagA.publicCode} assigned to Padaria Central`);
    assert.equal(assigned.beforeValue, "inventory");
    assert.equal(assigned.afterValue, "assigned");
    assert.equal(assigned.actor, "human");
    assert.equal(assigned.actorEmail, "admin@skale.club");
    assert.equal(assigned.batchId, batch.id, "tag entries inherit the tag's batch");
    assert.equal(assigned.customerName, "Padaria Central");
    const dest = tagStory.find((e) => e.action === "destination_changed")!;
    assert.equal(dest.afterValue, "https://g.page/r/padaria/review");
    assert.equal(dest.content, "Client's review link");

    // Tag B's story has the batch-wide entries but none of tag A's.
    const bStory = await journey.listJourneyEntries({ tagId: tagB.id });
    assert.deepEqual(bStory.map((e) => e.action).sort(), ["batch_created", "batch_status_changed"]);

    const customerStory = await journey.listJourneyEntries({ customerId: customer.id });
    assert.ok(customerStory.some((e) => e.action === "customer_created"));
    assert.ok(customerStory.some((e) => e.action === "tag_activated"));

    // ── Entries recorded from outside (MCP / admin) ──────────────────────────
    const printed = await journey.createJourneyEntry({
      kind: "execution",
      action: "printed",
      title: "Card plate printed",
      batchId: batch.id,
      metadata: { minutes: 163.8 },
      occurredAt: new Date("2026-10-03T15:00:00Z"),
    }, journey.journeyContext(null, "mcp"));
    assert.equal(printed.occurredAt, "2026-10-03T15:00:00.000Z");
    assert.deepEqual(printed.metadata, { minutes: 163.8 });

    const insight = await journey.createJourneyEntry({ kind: "insight", title: "QR reads from 30 cm", tagId: tagB.id, status: "needs_review" }, journey.journeyContext(null, "mcp"));
    assert.equal(insight.batchId, batch.id);
    assert.equal(insight.status, "needs_review");
    assert.equal((await journey.setJourneyEntryStatus(insight.id, "active")).status, "active");
    await journey.setJourneyEntryStatus(insight.id, "superseded");
    assert.ok(!(await journey.listJourneyEntries({ tagId: tagB.id })).some((e) => e.id === insight.id), "superseded entries are hidden");
    assert.ok((await journey.listJourneyEntries({ tagId: tagB.id, includeArchived: true })).some((e) => e.id === insight.id));

    // Append-only at the database level.
    await assert.rejects(
      db.execute(sql`UPDATE smart_tag_journey_entries SET title = 'rewritten' WHERE id = ${printed.id}`),
      (err: Error) => /append-only/.test(`${err.message} ${(err.cause as Error | undefined)?.message ?? ""}`),
    );

    await assert.rejects(
      journey.createJourneyEntry({ kind: "insight", title: "x", batchId: "00000000-0000-4000-8000-000000000000" }, journey.journeyContext(null, "mcp")),
      (err: unknown) => err instanceof repo.SmartTagError && err.status === 404,
    );
    assert.equal(await journey.resolveBatchId(batch.batchCode.toLowerCase()), batch.id);

    // ── Plans ────────────────────────────────────────────────────────────────
    const plan = await journey.createPlan({ kind: "experiment", title: "Slot fit, 0.15 clearance", tagId: tagA.id, dueDate: "2026-10-10" }, journey.journeyContext(null, "mcp"));
    assert.equal(plan.batchId, batch.id);
    assert.equal(plan.dueDate, "2026-10-10");
    assert.equal(plan.status, "active");
    const closed = await journey.updatePlan(plan.id, { status: "validated", outcome: "Holds by friction, no wobble" }, journey.journeyContext("admin-1"));
    assert.equal(closed.status, "validated");
    assert.ok(closed.closedAt);
    const planStory = await journey.listJourneyEntries({ planId: plan.id });
    assert.deepEqual(planStory.map((e) => [e.kind, e.action]).reverse(), [["decision", "plan_created"], ["result", "plan_status_changed"]]);
    assert.equal(planStory[0].content, "Holds by friction, no wobble");
    assert.equal(planStory[0].beforeValue, "active");
    assert.equal(planStory[0].planTitle, "Slot fit, 0.15 clearance");
    assert.equal((await journey.listPlans({ batchId: batch.id })).length, 0, "closed plans are not open");
    assert.equal((await journey.listPlans({ batchId: batch.id, status: "all" })).length, 1);
    const reopened = await journey.updatePlan(plan.id, { status: "active" }, journey.journeyContext("admin-1"));
    assert.equal(reopened.closedAt, null);

    // ── Admin API ────────────────────────────────────────────────────────────
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as any).session = { userId: "admin-1" };
      next();
    });
    registerSmartTagAdminRoutes(app);
    const server = app.listen(0);
    try {
      const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
      const post = await fetch(`${base}/api/admin/smart-tag-journey`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: "decision", title: "Bigger version: option A", batchId: batch.id }),
      });
      assert.equal(post.status, 201);
      const created = await post.json();
      assert.equal(created.source, "admin");
      assert.equal(created.actor, "human");
      const res = await fetch(`${base}/api/admin/smart-tag-journey?batchId=${batch.id}&limit=3`);
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.entries.length, 3);
      assert.equal(body.plans.length, 1);
      const bad = await fetch(`${base}/api/admin/smart-tag-plans`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: "idea", title: "x" }),
      });
      assert.equal(bad.status, 400);
      const missing = await fetch(`${base}/api/admin/smart-tag-plans/00000000-0000-4000-8000-000000000000`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "done" }),
      });
      assert.equal(missing.status, 404);
    } finally {
      server.close();
    }
  } finally {
    await pool.end();
  }
});
