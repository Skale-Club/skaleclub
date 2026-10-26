import { memo, useLayoutEffect, useRef, useState } from 'react';
import { useBoardStoreApi } from '../../store/boardStore';
import { commitNodeText } from '../../canvas/actions';
import { CanvasNodeShell, cn, useNodeEditing, type BoardNodeProps } from './nodeUtils';

function FrameTitleEditor({ id, initial }: { id: string; initial: string }) {
  const store = useBoardStoreApi();
  const [value, setValue] = useState(initial);
  const ref = useRef<HTMLInputElement>(null);
  const done = useRef(false);
  useLayoutEffect(() => {
    ref.current?.focus({ preventScroll: true });
    ref.current?.select();
  }, []);
  const commit = () => {
    if (done.current) return;
    done.current = true;
    commitNodeText(store, id, { title: value.trim().slice(0, 200) || 'Frame' });
  };
  return (
    <input
      ref={ref}
      value={value}
      maxLength={200}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter' || e.key === 'Escape') {
          e.preventDefault();
          commit();
        }
      }}
      onBlur={commit}
      onPointerDown={(e) => e.stopPropagation()}
      className="nodrag nopan w-56 border border-[#5173D6] bg-[var(--board-node-bg)] px-1.5 py-0.5 text-xs font-semibold text-[var(--board-node-fg)] outline-none"
      style={{ borderRadius: 6 }}
      aria-label="Frame title"
      data-testid="frame-title-editor"
    />
  );
}

// A titled container. Nodes dropped inside become its children and move with
// it. Only the title (and a selected frame) grab the pointer: dragging on an
// unselected frame's body box-selects what is inside (see board.css).
export const FrameNode = memo(function FrameNode({ id, data, selected, width, height }: BoardNodeProps<'frame'>) {
  const { editing } = useNodeEditing(id);
  const w = width || 480;
  const h = height || 320;
  return (
    <CanvasNodeShell
      id={id}
      selected={selected}
      data={data}
      testId="board-node-frame"
      style={{ width: w, height: h }}
      resize={{ minWidth: 160, minHeight: 120 }}
    >
      <div className="frame-title absolute -top-7 left-0 flex h-6 max-w-full items-end" data-testid="frame-title">
        {editing && !data.meta.readOnly ? (
          <FrameTitleEditor id={id} initial={data.title ?? 'Frame'} />
        ) : (
          <span className="cursor-grab truncate px-0.5 text-[13px] font-semibold text-[var(--board-muted)] hover:text-[var(--board-node-fg)]">{data.title?.trim() || 'Frame'}</span>
        )}
      </div>
      <div
        className={cn('h-full w-full border bg-[var(--board-frame-bg)]', selected ? 'border-2 border-[#5173D6]' : 'border-[var(--board-frame-border)]')}
        style={{ borderRadius: 12, ...(data.color ? { backgroundColor: data.color } : {}) }}
      />
    </CanvasNodeShell>
  );
});
