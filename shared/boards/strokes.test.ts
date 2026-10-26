// Run: npx tsx --test shared/boards/strokes.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { BOARD_LIMITS, type BoardStroke } from "../schema/boards.js";
import { appendStrokePoint, distanceToStroke, hitStrokes, strokeBounds, strokePointCount, strokeToPoints } from "./strokes.js";

test("appendStrokePoint rounds, skips close points and stops at the limit", () => {
  const pts: number[] = [];
  assert.equal(appendStrokePoint(pts, 1.234, 5.678, 0.333), true);
  assert.deepEqual(pts, [1.2, 5.7, 0.33]);
  assert.equal(appendStrokePoint(pts, 1.5, 5.8, 0.5, 2), false, "too close");
  assert.equal(appendStrokePoint(pts, 10, 10, 0, 2), true);
  assert.equal(pts[5], 0.5, "missing pressure defaults to 0.5");
  assert.equal(strokePointCount({ points: pts }), 2);
  assert.deepEqual(strokeToPoints({ points: pts }), [
    [1.2, 5.7, 0.33],
    [10, 10, 0.5],
  ]);
  const full = new Array(BOARD_LIMITS.strokePoints * 3).fill(0);
  assert.equal(appendStrokePoint(full, 1, 1, 1), false);
});

test("hit-testing strokes by distance to their segments", () => {
  const line: BoardStroke = { id: "line", points: [0, 0, 0.5, 100, 0, 0.5], size: 4 };
  const dot: BoardStroke = { id: "dot", points: [200, 200, 0.5] };
  assert.equal(distanceToStroke(line, { x: 50, y: 10 }), 10);
  assert.equal(distanceToStroke(line, { x: 110, y: 0 }), 10);
  assert.equal(distanceToStroke(dot, { x: 203, y: 204 }), 5);
  assert.deepEqual(hitStrokes([line, dot], { x: 50, y: 5 }, 4), ["line"]);
  assert.deepEqual(hitStrokes([line, dot], { x: 200, y: 205 }, 4), ["dot"]);
  assert.deepEqual(hitStrokes([line, dot], { x: 150, y: 100 }, 4), []);
  assert.deepEqual(strokeBounds(line), { x: -2, y: -2, w: 104, h: 4 });
});
