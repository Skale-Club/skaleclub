// Colour analysis: how many colours does this artwork really have?
//
// Tracers like Illustrator's Image Trace cluster *every* pixel, so the blended
// pixels along anti-aliased edges pull in extra in-between shades ("I asked for
// 3 colours and got 29"). Here the palette is learned only from pixels sitting
// in flat areas — pixels whose whole neighbourhood is the same colour — and the
// edge pixels are explained later as mixtures of the colours on either side.

import { colorName, labDistance, oklabToRgb, rgbToHex, rgbToOklab, type Lab } from './color';
import type { RasterImage } from './image';
import { hasTransparency } from './image';
import type { DetectedColor, ImageAnalysis } from './types';

interface Bins {
  L: Float64Array;
  a: Float64Array;
  b: Float64Array;
  w: Float64Array;
  count: number;
}

export interface ColorModel {
  width: number;
  height: number;
  hasTransparency: boolean;
  transparentBorder: boolean;
  /** Weighted colour histogram of flat-area pixels. */
  flat: Bins;
  /** Histogram of every opaque pixel, for coverage and error estimates. */
  all: Bins;
  /** Border pixel colours (OKLab), for background detection. */
  border: Lab[];
  opaqueCount: number;
  flatCount: number;
}

const FLAT_DELTA = 0.035;
const MERGE_DISTANCE = 0.04;

class BinBuilder {
  private index = new Map<number, number>();
  L: number[] = [];
  a: number[] = [];
  b: number[] = [];
  w: number[] = [];

  add(lab: Lab, weight: number) {
    const key =
      Math.round(lab[0] * 120) * 1_000_000 +
      Math.round((lab[1] + 0.5) * 120) * 1_000 +
      Math.round((lab[2] + 0.5) * 120);
    let i = this.index.get(key);
    if (i === undefined) {
      i = this.w.length;
      this.index.set(key, i);
      this.L.push(0);
      this.a.push(0);
      this.b.push(0);
      this.w.push(0);
    }
    this.L[i] += lab[0] * weight;
    this.a[i] += lab[1] * weight;
    this.b[i] += lab[2] * weight;
    this.w[i] += weight;
  }

  build(): Bins {
    const n = this.w.length;
    const out: Bins = {
      L: new Float64Array(n),
      a: new Float64Array(n),
      b: new Float64Array(n),
      w: new Float64Array(n),
      count: n,
    };
    for (let i = 0; i < n; i++) {
      const w = this.w[i];
      out.w[i] = w;
      out.L[i] = this.L[i] / w;
      out.a[i] = this.a[i] / w;
      out.b[i] = this.b[i] / w;
    }
    return out;
  }
}

export function buildColorModel(img: RasterImage): ColorModel {
  const { width: w, height: h, data } = img;
  const n = w * h;
  const lab = new Float32Array(n * 3);
  const opaque = new Uint8Array(n);
  let opaqueCount = 0;
  for (let i = 0; i < n; i++) {
    if (data[i * 4 + 3] < 128) continue;
    opaque[i] = data[i * 4 + 3] >= 250 ? 2 : 1;
    opaqueCount++;
    const c = rgbToOklab(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]);
    lab[i * 3] = c[0];
    lab[i * 3 + 1] = c[1];
    lab[i * 3 + 2] = c[2];
  }

  // Largest OKLab step to any 8-neighbour: ~0 inside a flat fill, large on edges.
  const grad = new Float32Array(n).fill(Infinity);
  const flatLimit = FLAT_DELTA * FLAT_DELTA;
  let flatCount = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!opaque[i]) continue;
      let max = 0;
      let complete = opaque[i] === 2;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if ((dx === 0 && dy === 0) || xx < 0 || xx >= w) continue;
          const j = yy * w + xx;
          if (opaque[j] !== 2) {
            complete = false;
            continue;
          }
          const dl = lab[i * 3] - lab[j * 3];
          const da = lab[i * 3 + 1] - lab[j * 3 + 1];
          const db = lab[i * 3 + 2] - lab[j * 3 + 2];
          const d = dl * dl + da * da + db * db;
          if (d > max) max = d;
        }
      }
      grad[i] = max;
      if (complete && max < flatLimit) flatCount++;
    }
  }

  const flat = new BinBuilder();
  const all = new BinBuilder();
  // Tiny or heavily textured images have few truly flat pixels; fall back to a
  // soft weighting so the palette still comes mostly from the calm areas.
  const useSoft = flatCount < Math.max(64, opaqueCount * 0.02);
  for (let i = 0; i < n; i++) {
    if (!opaque[i]) continue;
    const c: Lab = [lab[i * 3], lab[i * 3 + 1], lab[i * 3 + 2]];
    all.add(c, 1);
    if (useSoft) {
      const g = Math.sqrt(grad[i] === Infinity ? 1 : grad[i]);
      flat.add(c, 1 / (1 + (g / 0.04) ** 2));
    } else if (grad[i] < flatLimit) {
      flat.add(c, 1);
    }
  }

  const border: Lab[] = [];
  let transparentBorderCount = 0;
  let borderTotal = 0;
  const visitBorder = (x: number, y: number) => {
    const i = y * w + x;
    borderTotal++;
    if (!opaque[i]) {
      transparentBorderCount++;
      return;
    }
    border.push([lab[i * 3], lab[i * 3 + 1], lab[i * 3 + 2]]);
  };
  for (let x = 0; x < w; x++) {
    visitBorder(x, 0);
    if (h > 1) visitBorder(x, h - 1);
  }
  for (let y = 1; y < h - 1; y++) {
    visitBorder(0, y);
    if (w > 1) visitBorder(w - 1, y);
  }

  return {
    width: w,
    height: h,
    hasTransparency: hasTransparency(img),
    transparentBorder: borderTotal > 0 && transparentBorderCount / borderTotal >= 0.5,
    flat: flat.build(),
    all: all.build(),
    border,
    opaqueCount,
    flatCount: useSoft ? 0 : flatCount,
  };
}

