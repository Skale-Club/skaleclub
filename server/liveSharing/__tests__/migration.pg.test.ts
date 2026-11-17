// CI-only: disposable loopback PostgreSQL. Never run this against an app database.
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";

const requested = process.env.WHITEBOARDS_PG_TEST === "1";
const url = process.env.DATABASE_URL ?? "";
const loopback = /^postgres(?:ql)?:\/\/[^/]*@(?:127\.0\.0\.1|localhost)(?::\d+)?\//.test(url);
describe("live sharing and catalog migrations on disposable PostgreSQL", { skip: !requested || !loopback }, () => {
  let db: typeof import("../../db.js").db;
  let pool: typeof import("../../db.js").pool;
  let service: import("../service.js").LiveSharingService;
  const files = [
    "20261111180000_downloadable_apps.sql", "20261111192000_app_landing_pages.sql",
    "20261111210000_xpeed_platform.sql", "20261117010000_optional_live_sharing.sql",
  ];
  before(async () => {
    ({ db, pool } = await import("../../db.js"));
    const { sql } = await import("drizzle-orm");
    await db.execute(sql.raw(`CREATE TABLE IF NOT EXISTS portfolio_services (
      id serial PRIMARY KEY, slug text UNIQUE, title text, subtitle text, description text,
      price text, price_label text, badge_text text, category text, features jsonb,
      tool_url text, cta_text text, "order" integer, is_active boolean
    )`));
    for (const file of files) await db.execute(sql.raw(await readFile(new URL(`../../../supabase/migrations/${file}`, import.meta.url), "utf8")));
    const { LiveSharingService } = await import("../service.js");
    const { postgresLiveSessionStore } = await import("../postgresStore.js");
    service = new LiveSharingService(postgresLiveSessionStore, {
      secret: () => "disposable-postgres-live-test-secret-32-characters",
      loadSource: async () => ({ snapshot: {
        kind: "presentation", title: "Fake deck", slides: [{ layout: "cover" }, { layout: "closing" }],
        branding: { companyName: "Example", logoMain: null, logoDark: null, logoAvatarFull: null, logoAvatarMark: null, logoIcon: null },
      } }),
    });
  });
  after(async () => { await pool?.end(); });
  it("applies additive migrations repeatedly without duplicating catalog records", async () => {
    const { sql } = await import("drizzle-orm");
    for (const file of files) await db.execute(sql.raw(await readFile(new URL(`../../../supabase/migrations/${file}`, import.meta.url), "utf8")));
    const result = await db.execute(sql`SELECT count(*)::int AS count FROM downloadable_apps WHERE is_published`);
    assert.equal(result.rows[0].count, 6);
    const xpeed = await db.execute(sql`SELECT count(*)::int AS count FROM portfolio_services WHERE slug = 'xpeed'`);
    assert.equal(xpeed.rows[0].count, 1);
    const rls = await db.execute(sql`SELECT relrowsecurity FROM pg_class WHERE relname = 'live_sessions'`);
    assert.equal(rls.rows[0].relrowsecurity, true);
  });
  it("persists pinned sessions, serializes competing writes and recovers guest access", async () => {
    const c = await service.create("fake-owner", "presentation", "fake-source", "en");
    const shared = await service.share(c.state.id, "fake-owner", c.controllerToken);
    const joined = await service.join(c.state.id, shared.audienceToken);
    const results = await Promise.allSettled([0, 1].map((slideIndex) => service.command(c.state.id, "fake-owner", {
      controllerToken: c.controllerToken, commandId: randomUUID(), expectedRevision: 0,
      command: { type: "navigate", slideIndex },
    })));
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    const view = await service.audience(c.state.id, joined.credential);
    assert.equal(view.state.revision, 1);
    assert.match(view.state.expiresAt, /^\d{4}-\d\d-\d\dT/);
    await service.revoke(c.state.id, "fake-owner", c.controllerToken);
    await assert.rejects(service.audience(c.state.id, joined.credential));
  });
});
