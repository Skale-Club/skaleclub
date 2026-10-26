import { memo } from 'react';
import { selectionRing, MultilineText, cn, type BoardNodeProps } from './nodeUtils';
import { DEFAULT_STICKY_COLOR } from '../palette';
import { NodeHandles } from './NodeHandles';

export const StickyNode = memo(function StickyNode({ data, selected, width, height }: BoardNodeProps<'sticky'>) {
  return (
    <div className={cn('group', selected && 'is-selected')} data-testid="board-node-sticky">
      <div
        className={cn(
          'flex items-center justify-center rounded-md p-4 text-center text-[15px] leading-snug text-slate-800 shadow-[0_6px_16px_-6px_rgba(15,23,42,0.25)]',
          selectionRing(selected),
        )}
        style={{ backgroundColor: data.color ?? DEFAULT_STICKY_COLOR, width: width || 200, height: height || 200 }}
      >
        <MultilineText text={data.text} fallback="" />
      </div>
      <NodeHandles hidden={data.meta.readOnly} />
    </div>
  );
});
