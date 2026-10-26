import { createContext, createElement, useContext, useState, type ReactNode } from 'react';
import { createStore, useStore, type StoreApi } from 'zustand';
import { temporal, type TemporalState } from 'zundo';
import type { EdgeChange, NodeChange, Viewport } from '@xyflow/react';
import type { BoardDocument, BoardEdge, BoardNode, BoardNodeData, BoardStroke, BoardTheme } from '@shared/schema';
import { createEmptyDocument, removeEdgesById, removeNodesCascade } from '@shared/boards/document';
import { setMindCollapsed } from '@shared/boards/mindOps';
import { BOARD_LIMITS } from '@shared/schema/boards';
import { autoLayoutDocument, getMindForest, relayoutRoots } from '../mindmap/autoLayout';

// The single source of truth for an open board. React Flow renders nodes and
// edges derived from `document` (engine/toFlow.ts) and reports changes back
// through `updateNodes` / `updateEdges`; nothing else holds board content.
//
// Undo/redo (zundo) records `document` only: selection, viewport, measured
// sizes and the title never create history entries.
//
// Mind maps lay themselves out: every commit runs the auto layout
// (mindmap/autoLayout.ts) so an edit and the positions it causes are one
// document, one undo step. Re-layouts caused only by the DOM (a node measured
// a new size) are applied "silently": no history entry and no version bump, the
// positions simply ride along with the next save.

export type BoardTool = 'select' | 'mind' | 'sticky' | 'shape' | 'text' | 'connector' | 'pen' | 'image' | 'frame';

export interface PenOptions {
  color: string;
  size: number;
  /** `erase` removes whole strokes under the pointer. */
  mode: 'draw' | 'erase';
}

export interface BoardSelection {
  nodeIds: string[];
  edgeIds: string[];
}

export interface MeasuredSize {
  width: number;
  height: number;
}

/** What the mounted canvas lets the rest of the editor do with the camera. */
export interface BoardCanvasApi {
  /** Pans (keeping the zoom) so the node is centred; `ifOffscreen` only when it is not fully visible. */
  focusNode: (id: string, opts?: { ifOffscreen?: boolean }) => void;
  /** The flow-space point at the centre of the visible canvas. */
  getViewportCenter: () => { x: number; y: number };
  /** Frames everything on the board (nodes and pen strokes). */
  fitContent: (opts?: { duration?: number }) => void;
  /** PNG / SVG of the whole board, or of one frame; rejects with EmptyBoardError when there is nothing to draw. */
  renderImage: (opts: { format: 'png' | 'svg'; frameId?: string | null }) => Promise<Blob>;
}

export interface BoardState {
  document: BoardDocument;
  /** Bumped on every document change (edits, undo, redo). Autosave compares it to `savedVersion`. */
  documentVersion: number;
  /** The documentVersion last written to the server (or loaded from it). */
  savedVersion: number;
  /** Camera position; kept out of `document` so panning never adds history. */
  viewport: Viewport | null;
  viewportVersion: number;
  savedViewportVersion: number;
  title: string;
  savedTitle: string;
  selection: BoardSelection;
  activeTool: BoardTool;
  editingNodeId: string | null;
  /** Text that replaces the node's text when editing starts by typing a character. */
  editingSeed: string | null;
  /** The node being edited was just created: cancelling an empty edit removes it. */
  editingNew: boolean;
  /** Connector whose label is being edited inline. */
  editingEdgeId: string | null;
  /** Connector tool: the node clicked first (the next node clicked becomes the target). */
  connectorSourceId: string | null;
  pen: PenOptions;
  /** Snap node drags to a 16px grid. */
  snapToGrid: boolean;
  /** Mind node highlighted as the drop target while a branch is dragged. */
  dropTargetId: string | null;
  canvasApi: BoardCanvasApi | null;
  /** Present mode: the nodes kept at full strength (the rest is dimmed); null = nothing dimmed. */
  presentFocus: string[] | null;
  /** Mind node an AI request is expanding (shows a spinner on it). */
  aiBusyNodeId: string | null;
  /** Sizes React Flow measured in the DOM, so derived nodes keep them across renders. */
  measured: Record<string, MeasuredSize>;
  readOnly: boolean;

