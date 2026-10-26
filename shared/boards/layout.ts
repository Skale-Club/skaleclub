// Mind-map layout: a tidy tree (d3-hierarchy) for every mind-map root in a
// board document. Pure and DOM-free so it runs under `npm test`, in the editor
// store and in the public viewer alike.
//
// Model (see shared/schema/boards.ts): `mind` nodes linked by `tree` edges
// (source = parent, target = child). Sibling order is the order of the tree
// edges in `document.edges`. A mind node with no tree edge arriving is a root.
// Layout is relative to the root's current position, so dragging a root moves
// its whole map and the root itself never moves.
import { hierarchy, tree, type HierarchyPointNode } from "d3-hierarchy";
import type { BoardEdge, BoardNode, MindNodeData } from "../schema/boards.js";

export type MindLayoutKind = "balanced" | "right" | "vertical";
/** Which way a laid-out node hangs off its root. */
export type MindDirection = "left" | "right" | "down";

export interface MindSize {
  w: number;
  h: number;
}
/** Measured sizes as the store keeps them ({width,height}) or as {w,h}. */
export type MindSizeInput = MindSize | { width: number; height: number };
export type MindSizeSource = Map<string, MindSizeInput> | Record<string, MindSizeInput | undefined>;

/** Horizontal gap between levels (balanced / right). */
export const MIND_LEVEL_GAP = 48;
/** Vertical gap between levels in the org-chart layout. */
export const MIND_VERTICAL_LEVEL_GAP = 40;
/** Gap between siblings along the breadth axis. */
export const MIND_SIBLING_GAP = 14;
/** Gap between neighbours with different parents (a little more air between branches). */
export const MIND_COUSIN_GAP = 22;
/** Siblings sit side by side in the vertical layout, so they need more room. */
export const MIND_VERTICAL_SIBLING_GAP = 20;
export const MIND_VERTICAL_COUSIN_GAP = 32;
export const MIND_MAX_WIDTH = 320;

// ---------------------------------------------------------------------------
// Forest

export interface MindForest {
  /** Mind nodes by id. */
  nodes: Map<string, BoardNode>;
  /** child id -> parent id. */
  parent: Map<string, string>;
  /** parent id -> ordered child ids (tree-edge order). */
  children: Map<string, string[]>;
  /** child id -> the tree edge that attaches it. */
  incoming: Map<string, BoardEdge>;
  /** Root ids in document node order. */
  roots: string[];
  rootOf: Map<string, string>;
  depth: Map<string, number>;
}

function mindData(node: BoardNode): MindNodeData | null {
  return node.data.type === "mind" ? node.data : null;
}

export function isTreeEdgeBetweenMinds(edge: BoardEdge, mindIds: { has(id: string): boolean }): boolean {
  return edge.kind === "tree" && edge.source !== edge.target && mindIds.has(edge.source) && mindIds.has(edge.target);
}

// Builds the mind-map forest. A node gets the first tree edge that arrives at
// it (later ones are ignored); nodes only reachable through a cycle are broken
// out as extra roots so every mind node belongs to exactly one map.
export function buildMindForest(nodes: readonly BoardNode[], edges: readonly BoardEdge[]): MindForest {
  const mind = new Map<string, BoardNode>();
  for (const node of nodes) if (node.data.type === "mind") mind.set(node.id, node);

  const parent = new Map<string, string>();
  const incoming = new Map<string, BoardEdge>();
  const children = new Map<string, string[]>();
  for (const edge of edges) {
    if (!isTreeEdgeBetweenMinds(edge, mind) || parent.has(edge.target)) continue;
    parent.set(edge.target, edge.source);
    incoming.set(edge.target, edge);
  }
  const link = (from: string, to: string) => {
    const list = children.get(from);
    if (list) list.push(to);
    else children.set(from, [to]);
  };
  for (const edge of edges) {
    if (incoming.get(edge.target) === edge) link(edge.source, edge.target);
  }

  const roots: string[] = [];
  const rootOf = new Map<string, string>();
  const depth = new Map<string, number>();
  const walk = (rootId: string) => {
    roots.push(rootId);
    depth.set(rootId, 0);
    rootOf.set(rootId, rootId);
    const queue = [rootId];
    for (let i = 0; i < queue.length; i++) {
      const id = queue[i];
      const d = depth.get(id)!;
      for (const child of children.get(id) ?? []) {
        if (depth.has(child)) continue;
        depth.set(child, d + 1);
        rootOf.set(child, rootId);
        queue.push(child);
      }
    }
  };
  for (const id of Array.from(mind.keys())) if (!parent.has(id)) walk(id);
  // Cycles: promote the first unreached node of each one to a root.
  for (const id of Array.from(mind.keys())) {
    if (depth.has(id)) continue;
    const formerParent = parent.get(id);
    if (formerParent !== undefined) {
      parent.delete(id);
      incoming.delete(id);
      const list = children.get(formerParent);
      if (list) children.set(formerParent, list.filter((child) => child !== id));
    }
    walk(id);
  }
  return { nodes: mind, parent, children, incoming, roots, rootOf, depth };
}

