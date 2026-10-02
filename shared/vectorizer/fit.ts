// Curve fitting for planar-map edges: corner detection, exact straight lines,
// perfect circles, and least-squares cubic Béziers (Schneider's algorithm)
// with G1-continuous joins everywhere except at real corners.

import type { Point, Segment } from './types';

export interface FitOptions {
  /** Max distance (px) between the fitted curve and the pixel boundary. */
  tolerance: number;
  /**
   * Gaussian smoothing (px) applied to each span before fitting. Removes the
   * pixel staircase so the tolerance measures shape, not grid noise.
   */
  smoothing: number;
  /** Corner detection window in samples (scales with the upscale factor). */
  window: number;
  /** Turning angle (radians) above which a point is a corner. */
  cornerAngle: number;
  /** How far (px) a polygon vertex must stick out to count as a corner. */
  cornerSize: number;
  detectCircles: boolean;
}

export interface FittedEdge {
  start: Point;
  segments: Segment[];
  circle: boolean;
}

type P = { x: number; y: number };

const sub = (a: P, b: P): P => ({ x: a.x - b.x, y: a.y - b.y });
const add = (a: P, b: P): P => ({ x: a.x + b.x, y: a.y + b.y });
const mul = (a: P, s: number): P => ({ x: a.x * s, y: a.y * s });
const dot = (a: P, b: P) => a.x * b.x + a.y * b.y;
const len = (a: P) => Math.hypot(a.x, a.y);
const norm = (a: P): P => {
  const l = len(a);
  return l > 1e-12 ? { x: a.x / l, y: a.y / l } : { x: 0, y: 0 };
};

/** Boundary samples: crack midpoints, anchored on the node corners. */
export function edgeSamples(corners: Int32Array, w1: number, closed: boolean): P[] {
  const pts: P[] = [];
  const at = (i: number): P => ({ x: corners[i] % w1, y: Math.floor(corners[i] / w1) });
  const n = corners.length;
  if (!closed) pts.push(at(0));
  for (let i = 0; i < n - 1; i++) {
    const a = at(i);
    const b = at(i + 1);
    pts.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  }
  if (!closed) pts.push(at(n - 1));
  return pts;
}

function smooth(pts: P[], closed: boolean, sigma: number): P[] {
  const r = Math.max(1, Math.ceil(sigma * 2.5));
  const weights: number[] = [];
  for (let k = -r; k <= r; k++) weights.push(Math.exp(-(k * k) / (2 * sigma * sigma)));
  const n = pts.length;
  const out: P[] = new Array(n);
  for (let i = 0; i < n; i++) {
    if (!closed && (i === 0 || i === n - 1)) {
      out[i] = pts[i];
      continue;
    }
    let sx = 0, sy = 0, sw = 0;
    for (let k = -r; k <= r; k++) {
      let j = i + k;
      if (closed) j = ((j % n) + n) % n;
      else if (j < 0 || j >= n) continue;
      const wt = weights[k + r];
      sx += pts[j].x * wt;
      sy += pts[j].y * wt;
      sw += wt;
    }
    out[i] = { x: sx / sw, y: sy / sw };
  }
  return out;
}

/** Douglas-Peucker on an open polyline; returns kept indices (ends included). */
function simplify(pts: P[], lo: number, hi: number, eps: number, keep: Uint8Array) {
  const stack: Array<[number, number]> = [[lo, hi]];
  keep[lo] = keep[hi] = 1;
  while (stack.length) {
    const [a, b] = stack.pop()!;
    if (b - a < 2) continue;
    const pa = pts[a];
    const pb = pts[b];
    const ab = sub(pb, pa);
    const l = len(ab);
    let best = -1;
    let bestD = eps;
    for (let i = a + 1; i < b; i++) {
      const ap = sub(pts[i], pa);
      const d = l > 1e-9 ? Math.abs(ap.x * ab.y - ap.y * ab.x) / l : len(ap);
      if (d > bestD) {
        bestD = d;
        best = i;
      }
    }
    if (best >= 0) {
      keep[best] = 1;
      stack.push([a, best], [best, b]);
    }
  }
}

/**
 * Corners, Potrace-style: approximate the outline by a polygon, then call a
 * vertex a corner only if it turns sharply AND sticks out far enough from the
 * line through the midpoints of its two edges. Tight curves produce short
 * polygon edges and therefore small offsets, so they stay smooth, while real
 * corners — even two close together, like the ends of a thin bar — survive.
 */
