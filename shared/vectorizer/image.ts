// Raster helpers. Everything works on plain RGBA byte buffers so the same code
// runs in a Web Worker, in Node tests, and on the server.

export interface RasterImage {
  width: number;
  height: number;
  /** RGBA, 8 bits per channel, row-major, not premultiplied. */
  data: Uint8ClampedArray;
}

export function createImage(width: number, height: number): RasterImage {
  return { width, height, data: new Uint8ClampedArray(width * height * 4) };
}

export function hasTransparency(img: RasterImage): boolean {
  const d = img.data;
  for (let i = 3; i < d.length; i += 4) if (d[i] < 250) return true;
  return false;
}

/** Keys cubic kernel with a = -0.5 (Catmull-Rom): sharp, no ringing to speak of. */
function cubic(x: number): number {
  const a = -0.5;
  x = Math.abs(x);
  if (x <= 1) return (a + 2) * x * x * x - (a + 3) * x * x + 1;
  if (x < 2) return a * x * x * x - 5 * a * x * x + 8 * a * x - 4 * a;
  return 0;
}

interface Taps {
  start: Int32Array;
  count: Int32Array;
  weights: Float32Array;
  stride: number;
}

// Precomputes the filter taps for one axis. Upscaling uses the cubic kernel;
// downscaling widens it by the scale factor, which is an area-weighted average
// and keeps thin lines from aliasing away.
function buildTaps(src: number, dst: number): Taps {
  const scale = dst / src;
  const support = scale >= 1 ? 2 : 2 / scale;
  const stride = Math.ceil(support * 2) + 2;
  const start = new Int32Array(dst);
  const count = new Int32Array(dst);
  const weights = new Float32Array(dst * stride);
  for (let i = 0; i < dst; i++) {
    const center = (i + 0.5) / scale - 0.5;
    const lo = Math.floor(center - support) + 1;
    const hi = Math.floor(center + support);
    let sum = 0;
    let n = 0;
    const s0 = Math.max(0, lo);
    for (let j = s0; j <= Math.min(src - 1, hi) && n < stride; j++) {
      const w = scale >= 1 ? cubic(j - center) : cubic((j - center) * scale);
      weights[i * stride + n] = w;
      sum += w;
      n++;
    }
    if (sum !== 0) for (let k = 0; k < n; k++) weights[i * stride + k] /= sum;
    start[i] = s0;
    count[i] = n;
  }
  return { start, count, weights, stride };
}

/**
 * Resamples with premultiplied alpha so transparent pixels never bleed their
 * (meaningless) colour into the edge of a shape.
 */
export function resize(img: RasterImage, width: number, height: number): RasterImage {
  if (width === img.width && height === img.height) {
    return { width, height, data: new Uint8ClampedArray(img.data) };
  }
  const sw = img.width;
  const sh = img.height;
  const src = img.data;
  const pre = new Float32Array(sw * sh * 4);
  for (let i = 0, n = sw * sh; i < n; i++) {
    const a = src[i * 4 + 3] / 255;
    pre[i * 4] = src[i * 4] * a;
    pre[i * 4 + 1] = src[i * 4 + 1] * a;
    pre[i * 4 + 2] = src[i * 4 + 2] * a;
    pre[i * 4 + 3] = src[i * 4 + 3];
  }

  const tx = buildTaps(sw, width);
  const tmp = new Float32Array(width * sh * 4);
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      const s = tx.start[x];
      for (let k = 0; k < tx.count[x]; k++) {
        const w = tx.weights[x * tx.stride + k];
        const o = (y * sw + s + k) * 4;
        r += pre[o] * w;
        g += pre[o + 1] * w;
        b += pre[o + 2] * w;
        a += pre[o + 3] * w;
      }
      const o = (y * width + x) * 4;
      tmp[o] = r;
      tmp[o + 1] = g;
      tmp[o + 2] = b;
      tmp[o + 3] = a;
    }
  }

  const ty = buildTaps(sh, height);
  const out = createImage(width, height);
  const d = out.data;
  for (let y = 0; y < height; y++) {
    const s = ty.start[y];
    for (let x = 0; x < width; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let k = 0; k < ty.count[y]; k++) {
        const w = ty.weights[y * ty.stride + k];
        const o = ((s + k) * width + x) * 4;
        r += tmp[o] * w;
        g += tmp[o + 1] * w;
        b += tmp[o + 2] * w;
        a += tmp[o + 3] * w;
      }
      const o = (y * width + x) * 4;
      const alpha = Math.max(0, Math.min(255, a));
      if (alpha < 0.5) {
        d[o] = d[o + 1] = d[o + 2] = d[o + 3] = 0;
        continue;
      }
      // Premultiplied by alpha/255 above, so undo with 255/alpha.
      const inv = 255 / alpha;
      d[o] = r * inv;
      d[o + 1] = g * inv;
      d[o + 2] = b * inv;
      d[o + 3] = alpha;
    }
  }
  return out;
}

/** Scales an image so its longer side is at most `maxSide` (never upscales). */
export function fitWithin(img: RasterImage, maxSide: number): RasterImage {
  const long = Math.max(img.width, img.height);
  if (long <= maxSide) return img;
  const s = maxSide / long;
  return resize(img, Math.max(1, Math.round(img.width * s)), Math.max(1, Math.round(img.height * s)));
}
