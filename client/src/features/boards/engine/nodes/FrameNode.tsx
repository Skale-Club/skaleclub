import { memo } from 'react';
import { cn, type BoardNodeProps } from './nodeUtils';

export const FrameNode = memo(function FrameNode({ data, selected, width, height }: BoardNodeProps<'frame'>) {
  return (
    <div className="relative" style={{ width: width || 480, height: height || 320 }} data-testid="board-node-frame">
      <div className="absolute -top-6 left-0 max-w-full truncate text-xs font-semibold text-[var(--board-muted)]">
        {data.title?.trim() || 'Frame'}
      </div>
      <div
        className={cn(
          'h-full w-full rounded-xl border bg-[var(--board-frame-bg)]',
          selected ? 'border-[#5173D6] border-2' : 'border-[var(--board-frame-border)]',
        )}
        style={data.color ? { backgroundColor: data.color } : undefined}
      />
    </div>
  );
});
