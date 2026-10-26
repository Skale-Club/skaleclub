import { createContext, createElement, useContext, useState, type ReactNode } from 'react';
import { createStore, useStore, type StoreApi } from 'zustand';
import { temporal, type TemporalState } from 'zundo';
import type { EdgeChange, NodeChange, Viewport } from '@xyflow/react';
import type { BoardDocument, BoardEdge, BoardNode, BoardNodeData, BoardTheme } from '@shared/schema';
import { createEmptyDocument, removeEdgesById, removeNodesCascade } from '@shared/boards/document';

// The single source of truth for an open board. React Flow renders nodes and
// edges derived from `document` (engine/toFlow.ts) and reports changes back
// through `updateNodes` / `updateEdges`; nothing else holds board content.
//
// Undo/redo (zundo) records `document` only: selection, viewport, measured
// sizes and the title never create history entries.

export type BoardTool = 'select' | 'mind' | 'sticky' | 'shape' | 'text' | 'connector' | 'pen' | 'image' | 'frame';

export interface BoardSelection {
  nodeIds: string[];
  edgeIds: string[];
}

export interface MeasuredSize {
  width: number;
  height: number;
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
  setTheme: (patch: Partial<BoardTheme>) => void;
  // Session state (never undoable)
  /** `silent`: remember the camera without counting it as a change to save (programmatic moves such as the initial fit). */
  setViewport: (viewport: Viewport, opts?: { silent?: boolean }) => void;
  setTitle: (title: string) => void;
  select: (selection: Partial<BoardSelection>) => void;
  clearSelection: () => void;
  setActiveTool: (tool: BoardTool) => void;
  setEditingNode: (id: string | null) => void;
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
const HISTORY_LIMIT = 200;

function sameIds(a: string[], b: string[]) {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

export function createBoardStore(init?: { document?: BoardDocument; title?: string; readOnly?: boolean }): BoardStore {
  const initialDoc = init?.document ?? createEmptyDocument();
  // Depth of nested beginBatch calls; while > 0 history is paused after the
  // first edit (which records the pre-batch state).
  let batchDepth = 0;
  let batchRecorded = false;

  const store = createStore<BoardState>()(
    temporal(
      (set, get, api) => {
        // Every document edit goes through here so the version always moves.
        const commit = (next: BoardDocument) => {
          const state = get();
          if (next === state.document) return;
          set({ document: next, documentVersion: state.documentVersion + 1 });
          if (batchDepth > 0 && !batchRecorded) {
            batchRecorded = true;
            (api as unknown as BoardStore).temporal.getState().pause();
          }
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
                  if (change.dragging && !batchDepth) dragStart = true;
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
            if (dragStart) get().beginBatch();
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
            if (dragEnd && batchDepth) get().endBatch();
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
          setTheme: (patch) => {
            const doc = get().document;
            commit({ ...doc, theme: { ...doc.theme, ...patch } });
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
          setActiveTool: (tool) => set({ activeTool: tool }),
          setEditingNode: (id) => set({ editingNodeId: id }),
          markSaved: (sent) =>
            set({ savedVersion: sent.documentVersion, savedViewportVersion: sent.viewportVersion, savedTitle: sent.title }),

          undo: () => {
            const history = (api as unknown as BoardStore).temporal.getState();
            if (!history.pastStates.length) return;
            history.undo();
            set({ documentVersion: get().documentVersion + 1, editingNodeId: null });
            pruneSelection();
          },
          redo: () => {
            const history = (api as unknown as BoardStore).temporal.getState();
            if (!history.futureStates.length) return;
            history.redo();
            set({ documentVersion: get().documentVersion + 1, editingNodeId: null });
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
