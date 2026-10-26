// Free-canvas commands shared by the tools, the keyboard, the context menu and
// the style panel. Each is one store commit (one undo step) built from the
// pure helpers in shared/boards/canvasOps.ts.
import type { BoardEdge, BoardNode, BoardNodeData } from '@shared/schema/boards';
import { BOARD_LIMITS } from '@shared/schema/boards';
import { CANVAS_DEFAULT_SIZES, STICKY_COLORS, TEXT_SIZES, type CanvasNodeType } from '@shared/boards/canvasDefaults';
import {
  absoluteBox,
  adoptIntoFrame,
  alignBoxes,
  distributeBoxes,
  duplicateNodes,
  extractClipboard,
  indexNodes,
  pasteClipboard,
  reorderZ,
  serializeClipboard,
  setAbsolutePositions,
  setLocked,
  translateNodes,
  updateFrameMembership,
  type AlignMode,
  type BoardClipboard,
  type Box,
  type DistributeAxis,
  type ZOrderOp,
} from '@shared/boards/canvasOps';
import { createBoardId } from '@shared/boards/document';
import { buildTemplate, type BoardTemplateId } from '@shared/boards/templates';
import type { BoardStore } from '../store/boardStore';

export const DUPLICATE_OFFSET = 24;

function canEdit(store: BoardStore) {
  return !store.getState().readOnly;
}

/** Selected nodes that canvas arrangement applies to (mind nodes are laid out automatically). */
export function arrangeableIds(store: BoardStore, opts: { includeLocked?: boolean } = {}): string[] {
  const { selection, document: doc } = store.getState();
  const byId = indexNodes(doc.nodes);
  return selection.nodeIds.filter((id) => {
    const node = byId.get(id);
    return !!node && node.data.type !== 'mind' && (opts.includeLocked || !node.locked);
  });
}

function defaultData(type: Exclude<CanvasNodeType, 'mind' | 'image'>): BoardNodeData {
  switch (type) {
    case 'sticky':
      return { type: 'sticky', text: '', color: STICKY_COLORS[0] };
    case 'shape':
      return { type: 'shape', shape: 'rect', text: '' };
    case 'text':
      return { type: 'text', text: '', fontSize: TEXT_SIZES.M, align: 'left' };
    case 'frame':
      return { type: 'frame', title: 'Frame' };
  }
}

/**
 * Places a new node: centred on `at` (a click), or filling `rect` (a drag).
 * It joins the frame it lands in; a new frame adopts what it covers.
 */
export function createCanvasNode(
  store: BoardStore,
  type: Exclude<CanvasNodeType, 'mind' | 'image'>,
  place: { at: { x: number; y: number } } | { rect: Box },
  opts: { data?: Partial<BoardNodeData>; edit?: boolean } = {},
): string | null {
  const state = store.getState();
  if (!canEdit(store) || state.document.nodes.length >= BOARD_LIMITS.nodes) return null;
  const id = createBoardId();
  const data = { ...defaultData(type), ...(opts.data ?? {}) } as BoardNodeData;
  let node: BoardNode;
  if ('rect' in place) {
    node = { id, position: { x: Math.round(place.rect.x), y: Math.round(place.rect.y) }, size: { w: Math.round(place.rect.w), h: Math.round(place.rect.h) }, data };
  } else {
    const size = CANVAS_DEFAULT_SIZES[type];
    // Text sizes itself; place its first line on the click.
    const w = type === 'text' ? 0 : size.w;
    const h = type === 'text' ? (TEXT_SIZES.M * 1.5) : size.h;
    node = { id, position: { x: Math.round(place.at.x - w / 2), y: Math.round(place.at.y - h / 2) }, data };
    if (type !== 'text') node.size = { ...size };
  }
  let doc = { ...state.document, nodes: [...state.document.nodes, node] };
  doc = type === 'frame' ? adoptIntoFrame(doc, id, state.measured) : updateFrameMembership(doc, [id], state.measured);
  state.setDocument(doc);
  state.select({ nodeIds: [id], edgeIds: [] });
  if (opts.edit) state.setEditingNode(id, { isNew: true });
  return id;
}

export function addImageNode(store: BoardStore, at: { x: number; y: number }, image: { url: string; naturalW: number; naturalH: number; alt?: string }): string | null {
  const state = store.getState();
  if (!canEdit(store) || state.document.nodes.length >= BOARD_LIMITS.nodes) return null;
  const maxW = 480;
  const ratio = image.naturalW > 0 && image.naturalH > 0 ? image.naturalH / image.naturalW : 0.625;
  const w = Math.min(maxW, image.naturalW || maxW);
  const h = Math.max(1, Math.round(w * ratio));
  const id = createBoardId();
  const node: BoardNode = {
    id,
    position: { x: Math.round(at.x - w / 2), y: Math.round(at.y - h / 2) },
    size: { w, h },
    data: {
      type: 'image',
      url: image.url,
      ...(image.alt ? { alt: image.alt.slice(0, 500) } : {}),
      ...(image.naturalW > 0 ? { naturalW: Math.round(image.naturalW) } : {}),
      ...(image.naturalH > 0 ? { naturalH: Math.round(image.naturalH) } : {}),
    },
  };
  state.setDocument(updateFrameMembership({ ...state.document, nodes: [...state.document.nodes, node] }, [id], state.measured));
  state.select({ nodeIds: [id], edgeIds: [] });
  return id;
}

