// Pixel → colour assignment and print-oriented cleanup of the label image.

import { rgbToOklab, type Rgb } from './color';
import { dilate, open } from './edt';
import type { RasterImage } from './image';

export const VOID = -1;

interface Source {
  /** Premultiplied sRGB + alpha, 0-1. */
  v: [number, number, number, number];
  lab: [number, number, number] | null;
  label: number;
}

/**
 * Assigns every pixel to a palette entry (or VOID for transparency).
 *
 * Pixels inside flat areas take their nearest colour. Pixels on edges are
 * treated as anti-aliasing: a blend of two colours found nearby, mixed the way
 * renderers mix them (in gamma sRGB, premultiplied). The pixel goes to
 * whichever colour covers more than half of it, which places the boundary at
 * sub-pixel precision and never invents an in-between colour — the classic
 * failure where the black/yellow edge of a logo gets traced as a thin brown
 * outline.
 */
export function assignLabels(
  img: RasterImage,
  palette: Rgb[][],
  options: { withVoid: boolean; radius: number },
): Int32Array {
  const { width: w, height: h, data } = img;
  const n = w * h;
  const sources: Source[] = [];
  palette.forEach((srcs, label) => {
    for (const rgb of srcs) {
      sources.push({
        v: [rgb[0] / 255, rgb[1] / 255, rgb[2] / 255, 1],
        lab: rgbToOklab(rgb[0], rgb[1], rgb[2]),
        label,
      });
    }
  });
  if (options.withVoid) sources.push({ v: [0, 0, 0, 0], lab: null, label: VOID });
  const voidIndex = options.withVoid ? sources.length - 1 : -1;
  const labSources = sources.filter((s) => s.lab);

  // Nearest source by OKLab, cached on a 6-bit-per-channel grid.
  const cacheIdx = new Int16Array(1 << 18).fill(-1);
  const cacheDist = new Float32Array(1 << 18);
  const nearestOpaque = (r: number, g: number, b: number): number => {
    const key = ((r >> 2) << 12) | ((g >> 2) << 6) | (b >> 2);
    if (cacheIdx[key] >= 0) return key;
    // Evaluate at the centre of the cache cell so results do not depend on
    // which pixel happened to fill it first.
    const lab = rgbToOklab((r & ~3) + 1.5, (g & ~3) + 1.5, (b & ~3) + 1.5);
    let best = -1;
    let bd = Infinity;
    for (let s = 0; s < sources.length; s++) {
      const sl = sources[s].lab;
      if (!sl) continue;
      const d = (lab[0] - sl[0]) ** 2 + (lab[1] - sl[1]) ** 2 + (lab[2] - sl[2]) ** 2;
      if (d < bd) {
        bd = d;
        best = s;
      }
    }
    cacheIdx[key] = best;
    cacheDist[key] = Math.sqrt(bd);
    return key;
  };

  const nearest = new Int16Array(n);
  const near = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = data[i * 4 + 3];
    if (voidIndex >= 0 && a < 128) {
      nearest[i] = voidIndex;
      near[i] = a / 255;
      continue;
    }
    if (labSources.length === 0) {
      nearest[i] = voidIndex;
      near[i] = 1;
      continue;
    }
    const key = nearestOpaque(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]);
    nearest[i] = cacheIdx[key];
    near[i] = a >= 250 ? cacheDist[key] : 1;
  }

  // Core pixels: close to a source colour and agreeing with all 4 neighbours.
  const core = new Uint8Array(n);
  const coreLimit = 0.06;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const s = nearest[i];
      if (s < 0) continue;
      const isVoid = s === voidIndex;
      if (isVoid ? data[i * 4 + 3] > 8 : near[i] > coreLimit) continue;
      // An exact colour match is trusted even without agreeing neighbours, so
      // one-pixel-wide lines still seed their colour.
      if (!isVoid && near[i] < 0.012) {
        core[i] = 1;
        continue;
      }
      if (x > 0 && nearest[i - 1] !== s) continue;
      if (x < w - 1 && nearest[i + 1] !== s) continue;
      if (y > 0 && nearest[i - w] !== s) continue;
      if (y < h - 1 && nearest[i + w] !== s) continue;
      core[i] = 1;
    }
  }

  const useMasks = sources.length <= 31;
  let masks: Uint32Array | null = null;
  if (useMasks) {
    masks = new Uint32Array(n);
    for (let i = 0; i < n; i++) if (core[i]) masks[i] = 1 << nearest[i];
    masks = orDilate(masks, w, h, Math.max(1, Math.round(options.radius)));
  }

  const out = new Int32Array(n);
  const RES_MAX = 0.12 * 0.12;
  const ALL = sources.length >= 31 ? 0x7fffffff : (1 << sources.length) - 1;
  for (let i = 0; i < n; i++) {
    if (core[i] || !masks) {
      out[i] = nearest[i] >= 0 ? sources[nearest[i]].label : VOID;
      continue;
    }
    const a = data[i * 4 + 3] / 255;
    const p0 = (data[i * 4] / 255) * a;
    const p1 = (data[i * 4 + 1] / 255) * a;
    const p2 = (data[i * 4 + 2] / 255) * a;
    const p3 = a;
    const m = masks[i];
    let best = -1;
    let bestRes = Infinity;
    // Local candidates first; if they cannot explain the pixel (a thin line
    // with no flat core of its own), fall back to every pair of colours.
    for (let pass = m !== 0 ? 0 : 1; pass < 2; pass++) {
      const mask = pass === 0 ? m : ALL;
      if (pass === 1 && best >= 0 && bestRes <= RES_MAX) break;
      for (let s = 0; s < sources.length; s++) {
        if (!(mask & (1 << s))) continue;
        const A = sources[s].v;
        // Single-colour fit.
        const r0 = (p0 - A[0]) ** 2 + (p1 - A[1]) ** 2 + (p2 - A[2]) ** 2 + (p3 - A[3]) ** 2;
        if (r0 < bestRes) {
          bestRes = r0;
          best = s;
        }
        for (let t = s + 1; t < sources.length; t++) {
          if (!(mask & (1 << t))) continue;
          const B = sources[t].v;
          const e0 = B[0] - A[0], e1 = B[1] - A[1], e2 = B[2] - A[2], e3 = B[3] - A[3];
          const len = e0 * e0 + e1 * e1 + e2 * e2 + e3 * e3;
          if (len < 1e-9) continue;
          let u = ((p0 - A[0]) * e0 + (p1 - A[1]) * e1 + (p2 - A[2]) * e2 + (p3 - A[3]) * e3) / len;
          u = Math.max(0, Math.min(1, u));
          const res =
            (p0 - A[0] - u * e0) ** 2 + (p1 - A[1] - u * e1) ** 2 + (p2 - A[2] - u * e2) ** 2 + (p3 - A[3] - u * e3) ** 2;
          if (res < bestRes) {
            bestRes = res;
            best = u < 0.5 ? s : t;
          }
        }
      }
    }
    if (best < 0 || bestRes > RES_MAX) best = nearest[i];
    out[i] = best >= 0 ? sources[best].label : VOID;
  }
  return out;
}

