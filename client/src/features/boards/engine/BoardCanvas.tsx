import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent as ReactDragEvent, type MouseEvent as ReactMouseEvent, type MutableRefObject, type ReactNode } from 'react';
import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  SelectionMode,
  useNodesInitialized,
  useReactFlow,
  useStoreApi as useFlowStoreApi,
  type Edge,
  type FinalConnectionState,
  type Node,
  type NodeChange,
  type Viewport,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './board.css';
import { TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { absoluteBox, absolutePosition, computeSnap, indexNodes, nodeSize, parseClipboard, unionBox, type Box } from '@shared/boards/canvasOps';
import { collectDescendants } from '@shared/boards/document';
import { boardContentBounds } from '@shared/boards/bounds';
import { useBoardStore, useBoardStoreApi } from '../store/boardStore';
import { computeMindMeta, toFlowEdges, toFlowNodes, type BoardFlowNode, type FlowNodeCache } from './toFlow';
import { boardNodeTypes } from './nodes';
import { boardEdgeTypes } from './edges';
import { BRAND_NAVY, CTA_BLUE, DEFAULT_STICKY_COLOR, EDGE_NEUTRAL } from './palette';
import { FIT_VIEW_OPTIONS, MAX_ZOOM, MIN_ZOOM, ZoomBar } from '../ui/ZoomBar';
import { createBoardThumbnail } from '../io/thumbnail';
import { exportRegion, renderBoardImage } from '../io/exportImage';
import { frameBox } from './camera';
import { getMindForest } from '../mindmap/autoLayout';
import { useAutoLayout } from '../mindmap/useAutoLayout';
import { useMindmapKeyboard } from '../mindmap/useMindmapKeyboard';
import { createRootAt } from '../mindmap/actions';
import { MindContextMenu, type MindContextMenuState } from '../mindmap/MindContextMenu';
import { CanvasContextMenu, type CanvasContextMenuState } from '../canvas/CanvasContextMenu';
import {
  addImageNode,
  connectNodes,
  copySelection,
  createCanvasNode,
  cutSelection,
  duplicateSelection,
  finishCanvasDrag,
  getMemoryClipboard,
  nudgeSelection,
  pasteContent,
} from '../canvas/actions';
import { clearGuides, guidesSignal, isTypingTarget, useShiftTracking } from '../canvas/interaction';
import { BOARD_IMAGE_ACCEPT, firstImageFile } from '../canvas/images';
import { useImageUpload } from '../canvas/useImageUpload';
import { StrokesLayer, PenOverlay } from './layers/PenLayer';
import { GuidesLayer } from './layers/GuidesLayer';
import { CREATION_TOOLS, CreationOverlay, type CreationTool } from './layers/CreationOverlay';
import type { BoardTool } from '../store/boardStore';

// Culling offscreen nodes only pays off on big boards, and it would also drop
// them from the thumbnail (rendered from the DOM), so it kicks in late.
const CULL_THRESHOLD = 300;
const VIEWPORT_THROTTLE_MS = 200;
const SNAP_PX = 6;
const LONG_PRESS_MS = 550;

export const BOARD_BACKGROUND = { light: '#ffffff', dark: '#0f172a' } as const;

export type ThumbnailRenderer = () => Promise<string | null>;

export interface BoardCanvasProps {
  readOnly?: boolean;
  /** Overrides theme.dark (the public viewer's light/dark toggle). */
  dark?: boolean;
  /** Overrides the store's grid-snap toggle. */
  snapToGrid?: boolean;
  showMiniMap?: boolean;
  /** Filled with a function that renders the save thumbnail from this canvas. */
  thumbnailRef?: MutableRefObject<ThumbnailRenderer | null>;
  /** Extra overlay content (rendered inside the provider, over the canvas). */
  children?: ReactNode;
  className?: string;
  /** Extra classes for the zoom bar panel (e.g. lift it above a mobile toolbar). */
  zoomBarClassName?: string;
  /** Shows a "?" button in the zoom bar. */
  onShowShortcuts?: () => void;
  /** Present mode: the minimap and the zoom bar get out of the way. */
  presenting?: boolean;
}

function minimapColor(node: BoardFlowNode, dark: boolean): string {
  switch (node.data?.type) {
    case 'mind':
      return node.data.meta.depth === 0 ? (node.data.color ?? (dark ? CTA_BLUE : BRAND_NAVY)) : (node.data.meta.branchColor ?? '#CBD5E1');
    case 'sticky':
      return node.data.color ?? DEFAULT_STICKY_COLOR;
    case 'frame':
      return 'rgba(148, 163, 184, 0.25)';
    default:
      return '#CBD5E1';
  }
}

function pointOf(event: unknown): { clientX: number; clientY: number } | null {
  const e = event as { clientX?: number; clientY?: number; changedTouches?: ArrayLike<{ clientX: number; clientY: number }> };
  if (typeof e?.clientX === 'number' && typeof e.clientY === 'number') return { clientX: e.clientX, clientY: e.clientY };
  const t = e?.changedTouches?.[0];
  return t ? { clientX: t.clientX, clientY: t.clientY } : null;
}

const TOOL_KEYS: Record<string, BoardTool> = { v: 'select', n: 'sticky', s: 'shape', t: 'text', c: 'connector', p: 'pen', f: 'frame', i: 'image' };
const ARROWS: Record<string, [number, number]> = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };

