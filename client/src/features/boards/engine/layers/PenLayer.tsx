import { memo, useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { ViewportPortal, useReactFlow } from '@xyflow/react';
import { getStroke } from 'perfect-freehand';
import type { BoardStroke } from '@shared/schema/boards';
import { appendStrokePoint, hitStrokes, strokeToPoints } from '@shared/boards/strokes';
import { createBoardId } from '@shared/boards/document';
import { useBoardStore, useBoardStoreApi } from '../../store/boardStore';
import { forwardWheel } from '../../canvas/interaction';

// Pen strokes live in board coordinates (document.strokes) and are drawn in
// an SVG inside React Flow's viewport (ViewportPortal), so they pan and zoom
// with the nodes. The stroke being drawn has its own layer; the overlay that
// captures the pointer only exists while the pen tool is active.

function svgPath(outline: number[][]): string {
  if (!outline.length) return '';
  const d = outline.reduce<(string | number)[]>(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length];
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
      return acc;
    },
    ['M', ...outline[0], 'Q'],
  );
  d.push('Z');
  return d.map((v) => (typeof v === 'number' ? Math.round(v * 100) / 100 : v)).join(' ');
}

function outlineOf(points: number[], size: number, simulatePressure: boolean) {
  return getStroke(strokeToPoints({ points }), { size, thinning: 0.55, smoothing: 0.5, streamline: 0.45, simulatePressure, last: true });
}

// Pressure varies only with a real pen: mouse and touch strokes simulate it.
function hasRealPressure(points: number[]) {
  for (let i = 2; i < points.length; i += 3) if (points[i] !== 0.5) return true;
  return false;
}

const pathCache = new WeakMap<BoardStroke, string>();
export function strokePath(stroke: BoardStroke): string {
  let d = pathCache.get(stroke);
  if (d === undefined) {
    d = svgPath(outlineOf(stroke.points, stroke.size ?? 4, !hasRealPressure(stroke.points)));
    pathCache.set(stroke, d);
  }
  return d;
}

const SVG_STYLE = { position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none' } as const;

/** Completed strokes (editor and viewer). */
export const StrokesLayer = memo(function StrokesLayer({ strokes }: { strokes: BoardStroke[] }) {
  if (!strokes.length) return null;
  return (
    <ViewportPortal>
      <svg width={1} height={1} style={SVG_STYLE} className="board-strokes" data-testid="board-strokes">
        {strokes.map((s) => (
          <path key={s.id} d={strokePath(s)} fill={s.color ?? '#0A162E'} data-testid="board-stroke" data-stroke-id={s.id} />
        ))}
      </svg>
    </ViewportPortal>
  );
});

/** Captures the pointer while the pen tool is active: draws, or erases whole strokes. */
export function PenOverlay({ containerRef }: { containerRef: React.RefObject<HTMLElement> }) {
  const store = useBoardStoreApi();
  const pen = useBoardStore((s) => s.pen);
  const strokes = useBoardStore((s) => s.document.strokes);
  const reactFlow = useReactFlow();
  const active = useRef<{ pointerId: number; points: number[]; pen: boolean } | null>(null);
  const [, setTick] = useState(0);
  const frame = useRef(0);
  const [hover, setHover] = useState<string | null>(null);
  // The pointer erasing right now (its strokes removed as one undo step); null when not erasing.
  const erasing = useRef<number | null>(null);
  // The overlay goes away mid-erase (tool switched): close the batch it opened.
  useEffect(
    () => () => {
      if (erasing.current !== null) {
        erasing.current = null;
        store.getState().endBatch();
      }
    },
    [store],
  );

  const redraw = useCallback(() => {
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      setTick((t) => t + 1);
    });
  }, []);

  const toFlow = (e: { clientX: number; clientY: number }) => reactFlow.screenToFlowPosition({ x: e.clientX, y: e.clientY });
  const tolerance = () => 6 / reactFlow.getViewport().zoom;

  const eraseAt = (e: { clientX: number; clientY: number }) => {
    const hits = hitStrokes(store.getState().document.strokes, toFlow(e), tolerance());
    if (hits.length) store.getState().removeStrokes(hits);
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    // A second finger cancels the stroke in progress; while erasing it is ignored
    // (the first pointer keeps erasing in the same batch).
    if (erasing.current !== null) return;
    if (active.current) {
      active.current = null;
      redraw();
      return;
    }
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    if (pen.mode === 'erase') {
      erasing.current = e.pointerId;
      store.getState().beginBatch();
      eraseAt(e);
      return;
    }
    const p = toFlow(e);
    const points: number[] = [];
    appendStrokePoint(points, p.x, p.y, e.pointerType === 'pen' ? e.pressure : 0.5);
    active.current = { pointerId: e.pointerId, points, pen: e.pointerType === 'pen' };
    redraw();
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (pen.mode === 'erase') {
      if (erasing.current !== null) {
        if (erasing.current === e.pointerId) eraseAt(e);
      } else {
        const hits = hitStrokes(store.getState().document.strokes, toFlow(e), tolerance());
        setHover(hits[hits.length - 1] ?? null);
      }
      return;
    }
    const stroke = active.current;
    if (!stroke || stroke.pointerId !== e.pointerId) return;
    const events = typeof e.nativeEvent.getCoalescedEvents === 'function' ? e.nativeEvent.getCoalescedEvents() : [];
    const zoom = reactFlow.getViewport().zoom;
    for (const ev of events.length ? events : [e.nativeEvent]) {
      const p = toFlow(ev);
      appendStrokePoint(stroke.points, p.x, p.y, stroke.pen ? ev.pressure : 0.5, 1 / zoom);
    }
    redraw();
  };

  const finish = (e: ReactPointerEvent<HTMLDivElement>, keep: boolean) => {
    if (erasing.current !== null) {
      // Only the pointer that started erasing ends the batch.
      if (erasing.current !== e.pointerId) return;
      erasing.current = null;
      store.getState().endBatch();
      return;
    }
    const stroke = active.current;
    if (!stroke || stroke.pointerId !== e.pointerId) return;
    active.current = null;
    if (keep && stroke.points.length >= 3) {
      store.getState().addStroke({ id: createBoardId(), points: stroke.points, color: pen.color, size: pen.size });
    }
    redraw();
  };

  const current = active.current;
  const hovered = hover ? strokes.find((s) => s.id === hover) : undefined;
  return (
    <>
      <div
        className="absolute inset-0 z-[4]"
        style={{ touchAction: 'none', cursor: pen.mode === 'erase' ? 'cell' : 'crosshair' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => finish(e, true)}
        onPointerCancel={(e) => finish(e, false)}
        onPointerLeave={() => setHover(null)}
        onWheel={(e) => forwardWheel(e, containerRef.current)}
        onContextMenu={(e) => e.preventDefault()}
        data-testid="board-pen-overlay"
        data-mode={pen.mode}
      />
      {(current || hovered) && (
        <ViewportPortal>
          <svg width={1} height={1} style={SVG_STYLE} className="board-strokes-active">
            {current && <path d={svgPath(outlineOf(current.points, pen.size, !current.pen))} fill={pen.color} opacity={0.9} />}
            {hovered && <path d={strokePath(hovered)} fill="none" stroke="#F43F5E" strokeWidth={2} vectorEffect="non-scaling-stroke" opacity={0.9} />}
          </svg>
        </ViewportPortal>
      )}
    </>
  );
}
