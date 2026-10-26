import { ViewportPortal } from '@xyflow/react';
import { guidesSignal, useSignal } from '../../canvas/interaction';

const GUIDE_COLOR = '#F43F5E';

// Alignment guides while dragging (computed in BoardCanvas' drag handler).
// Subscribes on its own so the lines never re-render the canvas.
export function GuidesLayer() {
  const lines = useSignal(guidesSignal);
  if (!lines.length) return null;
  return (
    <ViewportPortal>
      <svg width={1} height={1} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none' }} data-testid="board-guides">
        {lines.map((l, i) =>
          l.orientation === 'v' ? (
            <line key={i} x1={l.pos} x2={l.pos} y1={l.from} y2={l.to} stroke={GUIDE_COLOR} strokeWidth={1} vectorEffect="non-scaling-stroke" data-testid="board-guide" />
          ) : (
            <line key={i} y1={l.pos} y2={l.pos} x1={l.from} x2={l.to} stroke={GUIDE_COLOR} strokeWidth={1} vectorEffect="non-scaling-stroke" data-testid="board-guide" />
          ),
        )}
      </svg>
    </ViewportPortal>
  );
}
