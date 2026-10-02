// Extrudes flattened outlines into closed, consistently wound triangle meshes.

import earcut from 'earcut';
import type { Point } from './types';

export class MeshBuilder {
  positions: number[] = [];
  indices: number[] = [];

  /**
   * Adds a prism over a polygon with holes (ring 0 = outer, in a y-up frame)
   * from z0 to z1. Walls and caps share vertices, so each prism is watertight.
   */
  addPrism(rings: Point[][], z0: number, z1: number) {
    const clean = rings.map(dedupe).filter((r) => r.length >= 3 && Math.abs(signedArea(r)) > 1e-9);
    if (clean.length === 0) return;
    // Outer counter-clockwise, holes clockwise (y up).
    if (signedArea(clean[0]) < 0) clean[0].reverse();
    for (let i = 1; i < clean.length; i++) if (signedArea(clean[i]) > 0) clean[i].reverse();

    const coords: number[] = [];
    const holes: number[] = [];
    const ringStart: number[] = [];
    let count = 0;
    clean.forEach((r, k) => {
      if (k > 0) holes.push(count);
      ringStart.push(count);
      for (const p of r) coords.push(p.x, p.y);
      count += r.length;
    });

    let tris = earcut(coords, holes.length ? holes : null, 2);
    tris = repairDroppedVertices(tris, clean, ringStart);

    const base = this.positions.length / 3;
    for (let i = 0; i < count; i++) this.positions.push(coords[i * 2], coords[i * 2 + 1], z0);
    for (let i = 0; i < count; i++) this.positions.push(coords[i * 2], coords[i * 2 + 1], z1);

    for (let t = 0; t < tris.length; t += 3) {
      let a = tris[t], b = tris[t + 1], c = tris[t + 2];
      const area =
        (coords[b * 2] - coords[a * 2]) * (coords[c * 2 + 1] - coords[a * 2 + 1]) -
        (coords[c * 2] - coords[a * 2]) * (coords[b * 2 + 1] - coords[a * 2 + 1]);
      if (area === 0) continue;
      if (area < 0) [b, c] = [c, b];
      // Top faces up (CCW seen from above), bottom faces down.
      this.indices.push(base + count + a, base + count + b, base + count + c);
      this.indices.push(base + a, base + c, base + b);
    }

    clean.forEach((r, k) => {
      const s = ringStart[k];
      const n = r.length;
      for (let i = 0; i < n; i++) {
        const a = base + s + i;
        const b = base + s + ((i + 1) % n);
        this.indices.push(a, b, b + count, a, b + count, a + count);
      }
    });
  }

  build(): { positions: Float32Array; indices: Uint32Array } {
    return { positions: Float32Array.from(this.positions), indices: Uint32Array.from(this.indices) };
  }
}

function dedupe(r: Point[]): Point[] {
  const out: Point[] = [];
  for (const p of r) {
    const q = out[out.length - 1];
    if (!q || Math.abs(q.x - p.x) > 1e-9 || Math.abs(q.y - p.y) > 1e-9) out.push(p);
  }
  while (out.length > 1) {
    const a = out[0];
    const b = out[out.length - 1];
    if (Math.abs(a.x - b.x) > 1e-9 || Math.abs(a.y - b.y) > 1e-9) break;
    out.pop();
  }
  return out;
}

export function signedArea(r: Point[]): number {
  let a = 0;
  for (let i = 0, n = r.length; i < n; i++) {
    const p = r[i];
    const q = r[(i + 1) % n];
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

/**
 * Earcut skips collinear and duplicate ring vertices. The walls still use
 * them, which would leave T-junctions; split the cap triangle on that edge so
 * cap and walls share every vertex.
 */
function repairDroppedVertices(tris: number[], rings: Point[][], ringStart: number[]): number[] {
  const used = new Uint8Array(ringStart.length ? ringStart[ringStart.length - 1] + rings[rings.length - 1].length : 0);
  for (const v of tris) used[v] = 1;
  let missing = false;
  for (let i = 0; i < used.length; i++) if (!used[i]) { missing = true; break; }
  if (!missing) return tris;

  const out = tris.slice();
  const edgeTri = new Map<string, number>();
  const key = (a: number, b: number) => (a < b ? `${a},${b}` : `${b},${a}`);
  const index = (t: number) => {
    edgeTri.set(key(out[t], out[t + 1]), t);
    edgeTri.set(key(out[t + 1], out[t + 2]), t);
    edgeTri.set(key(out[t + 2], out[t]), t);
  };
  for (let t = 0; t < out.length; t += 3) index(t);

  rings.forEach((r, k) => {
    const s = ringStart[k];
    const n = r.length;
    for (let i = 0; i < n; i++) {
      const v = s + i;
      if (used[v]) continue;
      let pi = (i - 1 + n) % n;
      while (!used[s + pi] && pi !== i) pi = (pi - 1 + n) % n;
      let ni = (i + 1) % n;
      while (!used[s + ni] && ni !== i) ni = (ni + 1) % n;
      const a = s + pi;
      const b = s + ni;
      const t = edgeTri.get(key(a, b));
      if (t === undefined) continue;
      const tri = [out[t], out[t + 1], out[t + 2]];
      const ia = tri.indexOf(a);
      const ib = tri.indexOf(b);
      const x = tri[3 - ia - ib];
      // Winding is normalised by the caller, so order does not matter here.
      out[t] = a;
      out[t + 1] = v;
      out[t + 2] = x;
      out.push(v, b, x);
      edgeTri.delete(key(a, b));
      index(t);
      index(out.length - 3);
      used[v] = 1;
    }
  });
  return out;
}
