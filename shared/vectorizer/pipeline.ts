// End-to-end: raster image + options → vector layers, SVG, 3D parts, report.

import { composeBase } from './base';
import { build3mf, buildStl, meshVolume } from './export3d';
import type { FitOptions } from './fit';
import { hasTransparency, resize, type RasterImage } from './image';
import { MeshBuilder } from './mesh';
import { fitMap, regionPolygons, regionRings, ringToPath, type TracedMap, type Transform } from './outline';
import { buildPlanarMap, type PlanarRegion } from './planar';
import {
  assignLabels,
  components,
  majorityFilter,
  removeIslands,
  thickenThin,
  thinMask,
  VOID,
} from './segment';
import type {
  DetailLevel,
  LayerResult,
  MeshPart,
  Point,
  VectorizeOptions,
  VectorizeResult,
  Warning,
} from './types';
import { createZip } from './zip';

const DETAIL: Record<DetailLevel, { side: number; pixels: number }> = {
  standard: { side: 1400, pixels: 2_200_000 },
  high: { side: 2000, pixels: 4_200_000 },
  ultra: { side: 2800, pixels: 7_500_000 },
};

export function workingSize(width: number, height: number, detail: DetailLevel) {
  const { side, pixels } = DETAIL[detail];
  let s = side / Math.max(width, height);
  s = Math.min(s, Math.sqrt(pixels / (width * height)), 8);
  return { width: Math.max(1, Math.round(width * s)), height: Math.max(1, Math.round(height * s)), scale: s };
}

export interface VectorDocument {
  result: VectorizeResult;
  /** Combined SVG, one group per colour, cut-out (no overlaps). */
  svg(opts?: { includeBase?: boolean }): string;
  /** Stacked SVG: each layer also fills the area under the layers above it. */
  stackedSvg(): string;
  layerSvgs(): Array<{ name: string; svg: string }>;
  meshParts(): MeshPart[];
  export3mf(name: string): Uint8Array;
  exportStlZip(): Uint8Array;
  exportLayersZip(): Uint8Array;
}

type Progress = (stage: string, fraction: number) => void;