function detectCorners(raw: P[], closed: boolean, opt: FitOptions): number[] {
  const n = raw.length;
  if (n < 5) return [];
  const eps = Math.max(0.75, opt.tolerance * 0.9);
  const keep = new Uint8Array(n);
  if (closed) {
    // Split the loop at its two most distant samples.
    let far = 0;
    let fd = -1;
    for (let i = 1; i < n; i++) {
      const d = len(sub(raw[i], raw[0]));
      if (d > fd) {
        fd = d;
        far = i;
      }
    }
    const ext = raw.concat([raw[0]]);
    simplify(ext, 0, far, eps, keep);
    const keep2 = new Uint8Array(n + 1);
    simplify(ext, far, n, eps, keep2);
    for (let i = far; i < n; i++) if (keep2[i]) keep[i] = 1;
  } else {
    simplify(raw, 0, n - 1, eps, keep);
  }
  const verts: number[] = [];
  for (let i = 0; i < n; i++) if (keep[i]) verts.push(i);
  const m = verts.length;
  if (m < (closed ? 3 : 3)) return [];

  // A corner blurred by resampling is cut by two or three nearby polygon
  // vertices of ~45° each. Measure every vertex against neighbours at least
  // `reach` away so such a cluster reads as one sharp corner.
  const reach = Math.max(3, opt.cornerSize * 4.3);
  const separation = Math.max(2, opt.cornerSize * 2.3);
  const cand: Array<{ i: number; off: number }> = [];
  const vAt = (k: number) => raw[verts[((k % m) + m) % m]];
  const first = closed ? 0 : 1;
  const last = closed ? m : m - 1;
  for (let k = first; k < last; k++) {
    const b = vAt(k);
    let ka = k - 1;
    while ((closed ? k - ka < m - 1 : ka > 0) && len(sub(vAt(ka), b)) < reach) ka--;
    let kc = k + 1;
    while ((closed ? kc - k < m - 1 : kc < m - 1) && len(sub(vAt(kc), b)) < reach) kc++;
    const a = vAt(ka);
    const c = vAt(kc);
    const v1 = sub(b, a);
    const v2 = sub(c, b);
    const l1 = len(v1);
    const l2 = len(v2);
    if (l1 < 1e-9 || l2 < 1e-9) continue;
    const turn = Math.acos(Math.max(-1, Math.min(1, dot(v1, v2) / (l1 * l2))));
    if (turn < opt.cornerAngle) continue;
    const p0 = mid2(a, b);
    const p2 = mid2(b, c);
    const base = sub(p2, p0);
    const bl = len(base);
    const off = bl > 1e-9 ? Math.abs((b.x - p0.x) * base.y - (b.y - p0.y) * base.x) / bl : len(sub(b, p0));
    if (off < opt.cornerSize) continue;
    cand.push({ i: verts[((k % m) + m) % m], off });
  }
  // Keep the most prominent vertex of each cluster.
  cand.sort((p, q) => q.off - p.off);
  const corners: number[] = [];
  for (const c of cand) {
    if (corners.some((i) => len(sub(raw[i], raw[c.i])) < separation)) continue;
    corners.push(c.i);
  }
  return corners.sort((p, q) => p - q);
}

const mid2 = (a: P, b: P): P => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/** Least-squares line through points; returns centroid and direction. */
function fitLine(pts: P[]): { c: P; d: P } | null {
  if (pts.length < 2) return null;
  let cx = 0, cy = 0;
  for (const p of pts) {
    cx += p.x;
    cy += p.y;
  }
  cx /= pts.length;
  cy /= pts.length;
  let sxx = 0, sxy = 0, syy = 0;
  for (const p of pts) {
    const dx = p.x - cx;
    const dy = p.y - cy;
    sxx += dx * dx;
    sxy += dx * dy;
    syy += dy * dy;
  }
  const theta = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  return { c: { x: cx, y: cy }, d: { x: Math.cos(theta), y: Math.sin(theta) } };
}

function intersect(a: { c: P; d: P }, b: { c: P; d: P }): P | null {
  const det = a.d.x * b.d.y - a.d.y * b.d.x;
  if (Math.abs(det) < 0.2) return null; // nearly parallel
  const t = ((b.c.x - a.c.x) * b.d.y - (b.c.y - a.c.y) * b.d.x) / det;
  return add(a.c, mul(a.d, t));
}