  // Loading
  /** Loads a document as the saved baseline: clears history, selection and dirty state. */
  replaceDocument: (doc: BoardDocument, opts?: { title?: string; viewport?: Viewport | null; dirty?: boolean }) => void;
  /** Replaces the document as an undoable edit. */
  setDocument: (doc: BoardDocument) => void;
  // React Flow bridge
  updateNodes: (changes: NodeChange[]) => void;
  updateEdges: (changes: EdgeChange[]) => void;
  // Document edits (all undoable)
  addNode: (node: BoardNode, opts?: { select?: boolean }) => void;
  addNodes: (nodes: BoardNode[]) => void;
  updateNode: (id: string, patch: Partial<Omit<BoardNode, 'id' | 'data'>>) => void;
  updateNodeData: (id: string, patch: Partial<BoardNodeData>) => void;
  removeNodes: (ids: string[]) => void;
  addEdge: (edge: BoardEdge) => void;
  updateEdgeData: (id: string, patch: NonNullable<BoardEdge['data']>) => void;
  removeEdges: (ids: string[]) => void;
  removeSelection: () => void;
  addStroke: (stroke: BoardStroke) => void;
  removeStrokes: (ids: string[]) => void;
  /** Removes a node created for an edit that was cancelled empty (its creation leaves no history). */
  cancelNewNode: (id: string) => void;
  setTheme: (patch: Partial<BoardTheme>) => void;
  /** Collapses / expands a mind node (toggles without `value`). Works read-only too: the viewer can fold branches. */
  toggleCollapsed: (id: string, value?: boolean) => void;
  /** Lays out the maps containing `ids` again (all maps when omitted), as an edit. */
  relayout: (ids?: string[]) => void;
  // Session state (never undoable)
  /** `silent`: remember the camera without counting it as a change to save (programmatic moves such as the initial fit). */
  setViewport: (viewport: Viewport, opts?: { silent?: boolean }) => void;
  setTitle: (title: string) => void;
  select: (selection: Partial<BoardSelection>) => void;
  clearSelection: () => void;
  setActiveTool: (tool: BoardTool) => void;
  setEditingNode: (id: string | null, opts?: { seed?: string; isNew?: boolean }) => void;
  setEditingEdge: (id: string | null) => void;
  setConnectorSource: (id: string | null) => void;
  setPenOptions: (patch: Partial<PenOptions>) => void;
  setSnapToGrid: (value: boolean) => void;
  setDropTarget: (id: string | null) => void;
  setCanvasApi: (api: BoardCanvasApi | null) => void;
  setPresentFocus: (ids: string[] | null) => void;
  setAiBusyNode: (id: string | null) => void;
  /** Called after a successful save with what was sent. */
  markSaved: (sent: { documentVersion: number; viewportVersion: number; title: string }) => void;
  // History
  undo: () => void;
  redo: () => void;
  /** Groups the following edits into one undo step until `endBatch` (e.g. a drag). */
  beginBatch: () => void;
  endBatch: () => void;
}

type HistoryState = Pick<BoardState, 'document'>;
export type BoardStore = StoreApi<BoardState> & { temporal: StoreApi<TemporalState<HistoryState>> };

const EMPTY_SELECTION: BoardSelection = { nodeIds: [], edgeIds: [] };
export const DEFAULT_PEN: PenOptions = { color: '#0A162E', size: 4, mode: 'draw' };
const HISTORY_LIMIT = 200;

