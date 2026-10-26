// Run: npx tsx --test shared/boards/document.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import type { BoardDocument, BoardEdge, BoardNode } from "../schema/boards.js";
import {
  collectDescendants,
  computeTreeDepths,
  createBoardId,
  createEmptyDocument,
  createStarterDocument,
  isDocumentEmpty,
  normalizeDocument,
  removeEdgesById,
  removeNodesCascade,
  sortNodesParentFirst,
} from "./document.js";

const mind = (id: string, extra: Partial<BoardNode> = {}): BoardNode => ({
  id,
  position: { x: 0, y: 0 },
  data: { type: "mind", text: id },
  ...extra,
});
const sticky = (id: string, extra: Partial<BoardNode> = {}): BoardNode => ({
  id,
  position: { x: 0, y: 0 },
  data: { type: "sticky", text: id },
  ...extra,
});
const tree = (source: string, target: string): BoardEdge => ({ id: `${source}-${target}`, source, target, kind: "tree" });
const connector = (source: string, target: string): BoardEdge => ({ id: `c-${source}-${target}`, source, target, kind: "connector" });

function doc(nodes: BoardNode[], edges: BoardEdge[] = []): BoardDocument {
  return { ...createEmptyDocument(), nodes, edges };
}

test("empty document validates and is empty", () => {
  const empty = createEmptyDocument();
  assert.equal(isDocumentEmpty(empty), true);
  assert.deepEqual(normalizeDocument(empty), empty);
  // A fresh object each call, so callers can mutate it.
  assert.notEqual(createEmptyDocument(), empty);
});

test("starter document: a mind map gets a root named after the board, a canvas is empty", () => {
  const mindmap = createStarterDocument("mindmap", "  Q3 plan ");
  assert.equal(mindmap.nodes.length, 1);
  assert.equal(mindmap.nodes[0].data.type, "mind");
  assert.equal(mindmap.nodes[0].data.type === "mind" && mindmap.nodes[0].data.text, "Q3 plan");
  assert.equal(createStarterDocument("canvas", "x").nodes.length, 0);
});

test("ids are unique", () => {
  const ids = new Set(Array.from({ length: 500 }, () => createBoardId()));
  assert.equal(ids.size, 500);
});

test("normalizeDocument falls back to empty on invalid input and fills defaults", () => {
  assert.deepEqual(normalizeDocument({ nodes: "nope" }), createEmptyDocument());
  assert.deepEqual(normalizeDocument(null).theme, { palette: "brand", background: "dots" });
  const partial = normalizeDocument({ nodes: [mind("a")] });
  assert.equal(partial.nodes.length, 1);
  assert.deepEqual(partial.edges, []);
});

test("removeNodesCascade drops the subtree, frame children and touching edges", () => {
  const d = doc(
    [mind("root"), mind("a"), mind("a1"), mind("b"), sticky("frame-ish"), sticky("inside", { parentId: "frame-ish" }), sticky("other")],
    [tree("root", "a"), tree("a", "a1"), tree("root", "b"), connector("a1", "other"), connector("other", "b")],
  );
  const next = removeNodesCascade(d, ["a", "frame-ish"]);
  assert.deepEqual(next.nodes.map((n) => n.id), ["root", "b", "other"]);
  assert.deepEqual(next.edges.map((e) => e.id), ["root-b", "c-other-b"]);
  // The input is not mutated.
  assert.equal(d.nodes.length, 7);
});

test("removeNodesCascade returns the same object when nothing matches", () => {
  const d = doc([mind("a")]);
  assert.equal(removeNodesCascade(d, ["missing"]), d);
  assert.equal(removeNodesCascade(d, []), d);
  assert.equal(removeEdgesById(d, ["missing"]), d);
});

test("collectDescendants survives cycles", () => {
  const d = doc([mind("a"), mind("b")], [tree("a", "b"), tree("b", "a")]);
  assert.deepEqual([...collectDescendants(d, ["a"])].sort(), ["a", "b"]);
});

test("computeTreeDepths: roots are 0, children count up, connectors are ignored", () => {
  const d = doc(
    [mind("r"), mind("c"), mind("g"), mind("r2"), sticky("s")],
    [tree("r", "c"), tree("c", "g"), connector("g", "r2"), tree("s", "r2")],
  );
  const depths = computeTreeDepths(d);
  assert.equal(depths.get("r"), 0);
  assert.equal(depths.get("c"), 1);
  assert.equal(depths.get("g"), 2);
  // A tree edge from a non-mind node does not make r2 a child.
  assert.equal(depths.get("r2"), 0);
  assert.equal(depths.has("s"), false);
});

test("sortNodesParentFirst puts frames before their children", () => {
  const nodes = [sticky("child", { parentId: "frame" }), sticky("frame", { parentId: "outer" }), sticky("outer"), sticky("orphan", { parentId: "gone" })];
  const order = sortNodesParentFirst(nodes).map((n) => n.id);
  assert.ok(order.indexOf("outer") < order.indexOf("frame"));
  assert.ok(order.indexOf("frame") < order.indexOf("child"));
  assert.equal(order.length, 4);
});
