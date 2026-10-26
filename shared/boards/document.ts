// Pure, DOM-free helpers for a board document (shared/schema/boards.ts). The
// editor store, the public viewer and the server can all use them, and they run
// under `npm test` without a browser.
import {
  BOARD_LIMITS,
  boardDocumentSchema,
  type BoardDocument,
  type BoardEdge,
  type BoardKind,
  type BoardNode,
} from "../schema/boards.js";

export function createEmptyDocument(): BoardDocument {
  return {
    schemaVersion: 1,
    nodes: [],
    edges: [],
    strokes: [],
    theme: { palette: "brand", background: "dots" },
  };
}

// What a brand-new board starts with: a mind map opens on a central topic named
// after the board, a canvas starts empty.
export function createStarterDocument(kind: BoardKind, title: string): BoardDocument {
  const doc = createEmptyDocument();
  if (kind === "mindmap") {
    doc.nodes.push({
      id: createBoardId(),
      position: { x: 0, y: 0 },
      data: { type: "mind", text: title.trim().slice(0, BOARD_LIMITS.nodeText) || "Central topic", layout: "balanced" },
    });
  }
  return doc;
}

// A short random id (UUID where available). Ids only need to be unique within
// one document, but a UUID keeps nodes unique across copy/paste between boards.
export function createBoardId(): string {
  const cryptoApi = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (cryptoApi?.randomUUID) return cryptoApi.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 10)}`;
}

// Parses anything (a stored row, a localStorage snapshot, a paste) into a valid
// document, or the empty one when it does not validate.
export function normalizeDocument(input: unknown): BoardDocument {
  const parsed = boardDocumentSchema.safeParse(input ?? {});
  return parsed.success ? parsed.data : createEmptyDocument();
}

export function isDocumentEmpty(doc: Pick<BoardDocument, "nodes" | "strokes">): boolean {
  return doc.nodes.length === 0 && doc.strokes.length === 0;
}

// Every node below `ids`: frame children (parentId) and mind-map subtrees
// (`tree` edges from source to target). The result includes `ids` themselves.
export function collectDescendants(doc: Pick<BoardDocument, "nodes" | "edges">, ids: Iterable<string>): Set<string> {
  const childrenOf = new Map<string, string[]>();
  const link = (parent: string, child: string) => {
    const list = childrenOf.get(parent);
    if (list) list.push(child);
    else childrenOf.set(parent, [child]);
  };
  for (const node of doc.nodes) if (node.parentId) link(node.parentId, node.id);
  for (const edge of doc.edges) if (edge.kind === "tree") link(edge.source, edge.target);

  const result = new Set<string>();
  const stack = Array.from(ids);
  while (stack.length) {
    const id = stack.pop()!;
    if (result.has(id)) continue;
    result.add(id);
    for (const child of childrenOf.get(id) ?? []) stack.push(child);
  }
  return result;
}

// Removes the nodes, everything inside or below them (see collectDescendants)
// and every edge that touched a removed node. Returns the same document object
// when nothing matched, so reference checks stay cheap.
export function removeNodesCascade(doc: BoardDocument, ids: Iterable<string>): BoardDocument {
  const requested = Array.from(ids);
  if (requested.length === 0) return doc;
  const removed = collectDescendants(doc, requested);
  const nodes = doc.nodes.filter((node) => !removed.has(node.id));
  if (nodes.length === doc.nodes.length) return doc;
  const edges = doc.edges.filter((edge) => !removed.has(edge.source) && !removed.has(edge.target));
  return { ...doc, nodes, edges };
}

export function removeEdgesById(doc: BoardDocument, ids: Iterable<string>): BoardDocument {
  const removed = new Set(ids);
  if (removed.size === 0) return doc;
  const edges = doc.edges.filter((edge) => !removed.has(edge.id));
  return edges.length === doc.edges.length ? doc : { ...doc, edges };
}

// Depth of each `mind` node in its tree (0 = a root: no `tree` edge arrives).
// Nodes unreachable from a root (a cycle) are left out.
export function computeTreeDepths(doc: Pick<BoardDocument, "nodes" | "edges">): Map<string, number> {
  const mindIds = new Set(doc.nodes.filter((node) => node.data.type === "mind").map((node) => node.id));
  const children = new Map<string, string[]>();
  const hasParent = new Set<string>();
  for (const edge of doc.edges) {
    if (edge.kind !== "tree" || !mindIds.has(edge.source) || !mindIds.has(edge.target)) continue;
    hasParent.add(edge.target);
    const list = children.get(edge.source);
    if (list) list.push(edge.target);
    else children.set(edge.source, [edge.target]);
  }
  const depths = new Map<string, number>();
  const queue: string[] = [];
  for (const id of Array.from(mindIds)) {
    if (!hasParent.has(id)) {
      depths.set(id, 0);
      queue.push(id);
    }
  }
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i];
    const depth = depths.get(id)!;
    for (const child of children.get(id) ?? []) {
      if (depths.has(child)) continue;
      depths.set(child, depth + 1);
      queue.push(child);
    }
  }
  return depths;
}

// Orders nodes so a frame always comes before the nodes inside it (React Flow
// requires parents first). Nodes whose parent is missing are kept, unparented.
export function sortNodesParentFirst(nodes: BoardNode[]): BoardNode[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const visited = new Set<string>();
  const out: BoardNode[] = [];
  const visit = (node: BoardNode, trail: Set<string>) => {
    if (visited.has(node.id)) return;
    const parent = node.parentId ? byId.get(node.parentId) : undefined;
    if (parent && !trail.has(parent.id)) {
      trail.add(node.id);
      visit(parent, trail);
    }
    visited.add(node.id);
    out.push(node);
  };
  for (const node of nodes) visit(node, new Set());
  return out;
}

export function countBoardContent(doc: Pick<BoardDocument, "nodes" | "edges" | "strokes">) {
  return { nodes: doc.nodes.length, edges: doc.edges.length, strokes: doc.strokes.length };
}

export function edgeTouches(edge: BoardEdge, ids: Set<string>): boolean {
  return ids.has(edge.source) || ids.has(edge.target);
}
