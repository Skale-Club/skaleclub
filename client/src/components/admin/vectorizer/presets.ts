import type { Model3DOptions } from '@shared/vectorizer/types';

export interface PrinterPreset {
  id: string;
  label: string;
  /** Filament slots available without manual swaps. */
  slots: number;
  nozzleMm: number;
}

export const PRINTERS: PrinterPreset[] = [
  { id: 'bambu-ams', label: 'Bambu Lab + AMS (4 colors)', slots: 4, nozzleMm: 0.4 },
  { id: 'bambu-ams-2', label: 'Bambu Lab + 2× AMS (8 colors)', slots: 8, nozzleMm: 0.4 },
  { id: 'bambu-ams-4', label: 'Bambu Lab + 4× AMS (16 colors)', slots: 16, nozzleMm: 0.4 },
  { id: 'prusa-mmu3', label: 'Prusa MK4S / Core One + MMU3 (5 colors)', slots: 5, nozzleMm: 0.4 },
  { id: 'prusa-xl', label: 'Prusa XL (5 toolheads)', slots: 5, nozzleMm: 0.4 },
  { id: 'single', label: 'Single extruder (manual color swaps)', slots: 1, nozzleMm: 0.4 },
  { id: 'fine', label: 'Any printer, 0.2 mm nozzle (fine detail)', slots: 16, nozzleMm: 0.2 },
];

export interface ProjectPreset {
  id: string;
  label: string;
  description: string;
  widthMm: number;
  model: Partial<Model3DOptions>;
}

const noRing = { enabled: false, position: 'top-left' as const, holeDiameterMm: 4, ringWidthMm: 2.5 };
const ring = { enabled: true, position: 'top-left' as const, holeDiameterMm: 4.5, ringWidthMm: 2.5 };

export const PROJECTS: ProjectPreset[] = [
  {
    id: 'logo',
    label: 'Logo only',
    description: 'Each color extruded on its own, no base. Ideal for SVG import in Bambu Studio / Orca.',
    widthMm: 80,
    model: { mode: 'extrude', baseShape: 'none', keyring: noRing },
  },
  {
    id: 'flat-keychain',
    label: 'Flat keychain',
    description: 'Colors inlaid flush into the top of a plate cut to the logo outline.',
    widthMm: 40,
    model: { mode: 'flat', baseShape: 'contour', baseMarginMm: 2.5, baseThicknessMm: 3, inlayDepthMm: 0.6, keyring: ring },
  },
  {
    id: 'relief-keychain',
    label: 'Raised relief keychain',
    description: 'Colors stand 1 mm proud of the plate, so the logo can be felt.',
    widthMm: 40,
    model: { mode: 'relief', baseShape: 'contour', baseMarginMm: 2.5, baseThicknessMm: 2.4, keyring: ring },
  },
  {
    id: 'sign',
    label: 'Sign / plaque',
    description: 'Raised logo on a rounded rectangle.',
    widthMm: 150,
    model: { mode: 'relief', baseShape: 'rounded', baseMarginMm: 8, baseThicknessMm: 3, cornerRadiusMm: 6, keyring: noRing },
  },
  {
    id: 'coaster',
    label: 'Coaster',
    description: 'Flat inlaid logo on a round plate.',
    widthMm: 70,
    model: { mode: 'flat', baseShape: 'circle', baseMarginMm: 6, baseThicknessMm: 4, inlayDepthMm: 0.8, keyring: noRing },
  },
];

export const DEFAULT_MODEL: Model3DOptions = {
  mode: 'extrude',
  baseShape: 'none',
  baseMarginMm: 2.5,
  baseThicknessMm: 3,
  cornerRadiusMm: 4,
  basePaletteIndex: -1,
  baseCustomColor: '#ffffff',
  inlayDepthMm: 0.6,
  heightsMm: [],
  keyring: noRing,
};

/** PLA density, g/mm³. */
export const PLA_DENSITY = 0.00124;