/** Sharpens a detected corner to where its two arms actually meet. */
function refineCorner(pts: P[], i: number, closed: boolean, k: number): P {
  const n = pts.length;
  const take = (from: number, to: number): P[] => {
    const out: P[] = [];
    for (let j = from; j <= to; j++) {
      if (closed) out.push(pts[((j % n) + n) % n]);
      else if (j >= 0 && j < n) out.push(pts[j]);
    }
    return out;
  };
  const inner = Math.max(1, Math.round(k / 3));
  const reach = Math.max(3, Math.round(k * 1.5));
  const left = fitLine(take(i - reach, i - inner));
  const right = fitLine(take(i + inner, i + reach));
  if (!left || !right) return pts[i];
  const p = intersect(left, right);
  if (!p || len(sub(p, pts[i])) > Math.max(1.5, k * 0.75)) return pts[i];
  return p;
}

function tangentFrom(pts: P[], from: number, dir: 1 | -1, count: number, closed: boolean): P {
  // Direction of a least-squares line through the first `count` samples,
  // oriented away from `from`.
  const n = pts.length;
  const sel: P[] = [pts[from]];
  for (let k = 1; k <= count; k++) {
    let j = from + dir * k;
    if (closed) j = ((j % n) + n) % n;
    else if (j < 0 || j >= n) break;
    sel.push(pts[j]);
  }
  if (sel.length < 2) return { x: 0, y: 0 };
  const chord = sub(sel[sel.length - 1], sel[0]);
  const line = sel.length >= 3 ? fitLine(sel) : null;
  if (!line) return norm(chord);
  return dot(line.d, chord) < 0 ? mul(line.d, -1) : line.d;
}

// ── Schneider curve fitting ────────────────────────────────────────────────

type Bez = [P, P, P, P];

function bezierPoint(b: Bez, t: number): P {
  const mt = 1 - t;
  const a = mt * mt * mt;
  const c = 3 * mt * mt * t;
  const d = 3 * mt * t * t;
  const e = t * t * t;
  return { x: a * b[0].x + c * b[1].x + d * b[2].x + e * b[3].x, y: a * b[0].y + c * b[1].y + d * b[2].y + e * b[3].y };
}

function chordParams(d: P[]): number[] {
  const u = [0];
  for (let i = 1; i < d.length; i++) u.push(u[i - 1] + len(sub(d[i], d[i - 1])));
  const total = u[u.length - 1] || 1;
  return u.map((v) => v / total);
}

function generateBezier(d: P[], u: number[], t1: P, t2: P): Bez {
  const first = d[0];
  const last = d[d.length - 1];
  let c00 = 0, c01 = 0, c11 = 0, x0 = 0, x1 = 0;
  for (let i = 0; i < d.length; i++) {
    const t = u[i];
    const mt = 1 - t;
    const b1 = 3 * t * mt * mt;
    const b2 = 3 * t * t * mt;
    const a1 = mul(t1, b1);
    const a2 = mul(t2, b2);
    c00 += dot(a1, a1);
    c01 += dot(a1, a2);
    c11 += dot(a2, a2);
    const b0 = mt * mt * mt;
    const b3 = t * t * t;
    const tmp = sub(d[i], add(mul(first, b0 + b1), mul(last, b2 + b3)));
    x0 += dot(a1, tmp);
    x1 += dot(a2, tmp);
  }
  const det = c00 * c11 - c01 * c01;
  const segLen = len(sub(last, first));
  let al = 0;
  let ar = 0;
  if (Math.abs(det) > 1e-12) {
    al = (x0 * c11 - x1 * c01) / det;
    ar = (c00 * x1 - c01 * x0) / det;
  }
  const eps = 1e-6 * segLen;
  if (!(al > eps) || !(ar > eps) || al > segLen * 1.5 || ar > segLen * 1.5) {
    al = ar = segLen / 3;
  }
  return [first, add(first, mul(t1, al)), add(last, mul(t2, ar)), last];
}

