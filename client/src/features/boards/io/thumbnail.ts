import { getViewportForBounds } from '@xyflow/react';
import type { Box } from '@shared/boards/canvasOps';

const THUMBNAIL_WIDTH = 640;
const THUMBNAIL_HEIGHT = 360;
const PADDING = 0.12;
const FONT_EMBED_TIMEOUT_MS = 3_000;

// The board font (Inter, from Google Fonts) inlined as @font-face CSS. Built
// once per session; without it the clone falls back to a wider system font and
// labels wrap differently than on screen. null = embedding failed, skip fonts.
let fontEmbedCss: Promise<string | null> | null = null;

/** Shared with the image export. Bounded: a slow or blocked font host must not hold anything up. */
export function getBoardFontCss(viewportEl: HTMLElement): Promise<string | null> {
  if (!fontEmbedCss) {
    fontEmbedCss = (async () => {
      const { getFontEmbedCSS } = await import('html-to-image');
      const timeout = new Promise<null>((resolve) => window.setTimeout(() => resolve(null), FONT_EMBED_TIMEOUT_MS));
      return Promise.race([getFontEmbedCSS(viewportEl), timeout]).catch((err) => {
        console.warn('Board image: could not embed fonts', err);
        return null;
      });
    })();
  }
  return fontEmbedCss;
}

/** Connection handles and resize grips are editing chrome, not content. */
export function isEditingChrome(el: Node): boolean {
  return el instanceof HTMLElement && (el.classList.contains('react-flow__handle') || el.classList.contains('react-flow__resize-control'));
}

export interface ThumbnailInput {
  /** The `.react-flow__viewport` element of a mounted canvas. */
  viewportEl: HTMLElement | null;
  /** Bounds of all nodes and pen strokes (shared/boards/bounds.ts), or null for an empty board. */
  bounds: Box | null;
  background: string;
}

// 16:9 card preview of the whole board, fitted inside 640x360 on the board's
// own background. null for an empty board. Same idea as the whiteboards'
// createWhiteboardThumbnail, but rendered from the live DOM with html-to-image.
// Callers treat a rejection as "keep the old thumbnail": it never blocks a save.
export async function createBoardThumbnail({ viewportEl, bounds, background }: ThumbnailInput): Promise<string | null> {
  if (!viewportEl || !bounds) return null;
  // Loaded on first save only: it is not needed to open or edit a board.
  const { toCanvas } = await import('html-to-image');
  const fontCss = await getBoardFontCss(viewportEl);
  if (!Number.isFinite(bounds.w) || bounds.w <= 0 || bounds.h <= 0) return null;
  const viewport = getViewportForBounds({ x: bounds.x, y: bounds.y, width: bounds.w, height: bounds.h }, THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT, 0.05, 1, PADDING);
  const canvas = await toCanvas(viewportEl, {
    width: THUMBNAIL_WIDTH,
    height: THUMBNAIL_HEIGHT,
    canvasWidth: THUMBNAIL_WIDTH,
    canvasHeight: THUMBNAIL_HEIGHT,
    pixelRatio: 1,
    backgroundColor: background,
    ...(fontCss ? { fontEmbedCSS: fontCss } : { skipFonts: true }),
    style: {
      width: `${THUMBNAIL_WIDTH}px`,
      height: `${THUMBNAIL_HEIGHT}px`,
      transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
    },
    filter: (el) => !isEditingChrome(el),
  });
  // Safari cannot encode WebP and silently returns PNG; the server takes both.
  return canvas.toDataURL('image/webp', 0.85);
}
