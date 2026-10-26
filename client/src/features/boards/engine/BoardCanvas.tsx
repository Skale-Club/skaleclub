import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type MutableRefObject, type ReactNode } from 'react';
import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  SelectionMode,
  useReactFlow,
  type Node,
  type Viewport,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './board.css';
import { TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useBoardStore, useBoardStoreApi } from '../store/boardStore';
import { computeMindMeta, toFlowEdges, toFlowNodes, type BoardFlowNode, type FlowNodeCache } from './toFlow';
import { boardNodeTypes } from './nodes';
import { boardEdgeTypes } from './edges';
import { BRAND_NAVY, CTA_BLUE, DEFAULT_STICKY_COLOR, EDGE_NEUTRAL } from './palette';
import { FIT_VIEW_OPTIONS, MAX_ZOOM, MIN_ZOOM, ZoomBar } from '../ui/ZoomBar';
import { createBoardThumbnail } from '../io/thumbnail';
import { getMindForest } from '../mindmap/autoLayout';
import { useAutoLayout } from '../mindmap/useAutoLayout';
import { useMindmapKeyboard } from '../mindmap/useMindmapKeyboard';
import { createRootAt } from '../mindmap/actions';
import { MindContextMenu, type MindContextMenuState } from '../mindmap/MindContextMenu';

// Culling offscreen nodes only pays off on big boards, and it would also drop
// them from the thumbnail (rendered from the DOM), so it kicks in late.
const CULL_THRESHOLD = 300;
const VIEWPORT_THROTTLE_MS = 200;

export const BOARD_BACKGROUND = { light: '#ffffff', dark: '#0f172a' } as const;

export type ThumbnailRenderer = () => Promise<string | null>;

