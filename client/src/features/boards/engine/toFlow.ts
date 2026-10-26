// Pure conversions between the stored board document and React Flow's nodes
// and edges. Type-only imports from @xyflow/react keep this file free of
// runtime dependencies so it can be unit-tested without a DOM.
import type { Edge, MarkerType, Node } from '@xyflow/react';
import type { BoardEdge, BoardNode, BoardNodeData, BoardTheme } from '@shared/schema';
import { computeTreeDepths, sortNodesParentFirst } from '@shared/boards/document';
import { buildMindForest, computeHiddenMindNodes, rootLayoutOf, type MindDirection, type MindForest, type MindLayoutKind } from '@shared/boards/layout';
import type { BoardSelection, MeasuredSize } from '../store/boardStore';
import { branchPalette } from './palette';

export type BoardNodeType = BoardNodeData['type'];

/** Render-only fields added next to the stored data; stripped by `fromFlowNode`. */
export interface FlowNodeMeta {
  /** Depth in its mind-map tree (0 = root); undefined for non-mind nodes. */
  depth?: number;
  readOnly?: boolean;
  /** Mind nodes: the branch color (first-level palette color, or an inherited override). */
  branchColor?: string;
  /** Mind nodes (non-root): which way the node hangs off its parent. */
  direction?: MindDirection;
  /** Mind nodes: number of direct children. */
  childCount?: number;
  /** Mind nodes: descendants hidden because this node is collapsed. */
  hiddenCount?: number;
  /** Mind roots: their layout. */
  layout?: MindLayoutKind;
}

/** Per-node mind-map facts derived from the document (computed once per document change). */
export interface MindMeta {
  forest: MindForest;
  hidden: Set<string>;
  byId: Map<string, Pick<FlowNodeMeta, 'depth' | 'branchColor' | 'direction' | 'childCount' | 'hiddenCount' | 'layout'>>;
}

export function computeMindMeta(nodes: BoardNode[], edges: BoardEdge[], palette: BoardTheme['palette'] = 'brand', forest = buildMindForest(nodes, edges)): MindMeta {
  const hidden = computeHiddenMindNodes(forest);
  const colors = branchPalette(palette);
  const byId: MindMeta['byId'] = new Map();
  for (const rootId of forest.roots) {
    const root = forest.nodes.get(rootId)!;
    const layout = rootLayoutOf(forest, rootId);
    const visit = (id: string, depth: number, color: string | undefined, branchIndex: number) => {
      const node = forest.nodes.get(id)!;
      const data = node.data.type === 'mind' ? node.data : undefined;
      const own = depth > 0 ? (data?.color ?? color ?? colors[branchIndex % colors.length]) : undefined;
      const kids = forest.children.get(id) ?? [];
      let direction: MindDirection | undefined;
      if (depth > 0) {
        const parent = forest.nodes.get(forest.parent.get(id)!)!;
        direction = layout === 'vertical' ? 'down' : node.position.x < (depth === 1 ? root : parent).position.x ? 'left' : 'right';
      }
      let hiddenCount = 0;
      if (data?.collapsed && kids.length) {
        const stack = [...kids];
        while (stack.length) {
          const next = stack.pop()!;
          hiddenCount++;
          for (const k of forest.children.get(next) ?? []) stack.push(k);
        }
      }
      byId.set(id, { depth, branchColor: own, direction, childCount: kids.length, hiddenCount, layout: depth === 0 ? layout : undefined });
      kids.forEach((kid, i) => visit(kid, depth + 1, depth === 0 ? undefined : own, depth === 0 ? i : branchIndex));
    };
    visit(rootId, 0, undefined, 0);
  }
  return { forest, hidden, byId };
}

/** Reuses flow nodes whose inputs did not change, so React Flow skips them (see toFlowNodes). */
export type FlowNodeCache = Map<string, { key: unknown[]; flow: BoardFlowNode }>;

export type BoardFlowNodeData = BoardNodeData & { meta: FlowNodeMeta };
export type BoardFlowNode = Node<BoardFlowNodeData, BoardNodeType>;
export type BoardFlowEdgeData = NonNullable<BoardEdge['data']> & {
  /** Render-only (tree edges): branch color and depth of the child; stripped by fromFlowEdge. */
  branchColor?: string;
  treeDepth?: number;
} & Record<string, unknown>;
export type BoardFlowEdge = Edge<BoardFlowEdgeData, BoardEdge['kind']>;

export type HandleSide = 'top' | 'right' | 'bottom' | 'left';

