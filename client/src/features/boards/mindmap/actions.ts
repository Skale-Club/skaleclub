// Mind-map commands shared by the keyboard, the node buttons, the context menu,
// the style/outline panels and the editor menu. Each one is a single store
// edit (one undo step); the store lays the map out as part of it.
import type { BoardNode, MindNodeData } from '@shared/schema/boards';
import { BOARD_LIMITS } from '@shared/schema/boards';
import { createBoardId } from '@shared/boards/document';
import { computeHiddenMindNodes, estimateMindNodeSize, rootLayoutOf, type MindForest } from '@shared/boards/layout';
import {
  addMindChild,
  addMindSibling,
  canReparentMindNode,
  createMindNode,
  insertOutline,
  outdentMindNode,
  reparentMindNode,
} from '@shared/boards/mindOps';
import { mindMapToMarkdown, parseIndentedText } from '@shared/boards/outline';
import type { BoardStore } from '../store/boardStore';
import { getMindForest } from './autoLayout';

export type MindNavDirection = 'up' | 'down' | 'left' | 'right';

function forestOf(store: BoardStore): MindForest {
  const { document: doc } = store.getState();
  return getMindForest(doc.nodes, doc.edges);
}

/** The single selected mind node, if exactly one node (and no edge) is selected. */
export function selectedMindNodeId(store: BoardStore): string | null {
  const { selection, document: doc } = store.getState();
  if (selection.nodeIds.length !== 1 || selection.edgeIds.length) return null;
  const node = doc.nodes.find((n) => n.id === selection.nodeIds[0]);
  return node?.data.type === 'mind' ? node.id : null;
}

export function selectNode(store: BoardStore, id: string, opts: { focus?: boolean } = {}) {
  const state = store.getState();
  state.select({ nodeIds: [id], edgeIds: [] });
  if (opts.focus) revealNode(store, id);
}

/** Pans so the node is visible (after the next paint, once it is positioned). */
export function revealNode(store: BoardStore, id: string) {
  requestAnimationFrame(() => store.getState().canvasApi?.focusNode(id, { ifOffscreen: true }));
}

function startEditing(store: BoardStore, id: string) {
  store.getState().select({ nodeIds: [id], edgeIds: [] });
  store.getState().setEditingNode(id, { isNew: true });
  revealNode(store, id);
}

/** Escape on a brand-new empty topic: it goes away (no history) and its parent is selected. */
export function cancelNewTopic(store: BoardStore, id: string) {
  const parentId = forestOf(store).parent.get(id);
  store.getState().cancelNewNode(id);
  if (parentId && store.getState().document.nodes.some((n) => n.id === parentId)) selectNode(store, parentId);
}

export function addChild(store: BoardStore, parentId: string, opts: { edit?: boolean } = {}): string | null {
  const state = store.getState();
  if (state.readOnly || state.document.nodes.length >= BOARD_LIMITS.nodes) return null;
  const { doc, id } = addMindChild(state.document, parentId, { sizes: state.measured });
  if (!id) return null;
  state.setDocument(doc);
  if (opts.edit !== false) startEditing(store, id);
  else selectNode(store, id, { focus: true });
  return id;
}

export function addSibling(store: BoardStore, id: string, opts: { edit?: boolean } = {}): string | null {
  const state = store.getState();
  if (state.readOnly || state.document.nodes.length >= BOARD_LIMITS.nodes) return null;
  const { doc, id: created } = addMindSibling(state.document, id, { sizes: state.measured });
  if (!created) return null;
  state.setDocument(doc);
  if (opts.edit !== false) startEditing(store, created);
  else selectNode(store, created, { focus: true });
  return created;
}

export function outdent(store: BoardStore, id: string) {
  const state = store.getState();
  if (state.readOnly) return;
  state.setDocument(outdentMindNode(state.document, id, { sizes: state.measured }));
  selectNode(store, id, { focus: true });
}

/** Deletes the node and its subtree; selection moves to a sibling or the parent. */
export function removeSubtree(store: BoardStore, id: string) {
  const state = store.getState();
  if (state.readOnly) return;
  const forest = forestOf(store);
  const parentId = forest.parent.get(id);
  let next: string | undefined;
  if (parentId !== undefined) {
    const siblings = forest.children.get(parentId) ?? [];
    const i = siblings.indexOf(id);
    next = siblings[i + 1] ?? siblings[i - 1] ?? parentId;
  }
  state.removeNodes([id]);
  if (next) selectNode(store, next);
}

