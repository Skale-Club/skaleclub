// Run: npx tsx --test shared/boards/layout.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import type { BoardEdge, BoardNode, MindNodeData } from "../schema/boards.js";
import {
  MIND_LEVEL_GAP,
  MIND_SIBLING_GAP,
  applyMindLayout,
  buildMindForest,
  computeHiddenMindNodes,
  estimateMindNodeSize,
  layoutMindMaps,
  pickSideForNewBranch,
} from "./layout.js";

const SIZE = { w: 100, h: 40 };

function mind(id: string, data: Partial<MindNodeData> = {}, position = { x: 0, y: 0 }): BoardNode {
  return { id, position, data: { type: "mind", text: id, ...data } };
}
const tree = (source: string, target: string): BoardEdge => ({ id: `${source}>${target}`, source, target, kind: "tree" });
function sizesFor(nodes: BoardNode[], size = SIZE) {
  return Object.fromEntries(nodes.map((n) => [n.id, size]));
}

// root with four first-level branches, the first one having two children.
function sample(rootData: Partial<MindNodeData> = {}) {
  const nodes = [mind("r", rootData, { x: 500, y: 300 }), mind("a"), mind("b"), mind("c"), mind("d"), mind("a1"), mind("a2")];
  const edges = [tree("r", "a"), tree("r", "b"), tree("r", "c"), tree("r", "d"), tree("a", "a1"), tree("a", "a2")];
  return { nodes, edges, sizes: sizesFor(nodes) };
}

const overlaps = (p: { x: number; y: number }, q: { x: number; y: number }, size = SIZE) =>
  p.x < q.x + size.w && q.x < p.x + size.w && p.y < q.y + size.h && q.y < p.y + size.h;

function assertNoOverlap(positions: Map<string, { x: number; y: number }>, root: { x: number; y: number }) {
  const all = [...positions.entries(), ["root", root] as const];
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      assert.ok(!overlaps(all[i][1], all[j][1]), `${all[i][0]} overlaps ${all[j][0]}`);
    }
  }
}

test("forest: roots, depth, child order and cycles", () => {
  const nodes = [mind("r"), mind("a"), mind("b"), mind("x"), mind("y"), { id: "s", position: { x: 0, y: 0 }, data: { type: "sticky" as const, text: "" } }];
  const edges = [tree("r", "b"), tree("r", "a"), tree("x", "y"), tree("y", "x"), tree("r", "s")];
  const forest = buildMindForest(nodes, edges);
  assert.deepEqual(forest.children.get("r"), ["b", "a"], "tree-edge order is sibling order");
  assert.equal(forest.depth.get("a"), 1);
  assert.equal(forest.nodes.has("s"), false, "non-mind nodes are not part of the forest");
  assert.ok(forest.roots.includes("r"));
  // x <-> y is a cycle: one of them is promoted to a root, both are reached.
  assert.equal(forest.rootOf.get("x"), forest.rootOf.get("y"));
  assert.equal(forest.roots.length, 2);
});

test("balanced: first-level branches split left/right by subtree height", () => {
  const { nodes, edges, sizes } = sample();
  const result = layoutMindMaps({ nodes, edges, sizes });
  const root = nodes[0].position;
  // a (with two children) is the heaviest; it goes right, the next ones balance it.
  assert.equal(result.directions.get("a"), "right");
  assert.equal(result.directions.get("b"), "left");
  const right = ["a", "b", "c", "d"].filter((id) => result.directions.get(id) === "right");
  const left = ["a", "b", "c", "d"].filter((id) => result.directions.get(id) === "left");
  assert.ok(right.length >= 1 && left.length >= 1, "both sides used");
  for (const id of right) assert.equal(result.positions.get(id)!.x, root.x + SIZE.w + MIND_LEVEL_GAP);
  for (const id of left) assert.equal(result.positions.get(id)!.x, root.x - MIND_LEVEL_GAP - SIZE.w);
  // Children of a are one column further right and follow their parent's side.
  assert.equal(result.positions.get("a1")!.x, root.x + 2 * (SIZE.w + MIND_LEVEL_GAP));
  assert.equal(result.directions.get("a1"), "right");
  // Siblings stack top to bottom in order with the sibling gap.
  const a1 = result.positions.get("a1")!;
  const a2 = result.positions.get("a2")!;
  assert.equal(a2.y - a1.y, SIZE.h + MIND_SIBLING_GAP);
  // a sits centred on its children.
  assert.equal(result.positions.get("a")!.y, Math.round((a1.y + a2.y) / 2));
  assertNoOverlap(result.positions, root);
});

