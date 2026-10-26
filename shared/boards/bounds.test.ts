// Run: npx tsx --test shared/boards/bounds.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import type { BoardDocument, BoardEdge, BoardNode } from "../schema/boards.js";
import { boardContentBounds, padBox } from "./bounds.js";
import { buildPresentSteps, frameReadingOrder } from "./present.js";

const doc = (nodes: BoardNode[], edges: BoardEdge[] = [], strokes: BoardDocument["strokes"] = []) => ({ nodes, edges, strokes });
const frame = (id: string, x: number, y: number, w = 400, h = 300, title = id): BoardNode => ({
  id,
  position: { x, y },
  size: { w, h },
  data: { type: "frame", title },
});
const sticky = (id: string, x: number, y: number, parentId?: string): BoardNode => ({
  id,
  position: { x, y },
  size: { w: 100, h: 100 },
  parentId,
  data: { type: "sticky", text: id },
});
const mind = (id: string, x = 0, y = 0, extra: Partial<{ collapsed: boolean }> = {}): BoardNode => ({
  id,
  position: { x, y },
  size: { w: 100, h: 40 },
  data: { type: "mind", text: id, ...extra },
});
const tree = (source: string, target: string): BoardEdge => ({ id: `${source}-${target}`, source, target, kind: "tree" });

test("bounds cover nodes at their absolute position and pen strokes", () => {
  assert.equal(boardContentBounds(doc([])), null);
  const nodes = [frame("f", 100, 100), sticky("s", 10, 20, "f")];
  assert.deepEqual(boardContentBounds(doc(nodes)), { x: 100, y: 100, w: 400, h: 300 });
  // A sticky child sticks out of its frame: absolute position is frame + relative.
  const wide = [frame("f", 100, 100, 200, 200), sticky("s", 250, 0, "f")];
  assert.deepEqual(boardContentBounds(doc(wide)), { x: 100, y: 100, w: 350, h: 200 });
  // A stroke far from every node widens the bounds (with half its width as padding).
  const stroke = { id: "p", points: [1000, 900, 0.5, 1100, 950, 0.5], size: 4 };
  assert.deepEqual(boardContentBounds(doc(nodes, [], [stroke])), { x: 100, y: 100, w: 1002, h: 852 });
  // A board of only strokes still has bounds.
  assert.deepEqual(boardContentBounds(doc([], [], [stroke])), { x: 998, y: 898, w: 104, h: 54 });
});

test("measured sizes win and collapsed mind branches are not counted", () => {
  const nodes = [mind("root"), mind("a", 200, 0, { collapsed: true }), mind("b", 600, 500)];
  const edges = [tree("root", "a"), tree("a", "b")];
  assert.deepEqual(boardContentBounds(doc(nodes, edges)), { x: 0, y: 0, w: 300, h: 40 });
  assert.deepEqual(boardContentBounds(doc(nodes, edges), { includeHidden: true }), { x: 0, y: 0, w: 700, h: 540 });
  assert.deepEqual(boardContentBounds(doc([mind("root")]), { sizes: { root: { width: 500, height: 80 } } }), { x: 0, y: 0, w: 500, h: 80 });
  assert.deepEqual(padBox({ x: 10, y: 10, w: 100, h: 50 }, 32), { x: -22, y: -22, w: 164, h: 114 });
});

test("frames are presented in reading order: rows top to bottom, left to right", () => {
  const frames = [
    { id: "d", box: { x: 500, y: 420, w: 400, h: 300 } },
    { id: "b", box: { x: 500, y: 10, w: 400, h: 300 } },
    { id: "c", box: { x: 0, y: 400, w: 400, h: 300 } },
    { id: "a", box: { x: 0, y: 0, w: 400, h: 300 } },
  ];
  assert.deepEqual(frameReadingOrder(frames), ["a", "b", "c", "d"]);
});

test("steps: frames first, else the map and its first-level branches, else everything", () => {
  const frames = buildPresentSteps(doc([frame("f2", 500, 0, 400, 300, "Two"), frame("f1", 0, 0, 400, 300, "One"), sticky("s", 10, 10, "f1")]));
  assert.deepEqual(
    frames.map((s) => [s.kind, s.id, s.title, s.focusIds]),
    [
      ["frame", "f1", "One", null],
      ["frame", "f2", "Two", null],
    ],
  );

  const nodes = [mind("root", 0, 0), mind("a", 200, -100), mind("a1", 400, -100), mind("b", -200, 50), mind("c", 200, 100)];
  const edges = [tree("root", "a"), tree("a", "a1"), tree("root", "b"), tree("root", "c")];
  const steps = buildPresentSteps(doc(nodes, edges));
  assert.deepEqual(steps.map((s) => [s.kind, s.id]), [["map", "root"], ["branch", "a"], ["branch", "b"], ["branch", "c"]]);
  assert.equal(steps[0].focusIds, null);
  assert.deepEqual(steps[1].focusIds, ["a", "a1"]);
  assert.deepEqual(steps[1].box, { x: 200, y: -100, w: 300, h: 40 });
  assert.deepEqual(steps[0].box, { x: -200, y: -100, w: 700, h: 240 });

  const folded = buildPresentSteps(doc([mind("root"), mind("a", 200, 0), mind("a1", 400, 0)].map((n) => (n.id === "root" ? { ...n, data: { ...n.data, collapsed: true } } as BoardNode : n)), [tree("root", "a"), tree("a", "a1")]));
  assert.deepEqual(folded.map((s) => s.kind), ["map"], "a collapsed root has no branches to step through");

  const loose = buildPresentSteps(doc([sticky("s1", 0, 0), sticky("s2", 300, 0)]));
  assert.deepEqual(loose.map((s) => [s.kind, s.box]), [["all", { x: 0, y: 0, w: 400, h: 100 }]]);
  assert.deepEqual(buildPresentSteps(doc([])), []);
});
