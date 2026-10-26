import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useBoardStoreApi, type BoardTool } from '../../store/boardStore';
import { createCanvasNode } from '../../canvas/actions';
import { forwardWheel, toolPrefsSignal } from '../../canvas/interaction';

export type CreationTool = Extract<BoardTool, 'sticky' | 'shape' | 'text' | 'frame'>;
export const CREATION_TOOLS = new Set<BoardTool>(['sticky', 'shape', 'text', 'frame']);

const CLICK_SLOP = 4;
const MIN_DRAWN = { shape: 40, frame: 120 } as const;

// While a placement tool is active: a click places the node (sticky, text,
// default-size shape or frame); a drag draws a shape or a frame. The tool then
// goes back to Select; stickies and text open for typing right away.
export function CreationOverlay({ tool, containerRef }: { tool: CreationTool; containerRef: React.RefObject<HTMLElement> }) {
  const store = useBoardStoreApi();
  const reactFlow = useReactFlow();
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const [rect, setRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const drawable = tool === 'shape' || tool === 'frame';

  const local = (e: { clientX: number; clientY: number }) => {
    const box = containerRef.current?.getBoundingClientRect();
    return { x: e.clientX - (box?.left ?? 0), y: e.clientY - (box?.top ?? 0) };
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    if (start.current) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const s = start.current;
    if (!s || s.id !== e.pointerId || !drawable) return;
    const a = local({ clientX: s.x, clientY: s.y });
    const b = local(e);
    setRect({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) });
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const s = start.current;
    if (!s || s.id !== e.pointerId) return;
    start.current = null;
    setRect(null);
    const moved = Math.hypot(e.clientX - s.x, e.clientY - s.y) > CLICK_SLOP;
    const prefs = toolPrefsSignal.get();
    const data = tool === 'sticky' ? { color: prefs.stickyColor } : tool === 'shape' ? { shape: prefs.shapeKind } : undefined;
    const p1 = reactFlow.screenToFlowPosition({ x: s.x, y: s.y });
    let id: string | null;
    if (drawable && moved) {
      const p2 = reactFlow.screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const min = MIN_DRAWN[tool as 'shape' | 'frame'];
      const r = { x: Math.min(p1.x, p2.x), y: Math.min(p1.y, p2.y), w: Math.max(min, Math.abs(p2.x - p1.x)), h: Math.max(min * (tool === 'frame' ? 0.75 : 1), Math.abs(p2.y - p1.y)) };
      id = createCanvasNode(store, tool, { rect: r }, { data });
    } else {
      id = createCanvasNode(store, tool, { at: p1 }, { data, edit: tool === 'sticky' || tool === 'text' });
    }
    store.getState().setActiveTool('select');
    if (id && tool === 'frame') store.getState().setEditingNode(null);
  };

  return (
    <div
      className="absolute inset-0 z-[4]"
      style={{ touchAction: 'none', cursor: 'crosshair' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        start.current = null;
        setRect(null);
      }}
      onWheel={(e) => forwardWheel(e, containerRef.current)}
      onContextMenu={(e) => e.preventDefault()}
      data-testid="board-creation-overlay"
      data-tool={tool}
    >
      {rect && (
        <div
          className="pointer-events-none absolute border-2 border-dashed border-[#5173D6] bg-[#5173D6]/5"
          style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h, borderRadius: tool === 'frame' ? 12 : 4 }}
          data-testid="board-creation-preview"
        />
      )}
    </div>
  );
}