function maxError(d: P[], b: Bez, u: number[]): [number, number] {
  let max = 0;
  let split = Math.floor(d.length / 2);
  for (let i = 1; i < d.length - 1; i++) {
    const p = bezierPoint(b, u[i]);
    const e = (p.x - d[i].x) ** 2 + (p.y - d[i].y) ** 2;
    if (e >= max) {
      max = e;
      split = i;
    }
  }
  return [max, split];
}

function reparameterize(d: P[], b: Bez, u: number[]): number[] {
  const q1: P[] = [mul(sub(b[1], b[0]), 3), mul(sub(b[2], b[1]), 3), mul(sub(b[3], b[2]), 3)];
  const q2: P[] = [mul(sub(q1[1], q1[0]), 2), mul(sub(q1[2], q1[1]), 2)];
  return u.map((t, i) => {
    const p = bezierPoint(b, t);
    const mt = 1 - t;
    const d1 = { x: mt * mt * q1[0].x + 2 * mt * t * q1[1].x + t * t * q1[2].x, y: mt * mt * q1[0].y + 2 * mt * t * q1[1].y + t * t * q1[2].y };
    const d2 = { x: mt * q2[0].x + t * q2[1].x, y: mt * q2[0].y + t * q2[1].y };
    const diff = sub(p, d[i]);
    const num = dot(diff, d1);
    const den = dot(d1, d1) + dot(diff, d2);
    if (Math.abs(den) < 1e-12) return t;
    return Math.max(0, Math.min(1, t - num / den));
  });
}

interface Piece {
  b: Bez;
  lo: number;
  hi: number;
}

/** Best single cubic for d[lo..hi] with fixed end tangents, and its error². */
function fitOne(d: P[], lo: number, hi: number, t1: P, t2: P, tol2: number): { b: Bez; err: number; split: number } {
  const pts = d.slice(lo, hi + 1);
  if (pts.length <= 2) {
    const dist = len(sub(pts[pts.length - 1], pts[0])) / 3;
    return { b: [pts[0], add(pts[0], mul(t1, dist)), add(pts[pts.length - 1], mul(t2, dist)), pts[pts.length - 1]], err: 0, split: lo };
  }
  let u = chordParams(pts);
  let b = generateBezier(pts, u, t1, t2);
  let [err, split] = maxError(pts, b, u);
  if (err >= tol2 && err < tol2 * 16) {
    for (let it = 0; it < 12 && err >= tol2; it++) {
      u = reparameterize(pts, b, u);
      const nb = generateBezier(pts, u, t1, t2);
      const [ne, ns] = maxError(pts, nb, u);
      b = nb;
      err = ne;
      split = ns;
    }
  }
  return { b, err, split: lo + split };
}

function splitTangent(d: P[], lo: number, hi: number, split: number): P {
  // Tangent at the split from a local line fit: robust to leftover grid noise.
  const reach = Math.max(1, Math.min(10, split - lo, hi - split));
  const back = sub(d[split - reach], d[split + reach]);
  const local = fitLine(d.slice(split - reach, split + reach + 1));
  let center = local ? (dot(local.d, back) < 0 ? mul(local.d, -1) : local.d) : norm(back);
  if (len(center) === 0) center = norm(sub(d[split - 1], d[split + 1]));
  return center;
}

function fitCubic(d: P[], lo: number, hi: number, t1: P, t2: P, tol2: number, out: Piece[], depth = 0) {
  const { b, err, split: s0 } = fitOne(d, lo, hi, t1, t2, tol2);
  const n = hi - lo + 1;
  // Never split into slivers: tiny spans are noise, not shape.
  if (err < tol2 || depth > 40 || n < 8) {
    out.push({ b, lo, hi });
    return;
  }
  const split = Math.max(lo + 3, Math.min(hi - 3, s0));
  const center = splitTangent(d, lo, hi, split);
  fitCubic(d, lo, split, t1, center, tol2, out, depth + 1);
  fitCubic(d, split, hi, mul(center, -1), t2, tol2, out, depth + 1);
}

/**
 * Greedy merge of neighbouring pieces: Schneider splits at the worst point,
 * which often leaves more joins than the shape needs. Two pieces are fused
 * whenever a single cubic over both still meets the tolerance — fewer nodes,
 * smoother outlines.
 */
