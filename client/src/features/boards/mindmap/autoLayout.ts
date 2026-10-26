// Keeps mind maps laid out. The board store runs `autoLayoutDocument` on every
// document commit, so a structural edit and the positions it causes land in the
// same document object (one undo step, one save). Pure apart from small caches
// keyed by node arrays, so it is cheap to call on every drag frame.
import type { BoardDocument, BoardNode } from '@shared/schema/boards';
import {
  applyMindLayout,
  buildMindForest,
  collectSubtree,
  layoutMindMaps,
  type MindForest,
  type MindSizeSource,
} from '@shared/boards/layout';

type Nodes = BoardDocument['nodes'];
type Edges = BoardDocument['edges'];

const forestCache = new WeakMap<Nodes, { edges: Edges; forest: MindForest }>();
const signatureCache = new WeakMap<Nodes, { edges: Edges; sigs: Map<string, string> }>();

/** The forest for these exact arrays (memoized). */
export function getMindForest(nodes: Nodes, edges: Edges): MindForest {
  const hit = forestCache.get(nodes);
  if (hit && hit.edges === edges) return hit.forest;
  const forest = buildMindForest(nodes, edges);
  forestCache.set(nodes, { edges, forest });
  return forest;
}

// What the layout of one map depends on, except the root's position (a moved
// root is a translation, not a relayout) and measured sizes (handled by the
// store when the DOM reports them).
function signatures(nodes: Nodes, edges: Edges): Map<string, string> {
  const hit = signatureCache.get(nodes);
  if (hit && hit.edges === edges) return hit.sigs;
  const forest = getMindForest(nodes, edges);
  const sigs = new Map<string, string>();
  for (const rootId of forest.roots) {
    const parts: string[] = [];
    const visit = (id: string) => {
      const node = forest.nodes.get(id);
      if (!node || node.data.type !== 'mind') return;
      const d = node.data;
      parts.push(
        `${id}\u0001${d.text}\u0001${d.collapsed ? 1 : 0}\u0001${d.layout ?? ''}\u0001${d.side ?? ''}\u0001${d.icon ?? ''}\u0001${d.task ? 1 : 0}\u0001${d.note ? 1 : 0}\u0001${d.link ? 1 : 0}\u0001${node.size ? `${node.size.w}x${node.size.h}` : ''}`,
      );
      const kids = forest.children.get(id);
      if (kids?.length) {
        parts.push('(');
        for (const kid of kids) visit(kid);
        parts.push(')');
      }
    };
    visit(rootId);
    sigs.set(rootId, parts.join('\u0002'));
  }
  signatureCache.set(nodes, { edges, sigs });
  return sigs;
}

function onlyPositionsChanged(prev: Nodes, next: Nodes): boolean {
  if (prev.length !== next.length) return false;
  for (let i = 0; i < next.length; i++) {
    const a = prev[i];
    const b = next[i];
    if (a === b) continue;
    if (a.id !== b.id || a.data !== b.data || a.size !== b.size || a.parentId !== b.parentId) return false;
  }
  return true;
}

/** Re-runs the layout of the maps containing `ids` (any node of a map). */
export function relayoutRoots(doc: BoardDocument, ids: Iterable<string> | null, sizes?: MindSizeSource): BoardDocument {
  const forest = getMindForest(doc.nodes, doc.edges);
  if (forest.nodes.size === 0) return doc;
  const layout = layoutMindMaps({ nodes: doc.nodes, edges: doc.edges, sizes, forest, rootIds: ids ?? undefined });
  const nodes = applyMindLayout(doc.nodes, layout);
  return nodes === doc.nodes ? doc : { ...doc, nodes };
}

/**
 * Runs after every document edit: maps whose structure or content changed are
 * laid out again; a moved root drags its map along; a dragged branch drags its
 * subtree along (it snaps back or reparents on drop, see useAutoLayout).
 */
export function autoLayoutDocument(prev: BoardDocument | null, next: BoardDocument, sizes?: MindSizeSource): BoardDocument {
  if (prev && prev.nodes === next.nodes && prev.edges === next.edges) return next;
  const forest = getMindForest(next.nodes, next.edges);
  if (forest.nodes.size === 0) return next;

  const positionsOnly = !!prev && prev.edges === next.edges && onlyPositionsChanged(prev.nodes, next.nodes);
  let changedRoots: string[] = [];
  if (!positionsOnly) {
    const after = signatures(next.nodes, next.edges);
    const before = prev ? signatures(prev.nodes, prev.edges) : null;
    changedRoots = forest.roots.filter((id) => before?.get(id) !== after.get(id));
  } else if (prev) {
    // Same structure: carry the signatures over without recomputing them.
    const hit = signatureCache.get(prev.nodes);
    if (hit) signatureCache.set(next.nodes, { edges: next.edges, sigs: hit.sigs });
  }

  let nodes = next.nodes;
  if (prev) {
    // Translations: a moved root (whole map) or a dragged branch (its subtree).
    const prevById = new Map<string, BoardNode>(prev.nodes.map((n) => [n.id, n]));
    const changed = new Set(changedRoots);
    const shifts = new Map<string, { dx: number; dy: number }>();
    for (const node of next.nodes) {
      const before = prevById.get(node.id);
      if (!before || before === node || node.data.type !== 'mind') continue;
      const dx = node.position.x - before.position.x;
      const dy = node.position.y - before.position.y;
      if (!dx && !dy) continue;
      const rootId = forest.rootOf.get(node.id);
      if (!rootId || changed.has(rootId)) continue;
      for (const below of collectSubtree(forest, node.id)) {
        // Nodes that moved on their own (dragged together) keep their move (below).
        if (prevById.has(below) && !shifts.has(below)) shifts.set(below, { dx, dy });
      }
    }
    if (shifts.size) {
      nodes = nodes.map((node) => {
        const shift = shifts.get(node.id);
        const before = prevById.get(node.id);
        if (!shift || !before || before.position.x !== node.position.x || before.position.y !== node.position.y) return node;
        return { ...node, position: { x: node.position.x + shift.dx, y: node.position.y + shift.dy } };
      });
    }
  }

  if (nodes !== next.nodes) {
    const hit = signatureCache.get(next.nodes);
    if (hit) signatureCache.set(nodes, hit);
  }
  let doc = nodes === next.nodes ? next : { ...next, nodes };
  if (changedRoots.length) doc = relayoutRoots(doc, changedRoots, sizes);
  return doc;
}
