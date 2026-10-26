// Where a board's content sits: bounds that cover nodes (frames included, at
// their absolute position) AND pen strokes. The thumbnail, the viewer's
// "fit to screen" and the image export all use these. Pure, so it runs under
// `npm test`.
import type { BoardDocument, BoardNode } from "../schema/boards.js";
import { CANVAS_DEFAULT_SIZES } from "./canvasDefaults.js";
import { absolutePosition, indexNodes, unionBox, type Box, type CanvasSizeSource } from "./canvasOps.js";
import { buildMindForest, computeHiddenMindNodes, estimateMindNodeSize, type MindForest } from "./layout.js";
import { strokeBounds } from "./strokes.js";

type Content = Pick<BoardDocument, "nodes" | "edges" | "strokes">;

export interface BoundsOptions {
  /** Sizes measured in the DOM, keyed by node id. */
  sizes?: CanvasSizeSource;
  /** Count mind nodes hidden inside a collapsed branch (default: no, they are not drawn). */
  includeHidden?: boolean;
  /** A forest already built for this document. */
  forest?: MindForest;
}

/** Size of a node: measured, else stored, else an estimate for mind nodes, else the type default. */
export function boardNodeSize(node: BoardNode, sizes?: CanvasSizeSource, forest?: MindForest): { w: number; h: number } {
  const m = sizes?.[node.id];
  if (m && m.width > 0 && m.height > 0) return { w: m.width, h: m.height };
  if (node.size) return node.size;
  if (node.data.type === "mind") return estimateMindNodeSize(node.data, forest?.depth.get(node.id) ?? 1);
  return CANVAS_DEFAULT_SIZES[node.data.type];
}

/** The box of every drawn node, by id (absolute board coordinates). */
export function nodeBoxes(doc: Pick<BoardDocument, "nodes" | "edges">, opts: BoundsOptions = {}): Map<string, Box> {
  const forest = opts.forest ?? buildMindForest(doc.nodes, doc.edges);
  const hidden = opts.includeHidden ? new Set<string>() : computeHiddenMindNodes(forest);
  const byId = indexNodes(doc.nodes);
  const boxes = new Map<string, Box>();
  for (const node of doc.nodes) {
    if (hidden.has(node.id)) continue;
    const p = absolutePosition(byId, node);
    const s = boardNodeSize(node, opts.sizes, forest);
    boxes.set(node.id, { x: p.x, y: p.y, w: s.w, h: s.h });
  }
  return boxes;
}

/** Bounds of all nodes and strokes, or null for an empty board. */
export function boardContentBounds(doc: Content, opts: BoundsOptions = {}): Box | null {
  const boxes = Array.from(nodeBoxes(doc, opts).values());
  for (const stroke of doc.strokes) {
    const b = strokeBounds(stroke);
    if (b) boxes.push(b);
  }
  const box = unionBox(boxes);
  if (!box || !Number.isFinite(box.w) || !Number.isFinite(box.h)) return null;
  return box;
}

export function padBox(box: Box, pad: number): Box {
  return { x: box.x - pad, y: box.y - pad, w: box.w + pad * 2, h: box.h + pad * 2 };
}
