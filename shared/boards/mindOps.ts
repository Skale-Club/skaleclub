// Pure mind-map edits on a board document: add child / sibling, outdent,
// reparent, collapse, insert an outline. Each returns a new document (or the
// same one when nothing changed) and never positions nodes itself: the editor
// store runs the auto layout (shared/boards/layout.ts) on every commit.
import { BOARD_LIMITS, type BoardDocument, type BoardEdge, type BoardNode, type MindNodeData } from "../schema/boards.js";
import { createBoardId } from "./document.js";
import { buildMindForest, collectSubtree, pickSideForNewBranch, rootLayoutOf, type MindForest, type MindSizeSource } from "./layout.js";
import type { OutlineItem } from "./outline.js";

export interface MindOpOptions {
  /** Measured sizes, so a new branch of a balanced root goes to the lighter side. */
  sizes?: MindSizeSource;
  /** Id factory (tests pass a deterministic one). */
  newId?: () => string;
}

export interface MindInsertResult {
  doc: BoardDocument;
  id: string | null;
}

const clampText = (text: string) => text.slice(0, BOARD_LIMITS.nodeText);

export function createMindNode(id: string, position: { x: number; y: number }, data: Partial<Omit<MindNodeData, "type">> = {}): BoardNode {
  return { id, position: { x: position.x, y: position.y }, data: { type: "mind", text: "", ...data, ...(data.text !== undefined ? { text: clampText(data.text) } : {}) } };
}

export function treeEdge(id: string, source: string, target: string): BoardEdge {
  return { id, source, target, kind: "tree" };
}

function withoutSide(data: MindNodeData): MindNodeData {
  if (data.side === undefined) return data;
  const { side: _side, ...rest } = data;
  return rest;
}

function patchMind(nodes: BoardNode[], id: string, fn: (data: MindNodeData) => MindNodeData): BoardNode[] {
  return nodes.map((node) => {
    if (node.id !== id || node.data.type !== "mind") return node;
    const data = fn(node.data);
    return data === node.data ? node : { ...node, data };
  });
}

// The side a first-level branch is drawn on right now (explicit, or where the
// layout put it), so new siblings and outdented nodes land next to it.
export function displayedSide(forest: MindForest, id: string): "left" | "right" {
  const node = forest.nodes.get(id);
  const data = node?.data as MindNodeData | undefined;
  if (data?.side === "left" || data?.side === "right") return data.side;
  const rootId = forest.rootOf.get(id);
  const root = rootId ? forest.nodes.get(rootId) : undefined;
  if (!node || !root || root === node) return "right";
  return node.position.x < root.position.x ? "left" : "right";
}

function isBalancedRoot(forest: MindForest, id: string) {
  return forest.roots.includes(id) && rootLayoutOf(forest, id) === "balanced";
}

/** Adds a child at the end of `parentId`'s children (expanding it). */
export function addMindChild(doc: BoardDocument, parentId: string, opts: MindOpOptions & { text?: string } = {}): MindInsertResult {
  const forest = buildMindForest(doc.nodes, doc.edges);
  const parent = forest.nodes.get(parentId);
  if (!parent) return { doc, id: null };
  const id = (opts.newId ?? createBoardId)();
  const data: Partial<MindNodeData> = { text: opts.text ?? "" };
  if (isBalancedRoot(forest, parentId)) data.side = pickSideForNewBranch(doc.nodes, doc.edges, parentId, opts.sizes);
  const node = createMindNode(id, parent.position, data);
  const nodes = patchMind([...doc.nodes, node], parentId, (d) => (d.collapsed ? { ...d, collapsed: false } : d));
  return { doc: { ...doc, nodes, edges: [...doc.edges, treeEdge((opts.newId ?? createBoardId)(), parentId, id)] }, id };
}

/** Adds a sibling right below `id`; on a root it adds a child instead. */
export function addMindSibling(doc: BoardDocument, id: string, opts: MindOpOptions & { text?: string } = {}): MindInsertResult {
  const forest = buildMindForest(doc.nodes, doc.edges);
  const node = forest.nodes.get(id);
  const parentId = forest.parent.get(id);
  if (!node) return { doc, id: null };
  if (parentId === undefined) return addMindChild(doc, id, opts);
  const newId = (opts.newId ?? createBoardId)();
  const data: Partial<MindNodeData> = { text: opts.text ?? "" };
  if (isBalancedRoot(forest, parentId)) data.side = displayedSide(forest, id);
  const created = createMindNode(newId, node.position, data);
  const incoming = forest.incoming.get(id)!;
  const at = doc.edges.indexOf(incoming);
  const edges = [...doc.edges];
  edges.splice(at + 1, 0, treeEdge((opts.newId ?? createBoardId)(), parentId, newId));
  return { doc: { ...doc, nodes: [...doc.nodes, created], edges }, id: newId };
}

/** Shift+Tab: moves `id` up a level, right after its former parent. */
export function outdentMindNode(doc: BoardDocument, id: string, opts: MindOpOptions = {}): BoardDocument {
  const forest = buildMindForest(doc.nodes, doc.edges);
  const parentId = forest.parent.get(id);
  if (parentId === undefined) return doc;
  const grandId = forest.parent.get(parentId);
  if (grandId === undefined) return doc;
  const own = forest.incoming.get(id)!;
  const parentEdge = forest.incoming.get(parentId)!;
  const edges = doc.edges.filter((edge) => edge !== own);
  edges.splice(edges.indexOf(parentEdge) + 1, 0, treeEdge((opts.newId ?? createBoardId)(), grandId, id));
  const side = isBalancedRoot(forest, grandId) ? displayedSide(forest, parentId) : undefined;
  const nodes = patchMind(doc.nodes, id, (data) => (side ? { ...data, side } : withoutSide(data)));
  return { ...doc, nodes, edges };
}

