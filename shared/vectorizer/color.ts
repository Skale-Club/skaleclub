// Colour math for the vectorizer.
//
// Clustering and "is this the same colour" decisions run in OKLab, where equal
// distances read as equal visual differences. Anti-aliasing blends, on the other
// hand, are mixed by renderers in gamma-encoded sRGB, so mixture tests run there.

export type Rgb = [number, number, number];
export type Lab = [number, number, number];

const SRGB_TO_LINEAR = new Float32Array(256);
for (let i = 0; i < 256; i++) {
  const c = i / 255;
  SRGB_TO_LINEAR[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

export function srgbToLinear(v: number): number {
  const i = Math.max(0, Math.min(255, Math.round(v)));
  return SRGB_TO_LINEAR[i];
}

function linearToSrgb(c: number): number {
  const v = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, v * 255));
}

// Plain OKLab lightness is a cube root with no linear toe, so near-blacks
// spread out: sRGB (2,2,2) sits 0.085 from pure black, as far as two clearly
// different mid greys. JPEG noise in a black fill would then look like several
// colours. Ottosson's toe (the one Okhsl uses) compresses the darks; chroma is
// scaled with it so hue geometry is preserved.
const K1 = 0.206;
const K2 = 0.03;
const K3 = (1 + K1) / (1 + K2);

function toe(L: number): number {
  const t = K3 * L - K1;
  return 0.5 * (t + Math.sqrt(t * t + 4 * K2 * K3 * L));
}

function toeInv(Lr: number): number {
  return (Lr * Lr + K1 * Lr) / (K3 * (Lr + K2));
}

/** sRGB (0-255, float allowed) → OKLab with a perceptual toe on dark values. */
export function rgbToOklab(r: number, g: number, b: number): Lab {
  const [L, a, bb] = rawOklab(r, g, b);
  if (L <= 1e-9) return [0, 0, 0];
  const Lr = toe(L);
  const k = Lr / L;
  return [Lr, a * k, bb * k];
}

function rawOklab(r: number, g: number, b: number): Lab {
  const lr = isByte(r) ? SRGB_TO_LINEAR[r] : linearFromFloat(r);
  const lg = isByte(g) ? SRGB_TO_LINEAR[g] : linearFromFloat(g);
  const lb = isByte(b) ? SRGB_TO_LINEAR[b] : linearFromFloat(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function isByte(v: number): boolean {
  return Number.isInteger(v) && v >= 0 && v <= 255;
}

function linearFromFloat(v: number): number {
  const c = Math.max(0, Math.min(255, v)) / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** Inverse of rgbToOklab (toe-corrected OKLab → sRGB 0-255 floats, clamped). */
export function oklabToRgb(Lr: number, ar: number, br: number): Rgb {
  if (Lr <= 1e-9) return [0, 0, 0];
  const L = toeInv(Lr);
  const k = L / Lr;
  return rawOklabToRgb(L, ar * k, br * k);
}

function rawOklabToRgb(L: number, a: number, b: number): Rgb {
  const l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3);
  const m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3);
  const s = Math.pow(L - 0.0894841775 * a - 1.291485548 * b, 3);
  return [
    linearToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

export function labDistance(a: Lab, b: Lab): number {
  const dl = a[0] - b[0];
  const da = a[1] - b[1];
  const db = a[2] - b[2];
  return Math.sqrt(dl * dl + da * da + db * db);
}

export function rgbToHex([r, g, b]: Rgb): string {
  const h = (v: number) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

export function hexToRgb(hex: string): Rgb | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  let s = m[1];
  if (s.length === 3) s = s.split('').map((c) => c + c).join('');
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
}

/** Relative luminance, for picking readable text on a swatch. */
export function luminance([r, g, b]: Rgb): number {
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

// A small, opinionated set of names so a palette reads "Black, Red, Gold" rather
// than three hex codes. Matching is nearest-in-OKLab.
const NAMED: Array<[string, Rgb]> = [
  ['Black', [0, 0, 0]],
  ['Charcoal', [64, 64, 68]],
  ['Gray', [128, 128, 128]],
  ['Silver', [192, 192, 192]],
  ['White', [255, 255, 255]],
  ['Cream', [245, 236, 210]],
  ['Red', [214, 40, 40]],
  ['Dark Red', [128, 18, 24]],
  ['Pink', [240, 120, 170]],
  ['Magenta', [200, 30, 140]],
  ['Orange', [245, 130, 32]],
  ['Gold', [212, 170, 50]],
  ['Yellow', [250, 215, 30]],
  ['Beige', [214, 190, 150]],
  ['Brown', [120, 72, 40]],
  ['Lime', [150, 210, 50]],
  ['Green', [40, 160, 70]],
  ['Dark Green', [20, 80, 45]],
  ['Teal', [0, 140, 140]],
  ['Cyan', [40, 190, 220]],
  ['Sky Blue', [110, 180, 235]],
  ['Blue', [30, 90, 200]],
  ['Navy', [20, 35, 90]],
  ['Purple', [120, 60, 170]],
  ['Lavender', [180, 160, 220]],
];
// Names are matched in plain OKLab (no toe): the toe compresses dark chroma,
// which would make navy read as charcoal.
const NAMED_LAB = NAMED.map(([name, rgb]) => [name, rawOklab(...rgb)] as const);
const NEUTRALS = new Set(['Black', 'Charcoal', 'Gray', 'Silver', 'White']);

export function colorName(rgb: Rgb): string {
  const lab = rawOklab(rgb[0], rgb[1], rgb[2]);
  const chroma = Math.hypot(lab[1], lab[2]);
  const neutral = chroma < 0.035;
  let best = NAMED_LAB[0][0];
  let bestD = Infinity;
  for (const [name, ref] of NAMED_LAB) {
    if (neutral !== NEUTRALS.has(name)) continue;
    // Lightness counts for less than hue when telling chromatic colours apart.
    const d = neutral
      ? Math.abs(lab[0] - ref[0])
      : Math.hypot((lab[0] - ref[0]) * 0.6, lab[1] - ref[1], lab[2] - ref[2]);
    if (d < bestD) {
      bestD = d;
      best = name;
    }
  }
  return best;
}
