// Run: npx tsx --test shared/boards/canvasOps.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import type { BoardDocument, BoardEdge, BoardNode } from "../schema/boards.js";
import { createEmptyDocument } from "./document.js";
import {
  adoptIntoFrame,
  alignBoxes,
  computeSnap,
  distributeBoxes,
  duplicateNodes,
  extractClipboard,
  findDropFrame,
  isClipboardText,
  parseClipboard,
  pasteClipboard,
  reorderZ,
  serializeClipboard,
  setAbsolutePositions,
  setLocked,
  setNodeParent,
  translateNodes,
  updateFrameMembership,
} from "./canvasOps.js";

const counter = (prefix = "n") => {
  let i = 0;
  return () => `${prefix}${++i}`;
};

const sticky = (id: string, x: number, y: number, extra: Partial<BoardNode> = {}): BoardNode => ({
  id,
  position: { x, y },
  size: { w: 100, h: 100 },
  data: { type: "sticky", text: id },
  ...extra,
});
const frame = (id: string, x: number, y: number, w = 400, h = 300): BoardNode => ({
  id,
  position: { x, y },
  size: { w, h },
  data: { type: "frame", title: id },
});
const mind = (id: string, x = 0, y = 0): BoardNode => ({ id, position: { x, y }, data: { type: "mind", text: id } });
const connector = (source: string, target: string): BoardEdge => ({ id: `c-${source}-${target}`, source, target, kind: "connector" });
const tree = (source: string, target: string): BoardEdge => ({ id: `t-${source}-${target}`, source, target, kind: "tree" });
const doc = (nodes: BoardNode[], edges: BoardEdge[] = []): BoardDocument => ({ ...createEmptyDocument(), nodes, edges });
const pos = (d: BoardDocument, id: string) => d.nodes.find((n) => n.id === id)!.position;
const node = (d: BoardDocument, id: string) => d.nodes.find((n) => n.id === id)!;

test("align: left / center / right / top / middle / bottom", () => {
  const boxes = [
    { id: "a", x: 0, y: 0, w: 100, h: 50 },
    { id: "b", x: 200, y: 100, w: 50, h: 100 },
  ];
  assert.deepEqual(Object.fromEntries(alignBoxes(boxes, "left")), { b: { x: 0, y: 100 } });
  assert.deepEqual(Object.fromEntries(alignBoxes(boxes, "right")), { a: { x: 150, y: 0 } });
  assert.deepEqual(Object.fromEntries(alignBoxes(boxes, "center")), { a: { x: 75, y: 0 }, b: { x: 100, y: 100 } });
  assert.deepEqual(Object.fromEntries(alignBoxes(boxes, "top")), { b: { x: 200, y: 0 } });
  assert.deepEqual(Object.fromEntries(alignBoxes(boxes, "bottom")), { a: { x: 0, y: 150 } });
  assert.deepEqual(Object.fromEntries(alignBoxes(boxes, "middle")), { a: { x: 0, y: 75 }, b: { x: 200, y: 50 } });
  assert.equal(alignBoxes(boxes.slice(0, 1), "left").size, 0);
});

test("distribute: equal gaps, first and last stay", () => {
  const boxes = [
    { id: "a", x: 0, y: 0, w: 100, h: 10 },
    { id: "c", x: 500, y: 0, w: 100, h: 10 },
    { id: "b", x: 120, y: 0, w: 50, h: 10 },
  ];
  // span 600, used 250, gap 175: a@0, b@275, c@500.
  assert.deepEqual(Object.fromEntries(distributeBoxes(boxes, "horizontal")), { b: { x: 275, y: 0 } });
  const vertical = boxes.map((b) => ({ ...b, x: 0, y: b.x, w: 10, h: b.w }));
  assert.deepEqual(Object.fromEntries(distributeBoxes(vertical, "vertical")), { b: { x: 0, y: 275 } });
  assert.equal(distributeBoxes(boxes.slice(0, 2), "horizontal").size, 0);
});

test("setAbsolutePositions converts back to frame-relative positions", () => {
  const d = doc([frame("f", 100, 100), sticky("s", 10, 10, { parentId: "f" })]);
  const next = setAbsolutePositions(d, new Map([["s", { x: 150, y: 160 }]]));
  assert.deepEqual(pos(next, "s"), { x: 50, y: 60 });
  assert.equal(setAbsolutePositions(next, new Map([["s", { x: 150, y: 160 }]])), next, "unchanged returns the same doc");
});