function mergePieces(d: P[], pieces: Piece[], tol2: number): Piece[] {
  let list = pieces;
  let changed = true;
  while (changed && list.length > 1) {
    changed = false;
    const next: Piece[] = [];
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      const b = list[i + 1];
      if (b) {
        const t1 = norm(sub(a.b[1], a.b[0]));
        const t2 = norm(sub(b.b[2], b.b[3]));
        if (len(t1) > 0 && len(t2) > 0) {
          const f = fitOne(d, a.lo, b.hi, t1, t2, tol2);
          if (f.err < tol2) {
            next.push({ b: f.b, lo: a.lo, hi: b.hi });
            i++;
            changed = true;
            continue;
          }
        }
      }
      next.push(a);
    }
    list = next;
  }
  return list;
}

/**
 * Straight within `tol`? Samples within `trim` of either end may stray up to
 * 3 × tol: that is where a resampled corner gets rounded off, and the refined
 * corner point sits outside the rounding.
 */
function isLine(d: P[], tol: number, trim = 0): boolean {
  const a = d[0];
  const b = d[d.length - 1];
  const ab = sub(b, a);
  const l = len(ab);
  if (l < 1e-9) return d.length <= 2;
  const t2 = trim / l;
  for (let i = 1; i < d.length - 1; i++) {
    const ap = sub(d[i], a);
    const cross = Math.abs(ap.x * ab.y - ap.y * ab.x) / l;
    const t = dot(ap, ab) / (l * l);
    if (t < -0.05 || t > 1.05) return false;
    const nearEnd = t < t2 || t > 1 - t2;
    if (cross > (nearEnd ? tol * 3 : tol)) return false;
  }
  return true;
}

function fitSpan(raw: P[], t1: P, t2: P, opt: FitOptions, out: Segment[]) {
  const trim = opt.cornerSize * 7;
  if (raw.length <= 2 || isLine(raw, opt.tolerance, trim)) {
    out.push({ to: raw[raw.length - 1] });
    return;
  }
  // Endpoints stay pinned (corners / nodes); only the interior is smoothed.
  const d = raw.length > 4 && opt.smoothing > 0 ? smooth(raw, false, opt.smoothing) : raw;
  if (isLine(d, opt.tolerance, trim)) {
    out.push({ to: d[d.length - 1] });
    return;
  }
  if (len(t1) === 0) t1 = norm(sub(d[1], d[0]));
  if (len(t2) === 0) t2 = norm(sub(d[d.length - 2], d[d.length - 1]));
  const tol2 = opt.tolerance * opt.tolerance;
  const pieces: Piece[] = [];
  fitCubic(d, 0, d.length - 1, t1, t2, tol2, pieces);
  for (const { b } of mergePieces(d, pieces, tol2)) out.push({ c1: b[1], c2: b[2], to: b[3] });
}

function fitCircle(d: P[]): { c: P; r: number; dev: number } | null {
  // Kåsa algebraic fit.
  const n = d.length;
  if (n < 8) return null;
  let mx = 0, my = 0;
  for (const p of d) {
    mx += p.x;
    my += p.y;
  }
  mx /= n;
  my /= n;
  let suu = 0, svv = 0, suv = 0, suuu = 0, svvv = 0, suvv = 0, svuu = 0;
  for (const p of d) {
    const u = p.x - mx;
    const v = p.y - my;
    suu += u * u;
    svv += v * v;
    suv += u * v;
    suuu += u * u * u;
    svvv += v * v * v;
    suvv += u * v * v;
    svuu += v * u * u;
  }
  const det = suu * svv - suv * suv;
  if (Math.abs(det) < 1e-9) return null;
  const a = 0.5 * (suuu + suvv);
  const b = 0.5 * (svvv + svuu);
  const uc = (a * svv - b * suv) / det;
  const vc = (b * suu - a * suv) / det;
  const c = { x: uc + mx, y: vc + my };
  const r = Math.sqrt(uc * uc + vc * vc + (suu + svv) / n);
  let dev = 0;
  for (const p of d) dev = Math.max(dev, Math.abs(len(sub(p, c)) - r));
  return { c, r, dev };
}