export function toggleCollapse(store: BoardStore, id: string) {
  const forest = forestOf(store);
  if (!(forest.children.get(id)?.length)) return;
  store.getState().toggleCollapsed(id);
}

export function setMindData(store: BoardStore, id: string, patch: Partial<MindNodeData>) {
  store.getState().updateNodeData(id, patch);
}

/** Removes keys from a mind node's data (e.g. clearing a color or a note). */
export function clearMindData(store: BoardStore, id: string, keys: (keyof MindNodeData)[]) {
  const state = store.getState();
  const node = state.document.nodes.find((n) => n.id === id);
  if (!node || node.data.type !== 'mind') return;
  const data = { ...node.data } as Record<string, unknown>;
  if (!keys.some((key) => data[key] !== undefined)) return;
  for (const key of keys) delete data[key];
  state.setDocument({
    ...state.document,
    nodes: state.document.nodes.map((n) => (n.id === id ? ({ ...n, data } as BoardNode) : n)),
  });
}

/** A new map (root) centred on a flow-space point, ready to type into. */
export function createRootAt(store: BoardStore, center: { x: number; y: number }, text = ''): string | null {
  const state = store.getState();
  if (state.readOnly || state.document.nodes.length >= BOARD_LIMITS.nodes) return null;
  const size = estimateMindNodeSize({ text: text || 'Central idea' }, 0);
  const id = createBoardId();
  const node = createMindNode(id, { x: Math.round(center.x - size.w / 2), y: Math.round(center.y - size.h / 2) }, { text, layout: 'balanced' });
  state.addNode(node, { select: true });
  state.setEditingNode(id, { isNew: true });
  return id;
}

// ---------------------------------------------------------------------------
// Keyboard navigation

function boxOf(store: BoardStore, node: BoardNode, depth: number) {
  const measured = store.getState().measured[node.id];
  const size = measured
    ? { w: measured.width, h: measured.height }
    : node.data.type === 'mind'
      ? estimateMindNodeSize(node.data, depth)
      : { w: 160, h: 44 };
  return { x: node.position.x, y: node.position.y, w: size.w, h: size.h, cx: node.position.x + size.w / 2, cy: node.position.y + size.h / 2 };
}

/** Arrow keys: parent / children / siblings, following the side a branch is on. */
export function navigate(store: BoardStore, id: string, dir: MindNavDirection) {
  const forest = forestOf(store);
  const node = forest.nodes.get(id);
  if (!node) return;
  const hidden = computeHiddenMindNodes(forest);
  const rootId = forest.rootOf.get(id)!;
  const root = forest.nodes.get(rootId)!;
  const vertical = rootLayoutOf(forest, rootId) === 'vertical';
  const depthOf = (n: string) => forest.depth.get(n) ?? 0;
  const box = (n: string) => boxOf(store, forest.nodes.get(n)!, depthOf(n));
  const sideOf = (n: string): 'left' | 'right' => (forest.nodes.get(n)!.position.x < root.position.x ? 'left' : 'right');
  const here = box(id);
  const collapsed = node.data.type === 'mind' && !!node.data.collapsed;
  const visibleKids = collapsed ? [] : (forest.children.get(id) ?? []).filter((k) => !hidden.has(k));
  const parentId = forest.parent.get(id);

  const closestBy = (ids: string[], metric: (b: ReturnType<typeof box>) => number) =>
    ids.reduce<{ id: string; d: number } | null>((best, k) => {
      const d = metric(box(k));
      return !best || d < best.d ? { id: k, d } : best;
    }, null)?.id;

  // Same-depth neighbours in the same map (and on the same side), in a direction.
  const neighbour = (axis: 'x' | 'y', sign: 1 | -1) => {
    const depth = depthOf(id);
    const candidates = Array.from(forest.nodes.keys()).filter(
      (k) =>
        k !== id &&
        !hidden.has(k) &&
        forest.rootOf.get(k) === rootId &&
        depthOf(k) === depth &&
        (vertical || depth === 0 || sideOf(k) === sideOf(id)),
    );
    const ahead = candidates.filter((k) => {
      const b = box(k);
      return axis === 'y' ? (b.cy - here.cy) * sign > 1 : (b.cx - here.cx) * sign > 1;
    });
    return closestBy(ahead, (b) => (axis === 'y' ? Math.abs(b.cy - here.cy) * 4 + Math.abs(b.cx - here.cx) : Math.abs(b.cx - here.cx) * 4 + Math.abs(b.cy - here.cy)));
  };

  let target: string | undefined;
  if (vertical) {
    if (dir === 'up') target = parentId;
    else if (dir === 'down') target = closestBy(visibleKids, (b) => Math.abs(b.cx - here.cx));
    else target = neighbour('x', dir === 'left' ? -1 : 1);
  } else if (parentId === undefined) {
    // On a root: left/right go into that side's branches.
    if (dir === 'left' || dir === 'right') target = closestBy(visibleKids.filter((k) => sideOf(k) === dir), (b) => Math.abs(b.cy - here.cy));
  } else {
    const outward = sideOf(id);
    if (dir === 'up' || dir === 'down') target = neighbour('y', dir === 'up' ? -1 : 1);
    else if (dir === outward) target = closestBy(visibleKids, (b) => Math.abs(b.cy - here.cy));
    else target = parentId;
  }
  if (target) selectNode(store, target, { focus: true });
}