export interface BoardCanvasProps {
  readOnly?: boolean;
  /** Overrides theme.dark (the public viewer's light/dark toggle). */
  dark?: boolean;
  snapToGrid?: boolean;
  showMiniMap?: boolean;
  /** Filled with a function that renders the save thumbnail from this canvas. */
  thumbnailRef?: MutableRefObject<ThumbnailRenderer | null>;
  /** Extra overlay content (rendered inside the provider, over the canvas). */
  children?: ReactNode;
  className?: string;
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
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

function CanvasInner({ readOnly = false, dark: darkOverride, snapToGrid = false, showMiniMap = true, thumbnailRef, children, className }: BoardCanvasProps) {
  const storeApi = useBoardStoreApi();
  const document = useBoardStore((s) => s.document);
  const selection = useBoardStore((s) => s.selection);
  const measured = useBoardStore((s) => s.measured);
  const updateNodes = useBoardStore((s) => s.updateNodes);
  const updateEdges = useBoardStore((s) => s.updateEdges);
  const activeTool = useBoardStore((s) => s.activeTool);
  const reactFlow = useReactFlow();
  const wrapperRef = useRef<HTMLDivElement>(null);

  const dark = darkOverride ?? !!document.theme.dark;
  // Mind-map facts depend on the document only, never on the selection.
  const mind = useMemo(
    () => computeMindMeta(document.nodes, document.edges, document.theme.palette, getMindForest(document.nodes, document.edges)),
    [document.nodes, document.edges, document.theme.palette],
  );
  // Unchanged nodes keep their flow object, so React Flow re-renders only what moved.
  const flowCache = useRef<FlowNodeCache>(new Map()).current;
  const nodes = useMemo(
    () => toFlowNodes(document.nodes, document.edges, { selection, measured, readOnly, mind, cache: flowCache }),
    [document.nodes, document.edges, selection, measured, readOnly, mind, flowCache],
  );
  const edges = useMemo(
    () => toFlowEdges(document.edges, document.nodes, { selection, measured, readOnly, mind }),
    [document.edges, document.nodes, selection, measured, readOnly, mind],
  );

  const autoLayout = useAutoLayout(storeApi, reactFlow);
  // Registered before the generic key handler below, so mind keys win.
  useMindmapKeyboard(storeApi, { readOnly, containerRef: wrapperRef });
  const [contextMenu, setContextMenu] = useState<MindContextMenuState | null>(null);

  // Camera helpers for the panels, the keyboard and imports.
  useEffect(() => {
    storeApi.getState().setCanvasApi({
      focusNode: (id, opts) => {
        const node = reactFlow.getNode(id);
        const el = wrapperRef.current;
        if (!node || !el) return;
        const w = node.measured?.width ?? node.width ?? 160;
        const h = node.measured?.height ?? node.height ?? 44;
        const cx = node.position.x + w / 2;
        const cy = node.position.y + h / 2;
        const { x, y, zoom } = reactFlow.getViewport();
        if (opts?.ifOffscreen) {
          const rect = el.getBoundingClientRect();
          const margin = 48;
          const left = node.position.x * zoom + x;
          const top = node.position.y * zoom + y;
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
    });
    return () => storeApi.getState().setCanvasApi(null);
  }, [reactFlow, storeApi]);

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
      if (readOnly) {
        storeApi.getState().clearSelection();
        return;
      }
      if (storeApi.getState().activeTool === 'mind') createMapAt(event.clientX, event.clientY);
    },
    [createMapAt, readOnly, storeApi],
  );
  const handleDoubleClick = useCallback(
    (event: ReactMouseEvent) => {
      if (readOnly || storeApi.getState().activeTool !== 'mind') return;
      if (!(event.target instanceof Element) || !event.target.classList.contains('react-flow__pane')) return;
      createMapAt(event.clientX, event.clientY);
    },
    [createMapAt, readOnly, storeApi],
  );
  const handleNodeClick = useCallback(
    (_event: ReactMouseEvent, node: Node) => {
      // The read-only viewer has no React Flow selection; keep one for keyboard navigation.
      if (readOnly && node.type === 'mind') storeApi.getState().select({ nodeIds: [node.id], edgeIds: [] });
    },
    [readOnly, storeApi],
  );
  const handleNodeContextMenu = useCallback(
    (event: ReactMouseEvent, node: Node) => {
      if (readOnly || node.type !== 'mind') return;
      event.preventDefault();
      storeApi.getState().select({ nodeIds: [node.id], edgeIds: [] });
      setContextMenu({ nodeId: node.id, x: event.clientX, y: event.clientY });
    },
    [readOnly, storeApi],
  );

  // Open where the board was left; a board never opened before fits its content.
  // The read-only viewer always fits (the saved camera is the editor's screen).
  // Read once: later viewport writes must not move the camera.
  const initialViewport = useRef(readOnly ? null : storeApi.getState().viewport).current;

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

  // Delete / undo / redo go through the store (React Flow's own delete key is off).
  useEffect(() => {
    if (readOnly) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isTypingTarget(event.target)) return;
      // Ignore keys while a dialog/menu (portaled outside the canvas) has focus.
      const active = window.document.activeElement;
      if (active && active !== window.document.body && wrapperRef.current && !wrapperRef.current.contains(active)) {
        if (active.closest('[role="dialog"], [role="menu"], [role="alertdialog"]')) return;
      }
      const mod = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      const state = storeApi.getState();
      if (!mod && (event.key === 'Delete' || event.key === 'Backspace')) {
        event.preventDefault();
        state.removeSelection();
      } else if (mod && key === 'z' && !event.shiftKey) {
        event.preventDefault();
        state.undo();
      } else if (mod && ((key === 'z' && event.shiftKey) || key === 'y')) {
        event.preventDefault();
        state.redo();
      } else if (!mod && !event.altKey && key === 'v') {
        state.setActiveTool('select');
      } else if (!mod && !event.altKey && key === 'm') {
        state.setActiveTool(state.activeTool === 'mind' ? 'select' : 'mind');
      } else if (key === 'escape' && state.editingNodeId === null) {
        if (state.activeTool !== 'select') state.setActiveTool('select');
        else state.clearSelection();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [readOnly, storeApi]);

  useEffect(() => {
    if (!thumbnailRef) return;
    thumbnailRef.current = () =>
      createBoardThumbnail({
        viewportEl: wrapperRef.current?.querySelector<HTMLElement>('.react-flow__viewport') ?? null,
        nodes: reactFlow.getNodes(),
        background: dark ? BOARD_BACKGROUND.dark : BOARD_BACKGROUND.light,
      });
    return () => {
      thumbnailRef.current = null;
    };
  }, [dark, reactFlow, thumbnailRef]);

  const background = document.theme.background;
  const variant = background === 'grid' ? BackgroundVariant.Lines : BackgroundVariant.Dots;

  return (
    <div
      ref={wrapperRef}
      className={cn(
        'board-surface relative h-full w-full',
        dark && 'board-dark',
        autoLayout.animate && 'board-animate',
        !readOnly && activeTool === 'mind' && 'board-tool-mind',
        className,
      )}
      onDoubleClick={handleDoubleClick}
      data-testid="board-canvas"
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={boardNodeTypes}
        edgeTypes={boardEdgeTypes}
        onNodesChange={updateNodes}
        onEdgesChange={updateEdges}
        onMove={handleMove}
        onMoveEnd={handleMoveEnd}
        onPaneClick={handlePaneClick}
        onNodeClick={handleNodeClick}
        onNodeContextMenu={handleNodeContextMenu}
        onNodeDragStart={autoLayout.onNodeDragStart}
        onNodeDrag={autoLayout.onNodeDrag}
        onNodeDragStop={autoLayout.onNodeDragStop}
        onSelectionDragStart={autoLayout.onSelectionDragStart}
        onSelectionDragStop={autoLayout.onSelectionDragStop}
        // Arrow keys navigate the mind map instead of nudging nodes.
        disableKeyboardA11y
        colorMode={dark ? 'dark' : 'light'}
        defaultViewport={initialViewport ?? undefined}
        fitView={!initialViewport}
        fitViewOptions={{ padding: FIT_VIEW_OPTIONS.padding, maxZoom: FIT_VIEW_OPTIONS.maxZoom }}
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
        nodesDraggable={!readOnly}
        nodesConnectable={false}
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
        {showMiniMap && (
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
        <Panel position="bottom-left">
          <ZoomBar showHistory={!readOnly} />
        </Panel>
        {children}
      </ReactFlow>
      {!readOnly && <MindContextMenu menu={contextMenu} onClose={() => setContextMenu(null)} />}
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