function orDilate(src: Uint32Array, w: number, h: number, r: number): Uint32Array {
  const tmp = new Uint32Array(src.length);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      let v = 0;
      const x0 = Math.max(0, x - r);
      const x1 = Math.min(w - 1, x + r);
      for (let xx = x0; xx <= x1; xx++) v |= src[row + xx];
      tmp[row + x] = v;
    }
  }
  const out = new Uint32Array(src.length);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      let v = 0;
      const y0 = Math.max(0, y - r);
      const y1 = Math.min(h - 1, y + r);
      for (let yy = y0; yy <= y1; yy++) v |= tmp[yy * w + x];
      out[y * w + x] = v;
    }
  }
  return out;
}

/** 3×3 majority vote: removes single-pixel jaggies without moving real edges. */
export function majorityFilter(labels: Int32Array, w: number, h: number): Int32Array {
  const out = new Int32Array(labels);
  const vals = new Int32Array(9);
  const counts = new Int32Array(9);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const v = labels[i + dy * w + dx];
          let k = 0;
          while (k < n && vals[k] !== v) k++;
          if (k === n) {
            vals[n] = v;
            counts[n] = 0;
            n++;
          }
          counts[k]++;
        }
      }
      for (let k = 0; k < n; k++) {
        if (counts[k] >= 6 && vals[k] !== labels[i]) {
          out[i] = vals[k];
          break;
        }
      }
    }
  }
  return out;
}

export interface Components {
  comp: Int32Array;
  count: number;
  label: Int32Array;
  area: Int32Array;
}

/** 4-connected components of equal labels (VOID areas are components too). */
export function components(labels: Int32Array, w: number, h: number): Components {
  const n = w * h;
  const comp = new Int32Array(n).fill(-1);
  const queue = new Int32Array(n);
  const labelList: number[] = [];
  const areaList: number[] = [];
  let count = 0;
  for (let s = 0; s < n; s++) {
    if (comp[s] >= 0) continue;
    const L = labels[s];
    let head = 0;
    let tail = 0;
    queue[tail++] = s;
    comp[s] = count;
    while (head < tail) {
      const i = queue[head++];
      const x = i % w;
      if (x > 0 && comp[i - 1] < 0 && labels[i - 1] === L) {
        comp[i - 1] = count;
        queue[tail++] = i - 1;
      }
      if (x < w - 1 && comp[i + 1] < 0 && labels[i + 1] === L) {
        comp[i + 1] = count;
        queue[tail++] = i + 1;
      }
      if (i >= w && comp[i - w] < 0 && labels[i - w] === L) {
        comp[i - w] = count;
        queue[tail++] = i - w;
      }
      if (i + w < n && comp[i + w] < 0 && labels[i + w] === L) {
        comp[i + w] = count;
        queue[tail++] = i + w;
      }
    }
    labelList.push(L);
    areaList.push(tail);
    count++;
  }
  return { comp, count, label: Int32Array.from(labelList), area: Int32Array.from(areaList) };
}

