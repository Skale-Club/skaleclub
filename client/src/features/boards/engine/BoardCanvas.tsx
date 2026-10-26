import { useCallback, useEffect, useMemo, useRef, type MutableRefObject, type ReactNode } from 'react';
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
  type Viewport,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './board.css';
import { TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useBoardStore, useBoardStoreApi } from '../store/boardStore';
import { toFlowEdges, toFlowNodes, type BoardFlowNode } from './toFlow';
import { boardNodeTypes } from './nodes';
import { boardEdgeTypes } from './edges';
import { BRAND_NAVY, CTA_BLUE, DEFAULT_STICKY_COLOR, EDGE_NEUTRAL } from './palette';
import { FIT_VIEW_OPTIONS, MAX_ZOOM, MIN_ZOOM, ZoomBar } from '../ui/ZoomBar';
import { createBoardThumbnail } from '../io/thumbnail';

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
      return node.data.meta.depth === 0 ? (dark ? CTA_BLUE : BRAND_NAVY) : '#CBD5E1';
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
  const reactFlow = useReactFlow();
  const wrapperRef = useRef<HTMLDivElement>(null);

  const dark = darkOverride ?? !!document.theme.dark;
  const nodes = useMemo(
    () => toFlowNodes(document.nodes, document.edges, { selection, measured, readOnly }),
    [document.nodes, document.edges, selection, measured, readOnly],
  );
  const edges = useMemo(
    () => toFlowEdges(document.edges, document.nodes, { selection, measured, readOnly }),
    [document.edges, document.nodes, selection, measured, readOnly],
  );

  // Open where the board was left; a board never opened before fits its content.
  // Read once: later viewport writes must not move the camera.
  const initialViewport = useRef(storeApi.getState().viewport).current;

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
      } else if (key === 'escape' && state.editingNodeId === null) {
        state.clearSelection();
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
    <div ref={wrapperRef} className={cn('board-surface relative h-full w-full', dark && 'board-dark', className)} data-testid="board-canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={boardNodeTypes}
        edgeTypes={boardEdgeTypes}
        onNodesChange={updateNodes}
        onEdgesChange={updateEdges}
        onMove={handleMove}
        onMoveEnd={handleMoveEnd}
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
