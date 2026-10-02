// Exact Euclidean distance transform (Felzenszwalb & Huttenlocher), used for
// minimum-feature-width checks, contour offsets and morphological opening.

const INF = 1e20;

function edt1d(f: Float64Array, n: number, d: Float64Array, v: Int32Array, z: Float64Array) {
  let k = 0;
  v[0] = 0;
  z[0] = -INF;
  z[1] = INF;
  for (let q = 1; q < n; q++) {
    let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) {
      k--;
      s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    }
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = INF;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    const dq = q - v[k];
    d[q] = dq * dq + f[v[k]];
  }
}

/**
 * Squared distance from every pixel to the nearest pixel where `seed` is set.
 * Pixels outside the image never count as seeds.
 */
export function squaredDistanceTo(seed: Uint8Array, width: number, height: number): Float64Array {
  const out = new Float64Array(width * height);
  for (let i = 0; i < out.length; i++) out[i] = seed[i] ? 0 : INF;
  const n = Math.max(width, height);
  const f = new Float64Array(n);
  const d = new Float64Array(n);
  const v = new Int32Array(n);
  const z = new Float64Array(n + 1);
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) f[y] = out[y * width + x];
    edt1d(f, height, d, v, z);
    for (let y = 0; y < height; y++) out[y * width + x] = d[y];
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) f[x] = out[y * width + x];
    edt1d(f, width, d, v, z);
    for (let x = 0; x < width; x++) out[y * width + x] = d[x];
  }
  return out;
}

/** Grows a mask by `radius` pixels (round structuring element). */
export function dilate(mask: Uint8Array, width: number, height: number, radius: number): Uint8Array {
  const dist = squaredDistanceTo(mask, width, height);
  const r2 = radius * radius;
  const out = new Uint8Array(mask.length);
  for (let i = 0; i < out.length; i++) out[i] = dist[i] <= r2 ? 1 : 0;
  return out;
}

/**
 * Morphological opening with a disk of `radius`: keeps every part of the mask a
 * disk of that radius fits into. What it removes is "thinner than 2 × radius".
 */
export function open(mask: Uint8Array, width: number, height: number, radius: number): Uint8Array {
  // Erode: pixels at least `radius` away from the outside. The image border
  // counts as inside, so shapes touching the frame are not flagged there.
  const outside = new Uint8Array(mask.length);
  for (let i = 0; i < mask.length; i++) outside[i] = mask[i] ? 0 : 1;
  const din = squaredDistanceTo(outside, width, height);
  const r2 = radius * radius;
  const eroded = new Uint8Array(mask.length);
  for (let i = 0; i < mask.length; i++) eroded[i] = mask[i] && din[i] >= r2 ? 1 : 0;
  const dout = squaredDistanceTo(eroded, width, height);
  const out = new Uint8Array(mask.length);
  for (let i = 0; i < mask.length; i++) out[i] = mask[i] && dout[i] <= r2 ? 1 : 0;
  return out;
}
