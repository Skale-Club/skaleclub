// Pure free-canvas edits on a board document: geometry (absolute boxes),
// alignment and distribution, snap guides, frame membership, z-order, lock,
// nudge, duplicate and clipboard (copy/paste with new ids). DOM-free, so they
// run under `npm test`; the editor wraps each one in a single store commit.
import { z } from "zod";
import {
  BOARD_LIMITS,
  boardEdgeSchema,
  boardNodeSchema,
  type BoardDocument,
  type BoardEdge,
  type BoardNode,
} from "../schema/boards.js";
import { CANVAS_DEFAULT_SIZES, FRAMEABLE_TYPES } from "./canvasDefaults.js";
import { collectDescendants, createBoardId } from "./document.js";

export interface Point {
  x: number;
  y: number;
}
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
export type IdBox = Box & { id: string };
/** Sizes measured in the DOM (React Flow), keyed by node id. */
export type CanvasSizeSource = Record<string, { width: number; height: number } | undefined> | undefined;

type Nodes = readonly BoardNode[];

export function indexNodes(nodes: Nodes): Map<string, BoardNode> {
  return new Map(nodes.map((n) => [n.id, n]));
}

export function nodeSize(node: BoardNode, sizes?: CanvasSizeSource): { w: number; h: number } {
  const m = sizes?.[node.id];
  if (m && m.width > 0 && m.height > 0) return { w: m.width, h: m.height };
  return node.size ?? CANVAS_DEFAULT_SIZES[node.data.type];
}

/** Position on the board (frame children store positions relative to their frame). */
export function absolutePosition(byId: Map<string, BoardNode>, node: BoardNode): Point {
  let x = node.position.x;
  let y = node.position.y;
  const seen = new Set<string>([node.id]);
  let parent = node.parentId ? byId.get(node.parentId) : undefined;
  while (parent && !seen.has(parent.id)) {
    seen.add(parent.id);
    x += parent.position.x;
    y += parent.position.y;
    parent = parent.parentId ? byId.get(parent.parentId) : undefined;
  }
  return { x, y };
}

export function absoluteBox(byId: Map<string, BoardNode>, node: BoardNode, sizes?: CanvasSizeSource): Box {
  const p = absolutePosition(byId, node);
  const s = nodeSize(node, sizes);
  return { x: p.x, y: p.y, w: s.w, h: s.h };
}

