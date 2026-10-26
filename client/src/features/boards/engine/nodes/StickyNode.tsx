import { memo, useRef, useState } from 'react';
import { useBoardStoreApi } from '../../store/boardStore';
import { commitNodeText } from '../../canvas/actions';
import { CanvasNodeShell, NodeTextEditor, cn, selectionRing, useFitText, useNodeEditing, type BoardNodeProps } from './nodeUtils';
import { DEFAULT_STICKY_COLOR } from '../palette';

// A pastel square note. The text shrinks (down to 10px) to always fit.
export const StickyNode = memo(function StickyNode({ id, data, selected, width, height }: BoardNodeProps<'sticky'>) {
  const store = useBoardStoreApi();
  const { editing, seed } = useNodeEditing(id);
  const readOnly = !!data.meta.readOnly;
  const w = width || 200;
  const h = height || 200;
  const [draft, setDraft] = useState<string | null>(null);
  const fitRef = useRef<HTMLDivElement>(null);
  const shown = editing ? (draft ?? seed ?? data.text) : data.text;
  const max = Math.max(12, Math.min(56, Math.round(Math.min(w, h) * 0.12)));
  useFitText(fitRef, [shown, w, h, editing], max, 10);

  return (
    <CanvasNodeShell id={id} selected={selected} data={data} testId="board-node-sticky" resize={{ minWidth: 80, minHeight: 80 }}>
      <div
        className={cn('flex p-4 text-slate-800 shadow-[0_6px_16px_-6px_rgba(15,23,42,0.28)]', selectionRing(selected))}
        style={{ backgroundColor: data.color ?? DEFAULT_STICKY_COLOR, width: w, height: h, borderRadius: 6 }}
      >
        <div ref={fitRef} className="flex h-full w-full items-center justify-center overflow-hidden text-center leading-snug" data-testid="sticky-text">
          {editing && !readOnly ? (
            <NodeTextEditor
              initial={data.text}
              seed={seed}
              placeholder="Type something"
              ariaLabel="Sticky note text"
              testId="sticky-editor"
              onChange={setDraft}
              onCommit={(text) => {
                setDraft(null);
                commitNodeText(store, id, { text });
              }}
              className="w-full"
            />
          ) : (
            <span className={cn('whitespace-pre-wrap break-words', !data.text.trim() && 'opacity-40')}>{data.text.trim() ? data.text : readOnly ? '' : 'Double-click to type'}</span>
          )}
        </div>
      </div>
    </CanvasNodeShell>
  );
});