// ---------------------------------------------------------------------------
// Drag and drop

/** Reparents `id` under `targetId` if that keeps the tree valid. */
export function reparentByDrop(store: BoardStore, id: string, targetId: string, dropPoint?: { x: number }): boolean {
  const state = store.getState();
  if (!canReparentMindNode(state.document, id, targetId)) return false;
  const forest = forestOf(store);
  let side: 'left' | 'right' | undefined;
  const target = forest.nodes.get(targetId);
  if (target && dropPoint && forest.parent.get(targetId) === undefined) {
    const center = boxOf(store, target, 0).cx;
    side = dropPoint.x < center ? 'left' : 'right';
  }
  state.setDocument(reparentMindNode(state.document, id, targetId, { side, sizes: state.measured }));
  return true;
}

// ---------------------------------------------------------------------------
// Outline import / export / paste

/** The map the user is working on: the selected node's, else the first one. */
export function currentRootId(store: BoardStore): string | null {
  const forest = forestOf(store);
  const selected = store.getState().selection.nodeIds.find((id) => forest.nodes.has(id));
  if (selected) return forest.rootOf.get(selected) ?? null;
  return forest.roots[0] ?? null;
}

/** Markdown for the current map (or every map when `all`). */
export function exportOutline(store: BoardStore, opts: { all?: boolean } = {}): string {
  const { document: doc } = store.getState();
  const forest = forestOf(store);
  const rootId = currentRootId(store);
  const roots = opts.all || !rootId ? forest.roots : [rootId];
  return mindMapToMarkdown(doc, roots);
}

/** Pasted / imported text as a new map centred in the view. Returns the new root. */
export function importOutlineText(store: BoardStore, text: string, fallbackTitle = 'Imported outline'): string | null {
  const items = parseIndentedText(text);
  if (items.length === 0) return null;
  const state = store.getState();
  const center = state.canvasApi?.getViewportCenter() ?? { x: 0, y: 0 };
  const rootText = items.length === 1 ? items[0].text : fallbackTitle;
  const size = estimateMindNodeSize({ text: rootText }, 0);
  const { doc, rootId } = insertOutline(state.document, items, {
    position: { x: Math.round(center.x - size.w / 2), y: Math.round(center.y - size.h / 2) },
    rootText: fallbackTitle,
  });
  if (!rootId) return null;
  state.setDocument(doc);
  selectNode(store, rootId, { focus: true });
  return rootId;
}

/** Pasted text under a mind node: every line becomes a node, indentation nests. */
export function pasteOutlineUnder(store: BoardStore, parentId: string, text: string): number {
  const items = parseIndentedText(text);
  if (items.length === 0) return 0;
  const state = store.getState();
  const { doc, ids } = insertOutline(state.document, items, { parentId }, { sizes: state.measured });
  if (!ids.length) return 0;
  state.setDocument(doc);
  selectNode(store, ids[0], { focus: true });
  return ids.length;
}
