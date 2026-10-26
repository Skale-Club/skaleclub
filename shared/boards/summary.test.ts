// Run: npx tsx --test shared/boards/summary.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import type { BoardNode } from "../schema/boards.js";
import { boardToOutlineText } from "./summary.js";

const node = (id: string, x: number, y: number, data: BoardNode["data"], parentId?: string): BoardNode => ({ id, position: { x, y }, size: { w: 100, h: 50 }, parentId, data });

test("a mind map keeps its tree", () => {
  const nodes = [node("r", 0, 0, { type: "mind", text: "Plan" }), node("a", 200, 0, { type: "mind", text: "Ads" }), node("b", 200, 80, { type: "mind", text: "SEO" })];
  const edges = [
    { id: "1", source: "r", target: "a", kind: "tree" as const },
    { id: "2", source: "r", target: "b", kind: "tree" as const },
  ];
  assert.equal(boardToOutlineText({ nodes, edges, strokes: [] }), "- Plan\n  - Ads\n  - SEO");
});

test("a canvas becomes frames with their notes, then loose items, in reading order", () => {
  const nodes = [
    node("loose", 0, 900, { type: "text", text: "Remember the budget" }),
    node("f2", 600, 0, { type: "frame", title: "Weaknesses" }),
    node("f1", 0, 0, { type: "frame", title: "Strengths" }),
    node("s2", 20, 90, { type: "sticky", text: "Brand" }, "f1"),
    node("s1", 20, 10, { type: "sticky", text: "Team" }, "f1"),
    node("empty", 5, 5, { type: "sticky", text: "  " }),
    node("pic", 5, 500, { type: "image", url: "https://example.com/a.png" }),
  ];
  assert.equal(boardToOutlineText({ nodes, edges: [], strokes: [] }), "- Strengths\n  - Team\n  - Brand\n- Weaknesses\n- Remember the budget");
  assert.equal(boardToOutlineText({ nodes: [], edges: [], strokes: [] }), "");
});
