// Run: npx tsx --test shared/boards/json.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import type { BoardDocument } from "../schema/boards.js";
import { createEmptyDocument } from "./document.js";
import { parseBoardJson, repairDocument, serializeBoardJson } from "./json.js";

const sample = (): BoardDocument => ({
  ...createEmptyDocument(),
  viewport: { x: 5, y: 6, zoom: 2 },
  nodes: [
    { id: "a", position: { x: 0, y: 0 }, data: { type: "mind", text: "Root" } },
    { id: "b", position: { x: 10, y: 0 }, data: { type: "mind", text: "Child" } },
  ],
  edges: [{ id: "e", source: "a", target: "b", kind: "tree" }],
  strokes: [{ id: "s", points: [0, 0, 0.5, 5, 5, 0.5], color: "#EF4444", size: 4 }],
});

test("export then import round-trips the document, without the camera", () => {
  const doc = sample();
  const text = serializeBoardJson(doc);
  assert.doesNotMatch(text, /viewport/);
  const result = parseBoardJson(text);
  assert.ok(result.ok);
  assert.deepEqual(result.document, { ...doc, viewport: undefined });
  assert.equal(result.repaired, 0);
});

test("a board as the API returns it imports through its document", () => {
  const result = parseBoardJson(JSON.stringify({ id: "x", title: "T", document: sample() }));
  assert.ok(result.ok);
  assert.equal(result.document.nodes.length, 2);
});

test("bad files are refused with a reason", () => {
  assert.deepEqual(parseBoardJson("not json"), { ok: false, error: "This file is not valid JSON." });
  assert.equal(parseBoardJson("[1,2]").ok, false);
  assert.equal(parseBoardJson("null").ok, false);
  const wrongVersion = parseBoardJson(JSON.stringify({ ...sample(), schemaVersion: 2 }));
  assert.ok(!wrongVersion.ok);
  assert.match(wrongVersion.error, /schemaVersion/);
  const badNode = parseBoardJson(JSON.stringify({ nodes: [{ id: "a", position: { x: 0, y: 0 }, data: { type: "nope" } }] }));
  assert.ok(!badNode.ok);
  assert.match(badNode.error, /nodes\.0/);
});

test("dangling references and duplicates are repaired, not imported", () => {
  const doc = sample();
  doc.nodes.push({ id: "a", position: { x: 1, y: 1 }, data: { type: "mind", text: "Dup" } });
  doc.nodes.push({ id: "c", position: { x: 0, y: 0 }, parentId: "ghost", data: { type: "sticky", text: "x" } });
  doc.edges.push({ id: "bad", source: "a", target: "ghost", kind: "connector" });
  const { document, repaired } = repairDocument(doc);
  assert.equal(repaired, 3);
  assert.deepEqual(document.nodes.map((n) => n.id), ["a", "b", "c"]);
  assert.equal(document.nodes[2].parentId, undefined);
  assert.deepEqual(document.edges.map((e) => e.id), ["e"]);
  const clean = sample();
  assert.equal(repairDocument(clean).document, clean, "a clean document is returned as is");
});