/** Would making `newParentId` the parent of `id` create a cycle (or is it a no-op)? */
export function canReparentMindNode(doc: Pick<BoardDocument, "nodes" | "edges">, id: string, newParentId: string): boolean {
  if (id === newParentId) return false;
  const forest = buildMindForest(doc.nodes, doc.edges);
  if (!forest.nodes.has(id) || !forest.nodes.has(newParentId)) return false;
  if (forest.parent.get(id) === undefined) return false; // roots move, they do not reparent
  return !collectSubtree(forest, id).includes(newParentId);
}

/** Drag-and-drop reparent: `id` becomes the last child of `newParentId`. */
export function reparentMindNode(
  doc: BoardDocument,
  id: string,
  newParentId: string,
  opts: MindOpOptions & { side?: "left" | "right" } = {},
): BoardDocument {
  if (!canReparentMindNode(doc, id, newParentId)) return doc;
  const forest = buildMindForest(doc.nodes, doc.edges);
  const own = forest.incoming.get(id);
  const edges = doc.edges.filter((edge) => edge !== own);
  edges.push(treeEdge((opts.newId ?? createBoardId)(), newParentId, id));
  let side: "left" | "right" | undefined;
  if (isBalancedRoot(forest, newParentId)) {
    side = opts.side ?? pickSideForNewBranch(doc.nodes, edges, newParentId, opts.sizes);
  }
  let nodes = patchMind(doc.nodes, id, (data) => (side ? { ...data, side } : withoutSide(data)));
  nodes = patchMind(nodes, newParentId, (d) => (d.collapsed ? { ...d, collapsed: false } : d));
  return { ...doc, nodes, edges };
}

/** Collapses or expands `id` (toggles when `value` is omitted). Leaves are left alone. */
export function setMindCollapsed(doc: BoardDocument, id: string, value?: boolean): BoardDocument {
  const hasChildren = doc.edges.some((edge) => edge.kind === "tree" && edge.source === id);
  const node = doc.nodes.find((n) => n.id === id);
  if (!node || node.data.type !== "mind") return doc;
  const next = value ?? !node.data.collapsed;
  if (!hasChildren && next) return doc;
  if (!!node.data.collapsed === next) return doc;
  return {
    ...doc,
    nodes: patchMind(doc.nodes, id, (data) => {
      if (next) return { ...data, collapsed: true };
      const { collapsed: _c, ...rest } = data;
      return rest;
    }),
  };
}

/**
 * Inserts outline items as mind nodes. With a `parentId` they become children
 * of that node; without one, a single top-level item becomes a new root at
 * `position` (several are wrapped in a root titled `rootText`).
 */
export function insertOutline(
  doc: BoardDocument,
  items: OutlineItem[],
  target: { parentId: string } | { position: { x: number; y: number }; rootText?: string },
  opts: MindOpOptions = {},
): { doc: BoardDocument; rootId: string | null; ids: string[] } {
  const newId = opts.newId ?? createBoardId;
  if (items.length === 0) return { doc, rootId: null, ids: [] };
  const nodes: BoardNode[] = [];
  const edges: BoardEdge[] = [];
  const ids: string[] = [];
  const limit = BOARD_LIMITS.nodes - doc.nodes.length;
  const add = (item: OutlineItem, parent: string | null, origin: { x: number; y: number }, extra: Partial<MindNodeData> = {}) => {
    if (ids.length >= limit) return;
    const id = newId();
    ids.push(id);
    const data: Partial<MindNodeData> = { text: item.text, ...extra };
    if (item.collapsed && item.children.length) data.collapsed = true;
    nodes.push(createMindNode(id, origin, data));
    if (parent) edges.push(treeEdge(newId(), parent, id));
    for (const child of item.children) add(child, id, origin);
  };

  if ("parentId" in target) {
    const forest = buildMindForest(doc.nodes, doc.edges);
    const parent = forest.nodes.get(target.parentId);
    if (!parent) return { doc, rootId: null, ids: [] };
    const balanced = isBalancedRoot(forest, target.parentId);
    for (const item of items) {
      const extra: Partial<MindNodeData> = {};
      if (balanced) {
        // Balance as we go, counting the branches already inserted.
        extra.side = pickSideForNewBranch([...doc.nodes, ...nodes], [...doc.edges, ...edges], target.parentId, opts.sizes);
      }
      add(item, target.parentId, parent.position, extra);
    }
    const parentNodes = patchMind(doc.nodes, target.parentId, (d) => (d.collapsed ? { ...d, collapsed: false } : d));
    return { doc: { ...doc, nodes: [...parentNodes, ...nodes], edges: [...doc.edges, ...edges] }, rootId: null, ids };
  }

  const root: OutlineItem = items.length === 1 ? items[0] : { text: target.rootText ?? "Outline", children: items };
  add(root, null, target.position, { layout: "balanced" });
  return { doc: { ...doc, nodes: [...doc.nodes, ...nodes], edges: [...doc.edges, ...edges] }, rootId: ids[0] ?? null, ids };
}
