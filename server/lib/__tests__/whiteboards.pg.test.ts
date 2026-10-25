// Against a real, disposable Postgres (it drops public.whiteboards):
//   DATABASE_URL=postgresql://postgres@127.0.0.1:5432/postgres npm run test:pg
// Skipped otherwise (npm test has no database).
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { sql } from "drizzle-orm";

const enabled = process.env.WHITEBOARDS_PG_TEST === "1";

describe("whiteboards on Postgres", { skip: !enabled && "set WHITEBOARDS_PG_TEST=1 and DATABASE_URL" }, () => {
  let db: typeof import("../../db.js").db;
  let pool: typeof import("../../db.js").pool;
  let storage: typeof import("../../storage.js").storage;
  let ensureWhiteboardsTable: typeof import("../whiteboardsTable.js").ensureWhiteboardsTable;

  before(async () => {
    ({ db, pool } = await import("../../db.js"));
    ({ storage } = await import("../../storage.js"));
    ({ ensureWhiteboardsTable } = await import("../whiteboardsTable.js"));
    await db.execute(sql`DO $$ BEGIN CREATE ROLE service_role; EXCEPTION WHEN duplicate_object THEN NULL; END $$`);
    await db.execute(sql`DROP TABLE IF EXISTS public.whiteboards`);
  });

  after(async () => {
    await pool?.end();
  });

  async function columns() {
    const result = await db.execute(sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'whiteboards' ORDER BY column_name`);
    return result.rows.map((row) => row.column_name);
  }

  it("the bootstrap task creates the table and is safe to re-run", async () => {
    assert.equal((await ensureWhiteboardsTable()).done, true);
    assert.equal((await ensureWhiteboardsTable()).done, true);
    assert.deepEqual(await columns(), ["created_at", "id", "scene", "slug", "thumbnail_url", "title", "updated_at", "version"]);
    const rls = await db.execute(sql`SELECT relrowsecurity FROM pg_class WHERE relname = 'whiteboards'`);
    assert.equal(rls.rows[0].relrowsecurity, true);
  });

  it("it adds the later columns to a table made by the first migration alone", async () => {
    await db.execute(sql`ALTER TABLE public.whiteboards DROP COLUMN thumbnail_url, DROP COLUMN version`);
    await ensureWhiteboardsTable();
    assert.ok((await columns()).includes("thumbnail_url"));
    assert.ok((await columns()).includes("version"));
  });

  it("storage creates, lists, searches, updates and deletes boards", async () => {
    const empty = await storage.createWhiteboard({ title: "Meta Ads", slug: "meta-ads-1" });
    assert.deepEqual(empty.scene, { elements: [], appState: {}, files: {} }, "column default");
    assert.equal(empty.thumbnailUrl, null);

    const board = await storage.createWhiteboard({ title: "Google Ads", slug: "google-ads-1" });
    const scene = {
      elements: [{ id: "a", type: "rectangle" }, { id: "b", type: "text", text: "Leilão" }],
      appState: { viewBackgroundColor: "#ffffff", theme: "dark" },
      files: {},
    };
    const updated = await storage.updateWhiteboard(board.id, { scene, thumbnailUrl: "data:image/webp;base64,AA==" });
    assert.deepEqual(updated.scene, scene);
    assert.ok(updated.updatedAt! > board.updatedAt!, "updatedAt moves on save");

    const renamed = await storage.updateWhiteboard(board.id, { title: "Google Ads: leilão", thumbnailUrl: undefined });
    assert.equal(renamed.thumbnailUrl, "data:image/webp;base64,AA==", "undefined leaves the column alone");
    assert.deepEqual(renamed.scene, scene);

    const { data: list, total } = await storage.listWhiteboards();
    assert.equal(total, 2);
    assert.deepEqual(list.map((row) => row.slug), ["google-ads-1", "meta-ads-1"], "most recently saved first");
    assert.equal(list[0].elementCount, 2);
    assert.equal(list[1].elementCount, 0);
    assert.equal(list[0].thumbnailUrl, "data:image/webp;base64,AA==");
    assert.equal("scene" in list[0], false);
    assert.deepEqual((await storage.listWhiteboards({ search: "LEIL" })).data.map((row) => row.slug), ["google-ads-1"]);
    assert.deepEqual((await storage.listWhiteboards({ search: "meta-ads" })).data.map((row) => row.slug), ["meta-ads-1"]);
    const page2 = await storage.listWhiteboards({ limit: 1, offset: 1 });
    assert.deepEqual([page2.total, page2.data.map((row) => row.slug)], [2, ["meta-ads-1"]]);

    assert.equal((await storage.getWhiteboardBySlug("google-ads-1"))?.id, board.id);
    await assert.rejects(
      storage.createWhiteboard({ title: "Dup", slug: "google-ads-1" }),
      (err: { cause?: { code?: string } }) => err.cause?.code === "23505",
      "slugs are unique",
    );

    await storage.deleteWhiteboard(board.id);
    assert.equal(await storage.getWhiteboard(board.id), undefined);
    assert.equal((await storage.listWhiteboards()).total, 1);
  });

  it("saves bump the version, and a stale expected version changes nothing", async () => {
    const board = await storage.createWhiteboard({ title: "Versioned", slug: "versioned-1" });
    assert.equal(board.version, 1);
    const saved = await storage.updateWhiteboard(board.id, { title: "v2" }, 1);
    assert.equal(saved?.version, 2);
    assert.equal(await storage.updateWhiteboard(board.id, { title: "stale" }, 1), undefined);
    assert.equal((await storage.getWhiteboard(board.id))?.title, "v2");
    assert.equal((await storage.updateWhiteboard(board.id, { title: "forced" }))?.version, 3, "no expected version overwrites");
  });

  it("of two simultaneous saves from the same version, exactly one wins", async () => {
    const board = await storage.createWhiteboard({ title: "Race", slug: "race-1" });
    const results = await Promise.all(
      ["tab A", "tab B", "tab C"].map((title) => storage.updateWhiteboard(board.id, { title }, 1)),
    );
    const winners = results.filter(Boolean);
    assert.equal(winners.length, 1);
    const stored = await storage.getWhiteboard(board.id);
    assert.equal(stored?.version, 2);
    assert.equal(stored?.title, winners[0]?.title);
  });

  it("the migration files build the same table as the bootstrap task", async () => {
    const { readFile } = await import("node:fs/promises");
    const bootstrapColumns = await columns();
    await db.execute(sql`DROP TABLE public.whiteboards`);
    for (const file of ["20261025120000_whiteboards.sql", "20261025130000_whiteboard_thumbnails.sql", "20261026120000_whiteboard_version.sql"]) {
      await db.execute(sql.raw(await readFile(new URL(`../../../supabase/migrations/${file}`, import.meta.url), "utf-8")));
    }
    assert.deepEqual(await columns(), bootstrapColumns);
  });
});