function CanvasInner({ readOnly = false, dark: darkOverride, snapToGrid: snapOverride, showMiniMap = true, thumbnailRef, children, className, zoomBarClassName, onShowShortcuts, presenting = false }: BoardCanvasProps) {
  const storeApi = useBoardStoreApi();
  const document = useBoardStore((s) => s.document);
  const selection = useBoardStore((s) => s.selection);
  const measured = useBoardStore((s) => s.measured);
  const updateNodes = useBoardStore((s) => s.updateNodes);
  const updateEdges = useBoardStore((s) => s.updateEdges);
  const activeTool = useBoardStore((s) => s.activeTool);
  const storeSnap = useBoardStore((s) => s.snapToGrid);
  const snapToGrid = snapOverride ?? storeSnap;
  const reactFlow = useReactFlow();
  const flowStore = useFlowStoreApi();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadImage = useImageUpload();

  const dark = darkOverride ?? !!document.theme.dark;
  // Mind-map facts depend on the document only, never on the selection.
  const mind = useMemo(
    () => computeMindMeta(document.nodes, document.edges, document.theme.palette, getMindForest(document.nodes, document.edges)),
    [document.nodes, document.edges, document.theme.palette],
  );
  // Unchanged nodes keep their flow object, so React Flow re-renders only what moved.
  const flowCache = useRef<FlowNodeCache>(new Map()).current;
  // React Flow flags a clicked node as selected on its own internal copy (it mutates it so a
  // second drag does not carry the first node along). When the store then drops that selection
  // in the same batch (a connector click selects the new edge, say), the cached flow node is
  // unchanged, React Flow keeps its internal flag and the node stays drawn as selected while the
  // store has none. `resync` rebuilds such nodes so React Flow adopts the store's answer.
  const [resync, setResync] = useState(0);
  const nodes = useMemo(
    () => toFlowNodes(document.nodes, document.edges, { selection, measured, readOnly, mind, cache: flowCache }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [document.nodes, document.edges, selection, measured, readOnly, mind, flowCache, resync],
  );
  useEffect(() => {
    let stale = false;
    for (const node of nodes) {
      if (!node.selected && reactFlow.getInternalNode(node.id)?.selected) {
        flowCache.delete(node.id);
        stale = true;
      }
    }
    if (stale) setResync((n) => n + 1);
  }, [nodes, reactFlow, flowCache]);
  const edges = useMemo(
    () => toFlowEdges(document.edges, document.nodes, { selection, measured, readOnly, mind }),
    [document.edges, document.nodes, selection, measured, readOnly, mind],
  );

  // Present mode dims what is not on the current slide.
  const presentFocus = useBoardStore((s) => s.presentFocus);
  const shownNodes = useMemo(() => {
    if (!presentFocus) return nodes;
    const keep = new Set(presentFocus);
    return nodes.map((n) => (keep.has(n.id) ? n : { ...n, className: cn(n.className, 'board-dimmed') }));
  }, [nodes, presentFocus]);
  const shownEdges = useMemo(() => {
    if (!presentFocus) return edges;
    const keep = new Set(presentFocus);
    return edges.map((e) => (keep.has(e.source) && keep.has(e.target) ? e : { ...e, className: cn(e.className, 'board-dimmed') }));
  }, [edges, presentFocus]);

  const autoLayout = useAutoLayout(storeApi, reactFlow);
  // Registered before the generic key handler below, so mind keys win.
  useMindmapKeyboard(storeApi, { readOnly, containerRef: wrapperRef });
  useShiftTracking();
  const [contextMenu, setContextMenu] = useState<MindContextMenuState | null>(null);
  const [canvasMenu, setCanvasMenu] = useState<CanvasContextMenuState | null>(null);
  const [dropActive, setDropActive] = useState(false);

  // What the camera and the DOM know about sizes: React Flow's measurements are
  // fresher than the store's copy right after a layout.
  const measuredSizes = useCallback(() => {
    const sizes: Record<string, { width: number; height: number }> = { ...storeApi.getState().measured };
    for (const node of reactFlow.getNodes()) {
      if (node.measured?.width && node.measured?.height) sizes[node.id] = { width: node.measured.width, height: node.measured.height };
    }
    return sizes;
  }, [reactFlow, storeApi]);

  // Frames everything: nodes, frames and pen strokes (React Flow's own fitView only knows nodes).
  const fitContent = useCallback(
    (opts?: { duration?: number }) => {
      const bounds = boardContentBounds(storeApi.getState().document, { sizes: measuredSizes() });
      if (!bounds) return;
      frameBox(reactFlow, flowStore.getState(), bounds, {
        padding: FIT_VIEW_OPTIONS.padding,
        maxZoom: FIT_VIEW_OPTIONS.maxZoom,
        duration: opts?.duration ?? FIT_VIEW_OPTIONS.duration,
      });
    },
    [flowStore, measuredSizes, reactFlow, storeApi],
  );

  const renderImage = useCallback(
    async ({ format, frameId }: { format: 'png' | 'svg'; frameId?: string | null }) => {
      const viewportEl = wrapperRef.current?.querySelector<HTMLElement>('.react-flow__viewport');
      if (!viewportEl) throw new Error('The board is not ready yet');
      const state = storeApi.getState();
      const sizes = measuredSizes();
      const region = exportRegion(state.document, sizes, frameId);
      // Selection rings and a culled (offscreen) part of a big board must not end up in the picture.
      const selection = state.selection;
      const camera = reactFlow.getViewport();
      const culled = state.document.nodes.length > CULL_THRESHOLD;
      state.clearSelection();
      if (culled && region) await reactFlow.fitBounds({ x: region.x, y: region.y, width: region.w, height: region.h }, { padding: 0, duration: 0 });
      await new Promise((resolve) => window.setTimeout(resolve, culled ? 250 : 60));
      try {
        return await renderBoardImage({
          viewportEl,
          document: storeApi.getState().document,
          measured: sizes,
          format,
          frameId,
          background: dark ? BOARD_BACKGROUND.dark : BOARD_BACKGROUND.light,
        });
      } finally {
        if (culled) void reactFlow.setViewport(camera);
        // Put the selection back only if nobody changed it while the image rendered
        // (a click, or present mode starting, must not be undone by a late restore).
        const now = storeApi.getState().selection;
        if ((selection.nodeIds.length || selection.edgeIds.length) && now.nodeIds.length === 0 && now.edgeIds.length === 0) {
          storeApi.getState().select(selection);
        }
      }
    },
    [dark, measuredSizes, reactFlow, storeApi],
  );

  // Camera helpers for the panels, the keyboard and imports.
  useEffect(() => {
    storeApi.getState().setCanvasApi({
      focusNode: (id, opts) => {
        const node = reactFlow.getInternalNode(id);
        const el = wrapperRef.current;
        if (!node || !el) return;
        const w = node.measured?.width ?? node.width ?? 160;
        const h = node.measured?.height ?? node.height ?? 44;
        const pos = node.internals.positionAbsolute;
        const cx = pos.x + w / 2;
        const cy = pos.y + h / 2;
        const { x, y, zoom } = reactFlow.getViewport();
        if (opts?.ifOffscreen) {
          const rect = el.getBoundingClientRect();
          const margin = 48;
          const left = pos.x * zoom + x;
          const top = pos.y * zoom + y;
          const inside = left >= margin && top >= margin && left + w * zoom <= rect.width - margin && top + h * zoom <= rect.height - margin;
          if (inside) return;
        }
        void reactFlow.setCenter(cx, cy, { zoom, duration: 250 });
      },
      getViewportCenter: () => {
        const rect = wrapperRef.current?.getBoundingClientRect();
        if (!rect) return { x: 0, y: 0 };
        return reactFlow.screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
      },
      fitContent,
      renderImage,
    });
    return () => storeApi.getState().setCanvasApi(null);
  }, [fitContent, reactFlow, renderImage, storeApi]);

  // ---------------------------------------------------------------------------
  // Images: file picker (Image tool), drop and paste.

  const placeImage = useCallback(
    async (file: File, at?: { x: number; y: number }) => {
      const point = at ?? storeApi.getState().canvasApi?.getViewportCenter() ?? { x: 0, y: 0 };
      const image = await uploadImage(file);
      if (image) addImageNode(storeApi, point, image);
    },
    [storeApi, uploadImage],
  );

  useEffect(() => {
    if (readOnly || activeTool !== 'image') return;
    fileInputRef.current?.click();
    storeApi.getState().setActiveTool('select');
  }, [activeTool, readOnly, storeApi]);

  const handleDragOver = useCallback(
    (event: ReactDragEvent) => {
      if (readOnly || !Array.from(event.dataTransfer.types).includes('Files')) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
      setDropActive(true);
    },
    [readOnly],
  );
  const handleDrop = useCallback(
    (event: ReactDragEvent) => {
      setDropActive(false);
      if (readOnly) return;
      const file = firstImageFile(event.dataTransfer);
      if (!file) return;
      event.preventDefault();
      void placeImage(file, reactFlow.screenToFlowPosition({ x: event.clientX, y: event.clientY }));
    },
    [placeImage, reactFlow, readOnly],
  );

  // ---------------------------------------------------------------------------
  // Pointer: tools, clicks, context menus.

  // Mind map tool: a click (or double-click) on empty canvas starts a new map there.
  const createMapAt = useCallback(
    (clientX: number, clientY: number) => {
      const point = reactFlow.screenToFlowPosition({ x: clientX, y: clientY });
      createRootAt(storeApi, point);
      storeApi.getState().setActiveTool('select');
    },
    [reactFlow, storeApi],
  );
  const handlePaneClick = useCallback(
    (event: ReactMouseEvent) => {
      setContextMenu(null);
      setCanvasMenu(null);
      const state = storeApi.getState();
      if (readOnly) {
        state.clearSelection();
        return;
      }
      if (state.activeTool === 'mind') createMapAt(event.clientX, event.clientY);
      else if (state.activeTool === 'connector') state.setConnectorSource(null);
    },
    [createMapAt, readOnly, storeApi],
  );
  const handleDoubleClick = useCallback(
    (event: ReactMouseEvent) => {
      if (readOnly || !(event.target instanceof Element) || !event.target.classList.contains('react-flow__pane')) return;
      if (storeApi.getState().activeTool === 'mind') createMapAt(event.clientX, event.clientY);
    },
    [createMapAt, readOnly, storeApi],
  );
  const handleNodeClick = useCallback(
    (_event: ReactMouseEvent, node: Node) => {
      const state = storeApi.getState();
      // The read-only viewer has no React Flow selection; keep one for keyboard navigation.
      if (readOnly) {
        if (node.type === 'mind') state.select({ nodeIds: [node.id], edgeIds: [] });
        return;
      }
      if (state.activeTool === 'connector') {
        const source = state.connectorSourceId;
        if (!source) state.setConnectorSource(node.id);
        else if (source !== node.id) {
          connectNodes(storeApi, source, node.id);
          state.setActiveTool('select');
        }
      }
    },
    [readOnly, storeApi],
  );
  const openNodeMenu = useCallback(
    (nodeId: string, x: number, y: number) => {
      const state = storeApi.getState();
      const node = state.document.nodes.find((n) => n.id === nodeId);
      if (!node) return;
      if (node.data.type === 'mind') {
        state.select({ nodeIds: [nodeId], edgeIds: [] });
        setContextMenu({ nodeId, x, y });
        return;
      }
      if (!state.selection.nodeIds.includes(nodeId)) state.select({ nodeIds: [nodeId], edgeIds: [] });
      setCanvasMenu({ kind: 'node', id: nodeId, x, y });
    },
    [storeApi],
  );
  const openEdgeMenu = useCallback(
    (edgeId: string, x: number, y: number) => {
      const state = storeApi.getState();
      const edge = state.document.edges.find((e) => e.id === edgeId);
      if (!edge || edge.kind !== 'connector') return;
      state.select({ nodeIds: [], edgeIds: [edgeId] });
      setCanvasMenu({ kind: 'edge', id: edgeId, x, y });
    },
    [storeApi],
  );
  const handleNodeContextMenu = useCallback(
    (event: ReactMouseEvent, node: Node) => {
      if (readOnly) return;
      event.preventDefault();
      openNodeMenu(node.id, event.clientX, event.clientY);
    },
    [openNodeMenu, readOnly],
  );
  const handleEdgeContextMenu = useCallback(
    (event: ReactMouseEvent, edge: Edge) => {
      if (readOnly || edge.type !== 'connector') return;
      event.preventDefault();
      openEdgeMenu(edge.id, event.clientX, event.clientY);
    },
    [openEdgeMenu, readOnly],
  );
  const handleEdgeDoubleClick = useCallback(
    (event: ReactMouseEvent, edge: Edge) => {
      if (readOnly || edge.type !== 'connector') return;
      event.stopPropagation();
      storeApi.getState().select({ nodeIds: [], edgeIds: [edge.id] });
      storeApi.getState().setEditingEdge(edge.id);
    },
    [readOnly, storeApi],
  );

  // Touch: a long press opens the context menu of the node or connector under the finger.
  const longPress = useRef<{ timer: number; x: number; y: number } | null>(null);
  const cancelLongPress = useCallback(() => {
    if (longPress.current) window.clearTimeout(longPress.current.timer);
    longPress.current = null;
  }, []);
  const handlePointerDownCapture = useCallback(
    (event: React.PointerEvent) => {
      if (readOnly || event.pointerType !== 'touch' || !event.isPrimary) {
        cancelLongPress();
        return;
      }
      const target = event.target instanceof Element ? event.target : null;
      const nodeEl = target?.closest('.react-flow__node');
      const edgeEl = target?.closest('.react-flow__edge');
      if (!nodeEl && !edgeEl) return;
      const { clientX, clientY } = event;
      cancelLongPress();
      longPress.current = {
        x: clientX,
        y: clientY,
        timer: window.setTimeout(() => {
          longPress.current = null;
          const id = (nodeEl ?? edgeEl)?.getAttribute('data-id');
          if (!id) return;
          if (nodeEl) openNodeMenu(id, clientX, clientY);
          else openEdgeMenu(id, clientX, clientY);
        }, LONG_PRESS_MS),
      };
    },
    [cancelLongPress, openEdgeMenu, openNodeMenu, readOnly],
  );
  const handlePointerMoveCapture = useCallback(
    (event: React.PointerEvent) => {
      const lp = longPress.current;
      if (lp && Math.hypot(event.clientX - lp.x, event.clientY - lp.y) > 10) cancelLongPress();
    },
    [cancelLongPress],
  );

  // Connectors: drag from a handle and release on another node (anywhere on it).
  const handleConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent, state: FinalConnectionState) => {
      if (readOnly) return;
      const from = state.fromNode?.id;
      if (!from) return;
      let to = state.toNode?.id ?? null;
      if (!to) {
        const p = pointOf(event);
        const el = p ? window.document.elementFromPoint(p.clientX, p.clientY)?.closest('.react-flow__node') : null;
        to = el?.getAttribute('data-id') ?? null;
      }
      if (to && to !== from) connectNodes(storeApi, from, to);
    },
    [readOnly, storeApi],
  );

  // ---------------------------------------------------------------------------
  // Dragging: alignment guides (snap to other nodes' edges and centres) and
  // frame membership on drop.

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      if (!readOnly) {
        const drags = changes.filter((c): c is Extract<NodeChange, { type: 'position' }> => c.type === 'position' && !!c.dragging && !!c.position);
        const state = storeApi.getState();
        if (drags.length && !state.snapToGrid && snapOverride === undefined) {
          const doc = state.document;
          const byId = indexNodes(doc.nodes);
          const moving = drags.map((c) => byId.get(c.id));
          if (moving.every((n) => n && n.data.type !== 'mind')) {
            const boxes: Box[] = drags.map((c) => {
              const node = byId.get(c.id)!;
              const parent = node.parentId ? byId.get(node.parentId) : undefined;
              const origin = parent ? absolutePosition(byId, parent) : { x: 0, y: 0 };
              const size = nodeSize(node, state.measured);
              return { x: origin.x + c.position!.x, y: origin.y + c.position!.y, w: size.w, h: size.h };
            });
            const union = unionBox(boxes)!;
            const excluded = collectDescendants(doc, drags.map((c) => c.id));
            const { zoom } = reactFlow.getViewport();
            const margin = 400 / zoom;
            const others: Box[] = [];
            for (const node of doc.nodes) {
              if (excluded.has(node.id) || mind.hidden.has(node.id)) continue;
              const b = absoluteBox(byId, node, state.measured);
              // Only nodes near the drag are candidates (keeps big boards fast).
              if (b.x > union.x + union.w + margin || b.x + b.w < union.x - margin || b.y > union.y + union.h + margin || b.y + b.h < union.y - margin) continue;
              others.push(b);
            }
            const snap = computeSnap(union, others, SNAP_PX / zoom);
            guidesSignal.set(snap.lines);
            if (snap.dx || snap.dy) {
              const ids = new Set(drags.map((c) => c.id));
              changes = changes.map((c) =>
                c.type === 'position' && ids.has(c.id) && c.position ? { ...c, position: { x: c.position.x + snap.dx, y: c.position.y + snap.dy } } : c,
              );
            }
          }
        } else if (changes.some((c) => c.type === 'position' && c.dragging === false)) {
          clearGuides();
        }
      }
      updateNodes(changes);
    },
    [mind.hidden, reactFlow, readOnly, snapOverride, storeApi, updateNodes],
  );

  const handleNodeDragStop = useCallback(
    (event: MouseEvent | TouchEvent, node: Node, dragged: Node[]) => {
      clearGuides();
      // Inside the drag's undo step (opened by onNodeDragStart).
      finishCanvasDrag(storeApi, (dragged.length ? dragged : [node]).map((n) => n.id));
      autoLayout.onNodeDragStop(event, node, dragged);
    },
    [autoLayout, storeApi],
  );
  const handleSelectionDragStart = useCallback(() => {
    storeApi.getState().beginBatch();
    autoLayout.onSelectionDragStart();
  }, [autoLayout, storeApi]);
  const handleSelectionDragStop = useCallback(
    (_event: unknown, dragged: Node[]) => {
      clearGuides();
      finishCanvasDrag(storeApi, dragged.map((n) => n.id));
      autoLayout.onSelectionDragStop();
      storeApi.getState().endBatch();
    },
    [autoLayout, storeApi],
  );

  // Open where the board was left; a board never opened before fits its content.
  // The read-only viewer always fits (the saved camera is the editor's screen).
  // Read once: later viewport writes must not move the camera.
  const initialViewport = useRef(readOnly ? null : storeApi.getState().viewport).current;
  // Nothing to fit on an empty board (the camera would otherwise jump to the
  // first node placed). Content includes pen strokes, so React Flow's own
  // `fitView` (nodes only) is not used; the fit runs once the nodes are measured.
  const fitOnOpen = useRef(!initialViewport && (storeApi.getState().document.nodes.length > 0 || storeApi.getState().document.strokes.length > 0)).current;
  const nodesInitialized = useNodesInitialized();
  const didInitialFit = useRef(false);
  useEffect(() => {
    if (!fitOnOpen || didInitialFit.current) return;
    if (storeApi.getState().document.nodes.length > 0 && !nodesInitialized) return;
    didInitialFit.current = true;
    // After the measured pass has settled the map layout.
    const frame = requestAnimationFrame(() => fitContent({ duration: 0 }));
    return () => cancelAnimationFrame(frame);
  }, [fitContent, fitOnOpen, nodesInitialized, storeApi]);

  // Camera -> store, throttled (the store bumps viewportVersion for autosave).
  // Moves without a DOM event (the initial fit, the zoom bar) are remembered
  // silently: they ride along with the next save instead of causing one.
  const pendingViewport = useRef<{ viewport: Viewport; silent: boolean } | null>(null);
  const viewportTimer = useRef<number | null>(null);
  const flushViewport = useCallback(() => {
    viewportTimer.current = null;
    const pending = pendingViewport.current;
    pendingViewport.current = null;
    if (pending) storeApi.getState().setViewport(pending.viewport, { silent: pending.silent });
  }, [storeApi]);
  const queueViewport = useCallback((event: unknown, viewport: Viewport) => {
    const silent = !event && (pendingViewport.current?.silent ?? true);
    pendingViewport.current = { viewport, silent };
  }, []);
  const handleMove = useCallback((event: MouseEvent | TouchEvent | null, viewport: Viewport) => {
    queueViewport(event, viewport);
    if (viewportTimer.current === null) viewportTimer.current = window.setTimeout(flushViewport, VIEWPORT_THROTTLE_MS);
  }, [flushViewport, queueViewport]);
  const handleMoveEnd = useCallback((event: MouseEvent | TouchEvent | null, viewport: Viewport) => {
    if (viewportTimer.current !== null) window.clearTimeout(viewportTimer.current);
    queueViewport(event, viewport);
    flushViewport();
  }, [flushViewport, queueViewport]);
  useEffect(() => () => {
    if (viewportTimer.current !== null) window.clearTimeout(viewportTimer.current);
  }, []);

  // ---------------------------------------------------------------------------
  // Keyboard and clipboard (React Flow's own delete key is off).

  useEffect(() => {
    if (readOnly) return;
    // Focus in a dialog/menu portaled outside the canvas: leave keys alone.
    const inOverlay = () => {
      const active = window.document.activeElement;
      if (!active || active === window.document.body || (wrapperRef.current && wrapperRef.current.contains(active))) return false;
      return !!active.closest('[role="dialog"], [role="menu"], [role="alertdialog"]');
    };
    const blocked = (event: Event) => isTypingTarget(event.target) || inOverlay() || storeApi.getState().editingNodeId !== null || storeApi.getState().editingEdgeId !== null;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || isTypingTarget(event.target) || inOverlay()) return;
      const mod = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      const state = storeApi.getState();
      if (state.editingNodeId !== null || state.editingEdgeId !== null) return;
      if (!mod && (event.key === 'Delete' || event.key === 'Backspace')) {
        event.preventDefault();
        state.removeSelection();
      } else if (mod && key === 'z' && !event.shiftKey) {
        event.preventDefault();
        state.undo();
      } else if (mod && ((key === 'z' && event.shiftKey) || key === 'y')) {
        event.preventDefault();
        state.redo();
      } else if (mod && key === 'd') {
        event.preventDefault();
        duplicateSelection(storeApi);
      } else if (mod && key === 'a') {
        event.preventDefault();
        state.select({ nodeIds: state.document.nodes.filter((n) => !mind.hidden.has(n.id)).map((n) => n.id), edgeIds: [] });
      } else if (!mod && !event.altKey && ARROWS[event.key]) {
        const [dx, dy] = ARROWS[event.key];
        const step = event.shiftKey ? 10 : 1;
        if (nudgeSelection(storeApi, dx * step, dy * step)) event.preventDefault();
      } else if (!mod && !event.altKey && key === 'm') {
        state.setActiveTool(state.activeTool === 'mind' ? 'select' : 'mind');
      } else if (!mod && !event.altKey && TOOL_KEYS[key]) {
        const tool = TOOL_KEYS[key];
        state.setActiveTool(state.activeTool === tool && tool !== 'select' ? 'select' : tool);
      } else if (key === 'escape') {
        if (state.connectorSourceId) state.setConnectorSource(null);
        else if (state.activeTool !== 'select') state.setActiveTool('select');
        else state.clearSelection();
      }
    };
    const onCopy = (event: ClipboardEvent) => {
      if (blocked(event)) return;
      const text = copySelection(storeApi);
      if (!text) return;
      event.clipboardData?.setData('text/plain', text);
      event.preventDefault();
    };
    const onCut = (event: ClipboardEvent) => {
      if (blocked(event)) return;
      const text = cutSelection(storeApi);
      if (!text) return;
      event.clipboardData?.setData('text/plain', text);
      event.preventDefault();
    };
    // Runs after the mind map's paste (which turns text into a branch of the selected topic).
    const onPaste = (event: ClipboardEvent) => {
      if (event.defaultPrevented || blocked(event)) return;
      const text = event.clipboardData?.getData('text/plain') ?? '';
      const clip = parseClipboard(text);
      if (clip) {
        event.preventDefault();
        pasteContent(storeApi, clip);
        return;
      }
      const file = firstImageFile(event.clipboardData);
      if (file) {
        event.preventDefault();
        void placeImage(file);
        return;
      }
      if (text.trim()) {
        event.preventDefault();
        const center = storeApi.getState().canvasApi?.getViewportCenter() ?? { x: 0, y: 0 };
        createCanvasNode(storeApi, 'text', { at: center }, { data: { text: text.slice(0, 2_000) } });
        return;
      }
      if (getMemoryClipboard()) {
        event.preventDefault();
        pasteContent(storeApi);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('copy', onCopy);
    window.addEventListener('cut', onCut);
    window.addEventListener('paste', onPaste);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('copy', onCopy);
      window.removeEventListener('cut', onCut);
      window.removeEventListener('paste', onPaste);
    };
  }, [mind.hidden, placeImage, readOnly, storeApi]);

  useEffect(() => {
    if (!thumbnailRef) return;
    thumbnailRef.current = () =>
      createBoardThumbnail({
        viewportEl: wrapperRef.current?.querySelector<HTMLElement>('.react-flow__viewport') ?? null,
        bounds: boardContentBounds(storeApi.getState().document, { sizes: measuredSizes() }),
        background: dark ? BOARD_BACKGROUND.dark : BOARD_BACKGROUND.light,
      });
    return () => {
      thumbnailRef.current = null;
    };
  }, [dark, measuredSizes, storeApi, thumbnailRef]);

  const background = document.theme.background;
  const variant = background === 'grid' ? BackgroundVariant.Lines : BackgroundVariant.Dots;
  const creating = !readOnly && CREATION_TOOLS.has(activeTool);
  const drawing = !readOnly && activeTool === 'pen';
  const connecting = !readOnly && activeTool === 'connector';

  return (
    <div
      ref={wrapperRef}
      className={cn(
        'board-surface relative h-full w-full',
        dark && 'board-dark',
        autoLayout.animate && 'board-animate',
        !readOnly && activeTool === 'mind' && 'board-tool-mind',
        connecting && 'board-tool-connector',
        readOnly && 'board-readonly',
        dropActive && 'board-drop-active',
        className,
      )}
      onDoubleClick={handleDoubleClick}
      onDragOver={handleDragOver}
      onDragLeave={() => setDropActive(false)}
      onDrop={handleDrop}
      onPointerDownCapture={handlePointerDownCapture}
      onPointerMoveCapture={handlePointerMoveCapture}
      onPointerUpCapture={cancelLongPress}
      onPointerCancelCapture={cancelLongPress}
      data-testid="board-canvas"
      data-tool={activeTool}
    >
      <ReactFlow
        nodes={shownNodes}
        edges={shownEdges}
        nodeTypes={boardNodeTypes}
        edgeTypes={boardEdgeTypes}
        onNodesChange={handleNodesChange}
        onEdgesChange={updateEdges}
        onMove={handleMove}
        onMoveEnd={handleMoveEnd}
        onPaneClick={handlePaneClick}
        onNodeClick={handleNodeClick}
        onNodeContextMenu={handleNodeContextMenu}
        onEdgeContextMenu={handleEdgeContextMenu}
        onEdgeDoubleClick={handleEdgeDoubleClick}
        onNodeDragStart={autoLayout.onNodeDragStart}
        onNodeDrag={autoLayout.onNodeDrag}
        onNodeDragStop={handleNodeDragStop}
        onSelectionDragStart={handleSelectionDragStart}
        onSelectionDragStop={handleSelectionDragStop}
        onConnectEnd={handleConnectEnd}
        // Arrow keys navigate the mind map / nudge instead of React Flow's own moves.
        disableKeyboardA11y
        colorMode={dark ? 'dark' : 'light'}
        defaultViewport={initialViewport ?? undefined}
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        onlyRenderVisibleElements={nodes.length > CULL_THRESHOLD}
        // Miro-like navigation: scroll pans, pinch / ctrl+wheel zooms, drag on
        // empty space box-selects, space+drag or middle/right mouse pans. The
        // read-only viewer drags to pan instead.
        panOnScroll
        zoomOnPinch
        zoomOnScroll={false}
        zoomOnDoubleClick={false}
        selectionOnDrag={!readOnly}
        panOnDrag={readOnly ? true : [1, 2]}
        selectionMode={SelectionMode.Partial}
        multiSelectionKeyCode={['Shift', 'Meta', 'Control']}
        deleteKeyCode={null}
        nodesDraggable={!readOnly && !connecting}
        nodesConnectable={!readOnly}
        connectionRadius={28}
        elementsSelectable={!readOnly}
        edgesFocusable={!readOnly}
        nodesFocusable={!readOnly}
        connectionMode={ConnectionMode.Loose}
        snapToGrid={snapToGrid}
        snapGrid={[16, 16]}
        attributionPosition="bottom-center"
      >
        {background !== 'plain' && (
          <Background
            variant={variant}
            gap={variant === BackgroundVariant.Dots ? 20 : 32}
            size={variant === BackgroundVariant.Dots ? 1.5 : 1}
            color={dark ? (variant === BackgroundVariant.Dots ? '#334155' : '#1e293b') : variant === BackgroundVariant.Dots ? '#cbd5e1' : '#eef2f7'}
          />
        )}
        <StrokesLayer strokes={document.strokes} />
        {!readOnly && <GuidesLayer />}
        {creating && <CreationOverlay tool={activeTool as CreationTool} containerRef={wrapperRef} />}
        {drawing && <PenOverlay containerRef={wrapperRef} />}
        {showMiniMap && !presenting && (
          <MiniMap
            position="bottom-right"
            pannable
            zoomable
            nodeColor={(node) => minimapColor(node as BoardFlowNode, dark)}
            nodeStrokeColor={EDGE_NEUTRAL}
            nodeBorderRadius={6}
            maskColor={dark ? 'rgba(15, 23, 42, 0.7)' : 'rgba(241, 245, 249, 0.7)'}
            className="!hidden sm:!block !rounded-xl !border !border-[var(--board-frame-border)] !bg-[var(--board-bg)] !shadow-md overflow-hidden"
            ariaLabel="Board overview"
          />
        )}
        {!presenting && (
          <Panel position="bottom-left" className={zoomBarClassName}>
            <ZoomBar showHistory={!readOnly} showSnap={!readOnly && snapOverride === undefined} onShowShortcuts={onShowShortcuts} />
          </Panel>
        )}
        {children}
      </ReactFlow>
      {!readOnly && (
        <>
          <MindContextMenu menu={contextMenu} onClose={() => setContextMenu(null)} />
          <CanvasContextMenu menu={canvasMenu} onClose={() => setCanvasMenu(null)} />
          <input
            ref={fileInputRef}
            type="file"
            accept={BOARD_IMAGE_ACCEPT}
            className="hidden"
            data-testid="board-image-input"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) void placeImage(file);
            }}
          />
        </>
      )}
    </div>
  );
}

export function BoardCanvas(props: BoardCanvasProps) {
  return (
    <ReactFlowProvider>
      <TooltipProvider delayDuration={300}>
        <CanvasInner {...props} />
      </TooltipProvider>
    </ReactFlowProvider>
  );
}