export function vectorize(src: RasterImage, opts: VectorizeOptions, onProgress?: Progress): VectorDocument {
  const timings: Record<string, number> = {};
  let t0 = now();
  const mark = (name: string, fraction: number) => {
    const t = now();
    timings[name] = Math.round(t - t0);
    t0 = t;
    onProgress?.(name, fraction);
  };
  const warnings: Warning[] = [];

  // 1. Working resolution. Small sources are upscaled with a cubic filter so the
  //    anti-aliasing turns into sub-pixel boundary positions.
  const ws = workingSize(src.width, src.height, opts.detail);
  const work = resize(src, ws.width, ws.height);
  const u = ws.scale;
  const W = ws.width;
  const H = ws.height;
  mark('resample', 0.1);

  // 2. Pixel → colour, anti-aliasing aware.
  let labels = assignLabels(
    work,
    opts.palette.map((p) => p.sources),
    { withVoid: hasTransparency(src), radius: Math.max(2, Math.round(1.6 * Math.max(1, u))) },
  );
  labels = majorityFilter(labels, W, H);
  if (u >= 2) labels = majorityFilter(labels, W, H);
  mark('segment', 0.3);

  // 3. Background.
  const bg = opts.backgroundIndex;
  if (bg !== null && bg >= 0 && opts.backgroundMode !== 'keep') {
    if (opts.backgroundMode === 'remove') {
      for (let i = 0; i < labels.length; i++) if (labels[i] === bg) labels[i] = VOID;
    } else {
      floodRemove(labels, W, H, bg);
    }
  }

  // Physical scale from the artwork's bounding box.
  let x0 = W, x1 = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (labels[y * W + x] === VOID) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
    }
  }
  const artWidthPx = Math.max(1, x1 - x0 + 1);
  const mmPerPx = opts.widthMm / artWidthPx;

  // 4. Print cleanup: unprintable specks, then (optionally) thin details.
  const minAreaPx = Math.max(3, opts.minIslandMm2 / (mmPerPx * mmPerPx));
  const islandsRemoved = removeIslands(labels, W, H, minAreaPx);
  const thinRadius = opts.minFeatureMm / 2 / mmPerPx;
  const colorLabels = opts.palette.map((_, i) => i).filter((i) => i !== bg || opts.backgroundMode === 'keep');
  let thinFixed = 0;
  if (opts.thickenThin && thinRadius >= 1) {
    const keptBg = bg !== null && opts.backgroundMode === 'keep' ? bg : null;
    thinFixed = thickenThin(
      labels,
      W,
      H,
      colorLabels.filter((L) => L !== keptBg),
      thinRadius,
      (L) => L === VOID || L === keptBg,
    );
    if (thinFixed) removeIslands(labels, W, H, minAreaPx);
  }
  mark('cleanup', 0.45);

  // 5. Base plate / keychain.
  const m = opts.model;
  const hasBaseShape = m.mode !== 'extrude' && m.baseShape !== 'none';
  const comp = composeBase(labels, W, H, {
    shape: hasBaseShape ? m.baseShape : 'none',
    marginPx: m.baseMarginMm / mmPerPx,
    cornerPx: m.cornerRadiusMm / mmPerPx,
    keyring: m.keyring.enabled
      ? {
          enabled: true,
          position: m.keyring.position,
          holeRadiusPx: m.keyring.holeDiameterMm / 2 / mmPerPx,
          ringWidthPx: m.keyring.ringWidthMm / mmPerPx,
        }
      : null,
  });

  const emptyResult = (): VectorDocument => {
    warnings.push({ level: 'error', message: 'Nothing left to trace — every pixel was removed as background.' });
    return emptyDocument(warnings, timings, W, H, u, mmPerPx);
  };
  if (!comp) return emptyResult();

  mark('base', 0.5);
  const CW = comp.width;
  const CH = comp.height;
  const baseLabel = m.basePaletteIndex >= 0 && m.basePaletteIndex < opts.palette.length ? m.basePaletteIndex : opts.palette.length;
  const baseColor = baseLabel < opts.palette.length ? opts.palette[baseLabel].color : m.baseCustomColor;
  const traceLabels = new Int32Array(comp.labels);
  if (comp.base && m.mode === 'flat') {
    for (let i = 0; i < traceLabels.length; i++) if (traceLabels[i] === VOID && comp.base[i]) traceLabels[i] = baseLabel;
  }

  // Thin-detail analysis (after thickening, so it reports what will print).
  // Runs on a block-downsampled copy: it only feeds the report and overlay.
  const f = Math.max(1, Math.min(Math.floor(thinRadius / 1.25), Math.ceil(Math.max(CW, CH) / 700)));
  const TW = Math.ceil(CW / f);
  const TH = Math.ceil(CH / f);
  const small = f === 1 ? comp.labels : downsampleLabels(comp.labels, CW, CH, f);
  const overlaySrc = new Uint8Array(TW * TH);
  const thinByLabel = new Map<number, number>();
  for (const L of colorLabels) {
    const mask = thinMask(small, TW, TH, L, thinRadius / f);
    let count = 0;
    for (let i = 0; i < mask.length; i++) {
      if (mask[i]) {
        overlaySrc[i] = 1;
        count++;
      }
    }
    thinByLabel.set(L, count * f * f);
  }
  mark('analysis', 0.55);

  // 6. Trace. The artwork map is what the SVG shows; in flat mode the model
  //    map also contains the base's top band around the inlaid colours.
  const fit: FitOptions = {
    tolerance: (0.15 + (1 - clamp01(opts.accuracy)) * 0.45) * Math.max(1.5, u),
    smoothing: Math.max(0.7, 0.45 * Math.max(1, u)) * (1.5 - clamp01(opts.accuracy)),
    window: Math.max(3, Math.round(1.5 * Math.max(1, u))),
    cornerAngle: (Math.max(15, Math.min(150, opts.cornerAngle)) * Math.PI) / 180,
    cornerSize: Math.max(1, 0.35 * Math.max(1, u)),
    detectCircles: opts.detectShapes,
  };
  const trace = (lab: Int32Array, fo: FitOptions = fit): TracedMap => {
    const cc = components(lab, CW, CH);
    return fitMap(buildPlanarMap(lab, CW, CH, cc.comp), fo);
  };
  const artMap = trace(comp.labels);
  const flatBand = !!comp.base && m.mode === 'flat';
  // The flat-mode model map (with the base's top band) is only needed for
  // meshes, so it is traced on first use.
  let modelMapCache: TracedMap | null = flatBand ? null : artMap;
  const getModelMap = () => (modelMapCache ??= trace(traceLabels));
  let slabMap: TracedMap | null = null;
  let slabPx = 0;
  if (comp.base) {
    const slab = new Int32Array(CW * CH);
    for (let i = 0; i < slab.length; i++) {
      const inSlab = comp.base[i] || comp.labels[i] !== VOID;
      slab[i] = inSlab ? 0 : VOID;
      if (inSlab) slabPx++;
    }
    slabMap = trace(slab, { ...fit, detectCircles: true });
  }
  mark('trace', 0.85);

  // 7. Layers (one per artwork colour, plus the base) and printed parts (one
  //    per filament: the base slab joins the part of the same colour).
  const T = Math.max(0.2, m.baseThicknessMm);
  const inlay = Math.min(Math.max(0.1, m.inlayDepthMm), T);
  const slabTop = flatBand ? T - inlay : T;
  const tf: Transform = { scale: mmPerPx, ox: 0, oy: 0 };
  const widthMm = CW * mmPerPx;
  const heightMm = CH * mmPerPx;
  const px2 = mmPerPx * mmPerPx;

  const groupByLabel = (map: TracedMap) => {
    const out = new Map<number, PlanarRegion[]>();
    for (const r of map.map.regions) {
      if (r.label === VOID) continue;
      let list = out.get(r.label);
      if (!list) out.set(r.label, (list = []));
      list.push(r);
    }
    return out;
  };
  const artByLabel = groupByLabel(artMap);
  const zRange = (L: number): [number, number] => {
    const height = Math.max(0.1, m.heightsMm[L] ?? 1);
    if (m.mode === 'flat') return comp.base ? [T - inlay, T] : [0, T];
    if (m.mode === 'relief') return comp.base ? [T, T + height] : [0, height];
    return [0, height];
  };
  const pathOf = (map: TracedMap, regions: PlanarRegion[]) =>
    regions.flatMap((r) => regionRings(map, r).map((ring) => ringToPath(ring, tf))).join('');

  const layerResults: LayerResult[] = [];
  if (comp.base && slabMap) {
    const isPalette = baseLabel < opts.palette.length;
    let bandPx = 0;
    if (flatBand) for (let i = 0; i < comp.base.length; i++) if (comp.base[i] && comp.labels[i] === VOID) bandPx++;
    layerResults.push({
      key: 'base',
      name: isPalette ? `Base (${opts.palette[baseLabel].name})` : 'Base',
      color: baseColor,
      paletteIndex: isPalette ? baseLabel : -1,
      isBase: true,
      d: pathOf(slabMap, slabMap.map.regions.filter((r) => r.label !== VOID)),
      areaMm2: slabPx * px2,
      regionCount: slabMap.map.regions.filter((r) => r.label !== VOID).length,
      thinAreaMm2: 0,
      zMin: 0,
      zMax: flatBand ? T : slabTop,
      volumeMm3: slabPx * px2 * slabTop + Math.max(0, bandPx) * px2 * inlay,
    });
  }
  for (const L of Array.from(artByLabel.keys()).sort((a, b) => a - b)) {
    const regions = artByLabel.get(L)!;
    const entry = opts.palette[L];
    const [z0, z1] = zRange(L);
    const areaPx = regions.reduce((s, r) => s + r.area, 0);
    layerResults.push({
      key: `color-${L}`,
      name: entry?.name ?? `Color ${L + 1}`,
      color: entry?.color ?? '#000000',
      paletteIndex: L,
      isBase: false,
      d: pathOf(artMap, regions),
      areaMm2: areaPx * px2,
      regionCount: regions.length,
      thinAreaMm2: (thinByLabel.get(L) ?? 0) * px2,
      zMin: z0,
      zMax: z1,
      volumeMm3: areaPx * px2 * (z1 - z0),
    });
  }

  // Meshes are built lazily (3D preview / export only).
  let partsCache: MeshPart[] | null = null;
  const flattenTol = 0.012 / mmPerPx; // ≈ 0.012 mm, well under slicer resolution
  const meshParts = (): MeshPart[] => {
    if (partsCache) return partsCache;
    const modelCache = new Map<number, Point[]>();
    const slabCache = new Map<number, Point[]>();
    const toMm = (ring: Point[]) => ring.map((p) => ({ x: p.x * mmPerPx, y: (CH - p.y) * mmPerPx }));
    const modelMap = getModelMap();
    const modelByLabel = groupByLabel(modelMap);
    const parts: MeshPart[] = [];
    const baseMaterial = baseLabel < opts.palette.length ? `color-${baseLabel}` : 'base';
    const push = (mb: MeshBuilder, part: Omit<MeshPart, 'positions' | 'indices'>) => {
      const { positions, indices } = mb.build();
      if (indices.length) parts.push({ ...part, positions, indices });
    };
    // Every part is its own closed solid: the slab and whatever sits on or in
    // it are never fused into one mesh, they share a filament instead.
    if (comp.base && slabMap) {
      const mb = new MeshBuilder();
      for (const r of slabMap.map.regions) {
        if (r.label === VOID) continue;
        mb.addPrism(regionPolygons(slabMap, r, flattenTol, slabCache).map(toMm), 0, slabTop);
      }
      push(mb, { key: 'base', name: 'Base', color: baseColor, material: baseMaterial });
    }
    for (const L of Array.from(modelByLabel.keys()).sort((a, b) => a - b)) {
      const mb = new MeshBuilder();
      const [z0, z1] = zRange(L);
      for (const r of modelByLabel.get(L) ?? []) {
        mb.addPrism(regionPolygons(modelMap, r, flattenTol, modelCache).map(toMm), z0, z1);
      }
      const entry = opts.palette[L];
      push(mb, entry
        ? { key: `color-${L}`, name: entry.name, color: entry.color, material: `color-${L}` }
        : { key: 'base', name: 'Base (top)', color: baseColor, material: baseMaterial });
    }
    partsCache = parts;
    return parts;
  };

  // Stats.
  let segmentCount = 0, curveCount = 0, lineCount = 0, circleCount = 0;
  for (const e of artMap.fitted) {
    segmentCount += e.segments.length;
    if (e.circle) circleCount++;
    for (const s of e.segments) (s.c1 ? curveCount++ : lineCount++);
  }

  // Warnings.
  for (const lr of layerResults) {
    if (lr.thinAreaMm2 > 0.05 && lr.thinAreaMm2 > lr.areaMm2 * 0.003) {
      warnings.push({
        level: opts.thickenThin ? 'info' : 'warn',
        message: `${lr.name}: ${lr.thinAreaMm2.toFixed(2)} mm² of detail is thinner than ${opts.minFeatureMm} mm${
          opts.thickenThin ? ' (it borders another colour, so it could not grow).' : ' — turn on "Thicken fine details" or print larger.'
        }`,
      });
    }
  }
  if (islandsRemoved > 0) {
    warnings.push({ level: 'info', message: `${islandsRemoved} speck${islandsRemoved === 1 ? '' : 's'} smaller than ${opts.minIslandMm2} mm² merged into the surrounding colour.` });
  }
  if (thinFixed > 0) {
    warnings.push({ level: 'info', message: `Fine details thickened to the ${opts.minFeatureMm} mm minimum.` });
  }
  if (opts.minFeatureMm < opts.nozzleMm) {
    warnings.push({ level: 'warn', message: `Minimum feature (${opts.minFeatureMm} mm) is below the nozzle width (${opts.nozzleMm} mm).` });
  }
  mark('layers', 1);

  const result: VectorizeResult = {
    widthMm: comp.art.width * mmPerPx,
    heightMm: comp.art.height * mmPerPx,
    modelWidthMm: widthMm,
    modelHeightMm: heightMm,
    modelDepthMm: Math.max(0, ...layerResults.map((l) => l.zMax)),
    layers: layerResults,
    warnings,
    stats: {
      workWidth: W,
      workHeight: H,
      upscale: u,
      mmPerPx,
      nodeCount: artMap.map.nodeCount,
      segmentCount,
      curveCount,
      lineCount,
      circleCount,
      edgeCount: artMap.map.edges.length,
      regionCount: artMap.map.regions.filter((r) => r.label !== VOID).length,
      islandsRemoved,
      thinPixelsFixed: thinFixed,
      timings,
    },
    overlay: buildOverlay(overlaySrc, TW, TH, 900),
    viewBox: { x: 0, y: 0, width: widthMm, height: heightMm },
    art: {
      mm: { x: comp.art.x * mmPerPx, y: comp.art.y * mmPerPx, width: comp.art.width * mmPerPx, height: comp.art.height * mmPerPx },
      source: {
        x: (comp.offsetX + comp.art.x) / W,
        y: (comp.offsetY + comp.art.y) / H,
        width: comp.art.width / W,
        height: comp.art.height / H,
      },
    },
  };

  const svgHeader = (title: string) =>
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="${fmt(widthMm)}mm" height="${fmt(heightMm)}mm" viewBox="0 0 ${fmt(widthMm)} ${fmt(heightMm)}">\n<title>${esc(title)}</title>\n`;
  const group = (id: string, name: string, color: string, d: string) =>
    d ? `<g id="${id}" inkscape:groupmode="layer" inkscape:label="${esc(name)}"><path fill="${color}" d="${d}"/></g>\n` : '';
  const artLayers = layerResults.filter((l) => !l.isBase);
  const baseLayer = layerResults.find((l) => l.isBase);

  const svg = (o?: { includeBase?: boolean }) => {
    let s = svgHeader('Vectorized artwork');
    if (o?.includeBase && baseLayer) s += group('base', baseLayer.name, baseLayer.color, baseLayer.d);
    artLayers.forEach((l, i) => (s += group(slug(l.name, i), l.name, l.color, l.d)));
    return s + '</svg>\n';
  };

  const stackedSvg = () => {
    // Largest colour at the bottom. Each layer covers itself plus every layer
    // above it, traced as one silhouette so the outline stays exact.
    const order = [...artLayers].sort((a, b) => b.areaMm2 - a.areaMm2);
    let s = svgHeader('Vectorized artwork (stacked)');
    order.forEach((l, k) => {
      const above = new Set(order.slice(k).map((o) => o.paletteIndex));
      const mask = new Int32Array(CW * CH);
      for (let i = 0; i < mask.length; i++) mask[i] = above.has(comp.labels[i]) ? 0 : VOID;
      const traced = trace(mask);
      s += group(slug(l.name, k), l.name, l.color, pathOf(traced, traced.map.regions.filter((r) => r.label !== VOID)));
    });
    return s + '</svg>\n';
  };

  const layerSvgs = () => {
    const out: Array<{ name: string; svg: string }> = [];
    layerResults.forEach((l, i) => {
      if (!l.d) return;
      out.push({
        name: `${String(i + 1).padStart(2, '0')}-${slug(l.name, i)}`,
        svg: svgHeader(l.name) + group(slug(l.name, i), l.name, l.color, l.d) + '</svg>\n',
      });
    });
    return out;
  };

  return {
    result,
    svg,
    stackedSvg,
    layerSvgs,
    meshParts,
    export3mf: (name) => build3mf(meshParts(), name),
    exportStlZip: () =>
      createZip(meshParts().map((p, i) => ({ name: `${String(i + 1).padStart(2, '0')}-${slug(p.name, i)}.stl`, data: buildStl(p) }))),
    exportLayersZip: () =>
      createZip([
        ...layerSvgs().map((l) => ({ name: `${l.name}.svg`, data: l.svg })),
        { name: 'all-layers.svg', data: svg({ includeBase: true }) },
      ]),
  };
}

export function partVolumes(parts: MeshPart[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of parts) out[p.key] = Math.abs(meshVolume(p.positions, p.indices));
  return out;
}

function downsampleLabels(labels: Int32Array, w: number, h: number, f: number): Int32Array {
  // Block majority vote.
  const ow = Math.ceil(w / f);
  const oh = Math.ceil(h / f);
  const out = new Int32Array(ow * oh);
  const vals: number[] = [];
  const counts: number[] = [];
  for (let y = 0; y < oh; y++) {
    for (let x = 0; x < ow; x++) {
      vals.length = 0;
      counts.length = 0;
      for (let yy = y * f; yy < Math.min(h, (y + 1) * f); yy++) {
        for (let xx = x * f; xx < Math.min(w, (x + 1) * f); xx++) {
          const v = labels[yy * w + xx];
          const k = vals.indexOf(v);
          if (k < 0) {
            vals.push(v);
            counts.push(1);
          } else counts[k]++;
        }
      }
      let best = 0;
      for (let k = 1; k < vals.length; k++) if (counts[k] > counts[best]) best = k;
      out[y * ow + x] = vals[best];
    }
  }
  return out;
}

function floodRemove(labels: Int32Array, w: number, h: number, bg: number) {
  const queue = new Int32Array(labels.length);
  let tail = 0;
  const push = (i: number) => {
    if (labels[i] === bg) {
      labels[i] = VOID;
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
    if (i + w < labels.length) push(i + w);
  }
}

function buildOverlay(mask: Uint8Array, w: number, h: number, maxSide: number) {
  let any = false;
  for (let i = 0; i < mask.length; i++) if (mask[i]) { any = true; break; }
  if (!any) return null;
  const s = Math.min(1, maxSide / Math.max(w, h));
  const ow = Math.max(1, Math.round(w * s));
  const oh = Math.max(1, Math.round(h * s));
  const data = new Uint8ClampedArray(ow * oh * 4);
  for (let y = 0; y < oh; y++) {
    const sy0 = Math.floor(y / s), sy1 = Math.min(h, Math.ceil((y + 1) / s));
    for (let x = 0; x < ow; x++) {
      const sx0 = Math.floor(x / s), sx1 = Math.min(w, Math.ceil((x + 1) / s));
      let hit = false;
      for (let yy = sy0; yy < sy1 && !hit; yy++) for (let xx = sx0; xx < sx1; xx++) if (mask[yy * w + xx]) { hit = true; break; }
      if (hit) {
        const o = (y * ow + x) * 4;
        data[o] = 239;
        data[o + 1] = 68;
        data[o + 2] = 68;
        data[o + 3] = 220;
      }
    }
  }
  return { width: ow, height: oh, data };
}

function emptyDocument(warnings: Warning[], timings: Record<string, number>, W: number, H: number, u: number, mmPerPx: number): VectorDocument {
  const result: VectorizeResult = {
    widthMm: 0,
    heightMm: 0,
    modelWidthMm: 0,
    modelHeightMm: 0,
    modelDepthMm: 0,
    layers: [],
    warnings,
    stats: {
      workWidth: W, workHeight: H, upscale: u, mmPerPx, nodeCount: 0, segmentCount: 0, curveCount: 0, lineCount: 0,
      circleCount: 0, edgeCount: 0, regionCount: 0, islandsRemoved: 0, thinPixelsFixed: 0, timings,
    },
    overlay: null,
    viewBox: { x: 0, y: 0, width: 1, height: 1 },
    art: { mm: { x: 0, y: 0, width: 1, height: 1 }, source: { x: 0, y: 0, width: 1, height: 1 } },
  };
  const blank = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"/>\n';
  return {
    result,
    svg: () => blank,
    stackedSvg: () => blank,
    layerSvgs: () => [],
    meshParts: () => [],
    export3mf: (name) => build3mf([], name),
    exportStlZip: () => createZip([]),
    exportLayersZip: () => createZip([]),
  };
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const fmt = (v: number) => String(Math.round(v * 1000) / 1000);
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const slug = (s: string, i: number) =>
  (s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `layer-${i + 1}`);
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