// Fallback sizes before React Flow has measured a node (used to pick handles).
export const DEFAULT_NODE_SIZE: Record<BoardNodeType, { w: number; h: number }> = {
  mind: { w: 160, h: 44 },
  sticky: { w: 200, h: 200 },
  shape: { w: 160, h: 100 },
  text: { w: 200, h: 40 },
  frame: { w: 480, h: 320 },
  image: { w: 320, h: 200 },
};

const FIXED_SIZE_TYPES = new Set<BoardNodeType>(['sticky', 'shape', 'frame', 'image']);

export interface ToFlowOptions {
  selection?: BoardSelection;
  measured?: Record<string, MeasuredSize>;
  readOnly?: boolean;
  /** Mind-map facts (computeMindMeta); computed here when omitted. */
  mind?: MindMeta;
  cache?: FlowNodeCache;
}

export function toFlowNodes(nodes: BoardNode[], edges: BoardEdge[], opts: ToFlowOptions = {}): BoardFlowNode[] {
  const selected = new Set(opts.selection?.nodeIds ?? []);
  const mind = opts.mind ?? computeMindMeta(nodes, edges);
  const depths = mind.byId.size ? null : computeTreeDepths({ nodes, edges });
  const ids = new Set(nodes.map((n) => n.id));
  const cache = opts.cache;
  const seen = cache ? new Set<string>() : null;
  const out = sortNodesParentFirst(nodes).map((node) => {
    const meta = mind.byId.get(node.id);
    const ctx = {
      selected: selected.has(node.id),
      measured: opts.measured?.[node.id],
      depth: meta?.depth ?? depths?.get(node.id),
      readOnly: opts.readOnly,
      parentExists: node.parentId ? ids.has(node.parentId) : false,
      hidden: mind.hidden.has(node.id),
      mind: meta,
    };
    if (!cache) return toFlowNode(node, ctx);
    seen!.add(node.id);
    const key = [node, ctx.selected, ctx.measured, ctx.depth, ctx.readOnly, ctx.parentExists, ctx.hidden, meta?.branchColor, meta?.direction, meta?.childCount, meta?.hiddenCount, meta?.layout];
    const hit = cache.get(node.id);
    if (hit && hit.key.length === key.length && hit.key.every((value, i) => value === key[i])) return hit.flow;
    const flow = toFlowNode(node, ctx);
    cache.set(node.id, { key, flow });
    return flow;
  });
  if (cache && seen) for (const id of Array.from(cache.keys())) if (!seen.has(id)) cache.delete(id);
  return out;
}

export function toFlowNode(
  node: BoardNode,
  ctx: {
    selected?: boolean;
    measured?: MeasuredSize;
    depth?: number;
    readOnly?: boolean;
    parentExists?: boolean;
    hidden?: boolean;
    mind?: MindMeta['byId'] extends Map<string, infer M> ? M : never;
  } = {},
): BoardFlowNode {
  const flow: BoardFlowNode = {
    id: node.id,
    type: node.data.type,
    position: { x: node.position.x, y: node.position.y },
    data: { ...node.data, meta: { ...(ctx.mind ?? {}), depth: ctx.depth, readOnly: ctx.readOnly } } as BoardFlowNodeData,
    selected: ctx.selected ?? false,
    draggable: !ctx.readOnly && !node.locked,
    selectable: !ctx.readOnly,
    deletable: !ctx.readOnly && !node.locked,
    connectable: !ctx.readOnly,
  };
  // Box-like kinds have a size up front (stored, or the default); mind and
  // text nodes size to their content and are measured by React Flow.
  const size = node.size ?? (FIXED_SIZE_TYPES.has(node.data.type) ? DEFAULT_NODE_SIZE[node.data.type] : undefined);
  if (size) {
    flow.width = size.w;
    flow.height = size.h;
  }
  if (ctx.measured) flow.measured = { width: ctx.measured.width, height: ctx.measured.height };
  if (ctx.hidden) flow.hidden = true;
  if (node.zIndex !== undefined) flow.zIndex = node.zIndex;
  // Frames sit under everything unless told otherwise.
  else if (node.data.type === 'frame') flow.zIndex = -1;
  if (node.parentId && ctx.parentExists !== false) {
    flow.parentId = node.parentId;
    flow.extent = 'parent';
  }
  return flow;
}

