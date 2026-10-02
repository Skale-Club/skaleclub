// Base plate / keychain composition, done in raster space so the plate,
// the keyring hole and the logo all come out of the same exact tracer.

import { dilate } from './edt';
import { VOID } from './segment';
import type { BaseShape, KeyringPosition } from './types';

export interface BaseOptions {
  shape: BaseShape;
  marginPx: number;
  cornerPx: number;
  keyring: { enabled: boolean; position: KeyringPosition; holeRadiusPx: number; ringWidthPx: number } | null;
}

export interface Composition {
  width: number;
  height: number;
  labels: Int32Array;
  /** Silhouette of the printed base (null when there is none). */
  base: Uint8Array | null;
  /** Artwork bounding box inside the composition, in pixels. */
  art: { x: number; y: number; width: number; height: number };
  /** Offset of the composition relative to the input label image. */
  offsetX: number;
  offsetY: number;
}

export function contentBox(labels: Int32Array, w: number, h: number) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (labels[y * w + x] === VOID) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
}

const DIRS: Record<KeyringPosition, [number, number]> = {
  top: [0, -1],
  bottom: [0, 1],
  left: [-1, 0],
  right: [1, 0],
  'top-left': [-Math.SQRT1_2, -Math.SQRT1_2],
  'top-right': [Math.SQRT1_2, -Math.SQRT1_2],
};

function fillHoles(mask: Uint8Array, w: number, h: number): Uint8Array {
  // Flood the outside from the frame; anything not reached is inside.
  const outside = new Uint8Array(mask.length);
  const queue = new Int32Array(mask.length);
  let tail = 0;
  const push = (i: number) => {
    if (!mask[i] && !outside[i]) {
      outside[i] = 1;
      queue[tail++] = i;
    }
  };
  for (let x = 0; x < w; x++) {
    push(x);
    push((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    push(y * w);
    push(y * w + w - 1);
  }
  for (let head = 0; head < tail; head++) {
    const i = queue[head];
    const x = i % w;
    if (x > 0) push(i - 1);
    if (x < w - 1) push(i + 1);
    if (i >= w) push(i - w);
    if (i + w < mask.length) push(i + w);
  }
  const out = new Uint8Array(mask.length);
  for (let i = 0; i < out.length; i++) out[i] = outside[i] ? 0 : 1;
  return out;
}

function disk(mask: Uint8Array, w: number, h: number, cx: number, cy: number, r: number, value: number) {
  const x0 = Math.max(0, Math.floor(cx - r - 1));
  const x1 = Math.min(w - 1, Math.ceil(cx + r + 1));
  const y0 = Math.max(0, Math.floor(cy - r - 1));
  const y1 = Math.min(h - 1, Math.ceil(cy + r + 1));
  const r2 = r * r;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      if (dx * dx + dy * dy <= r2) mask[y * w + x] = value;
    }
  }
}

function capsule(mask: Uint8Array, w: number, h: number, ax: number, ay: number, bx: number, by: number, r: number) {
  const x0 = Math.max(0, Math.floor(Math.min(ax, bx) - r - 1));
  const x1 = Math.min(w - 1, Math.ceil(Math.max(ax, bx) + r + 1));
  const y0 = Math.max(0, Math.floor(Math.min(ay, by) - r - 1));
  const y1 = Math.min(h - 1, Math.ceil(Math.max(ay, by) + r + 1));
  const vx = bx - ax;
  const vy = by - ay;
  const l2 = vx * vx + vy * vy || 1;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const px = x + 0.5 - ax;
      const py = y + 0.5 - ay;
      const t = Math.max(0, Math.min(1, (px * vx + py * vy) / l2));
      const dx = px - t * vx;
      const dy = py - t * vy;
      if (dx * dx + dy * dy <= r * r) mask[y * w + x] = 1;
    }
  }
}

function diskHits(mask: Uint8Array, w: number, h: number, cx: number, cy: number, r: number): boolean {
  const x0 = Math.floor(cx - r - 1), x1 = Math.ceil(cx + r + 1);
  const y0 = Math.floor(cy - r - 1), y1 = Math.ceil(cy + r + 1);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      if (dx * dx + dy * dy <= r * r && mask[y * w + x]) return true;
    }
  }
  return false;
}

