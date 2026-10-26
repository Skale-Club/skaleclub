// Defaults shared by the canvas editor, the templates and the pure canvas ops.
import type { BoardNodeData } from "../schema/boards.js";

export type CanvasNodeType = BoardNodeData["type"];

// Sizes used before React Flow has measured a node (and for new nodes).
export const CANVAS_DEFAULT_SIZES: Record<CanvasNodeType, { w: number; h: number }> = {
  mind: { w: 160, h: 44 },
  sticky: { w: 200, h: 200 },
  shape: { w: 160, h: 100 },
  text: { w: 200, h: 40 },
  frame: { w: 480, h: 320 },
  image: { w: 320, h: 200 },
};

// Eight pastel sticky-note colors.
export const STICKY_COLORS = [
  "#FEF3C7", // butter
  "#FDE2E4", // blush
  "#DCFCE7", // mint
  "#DBEAFE", // sky
  "#EDE9FE", // lavender
  "#FFEDD5", // peach
  "#E0F2FE", // ice
  "#F1F5F9", // cloud
] as const;

// Soft frame fills (translucent so they work on light and dark boards).
export const FRAME_COLORS = [
  "rgba(16, 185, 129, 0.10)", // green
  "rgba(239, 68, 68, 0.09)", // red
  "rgba(81, 115, 214, 0.10)", // blue
  "rgba(245, 158, 11, 0.11)", // amber
  "rgba(139, 92, 246, 0.10)", // violet
  "rgba(100, 116, 139, 0.08)", // slate
] as const;

export const TEXT_SIZES = { S: 14, M: 18, L: 28, XL: 44 } as const;

/** Node types that can live inside a frame. */
export const FRAMEABLE_TYPES = new Set<CanvasNodeType>(["sticky", "shape", "text", "image"]);
