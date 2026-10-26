import { memo } from 'react';
import { selectionRing, MultilineText, cn, type BoardNodeProps } from './nodeUtils';
import { NodeHandles } from './NodeHandles';

export const TextNode = memo(function TextNode({ data, selected }: BoardNodeProps<'text'>) {
  return (
    <div className={cn('group', selected && 'is-selected')} data-testid="board-node-text">
      <div
        className={cn('min-w-[40px] max-w-[480px] rounded px-1 text-[var(--board-node-fg)]', selectionRing(selected))}
        style={{ fontSize: data.fontSize ?? 18, textAlign: data.align ?? 'left', color: data.color }}
      >
        <MultilineText text={data.text} fallback="Text" />
      </div>
      <NodeHandles hidden={data.meta.readOnly} />
    </div>
  );
});
