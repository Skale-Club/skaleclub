import { memo } from 'react';
import { selectionRing, MultilineText, cn, type BoardNodeProps } from './nodeUtils';
import { HORIZONTAL_SIDES, NodeHandles } from './NodeHandles';

export const MindNode = memo(function MindNode({ data, selected }: BoardNodeProps<'mind'>) {
  const depth = data.meta.depth ?? 0;
  const isRoot = depth === 0;
  const accent = data.color;
  return (
    <div className={cn('group', selected && 'is-selected')} data-testid="board-node-mind">
      <div
        className={cn(
          'min-w-[96px] max-w-[320px] rounded-full text-center font-medium shadow-sm transition-shadow',
          isRoot
            ? 'px-6 py-3 text-base text-white shadow-md'
            : 'border-2 bg-[var(--board-node-bg)] px-4 py-2 text-sm text-[var(--board-node-fg)]',
          selectionRing(selected),
        )}
        style={isRoot ? { backgroundColor: accent ?? 'var(--board-root-bg)' } : { borderColor: accent ?? 'var(--board-node-border)' }}
      >
        {data.task && (
          <span className={cn('mr-1.5 inline-block h-3 w-3 rounded-sm border align-middle', data.task.done && 'bg-current')} aria-hidden />
        )}
        {data.icon && <span className="mr-1.5" aria-hidden>{data.icon}</span>}
        <MultilineText text={data.text} fallback="Topic" />
      </div>
      <NodeHandles hidden={data.meta.readOnly} sides={HORIZONTAL_SIDES} />
    </div>
  );
});