interface Cluster {
  c: Lab;
  w: number;
}

function nearest(bins: Bins, i: number, centers: Lab[]): [number, number] {
  let best = 0;
  let bestD = Infinity;
  for (let k = 0; k < centers.length; k++) {
    const dl = bins.L[i] - centers[k][0];
    const da = bins.a[i] - centers[k][1];
    const db = bins.b[i] - centers[k][2];
    const d = dl * dl + da * da + db * db;
    if (d < bestD) {
      bestD = d;
      best = k;
    }
  }
  return [best, bestD];
}

function lloyd(bins: Bins, init: Lab[], iterations: number): Cluster[] {
  let centers = init.map((c) => [...c] as Lab);
  let weights = new Array(centers.length).fill(0);
  for (let it = 0; it < iterations; it++) {
    const sum = centers.map(() => [0, 0, 0]);
    weights = new Array(centers.length).fill(0);
    for (let i = 0; i < bins.count; i++) {
      const [k] = nearest(bins, i, centers);
      const w = bins.w[i];
      sum[k][0] += bins.L[i] * w;
      sum[k][1] += bins.a[i] * w;
      sum[k][2] += bins.b[i] * w;
      weights[k] += w;
    }
    let moved = 0;
    const next = centers.map((c, k) => {
      if (weights[k] <= 0) return c;
      const n: Lab = [sum[k][0] / weights[k], sum[k][1] / weights[k], sum[k][2] / weights[k]];
      moved = Math.max(moved, labDistance(n, c));
      return n;
    });
    centers = next;
    if (moved < 1e-4) break;
  }
  return centers.map((c, k) => ({ c, w: weights[k] })).filter((cl) => cl.w > 0);
}

// Deterministic k-means++ seeding: the heaviest bin first, then whichever bin is
// furthest from the chosen centres (damped by log weight so lone noise pixels
// do not win over real colours).
function seed(bins: Bins, k: number, initial: Lab[] = []): Lab[] {
  const centers = [...initial];
  if (centers.length === 0 && bins.count > 0) {
    let best = 0;
    for (let i = 1; i < bins.count; i++) if (bins.w[i] > bins.w[best]) best = i;
    centers.push([bins.L[best], bins.a[best], bins.b[best]]);
  }
  while (centers.length < k) {
    let best = -1;
    let bestScore = 0;
    for (let i = 0; i < bins.count; i++) {
      const [, d] = nearest(bins, i, centers);
      const score = d * Math.log1p(bins.w[i]);
      if (score > bestScore) {
        bestScore = score;
        best = i;
      }
    }
    if (best < 0 || bestScore < 1e-7) break;
    centers.push([bins.L[best], bins.a[best], bins.b[best]]);
  }
  return centers;
}

function mergeClose(clusters: Cluster[], threshold: number): Cluster[] {
  const list = clusters.map((c) => ({ c: [...c.c] as Lab, w: c.w }));
  for (;;) {
    let bi = -1;
    let bj = -1;
    let bd = threshold;
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const d = labDistance(list[i].c, list[j].c);
        if (d < bd) {
          bd = d;
          bi = i;
          bj = j;
        }
      }
    }
    if (bi < 0) return list;
    list[bi] = combine(list[bi], list[bj]);
    list.splice(bj, 1);
  }
}

function combine(a: Cluster, b: Cluster): Cluster {
  const w = a.w + b.w;
  return {
    c: [
      (a.c[0] * a.w + b.c[0] * b.w) / w,
      (a.c[1] * a.w + b.c[1] * b.w) / w,
      (a.c[2] * a.w + b.c[2] * b.w) / w,
    ],
    w,
  };
}