test("snap: closest edge/centre within the threshold, with guide lines", () => {
  const other = { x: 0, y: 0, w: 100, h: 100 };
  // Left edge 3px right of the other's right edge... closest is left->right (100).
  const snap = computeSnap({ x: 103, y: 300, w: 50, h: 50 }, [other], 6);
  assert.equal(snap.dx, -3);
  assert.equal(snap.dy, 0);
  assert.equal(snap.lines.length, 1);
  assert.deepEqual(snap.lines[0], { orientation: "v", pos: 100, from: 0, to: 350 });
  // Centres line up vertically.
  const mid = computeSnap({ x: 400, y: 27, w: 50, h: 50 }, [other], 6);
  assert.equal(mid.dy, -2);
  assert.ok(mid.lines.some((l) => l.orientation === "h" && l.pos === 50));
  // Too far: no snap.
  assert.deepEqual(computeSnap({ x: 120, y: 300, w: 50, h: 50 }, [other], 6), { dx: 0, dy: 0, lines: [] });
});

test("frames: a node joins the frame under its centre and leaves it when moved out", () => {
  const d = doc([frame("f", 0, 0), frame("small", 50, 50, 200, 200), sticky("s", 100, 100)]);
  assert.equal(findDropFrame(d, "s"), "small", "the smallest frame wins");
  const inside = updateFrameMembership(d, ["s"]);
  assert.equal(node(inside, "s").parentId, "small");
  assert.deepEqual(pos(inside, "s"), { x: 50, y: 50 }, "relative to the frame");

  const moved = setAbsolutePositions(inside, new Map([["s", { x: 1000, y: 1000 }]]));
  const out = updateFrameMembership(moved, ["s"]);
  assert.equal(node(out, "s").parentId, undefined);
  assert.deepEqual(pos(out, "s"), { x: 1000, y: 1000 });

  // Mind nodes and frames never join frames.
  const minds = doc([frame("f", 0, 0), mind("m", 10, 10), frame("g", 20, 20, 50, 50)]);
  assert.equal(findDropFrame(minds, "m"), null);
  assert.equal(findDropFrame(minds, "g"), null);
});

test("frames: setNodeParent keeps the node in place; frames are sorted before children", () => {
  const d = doc([sticky("s", 300, 300), frame("f", 200, 200)]);
  const next = updateFrameMembership(d, ["s"]);
  assert.equal(node(next, "s").parentId, "f");
  assert.deepEqual(pos(next, "s"), { x: 100, y: 100 });
  assert.ok(next.nodes.findIndex((n) => n.id === "f") < next.nodes.findIndex((n) => n.id === "s"));
  assert.equal(setNodeParent(next, "s", "f"), next);
});

test("frames: a frame drawn over loose nodes adopts the ones fully inside", () => {
  const d = doc([sticky("in", 50, 50), sticky("half", 350, 50), mind("m", 60, 200), frame("f", 0, 0)]);
  const next = adoptIntoFrame(d, "f");
  assert.equal(node(next, "in").parentId, "f");
  assert.equal(node(next, "half").parentId, undefined);
  assert.equal(node(next, "m").parentId, undefined);
});

test("z-order: front / back / forward / backward within the layer", () => {
  const d = doc([sticky("a", 0, 0), sticky("b", 0, 0), sticky("c", 0, 0), frame("f1", 0, 0), frame("f2", 0, 0)]);
  const order = (x: BoardDocument, ids: string[]) =>
    ids
      .map((id) => ({ id, z: node(x, id).zIndex ?? (node(x, id).data.type === "frame" ? -1 : 0) }))
      .sort((p, q) => p.z - q.z || ids.indexOf(p.id) - ids.indexOf(q.id))
      .map((p) => p.id);
  const front = reorderZ(d, ["a"], "front");
  assert.deepEqual(order(front, ["a", "b", "c"]), ["b", "c", "a"]);
  const back = reorderZ(front, ["a"], "back");
  assert.deepEqual(order(back, ["a", "b", "c"]), ["a", "b", "c"]);
  const fwd = reorderZ(back, ["a"], "forward");
  assert.deepEqual(order(fwd, ["a", "b", "c"]), ["b", "a", "c"]);
  const bwd = reorderZ(fwd, ["c"], "backward");
  assert.deepEqual(order(bwd, ["a", "b", "c"]), ["b", "c", "a"]);
  // Frames stay negative (under content) whatever happens.
  const frames = reorderZ(d, ["f1"], "front");
  assert.ok(frames.nodes.filter((n) => n.data.type === "frame").every((n) => (n.zIndex ?? -1) < 0));
  assert.deepEqual(order(frames, ["f1", "f2"]), ["f2", "f1"]);
  // Nothing to do: same document.
  assert.equal(reorderZ(d, ["c"], "front"), d);
});

test("lock and nudge", () => {
  const d = doc([sticky("a", 0, 0), sticky("b", 10, 10), mind("m"), frame("f", 0, 0), sticky("child", 5, 5, { parentId: "f" })]);
  const locked = setLocked(d, ["a"], true);
  assert.equal(node(locked, "a").locked, true);
  assert.equal("locked" in node(setLocked(locked, ["a"], false), "a"), false);
  const moved = translateNodes(locked, ["a", "b", "m", "f", "child"], 10, -1);
  assert.deepEqual(pos(moved, "a"), { x: 0, y: 0 }, "locked stays");
  assert.deepEqual(pos(moved, "b"), { x: 20, y: 9 });
  assert.deepEqual(pos(moved, "m"), { x: 0, y: 0 }, "mind nodes are not nudged");
  assert.deepEqual(pos(moved, "f"), { x: 10, y: -1 });
  assert.deepEqual(pos(moved, "child"), { x: 5, y: 5 }, "moves with its frame only");
});

