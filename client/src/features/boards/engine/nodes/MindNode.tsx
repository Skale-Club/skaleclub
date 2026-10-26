import { memo, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Check, Link2, Plus, StickyNote } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { BOARD_LIMITS } from '@shared/schema/boards';
import { useBoardStore, useBoardStoreApi } from '../../store/boardStore';
import { addChild, outdent, toggleCollapse } from '../../mindmap/actions';
import { cn, type BoardNodeProps } from './nodeUtils';
import { NodeHandles } from './NodeHandles';
import { CTA_BLUE } from '../palette';

// Inline text editor: an auto-sized textarea (grows to 320px, then wraps).
// Enter or Ctrl/Cmd+Enter or Escape commits, Shift+Enter is a new line, Tab
// commits and adds a child, Shift+Tab commits and moves the node up a level.
function MindTextEditor({ id, initial, seed, isRoot }: { id: string; initial: string; seed: string | null; isRoot: boolean }) {
  const store = useBoardStoreApi();
  const [value, setValue] = useState(seed ?? initial);
  const ref = useRef<HTMLTextAreaElement>(null);
  const done = useRef(false);

  // A new node stays `visibility: hidden` until React Flow has measured it, and
  // hidden elements cannot take focus: retry for a few frames until it sticks.
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

  const commit = () => {
    if (done.current) return;
    done.current = true;
    const state = store.getState();
    const text = value.slice(0, BOARD_LIMITS.nodeText);
    if (text !== initial) state.updateNodeData(id, { text });
    if (state.editingNodeId === id) state.setEditingNode(null);
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    event.stopPropagation();
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'Escape' || (event.key === 'Enter' && !event.shiftKey)) {
      event.preventDefault();
      commit();
    } else if (event.key === 'Tab') {
      event.preventDefault();
      commit();
      if (event.shiftKey) outdent(store, id);
      else addChild(store, id);
    }
  };

  return (
    <span className="relative inline-grid min-w-[1ch] max-w-full align-top">
      {/* The mirror sizes the box; the textarea sits on top of it. */}
      <span aria-hidden className="invisible col-start-1 row-start-1 whitespace-pre-wrap break-words">
        {value || (isRoot ? 'Central idea' : 'Topic')}{' '}
      </span>
      <textarea
        ref={ref}
        value={value}
        rows={1}
        maxLength={BOARD_LIMITS.nodeText}
        spellCheck
        placeholder={isRoot ? 'Central idea' : 'Topic'}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={commit}
        onPointerDown={(e) => e.stopPropagation()}
        className="nodrag nopan nowheel col-start-1 row-start-1 h-full w-full resize-none overflow-hidden border-0 bg-transparent p-0 text-center font-[inherit] leading-[inherit] text-inherit outline-none placeholder:text-current placeholder:opacity-40"
        aria-label="Topic text"
        data-testid="mind-node-editor"
      />
    </span>
  );
}

function CollapseToggle({
  id,
  collapsed,
  hiddenCount,
  color,
  direction,
  alwaysVisible,
}: {
  id: string;
  collapsed: boolean;
  hiddenCount: number;
  color: string;
  direction: 'left' | 'right' | 'down';
  alwaysVisible: boolean;
}) {
  const store = useBoardStoreApi();
  const placement =
    direction === 'down'
      ? 'left-1/2 top-full -translate-x-1/2 -translate-y-1/2'
      : direction === 'left'
        ? 'right-full top-1/2 translate-x-1/2 -translate-y-1/2'
        : 'left-full top-1/2 -translate-x-1/2 -translate-y-1/2';
  return (
    <button
      type="button"
      className={cn(
        'nodrag nopan absolute z-10 flex h-5 min-w-5 items-center justify-center rounded-full border-2 px-1 text-[10px] font-bold leading-none shadow-sm transition-[opacity,transform] duration-150 hover:scale-110',
        placement,
        collapsed ? 'text-white opacity-100' : 'bg-[var(--board-node-bg)]',
        !collapsed && !alwaysVisible && 'opacity-0 group-hover:opacity-100 group-[.is-selected]:opacity-100',
      )}
      style={{ borderColor: color, ...(collapsed ? { backgroundColor: color } : { color }) }}
      onClick={(e) => {
        e.stopPropagation();
        toggleCollapse(store, id);
      }}
      onDoubleClick={(e) => e.stopPropagation()}
      aria-label={collapsed ? `Expand (${hiddenCount} hidden)` : 'Collapse'}
      aria-expanded={!collapsed}
      data-testid="mind-collapse-toggle"
    >
      {collapsed ? `+${hiddenCount}` : '−'}
    </button>
  );
}

