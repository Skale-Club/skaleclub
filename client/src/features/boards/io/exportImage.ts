import type { BoardDocument } from '@shared/schema/boards';
import type { Box, CanvasSizeSource } from '@shared/boards/canvasOps';
import { boardContentBounds, nodeBoxes, padBox } from '@shared/boards/bounds';
import { getBoardFontCss, isEditingChrome } from './thumbnail';

export type ExportFormat = 'png' | 'svg';

/** Space around the exported content (and around a frame cropped to its bounds). */
export const EXPORT_PADDING = 32;
const MAX_PIXEL_RATIO = 2;
const MAX_SIDE_PX = 8_192;
const MAX_PIXELS = 50_000_000;

export interface ExportImageInput {
  /** The `.react-flow__viewport` element of a mounted canvas. */
  viewportEl: HTMLElement;
  document: BoardDocument;
  /** Sizes React Flow measured, so bounds match what is drawn. */
  measured: CanvasSizeSource;
  format: ExportFormat;
  /** Crop to this frame (its bounds plus the padding) instead of the whole board. */
  frameId?: string | null;
  background: string;
}

export class EmptyBoardError extends Error {
  constructor() {
    super('There is nothing to export yet');
  }
}

/** The board region an export covers, or null when the board (or the frame) is empty. */
export function exportRegion(doc: BoardDocument, measured: CanvasSizeSource, frameId?: string | null): Box | null {
  const content = frameId ? (nodeBoxes(doc, { sizes: measured }).get(frameId) ?? null) : boardContentBounds(doc, { sizes: measured });
  return content ? padBox(content, EXPORT_PADDING) : null;
}

/** 2x for crisp images, lowered so a huge board stays inside what a canvas can hold. */
export function exportPixelRatio(region: Pick<Box, 'w' | 'h'>): number {
  const bySide = MAX_SIDE_PX / Math.max(region.w, region.h);
  const byArea = Math.sqrt(MAX_PIXELS / (region.w * region.h));
  return Math.max(0.1, Math.min(MAX_PIXEL_RATIO, bySide, byArea));
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('The image could not be created'))), type));
}

/**
 * Renders the board (or one frame) from the live canvas DOM: nodes, connectors
 * and pen strokes all live inside React Flow's viewport element, which is
 * translated so the region's corner is the image's corner.
 */
export async function renderBoardImage({ viewportEl, document: doc, measured, format, frameId, background }: ExportImageInput): Promise<Blob> {
  const region = exportRegion(doc, measured, frameId);
  if (!region) throw new EmptyBoardError();
  const { toCanvas, toSvg } = await import('html-to-image');
  const fontCss = await getBoardFontCss(viewportEl);
  const width = Math.ceil(region.w);
  const height = Math.ceil(region.h);
  const options = {
    width,
    height,
    backgroundColor: background,
    ...(fontCss ? { fontEmbedCSS: fontCss } : { skipFonts: true }),
    style: {
      width: `${width}px`,
      height: `${height}px`,
      transform: `translate(${-region.x}px, ${-region.y}px) scale(1)`,
    },
    filter: (el: Node) => !isEditingChrome(el),
  };
  if (format === 'svg') {
    const dataUrl = await toSvg(viewportEl, options);
    return new Blob([decodeSvgDataUrl(dataUrl)], { type: 'image/svg+xml;charset=utf-8' });
  }
  const ratio = exportPixelRatio({ w: width, h: height });
  const canvas = await toCanvas(viewportEl, { ...options, pixelRatio: ratio, canvasWidth: width, canvasHeight: height });
  return canvasToBlob(canvas, 'image/png');
}

function decodeSvgDataUrl(dataUrl: string): string {
  const comma = dataUrl.indexOf(',');
  const head = dataUrl.slice(0, comma);
  const body = dataUrl.slice(comma + 1);
  return head.includes(';base64') ? new TextDecoder().decode(Uint8Array.from(atob(body), (c) => c.charCodeAt(0))) : decodeURIComponent(body);
}

/** Saves a blob through a temporary link (no new tab, no navigation). */
export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = window.document.createElement('a');
  link.href = url;
  link.download = filename;
  window.document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

/** A file name from the board title: no path characters, never empty. */
export function fileNameFor(title: string, extension: string): string {
  const base = title.trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').slice(0, 80) || 'board';
  return `${base}.${extension}`;
}