export function composeBase(labels: Int32Array, w: number, h: number, opt: BaseOptions): Composition | null {
  const box = contentBox(labels, w, h);
  if (!box) return null;
  const hasBase = opt.shape !== 'none';
  const ring = hasBase && opt.keyring?.enabled ? opt.keyring : null;
  const ringReach = ring ? 2 * (ring.holeRadiusPx + ring.ringWidthPx) + ring.holeRadiusPx : 0;
  const pad = Math.ceil((hasBase ? opt.marginPx : 0) + ringReach + 4);
  const bw = box.x1 - box.x0 + 1;
  const bh = box.y1 - box.y0 + 1;
  // A circle around a wide logo reaches further than the margin.
  const circleExtra = opt.shape === 'circle' ? Math.ceil(Math.hypot(bw, bh) / 2 - Math.min(bw, bh) / 2) : 0;
  const P = pad + circleExtra;
  const W = bw + 2 * P;
  const H = bh + 2 * P;
  const out = new Int32Array(W * H).fill(VOID);
  for (let y = 0; y < bh; y++) {
    for (let x = 0; x < bw; x++) out[(y + P) * W + x + P] = labels[(y + box.y0) * w + x + box.x0];
  }
  const logo = new Uint8Array(W * H);
  for (let i = 0; i < out.length; i++) logo[i] = out[i] === VOID ? 0 : 1;

  let base: Uint8Array | null = null;
  const ax0 = P, ay0 = P, ax1 = P + bw, ay1 = P + bh; // art box (corner coords)
  if (hasBase) {
    base = new Uint8Array(W * H);
    const m = opt.marginPx;
    if (opt.shape === 'contour') {
      base = fillHoles(dilate(logo, W, H, Math.max(0.5, m)), W, H);
    } else if (opt.shape === 'circle') {
      const cx = (ax0 + ax1) / 2;
      const cy = (ay0 + ay1) / 2;
      let r = 0;
      for (let y = ay0; y < ay1; y++) {
        for (let x = ax0; x < ax1; x++) {
          if (!logo[y * W + x]) continue;
          for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) r = Math.max(r, Math.hypot(x + dx - cx, y + dy - cy));
        }
      }
      disk(base, W, H, cx, cy, r + m, 1);
    } else {
      const rx0 = ax0 - m, ry0 = ay0 - m, rx1 = ax1 + m, ry1 = ay1 + m;
      const cr = opt.shape === 'rounded' ? Math.min(opt.cornerPx, (rx1 - rx0) / 2, (ry1 - ry0) / 2) : 0;
      for (let y = Math.max(0, Math.floor(ry0)); y < Math.min(H, Math.ceil(ry1)); y++) {
        for (let x = Math.max(0, Math.floor(rx0)); x < Math.min(W, Math.ceil(rx1)); x++) {
          const px = x + 0.5, py = y + 0.5;
          if (px < rx0 || px > rx1 || py < ry0 || py > ry1) continue;
          if (cr > 0) {
            const qx = Math.max(rx0 + cr - px, 0, px - (rx1 - cr));
            const qy = Math.max(ry0 + cr - py, 0, py - (ry1 - cr));
            if (qx * qx + qy * qy > cr * cr) continue;
          }
          base[y * W + x] = 1;
        }
      }
    }
    for (let i = 0; i < base.length; i++) if (logo[i]) base[i] = 1;

    if (ring) {
      const [dx, dy] = DIRS[ring.position];
      const cx = (ax0 + ax1) / 2;
      const cy = (ay0 + ay1) / 2;
      // Furthest base pixel in the keyring direction.
      let best = -Infinity, ex = cx, ey = cy;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          if (!base[y * W + x]) continue;
          const px = x + 0.5, py = y + 0.5;
          const d = (px - cx) * dx + (py - cy) * dy;
          // Prefer points near the centre line so the tab sits centred.
          const off = Math.abs((px - cx) * dy - (py - cy) * dx);
          const score = d - off * 0.35;
          if (score > best) {
            best = score;
            ex = px;
            ey = py;
          }
        }
      }
      const R = ring.holeRadiusPx + ring.ringWidthPx;
      const clearance = ring.ringWidthPx * 0.6;
      let t = ring.holeRadiusPx * 0.6;
      let hx = ex + dx * t, hy = ey + dy * t;
      for (let i = 0; i < 400 && diskHits(logo, W, H, hx, hy, ring.holeRadiusPx + clearance); i++) {
        t += 1;
        hx = ex + dx * t;
        hy = ey + dy * t;
      }
      capsule(base, W, H, ex - dx * R * 0.5, ey - dy * R * 0.5, hx, hy, R);
      disk(base, W, H, hx, hy, ring.holeRadiusPx, 0);
    }
  }

  // Crop to what is actually printed.
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!logo[i] && !(base && base[i])) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  // No margin: outlines run along pixel edges, so the artwork's width in the
  // SVG is exactly the requested width.
  const cw = x1 - x0 + 1;
  const ch = y1 - y0 + 1;
  const labelsOut = new Int32Array(cw * ch);
  const baseOut = base ? new Uint8Array(cw * ch) : null;
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      const s = (y + y0) * W + x + x0;
      labelsOut[y * cw + x] = out[s];
      if (baseOut && base) baseOut[y * cw + x] = base[s];
    }
  }
  return {
    width: cw,
    height: ch,
    labels: labelsOut,
    base: baseOut,
    art: { x: ax0 - x0, y: ay0 - y0, width: bw, height: bh },
    offsetX: box.x0 - P + x0,
    offsetY: box.y0 - P + y0,
  };
}
