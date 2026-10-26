// Pure conversions between the stored board document and React Flow's nodes
// and edges. Type-only imports from @xyflow/react keep this file free of
// runtime dependencies so it can be unit-tested without a DOM.
import type { Edge, MarkerType, Node } from '@xyflow/react';
import type { BoardEdge, BoardNode, BoardNodeData } from '@shared/schema';
import { computeTreeDepths, sortNodesParentFirst } from '@shared/boards/document';
import type { BoardSelection, MeasuredSize } from '../store/boardStore';

export type BoardNodeType = BoardNodeData['type'];

/** Render-only fields added next to the stored data; stripped by `fromFlowNode`. */
export interface FlowNodeMeta {
  /** Depth in its mind-map tree (0 = root); undefined for non-mind nodes. */
  depth?: number;
  readOnly?: boolean;
}

export type BoardFlowNodeData = BoardNodeData & { meta: FlowNodeMeta };
export type BoardFlowNode = Node<BoardFlowNodeData, BoardNodeType>;
export type BoardFlowEdgeData = NonNullable<BoardEdge['data']> & Record<string, unknown>;
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
}

export function toFlowNodes(nodes: BoardNode[], edges: BoardEdge[], opts: ToFlowOptions = {}): BoardFlowNode[] {
  const selected = new Set(opts.selection?.nodeIds ?? []);
  const depths = computeTreeDepths({ nodes, edges });
  const ids = new Set(nodes.map((n) => n.id));
  return sortNodesParentFirst(nodes).map((node) => toFlowNode(node, {
    selected: selected.has(node.id),
    measured: opts.measured?.[node.id],
    depth: depths.get(node.id),
    readOnly: opts.readOnly,
    parentExists: node.parentId ? ids.has(node.parentId) : false,
  }));
}

export function toFlowNode(
  node: BoardNode,
  ctx: { selected?: boolean; measured?: MeasuredSize; depth?: number; readOnly?: boolean; parentExists?: boolean } = {},
): BoardFlowNode {
  const flow: BoardFlowNode = {
    id: node.id,
    type: node.data.type,
    position: { x: node.position.x, y: node.position.y },
    data: { ...node.data, meta: { depth: ctx.depth, readOnly: ctx.readOnly } } as BoardFlowNodeData,
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
    const handles = pickHandles(box(source), box(target), edge.kind === 'tree');
    const flow: BoardFlowEdge = {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: edge.kind,
      sourceHandle: handles.sourceHandle,
      targetHandle: handles.targetHandle,
      data: { ...(edge.data ?? {}) },
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
  if (flow.data && Object.keys(flow.data).length) edge.data = { ...flow.data };
  return edge;
}
