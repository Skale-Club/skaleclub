// Assembling fitted edges into closed outlines, and writing them out as SVG
// path data or flattened polylines (for meshing).

import { fitEdge, type FitOptions, type FittedEdge } from './fit';
import type { PlanarMap, PlanarRegion } from './planar';
import type { Point, Ring, Segment } from './types';

export interface TracedMap {
  map: PlanarMap;
  fitted: FittedEdge[];
}

export function fitMap(map: PlanarMap, opt: FitOptions): TracedMap {
  const w1 = map.width + 1;
  const fitted = map.edges.map((e) => fitEdge(e.corners, w1, e.closed, opt));
  return { map, fitted };
}

export function reverseEdge(e: FittedEdge): FittedEdge {
  const pts: Point[] = [e.start, ...e.segments.map((s) => s.to)];
  const segments: Segment[] = [];
  for (let i = e.segments.length - 1; i >= 0; i--) {
    const s = e.segments[i];
    const to = pts[i];
    segments.push(s.c1 && s.c2 ? { c1: s.c2, c2: s.c1, to } : { to });
  }
  return { start: pts[pts.length - 1], segments, circle: e.circle };
}

/** Closed outlines of a region in pixel coordinates; ring 0 is the outer one. */
export function regionRings(traced: TracedMap, region: PlanarRegion): Ring[] {
  const reversed = new Map<number, FittedEdge>();
  const rings = region.rings.map((ref) => {
    const segments: Segment[] = [];
    let start: Point | null = null;
    for (const { edge, reversed: rev } of ref.edges) {
      let e = traced.fitted[edge];
      if (rev) {
        let r = reversed.get(edge);
        if (!r) {
          r = reverseEdge(e);
          reversed.set(edge, r);
        }
        e = r;
      }
      if (!start) start = e.start;
      segments.push(...e.segments);
    }
    return { ring: { start: start ?? { x: 0, y: 0 }, segments }, area: ref.area };
  });
  // Outer ring = largest |area|; holes run the opposite way round.
  rings.sort((a, b) => Math.abs(b.area) - Math.abs(a.area));
  return rings.map((r) => r.ring);
}

export interface Transform {
  scale: number;
  ox: number;
  oy: number;
}

const fmt = (v: number) => {
  const r = Math.round(v * 1000) / 1000;
  return Object.is(r, -0) ? '0' : String(r);
};

export function ringToPath(ring: Ring, t: Transform): string {
  const X = (p: Point) => fmt((p.x - t.ox) * t.scale);
  const Y = (p: Point) => fmt((p.y - t.oy) * t.scale);
  const parts = [`M${X(ring.start)} ${Y(ring.start)}`];
  const n = ring.segments.length;
  for (let i = 0; i < n; i++) {
    const s = ring.segments[i];
    // The closing segment is implied by Z when it is a straight line.
    if (i === n - 1 && !s.c1) break;
    if (s.c1 && s.c2) parts.push(`C${X(s.c1)} ${Y(s.c1)} ${X(s.c2)} ${Y(s.c2)} ${X(s.to)} ${Y(s.to)}`);
    else parts.push(`L${X(s.to)} ${Y(s.to)}`);
  }
  parts.push('Z');
  return parts.join('');
}

// ── Flattening (for meshes) ─────────────────────────────────────────────────

function flattenCubic(p0: Point, c1: Point, c2: Point, p3: Point, tol: number, out: Point[], depth = 0) {
  // Flatness: distance of the controls from the chord.
  const dx = p3.x - p0.x;
  const dy = p3.y - p0.y;
  const l = Math.hypot(dx, dy) || 1e-12;
  const d1 = Math.abs((c1.x - p0.x) * dy - (c1.y - p0.y) * dx) / l;
  const d2 = Math.abs((c2.x - p0.x) * dy - (c2.y - p0.y) * dx) / l;
  if (depth > 16 || Math.max(d1, d2) <= tol) {
    out.push(p3);
    return;
  }
  const m01 = mid(p0, c1);
  const m12 = mid(c1, c2);
  const m23 = mid(c2, p3);
  const a = mid(m01, m12);
  const b = mid(m12, m23);
  const m = mid(a, b);
  flattenCubic(p0, m01, a, m, tol, out, depth + 1);
  flattenCubic(m, b, m23, p3, tol, out, depth + 1);
}

const mid = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/** Polyline of an edge, excluding its start point. */
export function flattenEdge(e: FittedEdge, tol: number): Point[] {
  const out: Point[] = [];
  let p = e.start;
  for (const s of e.segments) {
    if (s.c1 && s.c2) flattenCubic(p, s.c1, s.c2, s.to, tol, out);
    else out.push(s.to);
    p = s.to;
  }
  return out;
}

/**
 * Flattened outlines of a region, built edge by edge from a shared cache so
 * neighbouring regions get bit-identical vertices along their common border.
 */
export function regionPolygons(
  traced: TracedMap,
  region: PlanarRegion,
  tol: number,
  cache: Map<number, Point[]>,
): Point[][] {
  const flat = (edge: number): Point[] => {
    let pts = cache.get(edge);
    if (!pts) {
      const e = traced.fitted[edge];
      pts = [e.start, ...flattenEdge(e, tol)];
      cache.set(edge, pts);
    }
    return pts;
  };
  const rings = region.rings.map((ref) => {
    const poly: Point[] = [];
    for (const { edge, reversed } of ref.edges) {
      const pts = flat(edge);
      if (reversed) for (let i = pts.length - 1; i > 0; i--) poly.push(pts[i]);
      else for (let i = 0; i < pts.length - 1; i++) poly.push(pts[i]);
    }
    return { poly, area: Math.abs(ref.area) };
  });
  rings.sort((a, b) => b.area - a.area);
  return rings.map((r) => r.poly).filter((p) => p.length >= 3);
}