/** Swaps an image node's picture, keeping its width and adopting the new aspect ratio. */
export function replaceImage(store: BoardStore, id: string, image: { url: string; naturalW: number; naturalH: number }) {
  const state = store.getState();
  const node = state.document.nodes.find((n) => n.id === id);
  if (!node || node.data.type !== 'image') return;
  const w = node.size?.w ?? CANVAS_DEFAULT_SIZES.image.w;
  const h = image.naturalW > 0 ? Math.max(1, Math.round((w * image.naturalH) / image.naturalW)) : (node.size?.h ?? CANVAS_DEFAULT_SIZES.image.h);
  state.setDocument({
    ...state.document,
    nodes: state.document.nodes.map((n) =>
      n.id === id
        ? ({ ...n, size: { w, h }, data: { ...n.data, url: image.url, naturalW: Math.round(image.naturalW) || undefined, naturalH: Math.round(image.naturalH) || undefined } } as BoardNode)
        : n,
    ),
  });
}

/** A free connector between two nodes (default: curved, arrow at the end). */
export function connectNodes(store: BoardStore, source: string, target: string): string | null {
  const state = store.getState();
  if (!canEdit(store) || source === target) return null;
  const ids = new Set(state.document.nodes.map((n) => n.id));
  if (!ids.has(source) || !ids.has(target) || state.document.edges.length >= BOARD_LIMITS.edges) return null;
  const edge: BoardEdge = { id: createBoardId(), source, target, kind: 'connector', data: { style: 'curve', arrowEnd: true } };
  state.addEdge(edge);
  state.select({ nodeIds: [], edgeIds: [edge.id] });
  return edge.id;
}

/** After a drag: moved nodes join or leave frames (inside the drag's undo step). */
export function finishCanvasDrag(store: BoardStore, ids: string[]) {
  const state = store.getState();
  if (!canEdit(store) || !ids.length) return;
  state.setDocument(updateFrameMembership(state.document, ids, state.measured));
}

export function duplicateSelection(store: BoardStore): string[] {
  const state = store.getState();
  if (!canEdit(store) || !state.selection.nodeIds.length) return [];
  const { doc, ids } = duplicateNodes(state.document, state.selection.nodeIds, { offset: DUPLICATE_OFFSET });
  if (!ids.length) return [];
  state.setDocument(doc);
  state.select({ nodeIds: ids, edgeIds: [] });
  return ids;
}

// The last copy in this tab; the system clipboard also gets the JSON so a
// paste works in another tab or board.
let memoryClipboard: BoardClipboard | null = null;
let pasteCount = 0;

export function getMemoryClipboard() {
  return memoryClipboard;
}

/** Copies the selection; returns the JSON for the system clipboard (null when nothing is selected). */
export function copySelection(store: BoardStore): string | null {
  const state = store.getState();
  if (!state.selection.nodeIds.length) return null;
  memoryClipboard = extractClipboard(state.document, state.selection.nodeIds);
  pasteCount = 0;
  return serializeClipboard(memoryClipboard);
}

export function cutSelection(store: BoardStore): string | null {
  const text = copySelection(store);
  if (text) store.getState().removeSelection();
  return text;
}

/**
 * Pastes clipboard content with new ids. On the board it came from (the
 * originals are still there) it lands 24px further each time; elsewhere it is
 * centred in the view.
 */
export function pasteContent(store: BoardStore, clip: BoardClipboard | null = memoryClipboard): string[] {
  const state = store.getState();
  if (!canEdit(store) || !clip || !clip.nodes.length) return [];
  const existing = new Set(state.document.nodes.map((n) => n.id));
  const sameBoard = clip.nodes.every((n) => existing.has(n.id));
  if (clip === memoryClipboard) pasteCount += 1;
  const result = sameBoard
    ? pasteClipboard(state.document, clip, { offset: { x: DUPLICATE_OFFSET * Math.max(1, pasteCount), y: DUPLICATE_OFFSET * Math.max(1, pasteCount) } })
    : pasteClipboard(state.document, clip, { center: state.canvasApi?.getViewportCenter() ?? { x: 0, y: 0 } });
  if (!result.ids.length) return [];
  state.setDocument(result.doc);
  state.select({ nodeIds: result.ids, edgeIds: [] });
  return result.ids;
}

