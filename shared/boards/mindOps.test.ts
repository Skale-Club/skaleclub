// Run: npx tsx --test shared/boards/mindOps.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import type { BoardDocument, BoardEdge, BoardNode, MindNodeData } from "../schema/boards.js";
import { boardDocumentSchema } from "../schema/boards.js";
import { createEmptyDocument } from "./document.js";
import { buildMindForest } from "./layout.js";
import {
  addMindChild,
  addMindSibling,
  canReparentMindNode,
  insertOutline,
  outdentMindNode,
  reparentMindNode,
  setMindCollapsed,
} from "./mindOps.js";

let counter = 0;
const newId = () => `n${++counter}`;

const mind = (id: string, data: Partial<MindNodeData> = {}, x = 0): BoardNode => ({ id, position: { x, y: 0 }, data: { type: "mind", text: id, ...data } });
const tree = (source: string, target: string): BoardEdge => ({ id: `${source}>${target}`, source, target, kind: "tree" });
const doc = (nodes: BoardNode[], edges: BoardEdge[]): BoardDocument => ({ ...createEmptyDocument(), nodes, edges });
const childrenOf = (d: BoardDocument, id: string) => buildMindForest(d.nodes, d.edges).children.get(id) ?? [];
const dataOf = (d: BoardDocument, id: string) => d.nodes.find((n) => n.id === id)!.data as MindNodeData;

// r -> a -> (a1, a2), r -> b
const base = () =>
  doc([mind("r", { layout: "balanced" }, 500), mind("a", { side: "right" }, 700), mind("b", { side: "left" }, 300), mind("a1"), mind("a2")], [
    tree("r", "a"),
    tree("r", "b"),
    tree("a", "a1"),
    tree("a", "a2"),
  ]);

test("add child appends, expands a collapsed parent and balances root branches", () => {
  const start = base();
  start.nodes[1] = mind("a", { side: "right", collapsed: true }, 700);
  const { doc: next, id } = addMindChild(start, "a", { newId });
  assert.deepEqual(childrenOf(next, "a"), ["a1", "a2", id]);
  assert.equal(dataOf(next, "a").collapsed, false);
  assert.equal(dataOf(next, id!).side, undefined, "only first-level branches get a side");

  const branch = addMindChild(base(), "r", { newId });
  const side = dataOf(branch.doc, branch.id!).side;
  // a (with two children) is heavier than b, so the new branch joins b on the left.
  assert.equal(side, "left");
  assert.ok(boardDocumentSchema.safeParse(branch.doc).success);
});

test("add sibling inserts right below and keeps the side; on a root it adds a child", () => {
  const { doc: next, id } = addMindSibling(base(), "a1", { newId });
  assert.deepEqual(childrenOf(next, "a"), ["a1", id, "a2"]);
  const first = addMindSibling(base(), "b", { newId });
  assert.equal(dataOf(first.doc, first.id!).side, "left");
  assert.deepEqual(childrenOf(first.doc, "r"), ["a", "b", first.id]);
  const onRoot = addMindSibling(base(), "r", { newId });
  assert.ok(childrenOf(onRoot.doc, "r").includes(onRoot.id!));
});

test("outdent moves a node next to its former parent", () => {
  const next = outdentMindNode(base(), "a2", { newId });
  assert.deepEqual(childrenOf(next, "r"), ["a", "a2", "b"]);
  assert.deepEqual(childrenOf(next, "a"), ["a1"]);
  assert.equal(dataOf(next, "a2").side, "right", "takes the side of the branch it left");
  const same = base();
  assert.equal(outdentMindNode(same, "a"), same, "first level cannot go higher");
  assert.equal(outdentMindNode(same, "r"), same);
});

test("reparent refuses cycles and roots, and moves the subtree", () => {
  const d = base();
  assert.equal(canReparentMindNode(d, "a", "a1"), false, "into its own subtree");
  assert.equal(canReparentMindNode(d, "a", "a"), false);
  assert.equal(canReparentMindNode(d, "r", "b"), false, "roots do not reparent");
  assert.equal(reparentMindNode(d, "a", "a2"), d);

  const next = reparentMindNode(d, "a", "b", { newId });
  assert.deepEqual(childrenOf(next, "b"), ["a"]);
  assert.deepEqual(childrenOf(next, "a"), ["a1", "a2"], "subtree comes along");
  assert.equal(dataOf(next, "a").side, undefined, "no longer first level");

  const up = reparentMindNode(d, "a1", "r", { newId, side: "left" });
  assert.equal(dataOf(up, "a1").side, "left");
  assert.equal(up.edges.filter((e) => e.target === "a1").length, 1, "exactly one parent");
});

test("collapse toggles only nodes with children", () => {
  const d = base();
  const collapsed = setMindCollapsed(d, "a");
  assert.equal(dataOf(collapsed, "a").collapsed, true);
  assert.equal(dataOf(setMindCollapsed(collapsed, "a"), "a").collapsed, undefined);
  assert.equal(setMindCollapsed(d, "a1"), d, "a leaf cannot collapse");
  assert.equal(setMindCollapsed(d, "a", false), d, "already expanded");
});

test("insert outline under a node or as a new map", () => {
  const items = [
    { text: "x", children: [{ text: "x1", children: [] }] },
    { text: "y", children: [] },
  ];
  const under = insertOutline(base(), items, { parentId: "a1" }, { newId });
  assert.equal(under.ids.length, 3);
  assert.deepEqual(childrenOf(under.doc, "a1").map((id) => dataOf(under.doc, id).text), ["x", "y"]);

  const map = insertOutline(createEmptyDocument(), items, { position: { x: 10, y: 20 }, rootText: "Imported" }, { newId });
  assert.equal(dataOf(map.doc, map.rootId!).text, "Imported");
  assert.deepEqual(map.doc.nodes.find((n) => n.id === map.rootId)!.position, { x: 10, y: 20 });
  assert.equal(map.doc.nodes.length, 4);
  assert.ok(boardDocumentSchema.safeParse(map.doc).success);
});
