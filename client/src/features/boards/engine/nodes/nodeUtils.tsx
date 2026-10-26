import { useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type ReactNode, type RefObject } from 'react';
import { NodeResizer, type NodeProps } from '@xyflow/react';
import { Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BOARD_LIMITS } from '@shared/schema/boards';
import { useBoardStore, useBoardStoreApi } from '../../store/boardStore';
import { shiftSignal, useSignal } from '../../canvas/interaction';
import type { BoardFlowNode, BoardFlowNodeData } from '../toFlow';
import { NodeHandles } from './NodeHandles';
import { CTA_BLUE } from '../palette';

// Shared building blocks of the canvas node renderers (sticky, shape, text,
// frame, image): the outer shell (selection, handles, resizer, lock badge,
// double-click to edit), an inline text editor and text auto-fit.

type DataOf<T extends BoardFlowNodeData['type']> = Extract<BoardFlowNodeData, { type: T }>;
export type BoardNodeProps<T extends BoardFlowNodeData['type']> = NodeProps<BoardFlowNode> & { data: DataOf<T> };

// Selected nodes get the CTA-blue ring.
export function selectionRing(selected: boolean | undefined) {
  return selected ? 'ring-2 ring-[#5173D6] ring-offset-2 ring-offset-[var(--board-bg)]' : '';
}

export function MultilineText({ text, fallback }: { text: string | undefined; fallback: string }) {
  const value = text?.trim() ? text : fallback;
  return <span className="whitespace-pre-wrap break-words">{value}</span>;
}

/** Is this node being edited (and with which seed)? Boolean selectors keep other nodes from re-rendering. */
export function useNodeEditing(id: string) {
  const editing = useBoardStore((s) => s.editingNodeId === id);
  const seed = useBoardStore((s) => (s.editingNodeId === id ? s.editingSeed : null));
  return { editing, seed };
}

// Resize handles: one undo step per resize; Shift (or `keepAspect`) keeps the ratio.
function BoardResizer({ minWidth, minHeight, keepAspect }: { minWidth: number; minHeight: number; keepAspect?: boolean }) {
  const store = useBoardStoreApi();
  const shift = useSignal(shiftSignal);
  return (
    <NodeResizer
      minWidth={minWidth}
      minHeight={minHeight}
      keepAspectRatio={keepAspect || shift}
      color={CTA_BLUE}
      handleClassName="board-resize-handle"
      lineClassName="board-resize-line"
      onResizeStart={() => store.getState().beginBatch()}
      onResizeEnd={() => store.getState().endBatch()}
    />
  );
}

export interface CanvasNodeShellProps {
  id: string;
  selected: boolean | undefined;
  data: BoardFlowNodeData;
  testId: string;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Resizable while selected (and not locked). */
  resize?: { minWidth: number; minHeight: number; keepAspect?: boolean };
  /** Double-click starts editing (the node's text). */
  editable?: boolean;
  handles?: boolean;
}

export function CanvasNodeShell({ id, selected, data, testId, children, className, style, resize, editable = true, handles = true }: CanvasNodeShellProps) {
  const store = useBoardStoreApi();
  const readOnly = !!data.meta.readOnly;
  const locked = !!data.meta.locked;
  const isSource = useBoardStore((s) => s.connectorSourceId === id);
  return (
    <div
      className={cn('group relative', selected && 'is-selected', className)}
      style={style}
      data-testid={testId}
      data-node-id={id}
      data-locked={locked ? 'true' : undefined}
      onDoubleClick={(e) => {
        if (readOnly || !editable) return;
        e.stopPropagation();
        store.getState().select({ nodeIds: [id], edgeIds: [] });
        store.getState().setEditingNode(id);
      }}
    >
      {children}
      {isSource && <div className="pointer-events-none absolute -inset-1.5 outline-dashed outline-2 outline-[#5173D6]" style={{ borderRadius: 10 }} />}
      {resize && selected && !readOnly && !locked && <BoardResizer {...resize} />}
      {handles && <NodeHandles hidden={readOnly} />}
      {locked && !readOnly && (
        <span
          className="pointer-events-none absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center bg-white text-slate-500 shadow ring-1 ring-slate-200"
          style={{ borderRadius: 999 }}
          aria-label="Locked"
          data-testid="board-node-locked"
        >
          <Lock className="h-3 w-3" />
        </span>
      )}
    </div>
  );
}