/** The ids below `id` (not including it), depth first in child order. */
export function collectSubtree(forest: Pick<MindForest, "children">, id: string): string[] {
  const out: string[] = [];
  const stack = [...(forest.children.get(id) ?? [])].reverse();
  const seen = new Set<string>([id]);
  while (stack.length) {
    const next = stack.pop()!;
    if (seen.has(next)) continue;
    seen.add(next);
    out.push(next);
    const kids = forest.children.get(next);
    if (kids) for (let i = kids.length - 1; i >= 0; i--) stack.push(kids[i]);
  }
  return out;
}

/** Mind nodes hidden because an ancestor is collapsed. */
export function computeHiddenMindNodes(forest: MindForest): Set<string> {
  const hidden = new Set<string>();
  for (const [id, node] of Array.from(forest.nodes)) {
    if (hidden.has(id) || !mindData(node)?.collapsed) continue;
    for (const below of collectSubtree(forest, id)) hidden.add(below);
  }
  return hidden;
}

export function rootLayoutOf(forest: MindForest, rootId: string): MindLayoutKind {
  const node = forest.nodes.get(rootId);
  return (node && mindData(node)?.layout) || "balanced";
}

// ---------------------------------------------------------------------------
// Sizes

// A stand-in for the rendered size before the DOM has measured a node (and in
// tests). Mirrors MindNode's typography: 16px root, 14px elsewhere.
export function estimateMindNodeSize(data: Pick<MindNodeData, "text" | "icon" | "task" | "note" | "link">, depth: number): MindSize {
  const isRoot = depth === 0;
  const font = isRoot ? 16 : 14;
  const charWidth = font * 0.56;
  const lineHeight = Math.round(font * 1.4);
  const padX = isRoot ? 48 : 28;
  const padY = isRoot ? 24 : 16;
  const extras = (data.icon ? 22 : 0) + (data.task ? 20 : 0) + (data.note ? 20 : 0) + (data.link ? 20 : 0);
  const maxInner = MIND_MAX_WIDTH - padX - extras;
  const text = data.text?.length ? data.text : "Topic";
  let lines = 0;
  let widest = 0;
  for (const line of text.split("\n")) {
    const width = Math.max(1, line.length) * charWidth;
    lines += Math.max(1, Math.ceil(width / maxInner));
    widest = Math.max(widest, Math.min(width, maxInner));
  }
  const w = Math.min(MIND_MAX_WIDTH, Math.max(isRoot ? 120 : 64, Math.ceil(widest + padX + extras)));
  const h = Math.ceil(lines * lineHeight + padY + 4);
  return { w, h };
}

function readSize(source: MindSizeSource | undefined, id: string): MindSize | undefined {
  if (!source) return undefined;
  const raw = source instanceof Map ? source.get(id) : source[id];
  if (!raw) return undefined;
  if ("w" in raw) return raw.w > 0 && raw.h > 0 ? raw : undefined;
  return raw.width > 0 && raw.height > 0 ? { w: raw.width, h: raw.height } : undefined;
}

function makeSizeOf(forest: MindForest, sizes: MindSizeSource | undefined) {
  const cache = new Map<string, MindSize>();
  return (id: string): MindSize => {
    let size = cache.get(id);
    if (size) return size;
    const node = forest.nodes.get(id);
    size = readSize(sizes, id) ?? node?.size ?? (node && mindData(node) ? estimateMindNodeSize(mindData(node)!, forest.depth.get(id) ?? 1) : { w: 160, h: 44 });
    cache.set(id, size);
    return size;
  };
}

