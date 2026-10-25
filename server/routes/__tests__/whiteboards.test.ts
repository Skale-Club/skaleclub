import test from "node:test";
import assert from "node:assert/strict";
import { LARGE_BODY_RE } from "../../lib/bodyLimits.js";
import { createWhiteboardsApp, installMemoryWhiteboards, listen } from "./helpers/whiteboardsHarness.js";

const THUMB = "data:image/webp;base64,UklGRg==";
const rectangle = { id: "r1", type: "rectangle", x: 0, y: 0, width: 10, height: 10, version: 2, isDeleted: false };

type Call = (method: string, path: string, body?: unknown, admin?: boolean) => Promise<{ status: number; json: any }>;

async function withApi(fn: (call: Call) => Promise<void>) {
  installMemoryWhiteboards();
  const { server, baseUrl } = await listen(createWhiteboardsApp());
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

test("only the whiteboard id path gets the large body limit", () => {
  assert.equal(LARGE_BODY_RE.test("/api/whiteboards/0b9e9c6e-3f2a-4d8e-9a51-2c7f0e6b1d23"), true);
  assert.equal(LARGE_BODY_RE.test("/api/whiteboards"), false);
  assert.equal(LARGE_BODY_RE.test("/api/whiteboards/slug/google-ads-abc"), false);
  assert.equal(LARGE_BODY_RE.test("/api/whiteboards/0b9e9c6e-3f2a-4d8e-9a51-2c7f0e6b1d23/x"), false);
});

test("admin routes refuse anonymous callers", () =>
  withApi(async (call) => {
    const id = "0b9e9c6e-3f2a-4d8e-9a51-2c7f0e6b1d23";
    assert.equal((await call("GET", "/api/whiteboards", undefined, false)).status, 401);
    assert.equal((await call("POST", "/api/whiteboards", { title: "x" }, false)).status, 401);
    assert.equal((await call("GET", `/api/whiteboards/${id}`, undefined, false)).status, 401);
    assert.equal((await call("PUT", `/api/whiteboards/${id}`, { title: "x" }, false)).status, 401);
    assert.equal((await call("DELETE", `/api/whiteboards/${id}`, undefined, false)).status, 401);
  }));

test("create derives an unguessable slug from the title and starts empty", () =>
  withApi(async (call) => {
    const { status, json } = await call("POST", "/api/whiteboards", { title: "  Como funciona o Google Ads?  " });
    assert.equal(status, 201);
    assert.equal(json.title, "Como funciona o Google Ads?");
    assert.match(json.slug, /^como-funciona-o-google-ads-[a-z0-9]+$/);
    assert.deepEqual(json.scene.elements, []);
    assert.equal(json.thumbnailUrl, null);

    const second = await call("POST", "/api/whiteboards", { title: "Como funciona o Google Ads?" });
    assert.notEqual(second.json.slug, json.slug);
  }));

test("create rejects a blank title", () =>
  withApi(async (call) => {
    assert.equal((await call("POST", "/api/whiteboards", { title: "   " })).status, 400);
    assert.equal((await call("POST", "/api/whiteboards", {})).status, 400);
  }));

test("saving a scene makes it public at its slug, without admin-only fields", () =>
  withApi(async (call) => {
    const created = (await call("POST", "/api/whiteboards", { title: "Funil" })).json;
    const scene = { elements: [rectangle], appState: { viewBackgroundColor: "#fff", theme: "dark" }, files: {} };
    const saved = await call("PUT", `/api/whiteboards/${created.id}`, { title: "Funil de vendas", scene, thumbnailUrl: THUMB });
    assert.equal(saved.status, 200);
    assert.equal(saved.json.title, "Funil de vendas");
    assert.equal(saved.json.thumbnailUrl, THUMB);

    const pub = await call("GET", `/api/whiteboards/slug/${created.slug}`, undefined, false);
    assert.equal(pub.status, 200);
    assert.deepEqual(Object.keys(pub.json).sort(), ["id", "scene", "slug", "title", "updatedAt"]);
    assert.deepEqual(pub.json.scene, scene);
    assert.equal(pub.json.title, "Funil de vendas");
  }));

test("public lookup of an unknown slug is a 404", () =>
  withApi(async (call) => {
    assert.equal((await call("GET", "/api/whiteboards/slug/nao-existe", undefined, false)).status, 404);
  }));

test("list shows summaries with element counts and thumbnails, and filters by search", () =>
  withApi(async (call) => {
    const a = (await call("POST", "/api/whiteboards", { title: "Google Ads" })).json;
    await call("POST", "/api/whiteboards", { title: "Meta Ads" });
    await call("PUT", `/api/whiteboards/${a.id}`, { scene: { elements: [rectangle, { ...rectangle, id: "r2" }] }, thumbnailUrl: THUMB });

    const all = await call("GET", "/api/whiteboards");
    assert.equal(all.status, 200);
    assert.equal(all.json.length, 2);
    assert.equal(all.json[0].id, a.id, "most recently saved first");
    assert.equal(all.json[0].elementCount, 2);
    assert.equal(all.json[0].thumbnailUrl, THUMB);
    assert.equal("scene" in all.json[0], false);

    const filtered = await call("GET", "/api/whiteboards?search=meta");
    assert.deepEqual(filtered.json.map((row: { title: string }) => row.title), ["Meta Ads"]);
  }));

test("a save that omits the thumbnail keeps the previous one; null clears it", () =>
  withApi(async (call) => {
    const { id } = (await call("POST", "/api/whiteboards", { title: "Board" })).json;
    await call("PUT", `/api/whiteboards/${id}`, { scene: { elements: [rectangle] }, thumbnailUrl: THUMB });
    const kept = await call("PUT", `/api/whiteboards/${id}`, { title: "Renamed" });
    assert.equal(kept.json.thumbnailUrl, THUMB);
    assert.equal(kept.json.scene.elements.length, 1, "scene untouched by a title-only save");
    const cleared = await call("PUT", `/api/whiteboards/${id}`, { scene: { elements: [] }, thumbnailUrl: null });
    assert.equal(cleared.json.thumbnailUrl, null);
  }));

test("save validates the id, the payload and the board's existence", () =>
  withApi(async (call) => {
    const { id } = (await call("POST", "/api/whiteboards", { title: "Board" })).json;
    assert.equal((await call("PUT", "/api/whiteboards/not-a-uuid", { title: "x" })).status, 400);
    assert.equal((await call("GET", "/api/whiteboards/not-a-uuid")).status, 400);
    assert.equal((await call("PUT", `/api/whiteboards/${id}`, { thumbnailUrl: "https://evil.example/x.png" })).status, 400);
    assert.equal((await call("PUT", `/api/whiteboards/${id}`, { scene: { elements: "nope" } })).status, 400);
    assert.equal((await call("PUT", `/api/whiteboards/${id}`, { title: "" })).status, 400);
    const missing = "0b9e9c6e-3f2a-4d8e-9a51-2c7f0e6b1d23";
    assert.equal((await call("PUT", `/api/whiteboards/${missing}`, { title: "x" })).status, 404);
    assert.equal((await call("GET", `/api/whiteboards/${missing}`)).status, 404);
  }));

test("a custom slug is normalized and must be unique", () =>
  withApi(async (call) => {
    const a = (await call("POST", "/api/whiteboards", { title: "A" })).json;
    const b = (await call("POST", "/api/whiteboards", { title: "B" })).json;
    const renamed = await call("PUT", `/api/whiteboards/${a.id}`, { slug: "  Aula 1: Lances! " });
    assert.equal(renamed.status, 200);
    assert.equal(renamed.json.slug, "aula-1-lances");
    assert.equal((await call("PUT", `/api/whiteboards/${b.id}`, { slug: "aula-1-lances" })).status, 409);
    assert.equal((await call("PUT", `/api/whiteboards/${a.id}`, { slug: "aula-1-lances" })).status, 200, "own slug is fine");
  }));

test("scenes with embedded images above the default 1 MB limit still save", () =>
  withApi(async (call) => {
    const { id, slug } = (await call("POST", "/api/whiteboards", { title: "Big" })).json;
    const dataURL = `data:image/png;base64,${"A".repeat(3_000_000)}`;
    const scene = {
      elements: [{ ...rectangle, type: "image", fileId: "f1" }],
      files: { f1: { id: "f1", mimeType: "image/png", dataURL, created: 1 } },
    };
    const saved = await call("PUT", `/api/whiteboards/${id}`, { scene });
    assert.equal(saved.status, 200);
    const pub = await call("GET", `/api/whiteboards/slug/${slug}`, undefined, false);
    assert.equal(pub.json.scene.files.f1.dataURL.length, dataURL.length);
  }));

test("delete removes the board and its public page", () =>
  withApi(async (call) => {
    const { id, slug } = (await call("POST", "/api/whiteboards", { title: "Temp" })).json;
    assert.equal((await call("DELETE", `/api/whiteboards/${id}`)).status, 200);
    assert.equal((await call("GET", `/api/whiteboards/slug/${slug}`, undefined, false)).status, 404);
    assert.equal((await call("DELETE", `/api/whiteboards/${id}`)).status, 404);
  }));