test("balanced: an explicit side is honoured", () => {
  const { nodes, edges, sizes } = sample();
  nodes[1] = mind("a", { side: "left" });
  nodes[2] = mind("b", { side: "left" });
  const result = layoutMindMaps({ nodes, edges, sizes });
  assert.equal(result.directions.get("a"), "left");
  assert.equal(result.directions.get("b"), "left");
  assert.equal(result.directions.get("c"), "right");
  assert.equal(result.directions.get("d"), "right");
  assert.equal(result.directions.get("a1"), "left");
  assert.ok(result.positions.get("a1")!.x < result.positions.get("a")!.x);
});

test("right layout puts every branch to the right, vertically centred on the root", () => {
  const { nodes, edges, sizes } = sample({ layout: "right" });
  const result = layoutMindMaps({ nodes, edges, sizes });
  const root = nodes[0].position;
  for (const id of ["a", "b", "c", "d", "a1", "a2"]) {
    assert.equal(result.directions.get(id), "right");
    assert.ok(result.positions.get(id)!.x > root.x, id);
  }
  const ys = ["a", "b", "c", "d"].map((id) => result.positions.get(id)!.y);
  assert.deepEqual([...ys].sort((p, q) => p - q), ys, "order kept top to bottom");
  assertNoOverlap(result.positions, root);
});

test("vertical layout is an org chart, top-down", () => {
  const { nodes, edges, sizes } = sample({ layout: "vertical" });
  const result = layoutMindMaps({ nodes, edges, sizes });
  const root = nodes[0].position;
  const firstRow = ["a", "b", "c", "d"].map((id) => result.positions.get(id)!);
  for (const p of firstRow) assert.ok(p.y > root.y + SIZE.h, "below the root");
  assert.equal(new Set(firstRow.map((p) => p.y)).size, 1, "first level shares a row");
  const xs = firstRow.map((p) => p.x);
  assert.deepEqual([...xs].sort((p, q) => p - q), xs, "left to right in order");
  assert.ok(result.positions.get("a1")!.y > firstRow[0].y, "grandchildren a row lower");
  assert.equal(result.directions.get("a1"), "down");
  // The first level is centred under the root.
  const mid = (Math.min(...xs) + Math.max(...xs) + SIZE.w) / 2;
  assert.ok(Math.abs(mid - (root.x + SIZE.w / 2)) <= 1);
  assertNoOverlap(result.positions, root);
});

test("collapsed nodes hide their descendants and free their space", () => {
  const { nodes, edges } = sample({ layout: "right" });
  // b has children too, so a's children push b down while a is open.
  nodes.push(mind("b1"), mind("b2"));
  edges.push(tree("b", "b1"), tree("b", "b2"));
  const sizes = sizesFor(nodes);
  const open = layoutMindMaps({ nodes, edges, sizes });
  nodes[1] = mind("a", { collapsed: true });
  const closed = layoutMindMaps({ nodes, edges, sizes });
  assert.deepEqual([...closed.hidden].sort(), ["a1", "a2"]);
  assert.equal(closed.positions.has("a1"), false);
  assert.equal(closed.positions.has("a"), true, "the collapsed node itself stays visible");
  const spanOpen = open.positions.get("d")!.y - open.positions.get("a")!.y;
  const spanClosed = closed.positions.get("d")!.y - closed.positions.get("a")!.y;
  assert.ok(spanClosed < spanOpen, "siblings close up");
  assert.deepEqual([...computeHiddenMindNodes(buildMindForest(nodes, edges))].sort(), ["a1", "a2"]);
});

test("nested collapse hides everything below the top collapsed node", () => {
  const nodes = [mind("r", { layout: "right" }), mind("a", { collapsed: true }), mind("b", { collapsed: true }), mind("c")];
  const edges = [tree("r", "a"), tree("a", "b"), tree("b", "c")];
  const result = layoutMindMaps({ nodes, edges, sizes: sizesFor(nodes) });
  assert.deepEqual([...result.hidden].sort(), ["b", "c"]);
});

