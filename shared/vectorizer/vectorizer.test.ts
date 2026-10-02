// Vectorizer engine tests on synthetic, anti-aliased artwork.
//
// Run: npx tsx --test shared/vectorizer/vectorizer.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { oklabToRgb, rgbToOklab, type Rgb } from "./color";
import type { RasterImage } from "./image";
import { analyzeImage, buildColorModel } from "./palette";
import { buildPlanarMap } from "./planar";
import { assignLabels, components, removeIslands, VOID } from "./segment";
import { vectorize } from "./pipeline";
import { crc32 } from "./zip";
import type { MeshPart, VectorizeOptions } from "./types";

type Shape = (x: number, y: number) => boolean;

/** Renders shapes (last wins) with 4×4 supersampled anti-aliasing. */
function render(w: number, h: number, bg: Rgb | null, layers: Array<[Shape, Rgb]>): RasterImage {
  const data = new Uint8ClampedArray(w * h * 4);
  const S = 4;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < S; sy++) {
        for (let sx = 0; sx < S; sx++) {
          const px = x + (sx + 0.5) / S;
          const py = y + (sy + 0.5) / S;
          let c: Rgb | null = bg;
          for (const [shape, col] of layers) if (shape(px, py)) c = col;
          if (c) {
            r += c[0];
            g += c[1];
            b += c[2];
            a += 255;
          }
        }
      }
      const n = S * S;
      const o = (y * w + x) * 4;
      const alpha = a / n;
      data[o] = alpha ? (r / n) * (255 / alpha) : 0;
      data[o + 1] = alpha ? (g / n) * (255 / alpha) : 0;
      data[o + 2] = alpha ? (b / n) * (255 / alpha) : 0;
      data[o + 3] = alpha;
    }
  }
  return { width: w, height: h, data };
}