export function fromFlowNode(flow: BoardFlowNode): BoardNode {
  const { meta: _meta, ...data } = flow.data;
  const node: BoardNode = {
    id: flow.id,
    position: { x: flow.position.x, y: flow.position.y },
    data: data as BoardNodeData,
  };
  if (flow.width !== undefined && flow.height !== undefined) node.size = { w: flow.width, h: flow.height };
  if (flow.parentId) node.parentId = flow.parentId;
  if (flow.zIndex !== undefined && !(data.type === 'frame' && flow.zIndex === -1)) node.zIndex = flow.zIndex;
  if (flow.draggable === false) node.locked = true;
  return node;
}

// Picks the facing sides of two nodes so an edge never wraps around a node.
// Mind-map edges always run horizontally (the tree grows left/right).
export function pickHandles(
  source: { x: number; y: number; w: number; h: number },
  target: { x: number; y: number; w: number; h: number },
  horizontalOnly = false,
): { sourceHandle: HandleSide; targetHandle: HandleSide } {
  const dx = target.x + target.w / 2 - (source.x + source.w / 2);
  const dy = target.y + target.h / 2 - (source.y + source.h / 2);
  if (horizontalOnly || Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? { sourceHandle: 'right', targetHandle: 'left' } : { sourceHandle: 'left', targetHandle: 'right' };
  }
  return dy >= 0 ? { sourceHandle: 'bottom', targetHandle: 'top' } : { sourceHandle: 'top', targetHandle: 'bottom' };
}

const ARROW: MarkerType = 'arrowclosed' as MarkerType;

const TREE_HANDLES: Record<MindDirection, { sourceHandle: HandleSide; targetHandle: HandleSide }> = {
  right: { sourceHandle: 'right', targetHandle: 'left' },
  left: { sourceHandle: 'left', targetHandle: 'right' },
  down: { sourceHandle: 'bottom', targetHandle: 'top' },
};

export function toFlowEdges(edges: BoardEdge[], nodes: BoardNode[], opts: ToFlowOptions = {}): BoardFlowEdge[] {
  const selected = new Set(opts.selection?.edgeIds ?? []);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  // Absolute box of a node (positions inside a frame are relative to it).
  const box = (node: BoardNode) => {
    let x = node.position.x;
    let y = node.position.y;
    let parent = node.parentId ? byId.get(node.parentId) : undefined;
    const seen = new Set<string>([node.id]);
    while (parent && !seen.has(parent.id)) {
      seen.add(parent.id);
      x += parent.position.x;
      y += parent.position.y;
      parent = parent.parentId ? byId.get(parent.parentId) : undefined;
    }
    const m = opts.measured?.[node.id];
    const fallback = node.size ?? DEFAULT_NODE_SIZE[node.data.type];
    return { x, y, w: m?.width ?? fallback.w, h: m?.height ?? fallback.h };
  };

  const out: BoardFlowEdge[] = [];
  for (const edge of edges) {
    const source = byId.get(edge.source);
    const target = byId.get(edge.target);
    if (!source || !target) continue;
    const treeMeta = edge.kind === 'tree' ? opts.mind?.byId.get(edge.target) : undefined;
    // Tree edges leave the parent on the child's side (outer side of the map).
    const handles = treeMeta?.direction
      ? TREE_HANDLES[treeMeta.direction]
      : pickHandles(box(source), box(target), edge.kind === 'tree');
    const data: BoardFlowEdgeData = { ...(edge.data ?? {}) };
    if (treeMeta) {
      data.branchColor = treeMeta.branchColor;
      data.treeDepth = treeMeta.depth;
    }
    const flow: BoardFlowEdge = {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: edge.kind,
      sourceHandle: handles.sourceHandle,
      targetHandle: handles.targetHandle,
      data,
      selected: selected.has(edge.id),
      selectable: !opts.readOnly,
      deletable: !opts.readOnly,
    };
    if (edge.kind === 'connector') {
      const color = edge.data?.color;
      if (edge.data?.arrowEnd !== false) flow.markerEnd = { type: ARROW, color, width: 18, height: 18 };
      if (edge.data?.arrowStart) flow.markerStart = { type: ARROW, color, width: 18, height: 18 };
    }
    out.push(flow);
  }
  return out;
}

export function fromFlowEdge(flow: BoardFlowEdge): BoardEdge {
  const edge: BoardEdge = { id: flow.id, source: flow.source, target: flow.target, kind: flow.type ?? 'connector' };
  if (flow.data) {
    const { branchColor: _color, treeDepth: _depth, ...data } = flow.data;
    if (Object.keys(data).length) edge.data = data;
  }
  return edge;
}