function AddChildButton({ id, direction, offset }: { id: string; direction: 'left' | 'right' | 'down'; offset: boolean }) {
  const store = useBoardStoreApi();
  const gap = offset ? 22 : 10;
  const style: CSSProperties =
    direction === 'down'
      ? { top: `calc(100% + ${gap}px)`, left: '50%', transform: 'translateX(-50%)' }
      : direction === 'left'
        ? { right: `calc(100% + ${gap}px)`, top: '50%', transform: 'translateY(-50%)' }
        : { left: `calc(100% + ${gap}px)`, top: '50%', transform: 'translateY(-50%)' };
  return (
    <button
      type="button"
      className="nodrag nopan absolute z-10 flex h-6 w-6 items-center justify-center rounded-full bg-[#5173D6] text-white opacity-0 shadow-md transition-opacity duration-150 hover:bg-[#4562c4] group-hover:opacity-100 group-[.is-selected]:opacity-100"
      style={style}
      onClick={(e) => {
        e.stopPropagation();
        addChild(store, id);
      }}
      onDoubleClick={(e) => e.stopPropagation()}
      aria-label="Add child topic"
      data-testid="mind-add-child"
    >
      <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
    </button>
  );
}

export const MindNode = memo(function MindNode({ id, data, selected }: BoardNodeProps<'mind'>) {
  const store = useBoardStoreApi();
  const meta = data.meta;
  const depth = meta.depth ?? 0;
  const isRoot = depth === 0;
  const readOnly = !!meta.readOnly;
  const editing = useBoardStore((s) => s.editingNodeId === id);
  const seed = useBoardStore((s) => (s.editingNodeId === id ? s.editingSeed : null));
  const isDropTarget = useBoardStore((s) => s.dropTargetId === id);
  const color = meta.branchColor ?? CTA_BLUE;
  const direction = meta.direction ?? (meta.layout === 'vertical' ? 'down' : 'right');
  const childCount = meta.childCount ?? 0;
  const collapsed = !!data.collapsed && childCount > 0;
  const done = !!data.task?.done;

  // Radii are inline: the admin theme squares every `rounded-*` class, but board
  // content keeps its own shape language.
  let bodyClass: string;
  let bodyStyle: CSSProperties;
  if (isRoot) {
    bodyClass = 'rounded-[22px] px-6 py-3 text-base font-semibold leading-[22px] text-white shadow-[0_10px_28px_-12px_rgba(10,22,46,0.55)]';
    bodyStyle = { backgroundColor: data.color ?? 'var(--board-root-bg)', borderRadius: 22 };
  } else if (depth === 1) {
    bodyClass = 'rounded-xl border-2 px-3.5 py-2 text-sm font-semibold leading-5 text-[var(--board-node-fg)] shadow-[0_4px_14px_-8px_rgba(15,23,42,0.35)]';
    bodyStyle = { borderColor: color, backgroundColor: `color-mix(in srgb, ${color} 12%, var(--board-node-bg))`, borderRadius: 12 };
  } else {
    bodyClass = 'rounded-lg border border-[var(--board-node-border)] bg-[var(--board-node-bg)] px-3.5 py-2 text-sm font-medium leading-5 text-[var(--board-node-fg)] shadow-[0_2px_8px_-6px_rgba(15,23,42,0.3)]';
    // The accent bar sits on the side facing the parent.
    const inset = direction === 'left' ? '-3px 0 0 0' : direction === 'down' ? '0 3px 0 0' : '3px 0 0 0';
    bodyStyle = { boxShadow: `inset ${inset} ${color}`, borderRadius: 8 };
  }

  return (
    <div
      className={cn('group relative', selected && 'is-selected')}
      data-testid="board-node-mind"
      data-node-id={id}
      data-depth={depth}
      data-collapsed={collapsed ? 'true' : undefined}
      onDoubleClick={(e) => {
        if (readOnly) return;
        e.stopPropagation();
        store.getState().select({ nodeIds: [id], edgeIds: [] });
        store.getState().setEditingNode(id);
      }}
    >
      <div
        className={cn(
          'mind-node-body flex min-h-[36px] max-w-[320px] items-center justify-center gap-1.5 text-center transition-[box-shadow,transform,outline-color] duration-150',
          isRoot ? 'min-w-[120px]' : 'min-w-[64px]',
          bodyClass,
          selected && 'ring-2 ring-[#5173D6] ring-offset-2 ring-offset-[var(--board-bg)]',
          isDropTarget && 'scale-[1.04] outline-dashed outline-2 outline-offset-4 outline-[#5173D6]',
        )}
        style={bodyStyle}
      >
        {data.task && (
          <button
            type="button"
            disabled={readOnly}
            className={cn(
              'nodrag nopan flex h-4 w-4 shrink-0 items-center justify-center rounded border-[1.5px] transition-colors',
              done ? 'border-transparent bg-emerald-500 text-white' : isRoot ? 'border-white/80' : 'border-current opacity-70',
            )}
            onClick={(e) => {
              e.stopPropagation();
              store.getState().updateNodeData(id, { task: { done: !done } });
            }}
            onDoubleClick={(e) => e.stopPropagation()}
            aria-label={done ? 'Mark as not done' : 'Mark as done'}
            aria-pressed={done}
            data-testid="mind-task-checkbox"
          >
            {done && <Check className="h-3 w-3" strokeWidth={3} />}
          </button>
        )}
        {data.icon && (
          <span className="shrink-0 text-[1.1em] leading-none" aria-hidden>
            {data.icon}
          </span>
        )}
        <span className={cn('min-w-0', done && 'line-through opacity-60')}>
          {editing && !readOnly ? (
            <MindTextEditor id={id} initial={data.text} seed={seed} isRoot={isRoot} />
          ) : (
            <span className={cn('whitespace-pre-wrap break-words', !data.text.trim() && 'opacity-40')} data-testid="mind-node-text">
              {data.text.trim() ? data.text : isRoot ? 'Central idea' : 'Topic'}
            </span>
          )}
        </span>
        {data.note && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="nodrag shrink-0 cursor-help opacity-70 hover:opacity-100" aria-label="Note" data-testid="mind-note-indicator">
                <StickyNote className="h-3.5 w-3.5" />
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs whitespace-pre-wrap text-left text-xs">
              {data.note}
            </TooltipContent>
          </Tooltip>
        )}
        {data.link && (
          <a
            href={data.link}
            target="_blank"
            rel="noopener noreferrer"
            className="nodrag nopan shrink-0 opacity-70 hover:opacity-100"
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            title={data.link}
            aria-label="Open link"
            data-testid="mind-link"
          >
            <Link2 className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
      {childCount > 0 && (!isRoot || collapsed) && (
        <CollapseToggle id={id} collapsed={collapsed} hiddenCount={meta.hiddenCount ?? 0} color={color} direction={direction} alwaysVisible={readOnly} />
      )}
      {!readOnly && !editing && <AddChildButton id={id} direction={direction} offset={childCount > 0 && (!isRoot || collapsed)} />}
      <NodeHandles hidden />
    </div>
  );
});