function sameIds(a: string[], b: string[]) {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

export function createBoardStore(init?: { document?: BoardDocument; title?: string; readOnly?: boolean; autoLayout?: boolean }): BoardStore {
  const initialDoc = init?.document ?? createEmptyDocument();
  const autoLayout = init?.autoLayout ?? true;
  // Depth of nested beginBatch calls; while > 0 history is paused after the
  // first edit (which records the pre-batch state).
  let batchDepth = 0;
  let batchRecorded = false;
  // A drag opens its own batch (closed by the drag end), independent of any
  // batch a caller opened around it (useAutoLayout wraps drag + reparent).
  let dragBatch = false;

  const store = createStore<BoardState>()(
    temporal(
      (set, get, api) => {
        // Every document edit goes through here so the version always moves.
        const commit = (input: BoardDocument) => {
          const state = get();
          if (input === state.document) return;
          const next = autoLayout ? autoLayoutDocument(state.document, input, state.measured) : input;
          set({ document: next, documentVersion: state.documentVersion + 1 });
          if (batchDepth > 0 && !batchRecorded) {
            batchRecorded = true;
            (api as unknown as BoardStore).temporal.getState().pause();
          }
        };
        // A layout-only change: no history entry, no version bump.
        const commitSilently = (next: BoardDocument) => {
          if (next === get().document) return;
          const history = (api as unknown as BoardStore).temporal.getState();
          const tracking = history.isTracking;
          if (tracking) history.pause();
          set({ document: next });
          if (tracking) history.resume();
        };
        const relayoutSilently = (ids: Iterable<string> | null) => {
          if (!autoLayout) return;
          const { document: doc, measured } = get();
          commitSilently(relayoutRoots(doc, ids, measured));
        };
        const mapNodes = (fn: (node: BoardNode) => BoardNode) => {
          const doc = get().document;
          let changed = false;
          const nodes = doc.nodes.map((node) => {
            const next = fn(node);
            if (next !== node) changed = true;
            return next;
          });
          if (changed) commit({ ...doc, nodes });
        };
        const pruneSelection = () => {
          const { document: doc, selection } = get();
          const nodeIds = new Set(doc.nodes.map((n) => n.id));
          const edgeIds = new Set(doc.edges.map((e) => e.id));
          const next = {
            nodeIds: selection.nodeIds.filter((id) => nodeIds.has(id)),
            edgeIds: selection.edgeIds.filter((id) => edgeIds.has(id)),
          };
          if (!sameIds(next.nodeIds, selection.nodeIds) || !sameIds(next.edgeIds, selection.edgeIds)) set({ selection: next });
          const { editingEdgeId, connectorSourceId } = get();
          if (editingEdgeId && !edgeIds.has(editingEdgeId)) set({ editingEdgeId: null });
          if (connectorSourceId && !nodeIds.has(connectorSourceId)) set({ connectorSourceId: null });
        };

        return {
          document: initialDoc,
          documentVersion: 0,
          savedVersion: 0,
          viewport: initialDoc.viewport ?? null,
          viewportVersion: 0,
          savedViewportVersion: 0,
          title: init?.title ?? '',
          savedTitle: init?.title ?? '',
          selection: EMPTY_SELECTION,
          activeTool: 'select',
          editingNodeId: null,
          editingSeed: null,
          editingNew: false,
          editingEdgeId: null,
          connectorSourceId: null,
          pen: DEFAULT_PEN,
          snapToGrid: false,
          dropTargetId: null,
          canvasApi: null,
          presentFocus: null,
          aiBusyNodeId: null,
          measured: {},
          readOnly: init?.readOnly ?? false,

          replaceDocument: (doc, opts) => {
            const state = get();
            // A fresh version number that differs from the old one, so
            // subscribers see a change, then saved (or not) at that version.
            const version = state.documentVersion + 1;
            set({
              document: doc,
              documentVersion: version,
              savedVersion: opts?.dirty ? state.savedVersion : version,
              viewport: opts?.viewport !== undefined ? opts.viewport : (doc.viewport ?? null),
              viewportVersion: state.viewportVersion,
              savedViewportVersion: state.viewportVersion,
              title: opts?.title ?? state.title,
              savedTitle: opts?.title ?? state.savedTitle,
              selection: EMPTY_SELECTION,
              editingNodeId: null,
              editingSeed: null,
              editingNew: false,
              editingEdgeId: null,
              connectorSourceId: null,
              dropTargetId: null,
              measured: {},
            });
            (api as unknown as BoardStore).temporal.getState().clear();
          },
          setDocument: (doc) => {
            commit(doc);
            pruneSelection();
          },

          updateNodes: (changes) => {
            if (changes.length === 0) return;
            const state = get();
            let selection = state.selection;
            let measured = state.measured;
            const resized: string[] = [];
            const positions = new Map<string, { x: number; y: number }>();
            const sizes = new Map<string, { w: number; h: number }>();
            const removed: string[] = [];
            let dragStart = false;
            let dragEnd = false;
            const locked = new Set(state.document.nodes.filter((n) => n.locked).map((n) => n.id));

            for (const change of changes) {
              switch (change.type) {
                case 'select': {
                  const has = selection.nodeIds.includes(change.id);
                  if (change.selected && !has) selection = { ...selection, nodeIds: [...selection.nodeIds, change.id] };
                  if (!change.selected && has) selection = { ...selection, nodeIds: selection.nodeIds.filter((id) => id !== change.id) };
                  break;
                }
                case 'dimensions': {
                  if (change.dimensions) {
                    const prev = measured[change.id];
                    if (!prev || prev.width !== change.dimensions.width || prev.height !== change.dimensions.height) {
                      measured = { ...measured, [change.id]: change.dimensions };
                      resized.push(change.id);
                    }
                    // Only a user resize (NodeResizer) changes the stored size.
                    if (change.resizing && !state.readOnly && !locked.has(change.id)) {
                      sizes.set(change.id, { w: change.dimensions.width, h: change.dimensions.height });
                    }
                  }
                  break;
                }
                case 'position': {
                  if (state.readOnly || locked.has(change.id)) break;
                  if (change.dragging && !dragBatch) dragStart = true;
                  if (change.dragging === false) dragEnd = true;
                  if (change.position) positions.set(change.id, change.position);
                  break;
                }
                case 'remove':
                  if (!state.readOnly) removed.push(change.id);
                  break;
                default:
                  break;
              }
            }

            if (selection !== state.selection || measured !== state.measured) set({ selection, measured });
            // Mind nodes that changed size push their neighbours around.
            if (resized.length) {
              const forest = getMindForest(state.document.nodes, state.document.edges);
              const mind = resized.filter((id) => forest.nodes.has(id));
              if (mind.length) relayoutSilently(mind);
            }
            if (dragStart) {
              dragBatch = true;
              get().beginBatch();
            }
            if (positions.size || sizes.size) {
              mapNodes((node) => {
                const position = positions.get(node.id);
                const size = sizes.get(node.id);
                if (!position && !size) return node;
                if (position && position.x === node.position.x && position.y === node.position.y && !size) return node;
                return { ...node, ...(position ? { position: { x: position.x, y: position.y } } : {}), ...(size ? { size } : {}) };
              });
            }
            if (removed.length) get().removeNodes(removed);
            if (dragEnd && dragBatch) {
              dragBatch = false;
              get().endBatch();
            }
          },

          updateEdges: (changes) => {
            if (changes.length === 0) return;
            const state = get();
            let selection = state.selection;
            const removed: string[] = [];
            for (const change of changes) {
              if (change.type === 'select') {
                const has = selection.edgeIds.includes(change.id);
                if (change.selected && !has) selection = { ...selection, edgeIds: [...selection.edgeIds, change.id] };
                if (!change.selected && has) selection = { ...selection, edgeIds: selection.edgeIds.filter((id) => id !== change.id) };
              } else if (change.type === 'remove' && !state.readOnly) {
                removed.push(change.id);
              }
            }
            if (selection !== state.selection) set({ selection });
            if (removed.length) get().removeEdges(removed);
          },

          addNode: (node, opts) => {
            const doc = get().document;
            commit({ ...doc, nodes: [...doc.nodes, node] });
            if (opts?.select) set({ selection: { nodeIds: [node.id], edgeIds: [] } });
          },
          addNodes: (nodes) => {
            if (nodes.length === 0) return;
            const doc = get().document;
            commit({ ...doc, nodes: [...doc.nodes, ...nodes] });
          },
          updateNode: (id, patch) => {
            mapNodes((node) => (node.id === id ? { ...node, ...patch } : node));
          },
          updateNodeData: (id, patch) => {
            mapNodes((node) => (node.id === id ? ({ ...node, data: { ...node.data, ...patch } } as BoardNode) : node));
          },
          removeNodes: (ids) => {
            commit(removeNodesCascade(get().document, ids));
            pruneSelection();
            const editing = get().editingNodeId;
            if (editing && !get().document.nodes.some((n) => n.id === editing)) set({ editingNodeId: null });
          },
          addEdge: (edge) => {
            const doc = get().document;
            if (doc.edges.some((e) => e.id === edge.id)) return;
            commit({ ...doc, edges: [...doc.edges, edge] });
          },
          updateEdgeData: (id, patch) => {
            const doc = get().document;
            let changed = false;
            const edges = doc.edges.map((edge) => {
              if (edge.id !== id) return edge;
              changed = true;
              return { ...edge, data: { ...edge.data, ...patch } };
            });
            if (changed) commit({ ...doc, edges });
          },
          removeEdges: (ids) => {
            commit(removeEdgesById(get().document, ids));
            pruneSelection();
          },
          removeSelection: () => {
            const { selection, readOnly } = get();
            if (readOnly) return;
            const lockedIds = new Set(get().document.nodes.filter((n) => n.locked).map((n) => n.id));
            const nodeIds = selection.nodeIds.filter((id) => !lockedIds.has(id));
            if (selection.edgeIds.length === 0 && nodeIds.length === 0) return;
            // One undo step for nodes and edges together.
            get().beginBatch();
            if (selection.edgeIds.length) get().removeEdges(selection.edgeIds);
            if (nodeIds.length) get().removeNodes(nodeIds);
            get().endBatch();
          },
          addStroke: (stroke) => {
            const doc = get().document;
            if (doc.strokes.length >= BOARD_LIMITS.strokes || stroke.points.length < 3) return;
            commit({ ...doc, strokes: [...doc.strokes, stroke] });
          },
          removeStrokes: (ids) => {
            if (!ids.length) return;
            const drop = new Set(ids);
            const doc = get().document;
            const strokes = doc.strokes.filter((s) => !drop.has(s.id));
            if (strokes.length !== doc.strokes.length) commit({ ...doc, strokes });
          },
          cancelNewNode: (id) => {
            set({ editingNodeId: null, editingSeed: null, editingNew: false });
            const temporal = (api as unknown as BoardStore).temporal;
            const history = temporal.getState();
            const last = history.pastStates[history.pastStates.length - 1];
            const exists = get().document.nodes.some((n) => n.id === id);
            if (!exists) return;
            // The creation was the last step: step back over it and forget it, so
            // neither undo nor redo ever shows the empty node.
            if (last?.document && !last.document.nodes.some((n) => n.id === id) && history.isTracking && batchDepth === 0) {
              history.undo();
              temporal.setState({ futureStates: [] });
              set({ documentVersion: get().documentVersion + 1 });
              relayoutSilently(null);
              pruneSelection();
              return;
            }
            get().removeNodes([id]);
          },
          setTheme: (patch) => {
            const doc = get().document;
            commit({ ...doc, theme: { ...doc.theme, ...patch } });
          },
          toggleCollapsed: (id, value) => {
            commit(setMindCollapsed(get().document, id, value));
            // Selection inside a folded branch moves up to the folded node.
            const { selection, document: doc } = get();
            const forest = getMindForest(doc.nodes, doc.edges);
            const hiddenSelected = selection.nodeIds.some((sel) => {
              let p = forest.parent.get(sel);
              while (p !== undefined) {
                if (p === id) return true;
                p = forest.parent.get(p);
              }
              return false;
            });
            if (hiddenSelected) set({ selection: { nodeIds: [id], edgeIds: [] } });
          },
          relayout: (ids) => {
            if (!autoLayout) return;
            const { document: doc, measured } = get();
            commit(relayoutRoots(doc, ids ?? null, measured));
          },

          setViewport: (viewport, opts) => {
            const prev = get().viewport;
            if (prev && prev.x === viewport.x && prev.y === viewport.y && prev.zoom === viewport.zoom) return;
            const next = { x: viewport.x, y: viewport.y, zoom: viewport.zoom };
            set(opts?.silent ? { viewport: next } : { viewport: next, viewportVersion: get().viewportVersion + 1 });
          },
          setTitle: (title) => set({ title }),
          select: (next) => set({ selection: { nodeIds: next.nodeIds ?? get().selection.nodeIds, edgeIds: next.edgeIds ?? get().selection.edgeIds } }),
          clearSelection: () => set({ selection: EMPTY_SELECTION }),
          setActiveTool: (tool) => set({ activeTool: tool, connectorSourceId: null }),
          setEditingNode: (id, opts) =>
            set({ editingNodeId: id, editingSeed: id ? (opts?.seed ?? null) : null, editingNew: id ? !!opts?.isNew : false, ...(id ? { editingEdgeId: null } : {}) }),
          setEditingEdge: (id) => set({ editingEdgeId: id, ...(id ? { editingNodeId: null, editingSeed: null, editingNew: false } : {}) }),
          setConnectorSource: (id) => {
            if (get().connectorSourceId !== id) set({ connectorSourceId: id });
          },
          setPenOptions: (patch) => set({ pen: { ...get().pen, ...patch } }),
          setSnapToGrid: (value) => set({ snapToGrid: value }),
          setDropTarget: (id) => {
            if (get().dropTargetId !== id) set({ dropTargetId: id });
          },
          setCanvasApi: (canvasApi) => set({ canvasApi }),
          setPresentFocus: (presentFocus) => set({ presentFocus }),
          setAiBusyNode: (aiBusyNodeId) => set({ aiBusyNodeId }),
          markSaved: (sent) =>
            set({ savedVersion: sent.documentVersion, savedViewportVersion: sent.viewportVersion, savedTitle: sent.title }),

          undo: () => {
            const history = (api as unknown as BoardStore).temporal.getState();
            if (!history.pastStates.length) return;
            history.undo();
            set({ documentVersion: get().documentVersion + 1, editingNodeId: null, editingEdgeId: null });
            // Sizes may have changed since that state was recorded.
            relayoutSilently(null);
            pruneSelection();
          },
          redo: () => {
            const history = (api as unknown as BoardStore).temporal.getState();
            if (!history.futureStates.length) return;
            history.redo();
            set({ documentVersion: get().documentVersion + 1, editingNodeId: null, editingEdgeId: null });
            relayoutSilently(null);
            pruneSelection();
          },
          beginBatch: () => {
            if (batchDepth === 0) batchRecorded = false;
            batchDepth += 1;
          },
          endBatch: () => {
            if (batchDepth === 0) return;
            batchDepth -= 1;
            if (batchDepth === 0 && batchRecorded) {
              batchRecorded = false;
              (api as unknown as BoardStore).temporal.getState().resume();
            }
          },
        };
      },
      {
        partialize: (state): HistoryState => ({ document: state.document }),
        // Only a new document object is a history step.
        equality: (past, current) => past.document === current.document,
        limit: HISTORY_LIMIT,
      },
    ),
  ) as BoardStore;
  return store;
}

// ---------------------------------------------------------------------------
// Selectors (stable functions: pass them straight to useBoardStore)

export const selectIsDirty = (s: BoardState) => s.documentVersion !== s.savedVersion || s.title.trim() !== s.savedTitle;
/** Viewport moved since the last save (saved quietly, never shown as "unsaved"). */
export const selectViewportDirty = (s: BoardState) => s.viewportVersion !== s.savedViewportVersion;
export const selectSelectionCount = (s: BoardState) => s.selection.nodeIds.length + s.selection.edgeIds.length;
export const selectTheme = (s: BoardState) => s.document.theme;
/** What gets sent to the server: the document with the current camera. */
export function getDocumentForSave(s: BoardState): BoardDocument {
  return s.viewport ? { ...s.document, viewport: s.viewport } : s.document;
}

// ---------------------------------------------------------------------------
// React binding: one store per mounted editor/viewer.

const BoardStoreContext = createContext<BoardStore | null>(null);

export function BoardStoreProvider({ store, children }: { store: BoardStore; children: ReactNode }) {
  return createElement(BoardStoreContext.Provider, { value: store }, children);
}

/** Creates a store once for the lifetime of the calling component. */
export function useCreateBoardStore(init?: Parameters<typeof createBoardStore>[0]): BoardStore {
  const [store] = useState(() => createBoardStore(init));
  return store;
}

export function useBoardStoreApi(): BoardStore {
  const store = useContext(BoardStoreContext);
  if (!store) throw new Error('useBoardStore must be used inside <BoardStoreProvider>');
  return store;
}

export function useBoardStore<T>(selector: (state: BoardState) => T): T {
  return useStore(useBoardStoreApi(), selector);
}

export function useBoardHistory<T>(selector: (state: TemporalState<HistoryState>) => T): T {
  return useStore(useBoardStoreApi().temporal, selector);
}