// ---------------------------------------------------------------------------
// Sides (balanced layout)

function visibleChildren(forest: MindForest, id: string): string[] {
  const node = forest.nodes.get(id);
  if (node && mindData(node)?.collapsed) return [];
  return forest.children.get(id) ?? [];
}

// How much room a subtree needs along the breadth axis (heights stacked).
function subtreeExtent(forest: MindForest, id: string, sizeOf: (id: string) => MindSize, memo: Map<string, number>): number {
  const cached = memo.get(id);
  if (cached !== undefined) return cached;
  memo.set(id, 0); // cycle guard
  const kids = visibleChildren(forest, id);
  let sum = 0;
  kids.forEach((child, i) => {
    sum += subtreeExtent(forest, child, sizeOf, memo) + (i > 0 ? MIND_SIBLING_GAP : 0);
  });
  const value = Math.max(sizeOf(id).h, sum);
  memo.set(id, value);
  return value;
}

// Splits a balanced root's first-level branches between the two sides: an
// explicit `side` is honoured, the rest go one by one to whichever side is
// lighter so far (ties go right), so the map stays balanced by height.
export function assignBalancedSides(
  forest: MindForest,
  rootId: string,
  sizeOf: (id: string) => MindSize,
): Map<string, "left" | "right"> {
  const memo = new Map<string, number>();
  const kids = forest.children.get(rootId) ?? [];
  const sides = new Map<string, "left" | "right">();
  const total = { left: 0, right: 0 };
  for (const id of kids) {
    const side = (forest.nodes.get(id)?.data as MindNodeData | undefined)?.side;
    if (side === "left" || side === "right") {
      sides.set(id, side);
      total[side] += subtreeExtent(forest, id, sizeOf, memo) + MIND_SIBLING_GAP;
    }
  }
  for (const id of kids) {
    if (sides.has(id)) continue;
    const side = total.left < total.right ? "left" : "right";
    sides.set(id, side);
    total[side] += subtreeExtent(forest, id, sizeOf, memo) + MIND_SIBLING_GAP;
  }
  return sides;
}

/** The side a new first-level branch of a balanced root should take. */
export function pickSideForNewBranch(
  nodes: readonly BoardNode[],
  edges: readonly BoardEdge[],
  rootId: string,
  sizes?: MindSizeSource,
): "left" | "right" {
  const forest = buildMindForest(nodes, edges);
  const sizeOf = makeSizeOf(forest, sizes);
  const sides = assignBalancedSides(forest, rootId, sizeOf);
  const memo = new Map<string, number>();
  const total = { left: 0, right: 0 };
  for (const [id, side] of Array.from(sides)) total[side] += subtreeExtent(forest, id, sizeOf, memo) + MIND_SIBLING_GAP;
  return total.left < total.right ? "left" : "right";
}

// ---------------------------------------------------------------------------
// Layout

export interface MindLayoutInput {
  nodes: readonly BoardNode[];
  edges: readonly BoardEdge[];
  /** Measured sizes by node id; missing ones are estimated from the text. */
  sizes?: MindSizeSource;
  /** Lay out only these roots (default: every root). Ids of non-roots are mapped to their root. */
  rootIds?: Iterable<string>;
  /** Reuse a forest already built for these nodes/edges. */
  forest?: MindForest;
}

export interface MindLayoutResult {
  /** New top-left positions of the visible, non-root nodes of the laid-out maps. */
  positions: Map<string, { x: number; y: number }>;
  /** Nodes under a collapsed ancestor (in the laid-out maps); not positioned. */
  hidden: Set<string>;
  /** Direction of each positioned node relative to its root. */
  directions: Map<string, MindDirection>;
  /** The roots that were laid out. */
  roots: string[];
}

type Point = HierarchyPointNode<string>;