/**
 * Merges every connected patch smaller than `minArea` pixels into the
 * neighbouring colour it shares the longest border with. Returns the number of
 * patches removed.
 */
export function removeIslands(labels: Int32Array, w: number, h: number, minArea: number): number {
  let removed = 0;
  for (let pass = 0; pass < 4; pass++) {
    const cc = components(labels, w, h);
    const small = new Uint8Array(cc.count);
    let any = false;
    for (let c = 0; c < cc.count; c++) {
      if (cc.area[c] < minArea) {
        small[c] = 1;
        any = true;
      }
    }
    if (!any) break;
    // Shared border length per (small component, neighbouring label).
    const border = new Map<number, Map<number, number>>();
    const bump = (c: number, L: number) => {
      let m = border.get(c);
      if (!m) {
        m = new Map();
        border.set(c, m);
      }
      m.set(L, (m.get(L) ?? 0) + 1);
    };
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const a = cc.comp[i];
        if (x < w - 1) {
          const b = cc.comp[i + 1];
          if (a !== b) {
            if (small[a]) bump(a, labels[i + 1]);
            if (small[b]) bump(b, labels[i]);
          }
        }
        if (y < h - 1) {
          const b = cc.comp[i + w];
          if (a !== b) {
            if (small[a]) bump(a, labels[i + w]);
            if (small[b]) bump(b, labels[i]);
          }
        }
      }
    }
    const target = new Int32Array(cc.count);
    const changes = new Uint8Array(cc.count);
    // Smallest first, so a speck inside another speck resolves sensibly.
    const order = Array.from(border.keys()).sort((a, b) => cc.area[a] - cc.area[b]);
    let changed = 0;
    for (const c of order) {
      const m = border.get(c)!;
      let best = cc.label[c];
      let bestCount = -1;
      for (const [L, count] of Array.from(m)) {
        if (L !== cc.label[c] && count > bestCount) {
          bestCount = count;
          best = L;
        }
      }
      if (best !== cc.label[c]) {
        target[c] = best;
        changes[c] = 1;
        changed++;
      }
    }
    if (!changed) break;
    for (let i = 0; i < labels.length; i++) {
      const c = cc.comp[i];
      if (changes[c]) labels[i] = target[c];
    }
    removed += changed;
  }
  return removed;
}

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

function labelBox(labels: Int32Array, w: number, h: number, L: number): Box | null {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (labels[y * w + x] !== L) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
}

/**
 * Pixels of colour `L` belonging to details thinner than 2 × radius, as a full
 * image mask. Works on the colour's bounding box to stay fast.
 */
export function thinMask(labels: Int32Array, w: number, h: number, L: number, radius: number): Uint8Array {
  const out = new Uint8Array(w * h);
  const box = labelBox(labels, w, h, L);
  if (!box || radius < 0.75) return out;
  const pad = Math.ceil(radius) + 2;
  const x0 = Math.max(0, box.x0 - pad);
  const y0 = Math.max(0, box.y0 - pad);
  const x1 = Math.min(w - 1, box.x1 + pad);
  const y1 = Math.min(h - 1, box.y1 + pad);
  const bw = x1 - x0 + 1;
  const bh = y1 - y0 + 1;
  const mask = new Uint8Array(bw * bh);
  for (let y = 0; y < bh; y++) {
    for (let x = 0; x < bw; x++) mask[y * bw + x] = labels[(y + y0) * w + x + x0] === L ? 1 : 0;
  }
  const opened = open(mask, bw, bh, radius);
  for (let y = 0; y < bh; y++) {
    for (let x = 0; x < bw; x++) {
      const j = y * bw + x;
      if (mask[j] && !opened[j]) out[(y + y0) * w + x + x0] = 1;
    }
  }
  return out;
}

/**
 * Thickens details narrower than the minimum feature size by growing them into
 * the background (never into another colour). Returns pixels changed.
 */
export function thickenThin(
  labels: Int32Array,
  w: number,
  h: number,
  colorLabels: number[],
  radius: number,
  canOverwrite: (label: number) => boolean,
): number {
  let changed = 0;
  // Smallest colours first: they are the ones most likely made of fine detail.
  const areas = colorLabels.map((L) => {
    let a = 0;
    for (let i = 0; i < labels.length; i++) if (labels[i] === L) a++;
    return { L, a };
  });
  areas.sort((p, q) => p.a - q.a);
  for (const { L } of areas) {
    const thin = thinMask(labels, w, h, L, radius);
    let any = false;
    for (let i = 0; i < thin.length; i++) if (thin[i]) { any = true; break; }
    if (!any) continue;
    const grown = dilate(thin, w, h, Math.max(1, radius * 0.8));
    for (let i = 0; i < grown.length; i++) {
      if (grown[i] && labels[i] !== L && canOverwrite(labels[i])) {
        labels[i] = L;
        changed++;
      }
    }
  }
  return changed;
}
