import type { Rgb } from './color';

/** A colour the analysis found in the image. */
export interface DetectedColor {
  rgb: Rgb;
  hex: string;
  name: string;
  /** Fraction of the opaque image area this colour covers (0-1). */
  share: number;
}

export interface ImageAnalysis {
  width: number;
  height: number;
  hasTransparency: boolean;
  /** Palette at the automatically chosen colour count, largest first. */
  colors: DetectedColor[];
  autoColorCount: number;
  /** Index into `colors` of the colour that fills the border, or null. */
  backgroundIndex: number | null;
  /** True when the background is transparent pixels rather than a colour. */
  transparentBackground: boolean;
  /** Share of opaque pixels sitting in flat colour areas (logos score high). */
  flatRatio: number;
  /** Mean OKLab error of the palette over every opaque pixel. */
  paletteError: number;
  /** Gradients or photographic content: the result will be posterised. */
  photographic: boolean;
  /** Source smaller than ~300 px on its long side. */
  lowResolution: boolean;
}

/** One output colour. Several detected colours can be merged into it. */
export interface PaletteEntry {
  /** Detected colours whose pixels belong to this entry. */
  sources: Rgb[];
  /** Colour written to the SVG / 3MF (the filament colour). */
  color: string;
  name: string;
}

export type DetailLevel = 'standard' | 'high' | 'ultra';
export type BackgroundMode = 'keep' | 'remove' | 'remove-connected';
export type ModelMode = 'flat' | 'relief' | 'extrude';
export type BaseShape = 'none' | 'contour' | 'rect' | 'rounded' | 'circle';
export type KeyringPosition = 'top' | 'top-left' | 'top-right' | 'left' | 'right' | 'bottom';

export interface Model3DOptions {
  mode: ModelMode;
  baseShape: BaseShape;
  baseMarginMm: number;
  baseThicknessMm: number;
  cornerRadiusMm: number;
  /** Palette index the base is printed in, or -1 for `baseCustomColor`. */
  basePaletteIndex: number;
  baseCustomColor: string;
  /** Flat mode: how deep the colours are inlaid into the top of the base. */
  inlayDepthMm: number;
  /** Relief / extrude modes: height of each palette entry. */
  heightsMm: number[];
  keyring: {
    enabled: boolean;
    position: KeyringPosition;
    holeDiameterMm: number;
    ringWidthMm: number;
  };
}

export interface VectorizeOptions {
  palette: PaletteEntry[];
  /** Palette index of the background colour, or null. */
  backgroundIndex: number | null;
  backgroundMode: BackgroundMode;
  /** Physical width of the artwork (without base/margins). */
  widthMm: number;
  nozzleMm: number;
  /** Narrowest printable feature; thinner details are flagged or thickened. */
  minFeatureMm: number;
  /** Specks smaller than this are merged into their surroundings. */
  minIslandMm2: number;
  thickenThin: boolean;
  detail: DetailLevel;
  /** 0 = smoothest curves, 1 = hug every pixel. */
  accuracy: number;
  /** Turns sharper than this (degrees) become corners. */
  cornerAngle: number;
  /** Fit perfect circles where a closed outline is round. */
  detectShapes: boolean;
  model: Model3DOptions;
}

export interface Point {
  x: number;
  y: number;
}

/** A path segment: a line (no controls) or a cubic Bézier. */
export interface Segment {
  c1?: Point;
  c2?: Point;
  to: Point;
}

/** A closed outline: start point plus segments back to the start. */
export interface Ring {
  start: Point;
  segments: Segment[];
}

export interface LayerResult {
  key: string;
  name: string;
  color: string;
  /** Palette index, or -1 for a custom-coloured base. */
  paletteIndex: number;
  isBase: boolean;
  /** SVG path data in millimetres (fill-rule nonzero). */
  d: string;
  areaMm2: number;
  regionCount: number;
  /** Area of details narrower than the minimum feature size. */
  thinAreaMm2: number;
  /** Z range of the printed part in millimetres. */
  zMin: number;
  zMax: number;
  volumeMm3: number;
}

export interface Warning {
  level: 'info' | 'warn' | 'error';
  message: string;
}

export interface VectorizeStats {
  workWidth: number;
  workHeight: number;
  upscale: number;
  mmPerPx: number;
  nodeCount: number;
  segmentCount: number;
  curveCount: number;
  lineCount: number;
  circleCount: number;
  edgeCount: number;
  regionCount: number;
  islandsRemoved: number;
  thinPixelsFixed: number;
  timings: Record<string, number>;
}

export interface MeshPart {
  key: string;
  name: string;
  color: string;
  /** Parts with the same material print with the same filament. */
  material: string;
  /** xyz triples in millimetres, z up. */
  positions: Float32Array;
  indices: Uint32Array;
}

export interface VectorizeResult {
  widthMm: number;
  heightMm: number;
  /** Physical size including base / keyring. */
  modelWidthMm: number;
  modelHeightMm: number;
  modelDepthMm: number;
  layers: LayerResult[];
  warnings: Warning[];
  stats: VectorizeStats;
  /** RGBA overlay at preview resolution: thin details red, fixed details amber. */
  overlay: { width: number; height: number; data: Uint8ClampedArray } | null;
  /** Placement of the overlay / preview inside the SVG (mm). */
  viewBox: { x: number; y: number; width: number; height: number };
  /**
   * Where the artwork sits: `mm` inside the SVG, `source` as fractions of the
   * input image. Lets a preview line the original up under the vectors.
   */
  art: {
    mm: { x: number; y: number; width: number; height: number };
    source: { x: number; y: number; width: number; height: number };
  };
}