export function layoutMindMaps(input: MindLayoutInput): MindLayoutResult {
  const forest = input.forest ?? buildMindForest(input.nodes, input.edges);
  const sizeOf = makeSizeOf(forest, input.sizes);
  const result: MindLayoutResult = { positions: new Map(), hidden: new Set(), directions: new Map(), roots: [] };

  let roots = forest.roots;
  if (input.rootIds) {
    const wanted = new Set<string>();
    for (const id of Array.from(input.rootIds)) {
      const root = forest.rootOf.get(id);
      if (root) wanted.add(root);
    }
    roots = forest.roots.filter((id) => wanted.has(id));
  }

  for (const rootId of roots) {
    result.roots.push(rootId);
    const root = forest.nodes.get(rootId)!;
    for (const id of collectSubtree(forest, rootId)) {
      // Anything under a collapsed node (including below collapsed descendants).
      let p = forest.parent.get(id);
      while (p !== undefined) {
        if (mindData(forest.nodes.get(p)!)?.collapsed) {
          result.hidden.add(id);
          break;
        }
        p = forest.parent.get(p);
      }
    }

    const placeGroup = (id: string, group: string[], direction: MindDirection) => {
      const vertical = direction === "down";
      const breadth = (n: string) => (vertical ? sizeOf(n).w : sizeOf(n).h);
      const along = (n: string) => (vertical ? sizeOf(n).h : sizeOf(n).w);
      const sibGap = vertical ? MIND_VERTICAL_SIBLING_GAP : MIND_SIBLING_GAP;
      const cousinGap = vertical ? MIND_VERTICAL_COUSIN_GAP : MIND_COUSIN_GAP;
      const levelGap = vertical ? MIND_VERTICAL_LEVEL_GAP : MIND_LEVEL_GAP;

      const h = hierarchy<string>(id, (n) => (n === id ? group : visibleChildren(forest, n)));
      const laid = tree<string>()
        .nodeSize([1, 1])
        .separation((a, b) => (breadth(a.data) + breadth(b.data)) / 2 + (a.parent === b.parent ? sibGap : cousinGap))(h);

      // Column (or row) per depth, as wide as its widest node, so nodes at
      // different depths can never overlap.
      const levelSize: number[] = [];
      laid.each((n: Point) => {
        levelSize[n.depth] = Math.max(levelSize[n.depth] ?? 0, along(n.data));
      });
      const start: number[] = [];
      if (vertical) {
        start[1] = root.position.y + rootSize.h + levelGap;
      } else if (direction === "right") {
        start[1] = root.position.x + rootSize.w + levelGap;
      } else {
        start[1] = root.position.x - levelGap; // right edge of the column
      }
      for (let d = 2; d < levelSize.length; d++) {
        const prev = levelSize[d - 1] ?? 0;
        start[d] = direction === "left" ? start[d - 1] - prev - levelGap : start[d - 1] + prev + levelGap;
      }

      const centerX = root.position.x + rootSize.w / 2;
      const centerY = root.position.y + rootSize.h / 2;
      laid.each((n: Point) => {
        if (n.depth === 0) return;
        const size = sizeOf(n.data);
        const offset = n.x - laid.x;
        let x: number;
        let y: number;
        if (vertical) {
          x = centerX + offset - size.w / 2;
          y = start[n.depth];
        } else {
          x = direction === "right" ? start[n.depth] : start[n.depth] - size.w;
          y = centerY + offset - size.h / 2;
        }
        result.positions.set(n.data, { x: Math.round(x), y: Math.round(y) });
        result.directions.set(n.data, direction);
      });
    };

    const kind = rootLayoutOf(forest, rootId);
    const rootSize = sizeOf(rootId);
    const kids = visibleChildren(forest, rootId);
    if (kids.length === 0) continue;

    if (kind === "vertical") {
      placeGroup(rootId, kids, "down");
      continue;
    }
    if (kind === "right") {
      placeGroup(rootId, kids, "right");
      continue;
    }
    const sides = assignBalancedSides(forest, rootId, sizeOf);
    const right = kids.filter((id) => sides.get(id) !== "left");
    const left = kids.filter((id) => sides.get(id) === "left");
    if (right.length) placeGroup(rootId, right, "right");
    if (left.length) placeGroup(rootId, left, "left");
  }
  return result;
}

// Applies a layout to a node list. Returns the same array when nothing moved.
export function applyMindLayout(nodes: BoardNode[], layout: Pick<MindLayoutResult, "positions">): BoardNode[] {
  let changed = false;
  const next = nodes.map((node) => {
    const pos = layout.positions.get(node.id);
    if (!pos || (pos.x === node.position.x && pos.y === node.position.y)) return node;
    changed = true;
    return { ...node, position: { x: pos.x, y: pos.y } };
  });
  return changed ? next : nodes;
}