test("duplicate: new ids, offset, frame membership and internal connectors", () => {
  const d = doc(
    [frame("f", 0, 0), sticky("a", 10, 10, { parentId: "f" }), sticky("b", 200, 10, { parentId: "f" }), sticky("out", 600, 0)],
    [connector("a", "b"), connector("a", "out")],
  );
  const { doc: next, ids, idMap } = duplicateNodes(d, ["a", "b"], { newId: counter("x") });
  assert.equal(ids.length, 2);
  const copyA = node(next, idMap.get("a")!);
  assert.equal(copyA.parentId, "f", "keeps its frame");
  assert.deepEqual(copyA.position, { x: 34, y: 34 });
  const copied = next.edges.filter((e) => ids.includes(e.source) || ids.includes(e.target));
  assert.equal(copied.length, 1, "only the connector between copied nodes");
  assert.deepEqual([copied[0].source, copied[0].target], [idMap.get("a"), idMap.get("b")]);
  assert.equal(next.nodes.length, 6);

  // Duplicating a frame copies its children (still relative to the new frame).
  const { doc: withFrame, idMap: fm } = duplicateNodes(d, ["f"], { newId: counter("y") });
  const copyChild = node(withFrame, fm.get("a")!);
  assert.equal(copyChild.parentId, fm.get("f"));
  assert.deepEqual(copyChild.position, { x: 10, y: 10 });
  assert.deepEqual(pos(withFrame, fm.get("f")!), { x: 24, y: 24 });
  assert.equal(withFrame.edges.filter((e) => e.source === fm.get("a")).length, 1, "a->b copied, a->out not");
});

test("duplicate: a mind branch is copied with its subtree under the same parent", () => {
  const d = doc([mind("root"), mind("a"), mind("a1"), mind("b")], [tree("root", "a"), tree("a", "a1"), tree("root", "b")]);
  const { doc: next, idMap } = duplicateNodes(d, ["a"], { newId: counter("z") });
  const copy = idMap.get("a")!;
  const parentEdge = next.edges.find((e) => e.kind === "tree" && e.target === copy);
  assert.equal(parentEdge?.source, "root");
  // Inserted right after the original's edge, so the copy sits below it.
  assert.equal(next.edges.indexOf(parentEdge!), next.edges.findIndex((e) => e.id === "t-root-a") + 1);
  assert.ok(next.edges.some((e) => e.kind === "tree" && e.source === copy && e.target === idMap.get("a1")));
});

test("clipboard: extract, serialize, parse and paste with new ids", () => {
  const d = doc([frame("f", 100, 100), sticky("a", 10, 10, { parentId: "f" }), sticky("b", 500, 500)], [connector("a", "b")]);
  // Copying a child alone gives it an absolute position and no frame.
  const clip = extractClipboard(d, ["a", "b"]);
  assert.deepEqual(clip.nodes.map((n) => [n.id, n.parentId, n.position]), [
    ["a", undefined, { x: 110, y: 110 }],
    ["b", undefined, { x: 500, y: 500 }],
  ]);
  assert.equal(clip.edges.length, 1);
  const text = serializeClipboard(clip);
  assert.equal(isClipboardText(text), true);
  assert.equal(isClipboardText("- just a list"), false);
  assert.deepEqual(parseClipboard(text), clip);
  assert.equal(parseClipboard('{"kind":"skaleclub-board-clipboard","version":1,"nodes":"nope"}'), null);

  const empty = doc([]);
  const pasted = pasteClipboard(empty, clip, { center: { x: 0, y: 0 }, newId: counter("p") });
  assert.equal(pasted.doc.nodes.length, 2);
  assert.ok(pasted.doc.nodes.every((n) => n.id.startsWith("p")));
  const edge = pasted.doc.edges[0];
  assert.deepEqual([edge.source, edge.target], [pasted.idMap.get("a"), pasted.idMap.get("b")]);
  // Bounding box (110..600) centred on 0.
  assert.deepEqual(pos(pasted.doc, pasted.idMap.get("a")!), { x: -245, y: -245 });

  const offset = pasteClipboard(d, extractClipboard(d, ["f"]), { offset: { x: 24, y: 24 }, newId: counter("q") });
  const newFrame = offset.idMap.get("f")!;
  assert.deepEqual(offset.ids, [newFrame]);
  assert.equal(node(offset.doc, offset.idMap.get("a")!).parentId, newFrame);
  assert.deepEqual(pos(offset.doc, newFrame), { x: 124, y: 124 });
});