/**
 * Inline text editor: an auto-sized textarea over a mirror span. Enter (or
 * Ctrl/Cmd+Enter) and Escape commit, Shift+Enter is a new line; blur commits.
 * `wrap: false` grows sideways (text blocks); otherwise it wraps in the box.
 */
export function NodeTextEditor({
  initial,
  seed,
  placeholder,
  onCommit,
  onChange,
  wrap = true,
  className,
  style,
  ariaLabel,
  testId = 'node-text-editor',
}: {
  initial: string;
  seed: string | null;
  placeholder?: string;
  onCommit: (value: string, how: 'enter' | 'escape' | 'blur') => void;
  onChange?: (value: string) => void;
  wrap?: boolean;
  className?: string;
  style?: CSSProperties;
  ariaLabel: string;
  testId?: string;
}) {
  const [value, setValue] = useState(seed ?? initial);
  const ref = useRef<HTMLTextAreaElement>(null);
  const done = useRef(false);

  // New nodes are hidden until measured and cannot take focus: retry briefly.
  useLayoutEffect(() => {
    let frame = 0;
    let tries = 0;
    const tryFocus = () => {
      const el = ref.current;
      if (!el || done.current) return;
      el.focus({ preventScroll: true });
      if (document.activeElement === el) {
        if (seed === null) el.select();
        else el.setSelectionRange(el.value.length, el.value.length);
        return;
      }
      if (++tries < 30) frame = requestAnimationFrame(tryFocus);
    };
    tryFocus();
    return () => cancelAnimationFrame(frame);
  }, [seed]);

  const commit = (how: 'enter' | 'escape' | 'blur') => {
    if (done.current) return;
    done.current = true;
    onCommit(value.slice(0, BOARD_LIMITS.nodeText), how);
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    event.stopPropagation();
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      commit('escape');
    } else if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      commit('enter');
    }
  };

  const ws = wrap ? 'whitespace-pre-wrap break-words' : 'whitespace-pre';
  return (
    <span className={cn('relative inline-grid min-w-[1ch] align-top', wrap && 'max-w-full', className)} style={style}>
      <span aria-hidden className={cn('invisible col-start-1 row-start-1', ws)}>
        {value || placeholder || ' '}{' '}
      </span>
      <textarea
        ref={ref}
        value={value}
        rows={1}
        maxLength={BOARD_LIMITS.nodeText}
        spellCheck
        placeholder={placeholder}
        onChange={(e) => {
          setValue(e.target.value);
          onChange?.(e.target.value);
        }}
        onKeyDown={onKeyDown}
        onBlur={() => commit('blur')}
        onPointerDown={(e) => e.stopPropagation()}
        wrap={wrap ? 'soft' : 'off'}
        className={cn(
          'nodrag nopan nowheel col-start-1 row-start-1 h-full w-full resize-none overflow-hidden border-0 bg-transparent p-0 font-[inherit] leading-[inherit] text-inherit outline-none placeholder:text-current placeholder:opacity-40',
          ws,
        )}
        style={{ textAlign: 'inherit' }}
        aria-label={ariaLabel}
        data-testid={testId}
      />
    </span>
  );
}

/**
 * Shrinks the font of `ref`'s content until it fits the box (binary search
 * between `min` and `max`). Re-runs when `key` (text, size) changes.
 */
export function useFitText(ref: RefObject<HTMLElement>, key: unknown[], max: number, min = 10) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let lo = min;
    let hi = Math.max(min, max);
    let best = min;
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      el.style.fontSize = `${mid}px`;
      if (el.scrollHeight <= el.clientHeight + 1 && el.scrollWidth <= el.clientWidth + 1) {
        best = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    el.style.fontSize = `${best}px`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, max, min, ...key]);
}

export { cn };