function circleSegments(c: P, r: number, startAngle: number, sweepSign: number): FittedEdge {
  const k = 0.5522847498 * r;
  const segs: Segment[] = [];
  const pt = (a: number): P => ({ x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) });
  const tan = (a: number): P => ({ x: -Math.sin(a) * sweepSign, y: Math.cos(a) * sweepSign });
  let a0 = startAngle;
  for (let q = 0; q < 4; q++) {
    const a1 = a0 + (sweepSign * Math.PI) / 2;
    const p0 = pt(a0);
    const p1 = q === 3 ? pt(startAngle) : pt(a1);
    segs.push({ c1: add(p0, mul(tan(a0), k)), c2: sub(p1, mul(tan(a1), k)), to: p1 });
    a0 = a1;
  }
  return { start: pt(startAngle), segments: segs, circle: true };
}

/** Fits one planar-map edge. Open edges keep their node endpoints exactly. */
export function fitEdge(corners: Int32Array, w1: number, closed: boolean, opt: FitOptions): FittedEdge {
  const raw = edgeSamples(corners, w1, closed);
  const n = raw.length;
  if (!closed && n <= 3) {
    return { start: raw[0], segments: [{ to: raw[n - 1] }], circle: false };
  }
  const sigma = Math.max(0.8, opt.window / 3);
  const smoothPts = smooth(raw, closed, sigma);
  if (closed && opt.detectCircles) {
    const circ = fitCircle(raw);
    if (circ && circ.r >= 2.5 && circ.dev <= Math.max(opt.tolerance * 1.1, circ.r * 0.012)) {
      let area = 0;
      for (let i = 0; i < n; i++) {
        const a = raw[i];
        const b = raw[(i + 1) % n];
        area += a.x * b.y - b.x * a.y;
      }
      const start = Math.atan2(raw[0].y - circ.c.y, raw[0].x - circ.c.x);
      return circleSegments(circ.c, circ.r, start, area >= 0 ? 1 : -1);
    }
  }
  const cornerIdx = detectCorners(raw, closed, opt);
  const pts = raw.slice();
  const refined = new Map<number, P>();
  for (const i of cornerIdx) refined.set(i, refineCorner(raw, i, closed, opt.window));
  // Two vertices of one blurred corner can refine to the same point: keep one.
  for (let k = cornerIdx.length - 1; k > 0; k--) {
    const a = refined.get(cornerIdx[k - 1])!;
    const b = refined.get(cornerIdx[k])!;
    if (len(sub(a, b)) < 1.5) cornerIdx.splice(k, 1);
  }
  for (const i of cornerIdx) pts[i] = refined.get(i)!;

  const tanCount = Math.max(4, opt.window * 2);
  const segments: Segment[] = [];

  if (closed) {
    if (cornerIdx.length === 0) {
      // Smooth loop: split in two at points with shared, centred tangents.
      if (n < 4) return { start: raw[0], segments: raw.slice(1).concat([raw[0]]).map((p) => ({ to: p })), circle: false };
      const half = Math.floor(n / 2);
      const tA = norm(sub(smoothPts[1 % n], smoothPts[n - 1]));
      const tB = norm(sub(smoothPts[(half + 1) % n], smoothPts[half - 1]));
      fitSpan(pts.slice(0, half + 1), tA, mul(tB, -1), opt, segments);
      fitSpan(pts.slice(half).concat([pts[0]]), tB, mul(tA, -1), opt, segments);
      return { start: pts[0], segments, circle: false };
    }
    // Rotate so the loop starts at a corner.
    const startI = cornerIdx[0];
    const rot = pts.slice(startI).concat(pts.slice(0, startI));
    const rotCorners = cornerIdx.map((i) => (i - startI + n) % n).sort((a, b) => a - b);
    rotCorners.push(n);
    rot.push(rot[0]);
    for (let k = 0; k < rotCorners.length - 1; k++) {
      const a = rotCorners[k];
      const b = rotCorners[k + 1];
      const span = rot.slice(a, b + 1);
      fitSpan(span, tangentFrom(span, 0, 1, tanCount, false), tangentFrom(span, span.length - 1, -1, tanCount, false), opt, segments);
    }
    return { start: rot[0], segments, circle: false };
  }

  const breaks = [0, ...cornerIdx.filter((i) => i > 0 && i < n - 1), n - 1];
  for (let k = 0; k < breaks.length - 1; k++) {
    const span = pts.slice(breaks[k], breaks[k + 1] + 1);
    fitSpan(span, tangentFrom(span, 0, 1, tanCount, false), tangentFrom(span, span.length - 1, -1, tanCount, false), opt, segments);
  }
  return { start: pts[0], segments, circle: false };
}
