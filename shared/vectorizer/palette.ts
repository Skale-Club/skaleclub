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
  /** The analysed pixels, per-pixel OKLab and flat-area mask (thin-colour recovery). */
  pixels: RasterImage;
  lab: Float32Array;
  flatMask: Uint8Array;
  /** Memoised automatic palette. */
  auto?: Cluster[];
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
    pixels: img,
    lab,
    flatMask: (() => {
      const m = new Uint8Array(n);
      for (let i = 0; i < n; i++) m[i] = opaque[i] && grad[i] < flatLimit ? 1 : 0;
      return m;
    })(),
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
  if (!model.auto) model.auto = computeAutoPalette(model);
  return model.auto.map((c) => ({ c: [...c.c] as Lab, w: c.w }));
}

function computeAutoPalette(model: ColorModel): Cluster[] {
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
  // Colours that only appear in thin strokes (small print, hairlines) have no
  // flat pixels at all; find them as pixels no nearby colour pair explains.
  for (let pass = 0; pass < 2; pass++) {
    const extra = recoverThinColors(model, clusters);
    if (!extra.length) break;
    clusters = clusters.concat(extra);
  }
  return clusters.sort((a, b) => b.w - a.w);
}

function recoverThinColors(model: ColorModel, clusters: Cluster[]): Cluster[] {
  const { width: w, height: h, data } = model.pixels;
  const n = w * h;
  if (clusters.length === 0 || clusters.length >= 30) return [];
  const rgb = clusters.map((c) => oklabToRgb(c.c[0], c.c[1], c.c[2]).map((v) => v / 255));

  // Which palette colours have flat pixels near each pixel (radius 2).
  const seedMask = new Uint32Array(n);
  for (let i = 0; i < n; i++) {
    if (!model.flatMask[i]) continue;
    let best = -1;
    let bd = 0.06 * 0.06;
    for (let k = 0; k < clusters.length; k++) {
      const c = clusters[k].c;
      const d = (model.lab[i * 3] - c[0]) ** 2 + (model.lab[i * 3 + 1] - c[1]) ** 2 + (model.lab[i * 3 + 2] - c[2]) ** 2;
      if (d < bd) {
        bd = d;
        best = k;
      }
    }
    if (best >= 0) seedMask[i] = 1 << best;
  }
  const near = new Uint32Array(n);
  const R = 2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let m = 0;
      for (let dy = -R; dy <= R; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -R; dx <= R; dx++) {
          const xx = x + dx;
          if (xx >= 0 && xx < w) m |= seedMask[yy * w + xx];
        }
      }
      near[y * w + x] = m;
    }
  }

  // Compression noise sets the bar: JPEG blocks around edges must not read as
  // a colour of their own.
  let noise = 0;
  let noiseN = 0;
  for (let i = 0; i < n; i += 3) {
    if (!seedMask[i]) continue;
    const k = 31 - Math.clz32(seedMask[i]);
    const A = rgb[k];
    noise += (data[i * 4] / 255 - A[0]) ** 2 + (data[i * 4 + 1] / 255 - A[1]) ** 2 + (data[i * 4 + 2] / 255 - A[2]) ** 2;
    noiseN++;
  }
  const noiseRms = noiseN ? Math.sqrt(noise / noiseN) : 0;
  const resLimit = Math.max(0.08, noiseRms * 6);
  const res = new Float32Array(n);
  let unexplainedCount = 0;
  for (let i = 0; i < n; i++) {
    if (data[i * 4 + 3] < 250 || model.flatMask[i]) continue;
    const p = [data[i * 4] / 255, data[i * 4 + 1] / 255, data[i * 4 + 2] / 255];
    const m = near[i];
    let best = Infinity;
    for (let a = 0; a < clusters.length && best > 0.0036; a++) {
      if (!(m & (1 << a))) continue;
      const A = rgb[a];
      best = Math.min(best, (p[0] - A[0]) ** 2 + (p[1] - A[1]) ** 2 + (p[2] - A[2]) ** 2);
      for (let b = a + 1; b < clusters.length; b++) {
        if (!(m & (1 << b))) continue;
        const B = rgb[b];
        const e = [B[0] - A[0], B[1] - A[1], B[2] - A[2]];
        const l2 = e[0] ** 2 + e[1] ** 2 + e[2] ** 2;
        if (l2 < 1e-9) continue;
        const t = Math.max(0, Math.min(1, ((p[0] - A[0]) * e[0] + (p[1] - A[1]) * e[1] + (p[2] - A[2]) * e[2]) / l2));
        best = Math.min(best, (p[0] - A[0] - t * e[0]) ** 2 + (p[1] - A[1] - t * e[1]) ** 2 + (p[2] - A[2] - t * e[2]) ** 2);
      }
    }
    // Between two known colours, compression (4:2:0 chroma) bends the blend
    // off the straight mix line; only a much larger miss counts there.
    const between = (m & (m - 1)) !== 0;
    const limit = between ? Math.max(0.2, resLimit) : resLimit;
    if (best > limit * limit) {
      res[i] = Math.sqrt(Math.min(best, 3));
      unexplainedCount++;
    }
  }
  const minCount = Math.max(24, model.opaqueCount * 0.001);
  if (unexplainedCount < minCount) return [];

  // Each connected patch of unexplained pixels is one stroke (a letter, a
  // hairline) drawn over a known local colour. Its purest pixels point from
  // that background towards the stroke colour; thin strokes rarely reach full
  // coverage, so strokes are grouped by that direction and the colour is taken
  // near the far end of the group. A thin black line on white thus yields
  // black (already in the palette) and a grey tagline yields its grey.
  const seen = new Uint8Array(n);
  const stack: number[] = [];
  const strokes: Array<{ bg: number; dir: Lab; dist: number; w: number }> = [];
  for (let s0 = 0; s0 < n; s0++) {
    if (!res[s0] || seen[s0]) continue;
    const members: number[] = [];
    const bgVotes = new Array(clusters.length).fill(0);
    stack.push(s0);
    seen[s0] = 1;
    while (stack.length) {
      const i = stack.pop()!;
      members.push(i);
      for (let k = 0; k < clusters.length; k++) if (near[i] & (1 << k)) bgVotes[k]++;
      const x = i % w;
      const y = (i - x) / w;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
          const j = yy * w + xx;
          if (res[j] && !seen[j]) {
            seen[j] = 1;
            stack.push(j);
          }
        }
      }
    }
    if (members.length < 4) continue;
    const bg = bgVotes.indexOf(Math.max(...bgVotes));
    if (bgVotes[bg] === 0) continue;
    members.sort((p, q) => res[q] - res[p]);
    const top = members.slice(0, Math.max(1, Math.ceil(members.length * 0.05)));
    const c: Lab = [0, 0, 0];
    for (const i of top) {
      c[0] += model.lab[i * 3] / top.length;
      c[1] += model.lab[i * 3 + 1] / top.length;
      c[2] += model.lab[i * 3 + 2] / top.length;
    }
    const b0 = clusters[bg].c;
    const d: Lab = [c[0] - b0[0], c[1] - b0[1], c[2] - b0[2]];
    const dist = Math.hypot(d[0], d[1], d[2]);
    // Faint halos (JPEG ringing) sit close to the background; real strokes don't.
    if (dist < Math.max(0.2, resLimit * 1.5)) continue;
    strokes.push({ bg, dir: [d[0] / dist, d[1] / dist, d[2] / dist], dist, w: members.length });
  }

  const out: Cluster[] = [];
  const used = new Uint8Array(strokes.length);
  strokes.sort((p, q) => q.w - p.w);
  for (let i = 0; i < strokes.length; i++) {
    if (used[i]) continue;
    const group = [strokes[i]];
    used[i] = 1;
    for (let j = i + 1; j < strokes.length; j++) {
      const a = strokes[i];
      const b = strokes[j];
      if (used[j] || a.bg !== b.bg) continue;
      if (a.dir[0] * b.dir[0] + a.dir[1] * b.dir[1] + a.dir[2] * b.dir[2] > 0.97) {
        group.push(b);
        used[j] = 1;
      }
    }
    const weight = group.reduce((sum, g) => sum + g.w, 0);
    if (weight < minCount || group.length < 2) continue;
    // Fully covered strokes pile up at one distance (the stroke colour);
    // partially covered ones scatter below it. Take the densest distance in
    // the upper half, weighted by stroke size.
    const sorted = group.map((g) => g.dist).sort((p, q) => p - q);
    const median = sorted[Math.floor(sorted.length / 2)];
    const upper = group.filter((g) => g.dist >= median);
    let far = median;
    let bestScore = -1;
    for (const g of upper) {
      let score = 0;
      for (const o of upper) score += o.w * Math.exp(-(((o.dist - g.dist) / 0.05) ** 2));
      if (score > bestScore) {
        bestScore = score;
        far = g.dist;
      }
    }
    const near2 = upper.filter((g) => Math.abs(g.dist - far) < 0.06);
    far = near2.reduce((sum, g) => sum + g.dist * g.w, 0) / near2.reduce((sum, g) => sum + g.w, 0);
    const b0 = clusters[group[0].bg].c;
    const dir = group[0].dir;
    const c: Lab = [b0[0] + dir[0] * far, b0[1] + dir[1] * far, b0[2] + dir[2] * far];
    if (!clusters.concat(out).every((o) => labDistance(o.c, c) > 0.08)) continue;
    // A colour sitting right on the mix of two palette colours is far more
    // likely a blur of their shared edge than a colour of its own.
    const p = oklabToRgb(c[0], c[1], c[2]).map((v) => v / 255);
    let onMix = false;
    for (let a = 0; a < rgb.length && !onMix; a++) {
      for (let b = a + 1; b < rgb.length && !onMix; b++) {
        const A = rgb[a];
        const B = rgb[b];
        const e = [B[0] - A[0], B[1] - A[1], B[2] - A[2]];
        const l2 = e[0] ** 2 + e[1] ** 2 + e[2] ** 2;
        if (l2 < 1e-9) continue;
        const t = ((p[0] - A[0]) * e[0] + (p[1] - A[1]) * e[1] + (p[2] - A[2]) * e[2]) / l2;
        if (t < 0.1 || t > 0.9) continue;
        const r = Math.hypot(p[0] - A[0] - t * e[0], p[1] - A[1] - t * e[1], p[2] - A[2] - t * e[2]);
        if (r < 0.06) onMix = true;
      }
    }
    if (!onMix) out.push({ c, w: weight });
  }
  return out;
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