const circle = (cx: number, cy: number, r: number): Shape => (x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
const rect = (x0: number, y0: number, x1: number, y1: number): Shape => (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1;

const WHITE: Rgb = [255, 255, 255];
const BLACK: Rgb = [0, 0, 0];
const RED: Rgb = [220, 38, 38];
const YELLOW: Rgb = [250, 204, 21];

function logo(): RasterImage {
  return render(160, 100, WHITE, [
    [circle(50, 50, 32), RED],
    [rect(95, 20, 140, 80), BLACK],
    [circle(50, 50, 12), YELLOW],
  ]);
}

function options(analysis: ReturnType<typeof analyzeImage>, patch: Partial<VectorizeOptions> = {}): VectorizeOptions {
  return {
    palette: analysis.colors.map((c) => ({ sources: [c.rgb], color: c.hex, name: c.name })),
    backgroundIndex: analysis.backgroundIndex,
    backgroundMode: "remove",
    widthMm: 60,
    nozzleMm: 0.4,
    minFeatureMm: 0.4,
    minIslandMm2: 0.2,
    thickenThin: false,
    detail: "standard",
    accuracy: 0.5,
    cornerAngle: 40,
    detectShapes: true,
    model: {
      mode: "flat",
      baseShape: "rounded",
      baseMarginMm: 2,
      baseThicknessMm: 3,
      cornerRadiusMm: 3,
      basePaletteIndex: -1,
      baseCustomColor: "#ffffff",
      inlayDepthMm: 0.6,
      heightsMm: [],
      keyring: { enabled: true, position: "top", holeDiameterMm: 4, ringWidthMm: 2.5 },
    },
    ...patch,
  };
}

function assertWatertight(part: MeshPart) {
  const edges = new Map<string, number>();
  const t = part.indices;
  for (let i = 0; i < t.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      const key = `${t[i + k]},${t[i + ((k + 1) % 3)]}`;
      edges.set(key, (edges.get(key) ?? 0) + 1);
    }
  }
  edges.forEach((count, key) => {
    const [a, b] = key.split(",");
    assert.equal(count, 1, `${part.name}: edge ${key} used ${count}×`);
    assert.equal(edges.get(`${b},${a}`), 1, `${part.name}: edge ${key} has no twin`);
  });
}

test("OKLab with toe round-trips and keeps near-blacks close", () => {
  for (const c of [[0, 0, 0], [2, 2, 2], [30, 58, 138], [255, 255, 255], [220, 38, 38]] as Rgb[]) {
    const back = oklabToRgb(...rgbToOklab(...c));
    for (let k = 0; k < 3; k++) assert.ok(Math.abs(back[k] - c[k]) < 0.5, `${c} → ${back}`);
  }
  const d = rgbToOklab(3, 3, 3)[0] - rgbToOklab(0, 0, 0)[0];
  assert.ok(d < 0.03, `sRGB 3 should sit close to black, got ${d}`);
});

test("analysis finds exactly the artwork colours, not the anti-aliasing blends", () => {
  const a = analyzeImage(buildColorModel(logo()));
  assert.equal(a.autoColorCount, 4);
  const hexes = a.colors.map((c) => c.hex).sort();
  assert.deepEqual(hexes, ["#000000", "#dc2626", "#facc15", "#ffffff"]);
  assert.equal(a.colors[a.backgroundIndex!].hex, "#ffffff");
  assert.equal(a.photographic, false);
});

test("colours that only exist in thin strokes are still found", () => {
  // Grey hairline "tagline" strokes, 1.6 px wide, far from the navy shape:
  // no flat grey pixel exists, and grey is close to a navy/white blend.
  const NAVY: Rgb = [15, 23, 42];
  const SLATE: Rgb = [100, 116, 139];
  const strokes: Array<[Shape, Rgb]> = [[rect(10, 10, 70, 50), NAVY]];
  for (let k = 0; k < 14; k++) strokes.push([rect(12 + k * 10, 70, 13.6 + k * 10, 82), SLATE]);
  for (let k = 0; k < 7; k++) strokes.push([rect(12 + k * 20, 75.2, 20 + k * 20, 76.8), SLATE]);
  const a = analyzeImage(buildColorModel(render(160, 96, WHITE, strokes)));
  assert.equal(a.autoColorCount, 3, a.colors.map((c) => c.hex).join(","));
  const grey = a.colors.find((c) => c.name === "Slate");
  assert.ok(grey, a.colors.map((c) => `${c.hex} ${c.name}`).join(","));
});

test("a requested colour count merges the closest colours first", () => {
  const a = analyzeImage(buildColorModel(logo()), 3);
  assert.equal(a.colors.length, 3);
  assert.equal(a.autoColorCount, 4);
});

test("edge pixels are explained as mixtures, never as an in-between palette colour", () => {
  // Black square on yellow; an olive palette entry sits exactly on the blend.
  const img = render(60, 60, YELLOW, [[rect(15.3, 15.3, 44.7, 44.7), BLACK]]);
  const olive: Rgb = [125, 102, 10];
  const labels = assignLabels(img, [[YELLOW], [BLACK], [olive]], { withVoid: false, radius: 2 });
  assert.equal(labels.filter((l) => l === 2).length, 0, "no pixel may be traced as the blend colour");
});

test("transparent images get VOID outside the artwork", () => {
  const img = render(40, 40, null, [[circle(20, 20, 12), RED]]);
  const labels = assignLabels(img, [[RED]], { withVoid: true, radius: 2 });
  assert.equal(labels[0], VOID);
  assert.equal(labels[20 * 40 + 20], 0);
});

test("specks below the minimum area are merged into their surroundings", () => {
  const w = 30, h = 30;
  const labels = new Int32Array(w * h);
  labels[15 * w + 15] = 1;
  labels[5 * w + 5] = 1;
  labels[5 * w + 6] = 1;
  const removed = removeIslands(labels, w, h, 4);
  assert.equal(removed, 2);
  assert.ok(labels.every((l) => l === 0));
});

test("planar map: every boundary is one edge shared by both sides, rings close", () => {
  const w = 40, h = 30;
  const labels = new Int32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      labels[y * w + x] = x < 20 ? 0 : 1;
      if ((x - 10) ** 2 + (y - 15) ** 2 < 25) labels[y * w + x] = 2;
      if (x > 25 && x < 35 && y > 5 && y < 25) labels[y * w + x] = VOID;
    }
  }
  const cc = components(labels, w, h);
  const map = buildPlanarMap(labels, w, h, cc.comp);
  const uses = new Array(map.edges.length).fill(0);
  for (const r of map.regions) {
    for (const ring of r.rings) {
      for (const ref of ring.edges) uses[ref.edge]++;
      // Consecutive edges meet at the same corner.
      for (let k = 0; k < ring.edges.length; k++) {
        const a = ring.edges[k];
        const b = ring.edges[(k + 1) % ring.edges.length];
        const ea = map.edges[a.edge].corners;
        const eb = map.edges[b.edge].corners;
        const end = a.reversed ? ea[0] : ea[ea.length - 1];
        const start = b.reversed ? eb[eb.length - 1] : eb[0];
        assert.equal(end, start);
      }
    }
  }
  map.edges.forEach((e, i) => {
    const expected = e.right === -1 ? 1 : 2;
    assert.equal(uses[i], expected, `edge ${i} between ${e.left} and ${e.right}`);
  });
});