test("layout is deterministic", () => {
  const { nodes, edges, sizes } = sample();
  const one = layoutMindMaps({ nodes, edges, sizes });
  const two = layoutMindMaps({ nodes: structuredClone(nodes), edges: structuredClone(edges), sizes });
  assert.deepEqual([...one.positions], [...two.positions]);
  assert.deepEqual([...one.directions], [...two.directions]);
});

test("the root stays put and the map follows it", () => {
  const { nodes, edges, sizes } = sample();
  const before = layoutMindMaps({ nodes, edges, sizes });
  assert.equal(before.positions.has("r"), false, "the root is never repositioned");
  const moved = nodes.map((n) => (n.id === "r" ? { ...n, position: { x: n.position.x + 120, y: n.position.y - 40 } } : n));
  const after = layoutMindMaps({ nodes: moved, edges, sizes });
  for (const [id, p] of before.positions) {
    assert.deepEqual(after.positions.get(id), { x: p.x + 120, y: p.y - 40 }, id);
  }
  const applied = applyMindLayout(moved, after);
  assert.deepEqual(applied.find((n) => n.id === "r")!.position, moved[0].position);
  assert.equal(applyMindLayout(applied, after), applied, "re-applying is a no-op");
});

test("only the requested roots are laid out", () => {
  const nodes = [mind("r1", {}, { x: 0, y: 0 }), mind("a"), mind("r2", {}, { x: 1000, y: 0 }), mind("b")];
  const edges = [tree("r1", "a"), tree("r2", "b")];
  const result = layoutMindMaps({ nodes, edges, sizes: sizesFor(nodes), rootIds: ["b"] });
  assert.deepEqual(result.roots, ["r2"]);
  assert.equal(result.positions.has("a"), false);
  assert.equal(result.positions.has("b"), true);
});

test("variable sizes never overlap", () => {
  const nodes = [mind("r", {}, { x: 0, y: 0 })];
  const edges: BoardEdge[] = [];
  const sizes: Record<string, { w: number; h: number }> = { r: { w: 160, h: 48 } };
  for (let i = 0; i < 6; i++) {
    nodes.push(mind(`b${i}`));
    edges.push(tree("r", `b${i}`));
    sizes[`b${i}`] = { w: 80 + i * 40, h: 32 + (i % 3) * 20 };
    for (let j = 0; j < i; j++) {
      nodes.push(mind(`b${i}-${j}`));
      edges.push(tree(`b${i}`, `b${i}-${j}`));
      sizes[`b${i}-${j}`] = { w: 60 + j * 30, h: 28 + (j % 2) * 30 };
    }
  }
  const result = layoutMindMaps({ nodes, edges, sizes });
  const boxes = [...result.positions].map(([id, p]) => ({ id, ...p, ...sizes[id] }));
  boxes.push({ id: "r", x: 0, y: 0, ...sizes.r });
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i];
      const b = boxes[j];
      const hit = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
      assert.ok(!hit, `${a.id} overlaps ${b.id}`);
    }
  }
});

test("sizes fall back to an estimate from the text", () => {
  const short = estimateMindNodeSize({ text: "Hi" }, 2);
  const long = estimateMindNodeSize({ text: "A much longer topic that needs to wrap over a couple of lines at least" }, 2);
  const root = estimateMindNodeSize({ text: "Hi" }, 0);
  assert.ok(long.w > short.w && long.w <= 320);
  assert.ok(long.h > short.h, "long text wraps");
  assert.ok(root.h > short.h && root.w >= 120, "the root is larger");
  // Measured {width,height} sizes are accepted as well.
  const nodes = [mind("r", { layout: "right" }), mind("a")];
  const result = layoutMindMaps({ nodes, edges: [tree("r", "a")], sizes: { r: { width: 200, height: 50 }, a: { width: 90, height: 30 } } });
  assert.deepEqual(result.positions.get("a"), { x: 200 + MIND_LEVEL_GAP, y: 10 });
});

test("a new branch goes to the lighter side", () => {
  const { nodes, edges, sizes } = sample();
  const directions = layoutMindMaps({ nodes, edges, sizes }).directions;
  // a (94px tall) and d go right, b and c (40px each) go left: left is lighter.
  assert.deepEqual(["a", "b", "c", "d"].map((id) => directions.get(id)), ["right", "left", "left", "right"]);
  assert.equal(pickSideForNewBranch(nodes, edges, "r", sizes), "left");
});
