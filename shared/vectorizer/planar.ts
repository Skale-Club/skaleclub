// Planar map of a label image.
//
// Per-colour tracers (Potrace per layer, Illustrator's "abutting" mode) trace
// each colour on its own, so two neighbouring colours get two slightly
// different outlines: hairline gaps on screen, gaps or overlaps in a slicer.
// Here every boundary between two regions is extracted once, as a shared edge
// running between junction nodes. Both regions reference the same edge (one
// forwards, one backwards), so after curve fitting they still meet exactly.

import { VOID } from './segment';

export interface PlanarEdge {
  /** Pixel-corner indices (cy * (w + 1) + cx), first and last are nodes. */
  corners: Int32Array;
  closed: boolean;
  left: number;
  right: number;
}

export interface RingRef {
  edges: Array<{ edge: number; reversed: boolean }>;
  /** Signed area in px²; outer rings and holes have opposite signs. */
  area: number;
}

export interface PlanarRegion {
  id: number;
  label: number;
  area: number;
  rings: RingRef[];
}

export interface PlanarMap {
  width: number;
  height: number;
  edges: PlanarEdge[];
  regions: PlanarRegion[];
  nodeCount: number;
}

// Directions: 0 = east (+x), 1 = south (+y), 2 = west, 3 = north (y grows downward).
const DX = [1, 0, -1, 0];
const DY = [0, 1, 0, -1];

