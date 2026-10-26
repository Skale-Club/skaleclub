// Pen strokes: flat [x, y, pressure, ...] point lists in board coordinates
// (document.strokes). Pure helpers for recording and hit-testing them.
import { BOARD_LIMITS, type BoardStroke } from "../schema/boards.js";
import type { Point } from "./canvasOps.js";

export const PEN_COLORS = ["#0A162E", "#5173D6", "#EF4444", "#10B981", "#F59E0B", "#8B5CF6"] as const;
export const PEN_SIZES = [2, 4, 8, 16] as const;

export function strokePointCount(stroke: Pick<BoardStroke, "points">): number {
  return Math.floor(stroke.points.length / 3);
}

/** [[x, y, pressure], ...] for perfect-freehand. */
export function strokeToPoints(stroke: Pick<BoardStroke, "points">): [number, number, number][] {
  const out: [number, number, number][] = [];
  for (let i = 0; i + 2 < stroke.points.length; i += 3) out.push([stroke.points[i], stroke.points[i + 1], stroke.points[i + 2]]);
  return out;
}

/**
 * Appends a point unless it is closer than `minDistance` to the last one or
 * the stroke is full. Returns whether it was added. Coordinates are rounded
 * to 0.1 px (pressure to 0.01) to keep documents small.
 */
export function appendStrokePoint(points: number[], x: number, y: number, pressure: number, minDistance = 0): boolean {
  if (points.length >= BOARD_LIMITS.strokePoints * 3) return false;
  const n = points.length;
  if (n >= 3 && minDistance > 0) {
    const dx = x - points[n - 3];
    const dy = y - points[n - 2];
    if (dx * dx + dy * dy < minDistance * minDistance) return false;
  }
  const p = Number.isFinite(pressure) && pressure > 0 ? Math.min(1, pressure) : 0.5;
  points.push(Math.round(x * 10) / 10, Math.round(y * 10) / 10, Math.round(p * 100) / 100);
  return true;
}

function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  let t = len2 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const x = a.x + t * dx - p.x;
  const y = a.y + t * dy - p.y;
  return Math.sqrt(x * x + y * y);
}

export function distanceToStroke(stroke: Pick<BoardStroke, "points">, p: Point): number {
  const pts = stroke.points;
  if (pts.length < 3) return Infinity;
  if (pts.length < 6) return Math.hypot(p.x - pts[0], p.y - pts[1]);
  let best = Infinity;
  for (let i = 0; i + 5 < pts.length; i += 3) {
    best = Math.min(best, distanceToSegment(p, { x: pts[i], y: pts[i + 1] }, { x: pts[i + 3], y: pts[i + 4] }));
  }
  return best;
}

/** Ids of the strokes within `tolerance` of the point (plus half their width). */
export function hitStrokes(strokes: readonly BoardStroke[], p: Point, tolerance: number): string[] {
  return strokes.filter((s) => distanceToStroke(s, p) <= tolerance + (s.size ?? 4) / 2).map((s) => s.id);
}

export function strokeBounds(stroke: Pick<BoardStroke, "points" | "size">): { x: number; y: number; w: number; h: number } | null {
  if (stroke.points.length < 3) return null;
  let x1 = Infinity;
  let y1 = Infinity;
  let x2 = -Infinity;
  let y2 = -Infinity;
  for (let i = 0; i + 2 < stroke.points.length; i += 3) {
    x1 = Math.min(x1, stroke.points[i]);
    y1 = Math.min(y1, stroke.points[i + 1]);
    x2 = Math.max(x2, stroke.points[i]);
    y2 = Math.max(y2, stroke.points[i + 1]);
  }
  const pad = (stroke.size ?? 4) / 2;
  return { x: x1 - pad, y: y1 - pad, w: x2 - x1 + pad * 2, h: y2 - y1 + pad * 2 };
}