test("vectorize: layers, exact base, watertight coloured parts and a valid 3MF", () => {
  const img = logo();
  const a = analyzeImage(buildColorModel(img));
  const doc = vectorize(img, options(a));
  const r = doc.result;
  assert.deepEqual(r.layers.map((l) => l.name), ["Base", "Black", "Red", "Yellow"]);
  assert.ok(Math.abs(r.widthMm - 60) < 0.5, `art width ${r.widthMm}`);
  assert.ok(r.modelWidthMm > r.widthMm, "base adds a margin");
  assert.equal(r.warnings.filter((w) => w.level === "error").length, 0);

  const svg = doc.svg({ includeBase: true });
  assert.match(svg, /width="[\d.]+mm"/);
  assert.equal((svg.match(/<path /g) ?? []).length, 4);

  const parts = doc.meshParts();
  // The base's top band is its own solid sharing the base filament.
  assert.deepEqual(parts.map((p) => p.name), ["Base", "Black", "Red", "Yellow", "Base (top)"]);
  assert.equal(parts[4].material, parts[0].material);
  for (const p of parts) assertWatertight(p);
  // Coloured parts sit in the top 0.6 mm of a 3 mm plate.
  for (const p of parts.slice(1)) {
    let zmin = Infinity, zmax = -Infinity;
    for (let i = 2; i < p.positions.length; i += 3) {
      zmin = Math.min(zmin, p.positions[i]);
      zmax = Math.max(zmax, p.positions[i]);
    }
    assert.ok(Math.abs(zmin - 2.4) < 1e-4 && Math.abs(zmax - 3) < 1e-4, `${p.name}: z ${zmin}..${zmax}`);
  }

  const zip = doc.export3mf("logo");
  const text = new TextDecoder().decode(zip);
  assert.ok(text.includes("3D/3dmodel.model"));
  assert.ok(text.includes("Metadata/model_settings.config"));
  assert.ok(text.includes('<metadata key="extruder" value="4"/>'));
  assert.ok(!text.includes('<metadata key="extruder" value="5"/>'), "base top band reuses the base slot");
});

test("SVG export: real size at 96 dpi for CAD, source pixels for design tools", () => {
  const img = logo();
  const a = analyzeImage(buildColorModel(img));
  const doc = vectorize(img, options(a, {
    printChecks: false,
    model: { ...options(a).model, mode: "extrude", baseShape: "none", keyring: { enabled: false, position: "top", holeDiameterMm: 4, ringWidthMm: 2 } },
  }));
  const vb = (svg: string) => /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg)!.slice(1).map(Number);

  const mm = doc.svg();
  const widthMm = Number(/width="([\d.]+)mm"/.exec(mm)![1]);
  // Fusion 360 reads user units as 96 dpi pixels: viewBox must match the mm size.
  assert.ok(Math.abs(vb(mm)[0] - (widthMm * 96) / 25.4) < 0.01, `${vb(mm)[0]} vs ${widthMm}`);
  assert.ok(Math.abs(doc.result.widthMm - 60) < 0.5);

  // The artwork spans x = 18..140 of the 160 px source.
  const px = doc.svg({ units: "px" });
  assert.match(px, /width="[\d.]+" height="[\d.]+"/);
  assert.ok(Math.abs(vb(px)[0] - 122) < 2, `px width ${vb(px)[0]}`);

  // Red is a ring with the yellow disc in its hole: one shape, outer + hole.
  const groups = (svg: string) => svg.match(/<g [^>]*>.*?<\/g>/g) ?? [];
  assert.equal(groups(mm).length, 3);
  const compound = doc.svg({ separateShapes: false });
  for (const g of groups(compound)) assert.equal((g.match(/<path /g) ?? []).length, 1);
  assert.ok(!doc.result.overlay, "no print overlay when print checks are off");
});

test("relief mode stacks colours on the base and uses per-colour heights", () => {
  const img = logo();
  const a = analyzeImage(buildColorModel(img));
  const heights = a.colors.map((_, i) => 0.5 + i * 0.5);
  const doc = vectorize(img, options(a, {
    model: { ...options(a).model, mode: "relief", baseShape: "circle", keyring: { enabled: false, position: "top", holeDiameterMm: 4, ringWidthMm: 2 }, heightsMm: heights },
  }));
  const black = doc.result.layers.find((l) => l.name === "Black")!;
  const idx = a.colors.findIndex((c) => c.name === "Black");
  assert.equal(black.zMin, 3);
  assert.equal(black.zMax, 3 + heights[idx]);
  for (const p of doc.meshParts()) assertWatertight(p);
});

test("an image that is all background reports an error instead of throwing", () => {
  const img = render(20, 20, WHITE, []);
  const doc = vectorize(img, {
    ...options({ colors: [{ rgb: WHITE, hex: "#ffffff", name: "White", share: 1 }], backgroundIndex: 0 } as any),
  });
  assert.equal(doc.result.layers.length, 0);
  assert.equal(doc.result.warnings[0].level, "error");
});

test("crc32 matches the reference value", () => {
  assert.equal(crc32(new TextEncoder().encode("123456789")), 0xcbf43926);
});