/** The palette at the colour count the image itself suggests. */
export function autoPalette(model: ColorModel): Cluster[] {
  const bins = model.flat;
  if (bins.count === 0) return [];
  const k0 = Math.min(20, bins.count);
  let clusters = lloyd(bins, seed(bins, k0), 25);
  clusters = mergeClose(clusters, MERGE_DISTANCE);

  // Drop clusters that are too small to be a real fill, unless they are a
  // clearly distinct colour (a small red dot in a black logo is real).
  const total = clusters.reduce((s, c) => s + c.w, 0);
  const minAbs = model.flatCount > 0 ? Math.max(6, total * 0.00015) : total * 0.002;
  clusters.sort((a, b) => a.w - b.w);
  for (let i = 0; i < clusters.length && clusters.length > 1; ) {
    const cl = clusters[i];
    let nd = Infinity;
    for (const other of clusters) if (other !== cl) nd = Math.min(nd, labDistance(cl.c, other.c));
    const tooSmall = cl.w < minAbs || (cl.w < total * 0.004 && nd < 0.09);
    if (tooSmall) clusters.splice(i, 1);
    else i++;
  }

  clusters = lloyd(bins, clusters.map((c) => c.c), 15);
  clusters = mergeClose(clusters, MERGE_DISTANCE);
  return clusters.sort((a, b) => b.w - a.w);
}

/** The palette reduced or expanded to exactly `k` colours. */
export function paletteForCount(model: ColorModel, k: number): Cluster[] {
  const auto = autoPalette(model);
  if (k <= 0 || auto.length === 0) return auto;
  if (k === auto.length) return auto;
  let clusters: Cluster[];
  if (k < auto.length) {
    // Ward merging: always fuse the pair whose merge adds the least error.
    clusters = auto.map((c) => ({ c: [...c.c] as Lab, w: c.w }));
    while (clusters.length > k) {
      let bi = 0;
      let bj = 1;
      let best = Infinity;
      for (let i = 0; i < clusters.length; i++) {
        for (let j = i + 1; j < clusters.length; j++) {
          const d = labDistance(clusters[i].c, clusters[j].c);
          const cost = ((clusters[i].w * clusters[j].w) / (clusters[i].w + clusters[j].w)) * d * d;
          if (cost < best) {
            best = cost;
            bi = i;
            bj = j;
          }
        }
      }
      clusters[bi] = combine(clusters[bi], clusters[bj]);
      clusters.splice(bj, 1);
    }
    clusters = lloyd(model.flat, clusters.map((c) => c.c), 8);
  } else {
    // More colours than the image suggests: split along the opaque pixels,
    // which also covers soft shading the flat-pixel histogram ignores.
    const init = seed(model.all, k, auto.map((c) => c.c));
    clusters = lloyd(model.all, init, 20);
  }
  return clusters.sort((a, b) => b.w - a.w);
}

function snap(c: Lab): Lab {
  if (labDistance(c, [1, 0, 0]) < 0.035) return [1, 0, 0];
  if (labDistance(c, [0, 0, 0]) < 0.06) return [0, 0, 0];
  return c;
}

export function describePalette(model: ColorModel, clusters: Cluster[]): {
  colors: DetectedColor[];
  backgroundIndex: number | null;
  paletteError: number;
} {
  const centers = clusters.map((c) => snap(c.c));
  const share = new Array(centers.length).fill(0);
  let err = 0;
  let total = 0;
  for (let i = 0; i < model.all.count; i++) {
    const [k, d] = nearest(model.all, i, centers);
    share[k] += model.all.w[i];
    err += Math.sqrt(d) * model.all.w[i];
    total += model.all.w[i];
  }
  const colors = centers.map((c, k) => {
    const rgb = oklabToRgb(c[0], c[1], c[2]).map(Math.round) as [number, number, number];
    return { rgb, hex: rgbToHex(rgb), name: colorName(rgb), share: total ? share[k] / total : 0 };
  });

  // Two shades can share a name ("Black", "Black 2").
  const seen = new Map<string, number>();
  for (const c of colors) {
    const n = (seen.get(c.name) ?? 0) + 1;
    seen.set(c.name, n);
    if (n > 1) c.name = `${c.name} ${n}`;
  }

  let backgroundIndex: number | null = null;
  if (!model.transparentBorder && model.border.length > 0 && centers.length > 1) {
    const votes = new Array(centers.length).fill(0);
    for (const c of model.border) {
      let best = 0;
      let bd = Infinity;
      for (let k = 0; k < centers.length; k++) {
        const d = labDistance(c, centers[k]);
        if (d < bd) {
          bd = d;
          best = k;
        }
      }
      votes[best]++;
    }
    const top = votes.indexOf(Math.max(...votes));
    if (votes[top] / model.border.length >= 0.55) backgroundIndex = top;
  }
  return { colors, backgroundIndex, paletteError: total ? err / total : 0 };
}

export function analyzeImage(model: ColorModel, colorCount?: number): ImageAnalysis {
  const auto = autoPalette(model);
  const clusters = colorCount && colorCount !== auto.length ? paletteForCount(model, colorCount) : auto;
  const { colors, backgroundIndex } = describePalette(model, clusters);
  const autoError = describePalette(model, auto).paletteError;
  const flatRatio = model.opaqueCount ? model.flatCount / model.opaqueCount : 0;
  return {
    width: model.width,
    height: model.height,
    hasTransparency: model.hasTransparency,
    colors,
    autoColorCount: auto.length,
    backgroundIndex,
    transparentBackground: model.transparentBorder,
    flatRatio,
    paletteError: autoError,
    photographic: flatRatio < 0.3 || autoError > 0.06,
    lowResolution: Math.max(model.width, model.height) < 300,
  };
}