export function setSelectionLocked(store: BoardStore, locked: boolean) {
  const state = store.getState();
  if (!canEdit(store)) return;
  state.setDocument(setLocked(state.document, arrangeableIds(store, { includeLocked: true }), locked));
}

export function reorderSelection(store: BoardStore, op: ZOrderOp) {
  const state = store.getState();
  if (!canEdit(store)) return;
  state.setDocument(reorderZ(state.document, arrangeableIds(store, { includeLocked: true }), op));
}

function selectionBoxes(store: BoardStore) {
  const { document: doc, measured } = store.getState();
  const byId = indexNodes(doc.nodes);
  return arrangeableIds(store).map((id) => ({ id, ...absoluteBox(byId, byId.get(id)!, measured) }));
}

export function alignSelection(store: BoardStore, mode: AlignMode) {
  const state = store.getState();
  if (!canEdit(store)) return;
  state.setDocument(setAbsolutePositions(state.document, alignBoxes(selectionBoxes(store), mode)));
}

export function distributeSelection(store: BoardStore, axis: DistributeAxis) {
  const state = store.getState();
  if (!canEdit(store)) return;
  state.setDocument(setAbsolutePositions(state.document, distributeBoxes(selectionBoxes(store), axis)));
}

export function nudgeSelection(store: BoardStore, dx: number, dy: number): boolean {
  const state = store.getState();
  const ids = arrangeableIds(store);
  if (!canEdit(store) || !ids.length) return false;
  state.setDocument(translateNodes(state.document, ids, dx, dy));
  return true;
}

/** Patches the data of every selected node of `type` (one undo step). */
export function updateSelectedData<T extends BoardNodeData['type']>(store: BoardStore, type: T, patch: Partial<Extract<BoardNodeData, { type: T }>>, ids?: string[]) {
  const state = store.getState();
  if (!canEdit(store)) return;
  const target = new Set(ids ?? state.selection.nodeIds);
  let changed = false;
  const nodes = state.document.nodes.map((n) => {
    if (!target.has(n.id) || n.data.type !== type) return n;
    const data = { ...n.data, ...patch };
    if (Object.keys(patch).every((k) => (n.data as Record<string, unknown>)[k] === (patch as Record<string, unknown>)[k])) return n;
    changed = true;
    return { ...n, data } as BoardNode;
  });
  if (changed) state.setDocument({ ...state.document, nodes });
}

/** Patches the data of every selected connector. */
export function updateSelectedEdges(store: BoardStore, patch: NonNullable<BoardEdge['data']>, ids?: string[]) {
  const state = store.getState();
  if (!canEdit(store)) return;
  const target = new Set(ids ?? state.selection.edgeIds);
  let changed = false;
  const edges = state.document.edges.map((e) => {
    if (!target.has(e.id) || e.kind !== 'connector') return e;
    changed = true;
    return { ...e, data: { ...e.data, ...patch } };
  });
  if (changed) state.setDocument({ ...state.document, edges });
}

/** Inserts a template centred in the view and selects what it added. */
export function insertTemplate(store: BoardStore, id: BoardTemplateId): string[] {
  const state = store.getState();
  if (!canEdit(store) || id === 'blank') return [];
  const content = buildTemplate(id, { center: state.canvasApi?.getViewportCenter() ?? { x: 0, y: 0 } });
  const room = BOARD_LIMITS.nodes - state.document.nodes.length;
  if (content.nodes.length > room) return [];
  state.setDocument({ ...state.document, nodes: [...state.document.nodes, ...content.nodes], edges: [...state.document.edges, ...content.edges] });
  const top = content.nodes.filter((n) => !n.parentId).map((n) => n.id);
  state.select({ nodeIds: top, edgeIds: [] });
  return top;
}

/** Commits edited text; an empty text block (or a cancelled new node) goes away. */
export function commitNodeText(store: BoardStore, id: string, patch: Partial<BoardNodeData>, opts: { removeIfEmpty?: boolean } = {}) {
  const state = store.getState();
  const node = state.document.nodes.find((n) => n.id === id);
  if (!node) return;
  const text = (patch as { text?: string }).text;
  if (opts.removeIfEmpty && text !== undefined && !text.trim()) {
    if (state.editingNew && state.editingNodeId === id) state.cancelNewNode(id);
    else state.removeNodes([id]);
    if (store.getState().editingNodeId === id) store.getState().setEditingNode(null);
    return;
  }
  const changed = Object.entries(patch).some(([k, v]) => (node.data as Record<string, unknown>)[k] !== v);
  if (changed) state.updateNodeData(id, patch);
  if (store.getState().editingNodeId === id) store.getState().setEditingNode(null);
}
