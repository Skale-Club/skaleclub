import { getNodesBounds, getViewportForBounds, type Node } from '@xyflow/react';

const THUMBNAIL_WIDTH = 640;
const THUMBNAIL_HEIGHT = 360;
const PADDING = 0.12;
const FONT_EMBED_TIMEOUT_MS = 3_000;

// The board font (Inter, from Google Fonts) inlined as @font-face CSS. Built
// once per session; without it the clone falls back to a wider system font and
// labels wrap differently than on screen. null = embedding failed, skip fonts.
let fontEmbedCss: Promise<string | null> | null = null;

export interface ThumbnailInput {
  /** The `.react-flow__viewport` element of a mounted canvas. */
  viewportEl: HTMLElement | null;
  /** React Flow nodes with measured sizes (`reactFlow.getNodes()`). */
  nodes: Node[];
  background: string;
}

// 16:9 card preview of the whole board, fitted inside 640x360 on the board's
// own background. null for an empty board. Same idea as the whiteboards'
// createWhiteboardThumbnail, but rendered from the live DOM with html-to-image.
// Callers treat a rejection as "keep the old thumbnail": it never blocks a save.
export async function createBoardThumbnail({ viewportEl, nodes, background }: ThumbnailInput): Promise<string | null> {
  if (!viewportEl || nodes.length === 0) return null;
  // Loaded on first save only: it is not needed to open or edit a board.
  const { toCanvas, getFontEmbedCSS } = await import('html-to-image');
  if (!fontEmbedCss) {
    // Bounded: a slow or blocked font host must not hold up saves.
    const timeout = new Promise<null>((resolve) => window.setTimeout(() => resolve(null), FONT_EMBED_TIMEOUT_MS));
    fontEmbedCss = Promise.race([getFontEmbedCSS(viewportEl), timeout]).catch((err) => {
      console.warn('Board thumbnail: could not embed fonts', err);
      return null;
    });
  }
  const fontCss = await fontEmbedCss;
  const bounds = getNodesBounds(nodes);
  if (!Number.isFinite(bounds.width) || bounds.width <= 0 || bounds.height <= 0) return null;
  const viewport = getViewportForBounds(bounds, THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT, 0.05, 1, PADDING);
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
    // Connection handles are editing chrome, not content.
    filter: (el) => !(el instanceof HTMLElement && el.classList.contains('react-flow__handle')),
  });
  // Safari cannot encode WebP and silently returns PNG; the server takes both.
  return canvas.toDataURL('image/webp', 0.85);
}