export function buildPlanarMap(labels: Int32Array, w: number, h: number, comp: Int32Array): PlanarMap {
  const W1 = w + 1;
  const regionOf = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? -1 : labels[y * w + x] === VOID ? -1 : comp[y * w + x]);

  // Left / right pixel of a crack walked from corner (cx, cy) in direction d.
  const leftPx = (cx: number, cy: number, d: number): number => {
    switch (d) {
      case 0: return regionOf(cx, cy - 1);
      case 1: return regionOf(cx, cy);
      case 2: return regionOf(cx - 1, cy);
      default: return regionOf(cx - 1, cy - 1);
    }
  };
  const rightPx = (cx: number, cy: number, d: number): number => {
    switch (d) {
      case 0: return regionOf(cx, cy);
      case 1: return regionOf(cx - 1, cy);
      case 2: return regionOf(cx - 1, cy - 1);
      default: return regionOf(cx, cy - 1);
    }
  };

  // Number of boundary cracks meeting at a corner; 3 or 4 makes it a node.
  const degree = (cx: number, cy: number): number => {
    const a = regionOf(cx - 1, cy - 1);
    const b = regionOf(cx, cy - 1);
    const c = regionOf(cx - 1, cy);
    const d = regionOf(cx, cy);
    return (a !== b ? 1 : 0) + (c !== d ? 1 : 0) + (a !== c ? 1 : 0) + (b !== d ? 1 : 0);
  };
  const nodeCache = new Int8Array(W1 * (h + 1)).fill(-1);
  const isNode = (cx: number, cy: number): boolean => {
    const k = cy * W1 + cx;
    if (nodeCache[k] < 0) nodeCache[k] = degree(cx, cy) >= 3 ? 1 : 0;
    return nodeCache[k] === 1;
  };

  // visited[directed crack]: horizontal cracks (E/W) then vertical ones (S/N).
  const hCount = w * (h + 1);
  const vCount = (w + 1) * h;
  const visited = new Uint8Array((hCount + vCount) * 2);
  const crackId = (cx: number, cy: number, d: number): number => {
    switch (d) {
      case 0: return (cy * w + cx) * 2;
      case 2: return (cy * w + cx - 1) * 2 + 1;
      case 1: return (hCount + cy * W1 + cx) * 2;
      default: return (hCount + (cy - 1) * W1 + cx) * 2 + 1;
    }
  };

  const edges: PlanarEdge[] = [];
  const edgeKey = new Map<number, number>();
  const regionRings = new Map<number, RingRef[]>();
  let nodeCount = 0;
  for (let cy = 0; cy <= h; cy++) for (let cx = 0; cx <= w; cx++) if (isNode(cx, cy)) nodeCount++;

  const keyOf = (a: number, b: number) => a * 4 + (b - a === 1 ? 0 : b - a === W1 ? 1 : b - a === -1 ? 2 : 3);

  const traceCycle = (sx: number, sy: number, sd: number) => {
    const region = leftPx(sx, sy, sd);
    const corners: number[] = [];
    const rights: number[] = [];
    let cx = sx, cy = sy, d = sd;
    let area = 0;
    do {
      visited[crackId(cx, cy, d)] = 1;
      corners.push(cy * W1 + cx);
      rights.push(rightPx(cx, cy, d));
      const nx = cx + DX[d];
      const ny = cy + DY[d];
      area += cx * ny - nx * cy;
      cx = nx;
      cy = ny;
      // Pixels ahead-left / ahead-right decide the turn (4-connectivity).
      const al = leftPx(cx, cy, d);
      const ar = rightPx(cx, cy, d);
      if (al !== region) d = (d + 3) % 4;
      else if (ar === region) d = (d + 1) % 4;
    } while (!(cx === sx && cy === sy && d === sd));

    const n = corners.length;
    const nodeIdx: number[] = [];
    for (let i = 0; i < n; i++) {
      const c = corners[i];
      if (isNode(c % W1, Math.floor(c / W1))) nodeIdx.push(i);
    }

    const ring: RingRef = { edges: [], area: area / 2 };
    const addSegment = (pts: number[], right: number, closed: boolean) => {
      const rev = keyOf(pts[pts.length - 1], pts[pts.length - 2]);
      const existing = edgeKey.get(rev);
      if (existing !== undefined) {
        ring.edges.push({ edge: existing, reversed: true });
        return;
      }
      const id = edges.length;
      edges.push({ corners: Int32Array.from(pts), closed, left: region, right });
      edgeKey.set(keyOf(pts[0], pts[1]), id);
      ring.edges.push({ edge: id, reversed: false });
    };

    if (nodeIdx.length === 0) {
      // A loop with no junction: start it at its smallest corner so the region
      // on the other side finds the same edge.
      let m = 0;
      for (let i = 1; i < n; i++) if (corners[i] < corners[m]) m = i;
      const pts: number[] = [];
      for (let k = 0; k <= n; k++) pts.push(corners[(m + k) % n]);
      addSegment(pts, rights[m], true);
    } else {
      for (let k = 0; k < nodeIdx.length; k++) {
        const a = nodeIdx[k];
        const b = nodeIdx[(k + 1) % nodeIdx.length];
        const len = ((b - a + n) % n) || n;
        const pts: number[] = [];
        for (let j = 0; j <= len; j++) pts.push(corners[(a + j) % n]);
        addSegment(pts, rights[a], false);
      }
    }
    let list = regionRings.get(region);
    if (!list) {
      list = [];
      regionRings.set(region, list);
    }
    list.push(ring);
  };

  // Every boundary crack is walked once per side that has a real region.
  for (let cy = 0; cy <= h; cy++) {
    for (let cx = 0; cx < w; cx++) {
      const above = regionOf(cx, cy - 1);
      const below = regionOf(cx, cy);
      if (above === below) continue;
      if (above >= 0 && !visited[crackId(cx, cy, 0)]) traceCycle(cx, cy, 0);
      if (below >= 0 && !visited[crackId(cx + 1, cy, 2)]) traceCycle(cx + 1, cy, 2);
    }
  }
  for (let cy = 0; cy < h; cy++) {
    for (let cx = 0; cx <= w; cx++) {
      const left = regionOf(cx - 1, cy);
      const right = regionOf(cx, cy);
      if (left === right) continue;
      if (right >= 0 && !visited[crackId(cx, cy, 1)]) traceCycle(cx, cy, 1);
      if (left >= 0 && !visited[crackId(cx, cy + 1, 3)]) traceCycle(cx, cy + 1, 3);
    }
  }

  const areas = new Map<number, number>();
  const regionLabel = new Map<number, number>();
  for (let i = 0; i < labels.length; i++) {
    if (labels[i] === VOID) continue;
    const c = comp[i];
    areas.set(c, (areas.get(c) ?? 0) + 1);
    if (!regionLabel.has(c)) regionLabel.set(c, labels[i]);
  }
  const regions: PlanarRegion[] = [];
  for (const [id, rings] of Array.from(regionRings)) {
    regions.push({ id, label: regionLabel.get(id) ?? VOID, area: areas.get(id) ?? 0, rings });
  }
  regions.sort((a, b) => a.id - b.id);
  return { width: w, height: h, edges, regions, nodeCount };
}
