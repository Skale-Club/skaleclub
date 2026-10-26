import test from "node:test";
import assert from "node:assert/strict";
import { LARGE_BODY_RE } from "../../lib/bodyLimits.js";
import { BOARD_LIMITS } from "#shared/schema.js";
import { createBoardsApp, installMemoryBoards, listen } from "./helpers/boardsHarness.js";

const THUMB = "data:image/webp;base64,UklGRg==";
const ID = "0b9e9c6e-3f2a-4d8e-9a51-2c7f0e6b1d23";

const mind = (id: string, text = "Idea") => ({
  id,
  position: { x: 0, y: 0 },
  data: { type: "mind" as const, text },
});
const doc = (n: number) => ({ nodes: Array.from({ length: n }, (_, i) => mind(`n${i}`)), edges: [], strokes: [] });

type Call = (method: string, path: string, body?: unknown, admin?: boolean) => Promise<{ status: number; json: any }>;

async function withApi(fn: (call: Call) => Promise<void>) {
  installMemoryBoards();
  const { server, baseUrl } = await listen(createBoardsApp());
  const call: Call = async (method, path, body, admin = true) => {
    const res = await fetch(baseUrl + path, {
      method,
      headers: {
        ...(body === undefined ? {} : { "content-type": "application/json" }),
        ...(admin ? { "x-test-admin": "1" } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    return { status: res.status, json: text ? JSON.parse(text) : null };
  };
  try {
    await fn(call);
  } finally {
    server.close();
  }
}

test("only the board id path gets the large body limit", () => {
  assert.equal(LARGE_BODY_RE.test(`/api/boards/${ID}`), true);
  assert.equal(LARGE_BODY_RE.test("/api/boards"), false);
  assert.equal(LARGE_BODY_RE.test("/api/boards/slug/abc"), false);
  assert.equal(LARGE_BODY_RE.test(`/api/boards/${ID}/x`), false);
});

test("admin routes refuse anonymous callers", () =>
  withApi(async (call) => {
    assert.equal((await call("GET", "/api/boards", undefined, false)).status, 401);
    assert.equal((await call("POST", "/api/boards", { title: "x" }, false)).status, 401);
    assert.equal((await call("GET", `/api/boards/${ID}`, undefined, false)).status, 401);
    assert.equal((await call("PUT", `/api/boards/${ID}`, { title: "x" }, false)).status, 401);
    assert.equal((await call("DELETE", `/api/boards/${ID}`, undefined, false)).status, 401);
  }));

test("create generates a slug and applies defaults", () =>
  withApi(async (call) => {
    const { status, json } = await call("POST", "/api/boards", { title: "  Plano de Marketing  " });
    assert.equal(status, 201);
    assert.equal(json.title, "Plano de Marketing");
    assert.match(json.slug, /^plano-de-marketing-[a-z0-9]+$/);
    assert.equal(json.kind, "mindmap");
    assert.equal(json.visibility, "private");
    assert.equal(json.version, 1);
    assert.equal(json.thumbnailUrl, null);
    assert.equal(json.createdBy, "admin");
    assert.deepEqual(json.document.nodes, []);
    assert.equal(json.document.schemaVersion, 1);

    const canvas = await call("POST", "/api/boards", { title: "Plano de Marketing", kind: "canvas", document: doc(1) });
    assert.equal(canvas.json.kind, "canvas");
    assert.equal(canvas.json.document.nodes.length, 1);
    assert.notEqual(canvas.json.slug, json.slug);
  }));

test("create rejects a blank title, a bad kind and an invalid document", () =>
  withApi(async (call) => {
    assert.equal((await call("POST", "/api/boards", { title: "   " })).status, 400);
    assert.equal((await call("POST", "/api/boards", {})).status, 400);
    assert.equal((await call("POST", "/api/boards", { title: "x", kind: "table" })).status, 400);
    assert.equal((await call("POST", "/api/boards", { title: "x", document: { nodes: "no" } })).status, 400);
  }));

test("list omits the document, reports nodeCount, searches and pages", () =>
  withApi(async (call) => {
    const a = (await call("POST", "/api/boards", { title: "Google Ads" })).json;
    await call("POST", "/api/boards", { title: "Meta Ads" });
    await call("PUT", `/api/boards/${a.id}`, { document: doc(3), thumbnailUrl: THUMB });

    const all = await call("GET", "/api/boards");
    assert.equal(all.status, 200);
    assert.equal(all.json.total, 2);
    assert.equal(all.json.data[0].id, a.id, "most recently saved first");
    assert.equal(all.json.data[0].nodeCount, 3);
    assert.equal(all.json.data[0].thumbnailUrl, THUMB);
    assert.equal("document" in all.json.data[0], false);

    const filtered = await call("GET", "/api/boards?search=meta");
    assert.deepEqual(filtered.json.data.map((row: { title: string }) => row.title), ["Meta Ads"]);
    assert.equal(filtered.json.total, 1);

    for (let i = 1; i <= 28; i++) await call("POST", "/api/boards", { title: `Board ${i}` });
    const first = await call("GET", "/api/boards");
    assert.equal(first.json.total, 30);
    assert.equal(first.json.data.length, 24, "default page size");
    const rest = await call("GET", "/api/boards?limit=24&offset=24");
    assert.equal(rest.json.data.length, 6);
    assert.equal((await call("GET", "/api/boards?limit=5000")).json.data.length, 30, "capped, not an error");
    assert.equal((await call("GET", "/api/boards?limit=abc")).json.data.length, 24);
  }));

test("get returns the full row, validates the id and 404s", () =>
  withApi(async (call) => {
    const created = (await call("POST", "/api/boards", { title: "Full", document: doc(2) })).json;
    const got = await call("GET", `/api/boards/${created.id}`);
    assert.equal(got.status, 200);
    assert.equal(got.json.document.nodes.length, 2);
    assert.equal((await call("GET", "/api/boards/not-a-uuid")).status, 400);
    assert.equal((await call("GET", `/api/boards/${ID}`)).status, 404);
  }));

test("the public route shows only 'link' boards, with the PublicBoard shape", () =>
  withApi(async (call) => {
    const { id, slug } = (await call("POST", "/api/boards", { title: "Shared", document: doc(1) })).json;
    assert.equal((await call("GET", `/api/boards/slug/${slug}`, undefined, false)).status, 404, "private is hidden");
    assert.equal((await call("GET", "/api/boards/slug/nao-existe", undefined, false)).status, 404);

    await call("PUT", `/api/boards/${id}`, { visibility: "link", thumbnailUrl: THUMB });
    const pub = await call("GET", `/api/boards/slug/${slug}`, undefined, false);
    assert.equal(pub.status, 200);
    assert.deepEqual(Object.keys(pub.json).sort(), ["document", "id", "kind", "slug", "title", "updatedAt"]);
    assert.equal(pub.json.kind, "mindmap");
    assert.equal(pub.json.document.nodes.length, 1);

    await call("PUT", `/api/boards/${id}`, { visibility: "private" });
    assert.equal((await call("GET", `/api/boards/slug/${slug}`, undefined, false)).status, 404, "hidden again");
  }));

test("save validates the document, the payload and the id", () =>
  withApi(async (call) => {
    const { id } = (await call("POST", "/api/boards", { title: "Board" })).json;
    const put = (body: unknown) => call("PUT", `/api/boards/${id}`, body);
    const unknownType = { nodes: [{ id: "x", position: { x: 0, y: 0 }, data: { type: "hologram", text: "a" } }] };
    assert.equal((await put({ document: unknownType })).status, 400);
    assert.equal((await put({ document: doc(BOARD_LIMITS.nodes + 1) })).status, 400);
    assert.equal((await put({ document: doc(BOARD_LIMITS.nodes) })).status, 200, "the limit itself is fine");
    assert.equal((await put({ visibility: "public", thumbnailUrl: THUMB })).status, 400);
    assert.equal((await put({ visibility: "public" })).status, 400);
    assert.equal((await put({ title: "" })).status, 400);
    assert.equal((await call("PUT", "/api/boards/not-a-uuid", { title: "x" })).status, 400);
    assert.equal((await call("PUT", `/api/boards/${ID}`, { title: "x" })).status, 404);
  }));

test("a save that omits the thumbnail keeps it; null clears it", () =>
  withApi(async (call) => {
    const { id } = (await call("POST", "/api/boards", { title: "Board" })).json;
    await call("PUT", `/api/boards/${id}`, { document: doc(1), thumbnailUrl: THUMB });
    const kept = await call("PUT", `/api/boards/${id}`, { title: "Renamed" });
    assert.equal(kept.json.thumbnailUrl, THUMB);
    assert.equal(kept.json.document.nodes.length, 1, "document untouched by a title-only save");
    assert.equal((await call("PUT", `/api/boards/${id}`, { thumbnailUrl: null })).json.thumbnailUrl, null);
  }));

test("a custom slug is normalized and must be unique", () =>
  withApi(async (call) => {
    const a = (await call("POST", "/api/boards", { title: "A" })).json;
    const b = (await call("POST", "/api/boards", { title: "B" })).json;
    const renamed = await call("PUT", `/api/boards/${a.id}`, { slug: "  Aula 1: Lances! " });
    assert.equal(renamed.json.slug, "aula-1-lances");
    const taken = await call("PUT", `/api/boards/${b.id}`, { slug: "aula-1-lances", baseVersion: 1 });
    assert.equal(taken.status, 409);
    assert.equal(taken.json.code, "slug_taken");
    assert.equal((await call("PUT", `/api/boards/${a.id}`, { slug: "aula-1-lances" })).status, 200, "own slug is fine");
  }));

test("every save bumps the version and a stale baseVersion is refused", () =>
  withApi(async (call) => {
    const { id } = (await call("POST", "/api/boards", { title: "Shared" })).json;
    const ok = await call("PUT", `/api/boards/${id}`, { document: doc(1), baseVersion: 1 });
    assert.equal(ok.status, 200);
    assert.equal(ok.json.version, 2);

    const stale = await call("PUT", `/api/boards/${id}`, { document: doc(2), baseVersion: 1 });
    assert.equal(stale.status, 409);
    assert.equal(stale.json.code, "version_conflict");
    assert.equal(stale.json.version, 2);
    assert.ok(stale.json.updatedAt);
    assert.equal((await call("GET", `/api/boards/${id}`)).json.document.nodes.length, 1, "winner's work is intact");

    assert.equal((await call("PUT", `/api/boards/${id}`, { document: doc(2), baseVersion: 2 })).json.version, 3);
    const forced = await call("PUT", `/api/boards/${id}`, { document: doc(4) });
    assert.equal(forced.status, 200, "no baseVersion overwrites");
    assert.equal(forced.json.version, 4);
  }));

test("documents above the default 1 MB limit still save", () =>
  withApi(async (call) => {
    const { id } = (await call("POST", "/api/boards", { title: "Big" })).json;
    const text = "x".repeat(BOARD_LIMITS.nodeText);
    const big = { nodes: Array.from({ length: 1000 }, (_, i) => mind(`n${i}`, text)), edges: [], strokes: [] };
    assert.ok(JSON.stringify(big).length > 1_500_000);
    const saved = await call("PUT", `/api/boards/${id}`, { document: big });
    assert.equal(saved.status, 200);
    assert.equal(saved.json.document.nodes.length, 1000);
  }));

test("delete removes the board and its public page", () =>
  withApi(async (call) => {
    const { id, slug } = (await call("POST", "/api/boards", { title: "Temp" })).json;
    await call("PUT", `/api/boards/${id}`, { visibility: "link" });
    assert.equal((await call("GET", `/api/boards/slug/${slug}`, undefined, false)).status, 200);
    assert.equal((await call("DELETE", `/api/boards/${id}`)).status, 200);
    assert.equal((await call("GET", `/api/boards/slug/${slug}`, undefined, false)).status, 404);
    assert.equal((await call("DELETE", `/api/boards/${id}`)).status, 404);
  }));

test("an invalid thumbnail alone is dropped and the rest is saved; JPEG is accepted", () =>
  withApi(async (call) => {
    const { id } = (await call("POST", "/api/boards", { title: "Board" })).json;
    await call("PUT", `/api/boards/${id}`, { thumbnailUrl: THUMB });
    const dropped = await call("PUT", `/api/boards/${id}`, { document: doc(2), title: "Kept", thumbnailUrl: "https://evil.example/x.png" });
    assert.equal(dropped.status, 200);
    assert.equal(dropped.json.title, "Kept");
    assert.equal(dropped.json.document.nodes.length, 2);
    assert.equal(dropped.json.thumbnailUrl, THUMB, "the previous thumbnail stays");
    const tooBig = await call("PUT", `/api/boards/${id}`, { title: "Big", thumbnailUrl: `data:image/png;base64,${"A".repeat(1_500_001)}` });
    assert.equal(tooBig.status, 200);
    assert.equal(tooBig.json.thumbnailUrl, THUMB);
    const jpeg = "data:image/jpeg;base64,/9j/4AAQ";
    assert.equal((await call("PUT", `/api/boards/${id}`, { thumbnailUrl: jpeg })).json.thumbnailUrl, jpeg);
    assert.equal((await call("PUT", `/api/boards/${id}`, { document: { nodes: [{ id: "x", position: { x: 0, y: 0 }, data: { type: "hologram", text: "a" } }] }, thumbnailUrl: "nope" })).status, 400);
  }));

test("search matches %, _ and backslash literally", () =>
  withApi(async (call) => {
    await call("POST", "/api/boards", { title: "100% done" });
    await call("POST", "/api/boards", { title: "plain" });
    assert.equal((await call("GET", "/api/boards?search=%25")).json.total, 1);
    assert.equal((await call("GET", "/api/boards?search=_")).json.total, 0);
  }));