export function unionBox(boxes: Box[]): Box | null {
  if (!boxes.length) return null;
  let x1 = Infinity;
  let y1 = Infinity;
  let x2 = -Infinity;
  let y2 = -Infinity;
  for (const b of boxes) {
    x1 = Math.min(x1, b.x);
    y1 = Math.min(y1, b.y);
    x2 = Math.max(x2, b.x + b.w);
    y2 = Math.max(y2, b.y + b.h);
  }
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

export function boxContains(outer: Box, inner: Box): boolean {
  return inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.w <= outer.x + outer.w && inner.y + inner.h <= outer.y + outer.h;
}

export function boxContainsPoint(box: Box, p: Point): boolean {
  return p.x >= box.x && p.x <= box.x + box.w && p.y >= box.y && p.y <= box.y + box.h;
}

// Ids with an ancestor in the set are dropped: moving a frame already moves them.
export function topLevelIds(doc: Pick<BoardDocument, "nodes">, ids: Iterable<string>): string[] {
  const set = new Set(ids);
  const byId = indexNodes(doc.nodes);
  return Array.from(set).filter((id) => {
    const node = byId.get(id);
    if (!node) return false;
    let parent = node.parentId;
    const seen = new Set<string>();
    while (parent && !seen.has(parent)) {
      if (set.has(parent)) return false;
      seen.add(parent);
      parent = byId.get(parent)?.parentId;
    }
    return true;
  });
}

function patchNodes(doc: BoardDocument, patch: Map<string, (node: BoardNode) => BoardNode>): BoardDocument {
  if (patch.size === 0) return doc;
  let changed = false;
  const nodes = doc.nodes.map((node) => {
    const fn = patch.get(node.id);
    if (!fn) return node;
    const next = fn(node);
    if (next !== node) changed = true;
    return next;
  });
  return changed ? { ...doc, nodes } : doc;
}

/** Moves nodes to absolute positions (converted back to frame-relative where needed). */
export function setAbsolutePositions(doc: BoardDocument, positions: Map<string, Point>): BoardDocument {
  const byId = indexNodes(doc.nodes);
  const patch = new Map<string, (node: BoardNode) => BoardNode>();
  for (const [id, abs] of Array.from(positions)) {
    const node = byId.get(id);
    if (!node) continue;
    const parent = node.parentId ? byId.get(node.parentId) : undefined;
    const origin = parent ? absolutePosition(byId, parent) : { x: 0, y: 0 };
    const x = Math.round((abs.x - origin.x) * 100) / 100;
    const y = Math.round((abs.y - origin.y) * 100) / 100;
    if (x === node.position.x && y === node.position.y) continue;
    patch.set(id, (n) => ({ ...n, position: { x, y } }));
  }
  return patchNodes(doc, patch);
}

// ---------------------------------------------------------------------------
// Align / distribute

export type AlignMode = "left" | "center" | "right" | "top" | "middle" | "bottom";
export type DistributeAxis = "horizontal" | "vertical";

/** New absolute positions that align the boxes to the edge/centre of their union. */
export function alignBoxes(boxes: IdBox[], mode: AlignMode): Map<string, Point> {
  const out = new Map<string, Point>();
  const all = unionBox(boxes);
  if (!all || boxes.length < 2) return out;
  for (const b of boxes) {
    let { x, y } = b;
    if (mode === "left") x = all.x;
    else if (mode === "center") x = all.x + all.w / 2 - b.w / 2;
    else if (mode === "right") x = all.x + all.w - b.w;
    else if (mode === "top") y = all.y;
    else if (mode === "middle") y = all.y + all.h / 2 - b.h / 2;
    else y = all.y + all.h - b.h;
    if (x !== b.x || y !== b.y) out.set(b.id, { x, y });
  }
  return out;
}

/** Equal gaps between boxes along an axis; the first and last stay put. */
export function distributeBoxes(boxes: IdBox[], axis: DistributeAxis): Map<string, Point> {
  const out = new Map<string, Point>();
  if (boxes.length < 3) return out;
  const horizontal = axis === "horizontal";
  const start = (b: Box) => (horizontal ? b.x : b.y);
  const len = (b: Box) => (horizontal ? b.w : b.h);
  const sorted = [...boxes].sort((a, b) => start(a) - start(b) || a.id.localeCompare(b.id));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const span = start(last) + len(last) - start(first);
  const used = sorted.reduce((sum, b) => sum + len(b), 0);
  const gap = (span - used) / (sorted.length - 1);
  let cursor = start(first);
  for (const b of sorted) {
    const at = Math.round(cursor * 100) / 100;
    if (at !== start(b)) out.set(b.id, horizontal ? { x: at, y: b.y } : { x: b.x, y: at });
    cursor += len(b) + gap;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Snap guides (while dragging)

export interface GuideLine {
  /** `v`: a vertical line at x = pos; `h`: a horizontal line at y = pos. */
  orientation: "v" | "h";
  pos: number;
  from: number;
  to: number;
}

export interface SnapResult {
  dx: number;
  dy: number;
  lines: GuideLine[];
}

const xs = (b: Box) => [b.x, b.x + b.w / 2, b.x + b.w];
const ys = (b: Box) => [b.y, b.y + b.h / 2, b.y + b.h];

/**
 * Snaps a moving box to the edges and centres of other boxes within
 * `threshold` (per axis, the closest match wins) and returns the guide lines
 * to draw for the snapped position.
 */
export function computeSnap(moving: Box, others: Box[], threshold: number): SnapResult {
  let best: { dx: number; dist: number } | null = null;
  let bestY: { dy: number; dist: number } | null = null;
  const mx = xs(moving);
  const my = ys(moving);
  for (const o of others) {
    for (const ox of xs(o)) {
      for (const m of mx) {
        const d = ox - m;
        if (Math.abs(d) <= threshold && (!best || Math.abs(d) < best.dist)) best = { dx: d, dist: Math.abs(d) };
      }
    }
    for (const oy of ys(o)) {
      for (const m of my) {
        const d = oy - m;
        if (Math.abs(d) <= threshold && (!bestY || Math.abs(d) < bestY.dist)) bestY = { dy: d, dist: Math.abs(d) };
      }
    }
  }
  const dx = best?.dx ?? 0;
  const dy = bestY?.dy ?? 0;
  const snapped: Box = { ...moving, x: moving.x + dx, y: moving.y + dy };
  const lines: GuideLine[] = [];
  const eps = 0.5;
  if (best) {
    const seen = new Set<number>();
    for (const m of xs(snapped)) {
      const matches = others.filter((o) => xs(o).some((v) => Math.abs(v - m) < eps));
      if (!matches.length || seen.has(Math.round(m * 2))) continue;
      seen.add(Math.round(m * 2));
      const from = Math.min(snapped.y, ...matches.map((o) => o.y));
      const to = Math.max(snapped.y + snapped.h, ...matches.map((o) => o.y + o.h));
      lines.push({ orientation: "v", pos: m, from, to });
    }
  }
  if (bestY) {
    const seen = new Set<number>();
    for (const m of ys(snapped)) {
      const matches = others.filter((o) => ys(o).some((v) => Math.abs(v - m) < eps));
      if (!matches.length || seen.has(Math.round(m * 2))) continue;
      seen.add(Math.round(m * 2));
      const from = Math.min(snapped.x, ...matches.map((o) => o.x));
      const to = Math.max(snapped.x + snapped.w, ...matches.map((o) => o.x + o.w));
      lines.push({ orientation: "h", pos: m, from, to });
    }
  }
  return { dx, dy, lines };
}

// ---------------------------------------------------------------------------
// Frames

/** The frame a node should belong to: the smallest frame containing its centre. */
export function findDropFrame(doc: Pick<BoardDocument, "nodes" | "edges">, nodeId: string, sizes?: CanvasSizeSource): string | null {
  const byId = indexNodes(doc.nodes);
  const node = byId.get(nodeId);
  if (!node || !FRAMEABLE_TYPES.has(node.data.type)) return null;
  const box = absoluteBox(byId, node, sizes);
  const center = { x: box.x + box.w / 2, y: box.y + box.h / 2 };
  const excluded = collectDescendants(doc, [nodeId]);
  let best: { id: string; area: number } | null = null;
  for (const frame of doc.nodes) {
    if (frame.data.type !== "frame" || excluded.has(frame.id)) continue;
    const fb = absoluteBox(byId, frame, sizes);
    if (!boxContainsPoint(fb, center)) continue;
    const area = fb.w * fb.h;
    if (!best || area < best.area) best = { id: frame.id, area };
  }
  return best?.id ?? null;
}

/** Puts a node inside a frame (or takes it out with null), keeping it where it is on the board. */
export function setNodeParent(doc: BoardDocument, nodeId: string, frameId: string | null): BoardDocument {
  const byId = indexNodes(doc.nodes);
  const node = byId.get(nodeId);
  if (!node || (node.parentId ?? null) === frameId) return doc;
  const frame = frameId ? byId.get(frameId) : undefined;
  if (frameId && (!frame || frame.data.type !== "frame")) return doc;
  const abs = absolutePosition(byId, node);
  const origin = frame ? absolutePosition(byId, frame) : { x: 0, y: 0 };
  const position = { x: abs.x - origin.x, y: abs.y - origin.y };
  return patchNodes(
    doc,
    new Map([
      [
        nodeId,
        (n: BoardNode) => {
          const { parentId: _p, ...rest } = n;
          return frameId ? { ...rest, parentId: frameId, position } : { ...rest, position };
        },
      ],
    ]),
  );
}

/** After a drag: each moved frameable node joins the frame under it, or leaves its frame. */
export function updateFrameMembership(doc: BoardDocument, ids: Iterable<string>, sizes?: CanvasSizeSource): BoardDocument {
  let next = doc;
  for (const id of Array.from(ids)) {
    const node = next.nodes.find((n) => n.id === id);
    if (!node || !FRAMEABLE_TYPES.has(node.data.type)) continue;
    const frame = findDropFrame(next, id, sizes);
    if ((node.parentId ?? null) !== frame) next = setNodeParent(next, id, frame);
  }
  return ensureParentsFirst(next);
}

/** A frame drawn (or dropped) over loose nodes takes the ones fully inside it. */
export function adoptIntoFrame(doc: BoardDocument, frameId: string, sizes?: CanvasSizeSource): BoardDocument {
  const byId = indexNodes(doc.nodes);
  const frame = byId.get(frameId);
  if (!frame || frame.data.type !== "frame") return doc;
  const fb = absoluteBox(byId, frame, sizes);
  let next = doc;
  for (const node of doc.nodes) {
    if (node.id === frameId || node.parentId || !FRAMEABLE_TYPES.has(node.data.type)) continue;
    if (boxContains(fb, absoluteBox(byId, node, sizes))) next = setNodeParent(next, node.id, frameId);
  }
  return ensureParentsFirst(next);
}

/** Frames before their children in the array (React Flow needs parents first). */
export function ensureParentsFirst(doc: BoardDocument): BoardDocument {
  const index = new Map(doc.nodes.map((n, i) => [n.id, i]));
  const bad = doc.nodes.some((n, i) => n.parentId !== undefined && (index.get(n.parentId) ?? -1) > i);
  if (!bad) return doc;
  const frames = doc.nodes.filter((n) => n.data.type === "frame");
  const rest = doc.nodes.filter((n) => n.data.type !== "frame");
  return { ...doc, nodes: [...frames, ...rest] };
}

// ---------------------------------------------------------------------------
// Z-order

export type ZOrderOp = "front" | "back" | "forward" | "backward";

const defaultZ = (node: BoardNode) => (node.data.type === "frame" ? -1 : 0);
export const effectiveZ = (node: BoardNode) => node.zIndex ?? defaultZ(node);

/**
 * Reorders the selected nodes within their layer (frames always stay under
 * content) and renumbers that layer: content 0..n-1, frames -n..-1. Nodes
 * whose value does not change keep their object.
 */
export function reorderZ(doc: BoardDocument, ids: Iterable<string>, op: ZOrderOp): BoardDocument {
  const selected = new Set(ids);
  if (selected.size === 0) return doc;
  const patch = new Map<string, (node: BoardNode) => BoardNode>();
  for (const frames of [true, false]) {
    const layer = doc.nodes
      .map((node, index) => ({ node, index }))
      .filter(({ node }) => (node.data.type === "frame") === frames)
      .sort((a, b) => effectiveZ(a.node) - effectiveZ(b.node) || a.index - b.index)
      .map(({ node }) => node);
    if (!layer.some((n) => selected.has(n.id))) continue;
    let order = [...layer];
    if (op === "front") order = [...order.filter((n) => !selected.has(n.id)), ...order.filter((n) => selected.has(n.id))];
    else if (op === "back") order = [...order.filter((n) => selected.has(n.id)), ...order.filter((n) => !selected.has(n.id))];
    else if (op === "forward") {
      for (let i = order.length - 2; i >= 0; i--) {
        if (selected.has(order[i].id) && !selected.has(order[i + 1].id)) [order[i], order[i + 1]] = [order[i + 1], order[i]];
      }
    } else {
      for (let i = 1; i < order.length; i++) {
        if (selected.has(order[i].id) && !selected.has(order[i - 1].id)) [order[i], order[i - 1]] = [order[i - 1], order[i]];
      }
    }
    if (order.every((node, i) => node === layer[i])) continue;
    order.forEach((node, i) => {
      const z = frames ? i - order.length : i;
      if (node.zIndex === z || (node.zIndex === undefined && z === defaultZ(node))) return;
      patch.set(node.id, (n) => ({ ...n, zIndex: z }));
    });
  }
  return patchNodes(doc, patch);
}

// ---------------------------------------------------------------------------
// Lock / nudge

export function setLocked(doc: BoardDocument, ids: Iterable<string>, locked: boolean): BoardDocument {
  const patch = new Map<string, (node: BoardNode) => BoardNode>();
  for (const id of Array.from(ids)) {
    patch.set(id, (n) => {
      if (!!n.locked === locked) return n;
      if (locked) return { ...n, locked: true };
      const { locked: _l, ...rest } = n;
      return rest;
    });
  }
  return patchNodes(doc, patch);
}

/** Moves unlocked non-mind nodes by (dx, dy); frame children move with their frame. */
export function translateNodes(doc: BoardDocument, ids: Iterable<string>, dx: number, dy: number): BoardDocument {
  if (!dx && !dy) return doc;
  const patch = new Map<string, (node: BoardNode) => BoardNode>();
  const byId = indexNodes(doc.nodes);
  for (const id of topLevelIds(doc, ids)) {
    const node = byId.get(id);
    if (!node || node.locked || node.data.type === "mind") continue;
    patch.set(id, (n) => ({ ...n, position: { x: n.position.x + dx, y: n.position.y + dy } }));
  }
  return patchNodes(doc, patch);
}

// ---------------------------------------------------------------------------
// Duplicate / clipboard

export const CLIPBOARD_KIND = "skaleclub-board-clipboard";

export interface BoardClipboard {
  kind: typeof CLIPBOARD_KIND;
  version: 1;
  /** Top-level nodes carry absolute positions; nodes inside a copied frame stay relative to it. */
  nodes: BoardNode[];
  /** Edges with both ends among `nodes` (connectors and mind-map branches). */
  edges: BoardEdge[];
}

const clipboardSchema = z.object({
  kind: z.literal(CLIPBOARD_KIND),
  version: z.literal(1),
  nodes: z.array(boardNodeSchema).max(BOARD_LIMITS.nodes),
  edges: z.array(boardEdgeSchema).max(BOARD_LIMITS.edges),
});

/** What copying `ids` puts on the clipboard: the nodes, everything inside or below them, and the edges among them. */
export function extractClipboard(doc: BoardDocument, ids: Iterable<string>): BoardClipboard {
  const set = collectDescendants(doc, ids);
  const byId = indexNodes(doc.nodes);
  const nodes: BoardNode[] = [];
  for (const node of doc.nodes) {
    if (!set.has(node.id)) continue;
    if (node.parentId && set.has(node.parentId)) nodes.push(node);
    else {
      const { parentId: _p, ...rest } = node;
      nodes.push({ ...rest, position: absolutePosition(byId, node) });
    }
  }
  const edges = doc.edges.filter((e) => set.has(e.source) && set.has(e.target));
  return { kind: CLIPBOARD_KIND, version: 1, nodes, edges };
}

export function serializeClipboard(clip: BoardClipboard): string {
  return JSON.stringify(clip);
}

export function isClipboardText(text: string | null | undefined): boolean {
  return !!text && text.trimStart().startsWith("{") && text.includes(CLIPBOARD_KIND);
}

export function parseClipboard(text: string | null | undefined): BoardClipboard | null {
  if (!isClipboardText(text)) return null;
  try {
    const parsed = clipboardSchema.safeParse(JSON.parse(text!));
    return parsed.success ? (parsed.data as BoardClipboard) : null;
  } catch {
    return null;
  }
}

export interface InsertResult {
  doc: BoardDocument;
  /** New ids of the top-level inserted nodes (what should end up selected). */
  ids: string[];
  /** old id -> new id for every inserted node. */
  idMap: Map<string, string>;
}

function remapEdges(edges: BoardEdge[], idMap: Map<string, string>, newId: () => string): BoardEdge[] {
  return edges
    .filter((e) => idMap.has(e.source) && idMap.has(e.target))
    .map((e) => ({ ...e, id: newId(), source: idMap.get(e.source)!, target: idMap.get(e.target)! }));
}

/**
 * Pastes clipboard content with fresh ids. Top-level nodes are shifted by
 * `offset`, or moved so their bounding box is centred on `center`.
 */
export function pasteClipboard(
  doc: BoardDocument,
  clip: Pick<BoardClipboard, "nodes" | "edges">,
  opts: { offset?: Point; center?: Point; newId?: () => string } = {},
): InsertResult {
  const newId = opts.newId ?? createBoardId;
  const room = Math.max(0, BOARD_LIMITS.nodes - doc.nodes.length);
  const inClip = new Set(clip.nodes.map((n) => n.id));
  // Children whose frame was not copied become top-level (cannot happen with
  // extractClipboard, but a hand-made paste may do it).
  const top = clip.nodes.filter((n) => !n.parentId || !inClip.has(n.parentId));
  let shift = opts.offset ?? { x: 0, y: 0 };
  if (opts.center) {
    const box = unionBox(top.map((n) => ({ x: n.position.x, y: n.position.y, ...nodeSize(n) })));
    if (box) shift = { x: Math.round(opts.center.x - (box.x + box.w / 2)), y: Math.round(opts.center.y - (box.y + box.h / 2)) };
  }
  const idMap = new Map<string, string>();
  const kept = clip.nodes.slice(0, room);
  for (const n of kept) idMap.set(n.id, newId());
  const nodes: BoardNode[] = kept.map((n) => {
    const isTop = !n.parentId || !idMap.has(n.parentId);
    const { parentId: _p, ...rest } = n;
    if (isTop) return { ...rest, id: idMap.get(n.id)!, position: { x: n.position.x + shift.x, y: n.position.y + shift.y } };
    return { ...rest, id: idMap.get(n.id)!, parentId: idMap.get(n.parentId!)! };
  });
  const edges = remapEdges(clip.edges, idMap, newId).slice(0, Math.max(0, BOARD_LIMITS.edges - doc.edges.length));
  const ids = kept.filter((n) => !n.parentId || !idMap.has(n.parentId)).map((n) => idMap.get(n.id)!);
  return { doc: ensureParentsFirst({ ...doc, nodes: [...doc.nodes, ...nodes], edges: [...doc.edges, ...edges] }), ids, idMap };
}

/**
 * Ctrl/Cmd+D: copies `ids` (with frame contents, mind subtrees and the edges
 * among them) `offset` px down-right. A copy keeps its frame, and a copied
 * mind branch is attached to the same parent as the original.
 */
export function duplicateNodes(doc: BoardDocument, ids: Iterable<string>, opts: { offset?: number; newId?: () => string } = {}): InsertResult {
  const newId = opts.newId ?? createBoardId;
  const offset = opts.offset ?? 24;
  const requested = topLevelIds(doc, ids);
  const set = collectDescendants(doc, requested);
  const room = Math.max(0, BOARD_LIMITS.nodes - doc.nodes.length);
  const source = doc.nodes.filter((n) => set.has(n.id)).slice(0, room);
  const idMap = new Map<string, string>();
  for (const n of source) idMap.set(n.id, newId());
  const nodes: BoardNode[] = source.map((n) => {
    const insideCopy = !!n.parentId && idMap.has(n.parentId);
    if (insideCopy) return { ...n, id: idMap.get(n.id)!, parentId: idMap.get(n.parentId!)! };
    return { ...n, id: idMap.get(n.id)!, position: { x: n.position.x + offset, y: n.position.y + offset } };
  });
  const edges = remapEdges(
    doc.edges.filter((e) => set.has(e.source) && set.has(e.target)),
    idMap,
    newId,
  );
  // Mind branches: hang the copy off the original's parent, right after it.
  const allEdges = [...doc.edges];
  for (const id of requested) {
    const incoming = doc.edges.find((e) => e.kind === "tree" && e.target === id);
    if (!incoming || set.has(incoming.source) || !idMap.has(id)) continue;
    const at = allEdges.indexOf(incoming);
    allEdges.splice(at + 1, 0, { id: newId(), source: incoming.source, target: idMap.get(id)!, kind: "tree" });
  }
  const top = requested.filter((id) => idMap.has(id)).map((id) => idMap.get(id)!);
  return { doc: ensureParentsFirst({ ...doc, nodes: [...doc.nodes, ...nodes], edges: [...allEdges, ...edges] }), ids: top, idMap };
}

/** Moves content so its bounding box is centred on `center` (top-level nodes only). */
export function centerContent<T extends Pick<BoardDocument, "nodes" | "edges">>(content: T, center: Point): T {
  const top = content.nodes.filter((n) => !n.parentId);
  const box = unionBox(top.map((n) => ({ x: n.position.x, y: n.position.y, ...nodeSize(n) })));
  if (!box) return content;
  const dx = Math.round(center.x - (box.x + box.w / 2));
  const dy = Math.round(center.y - (box.y + box.h / 2));
  return {
    ...content,
    nodes: content.nodes.map((n) => (n.parentId ? n : { ...n, position: { x: n.position.x + dx, y: n.position.y + dy } })),
  };
}
