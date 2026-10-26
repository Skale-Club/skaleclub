import { memo } from 'react';
import { ImageIcon } from 'lucide-react';
import { selectionRing, cn, type BoardNodeProps } from './nodeUtils';
import { NodeHandles } from './NodeHandles';

export const ImageNode = memo(function ImageNode({ data, selected, width, height }: BoardNodeProps<'image'>) {
  return (
    <div className={cn('group', selected && 'is-selected')} data-testid="board-node-image">
      <div
        className={cn('overflow-hidden rounded-lg bg-[var(--board-frame-bg)] shadow-sm', selectionRing(selected))}
        style={{ width: width || 320, height: height || 200 }}
      >
        {data.url ? (
          <img src={data.url} alt={data.alt ?? ''} className="h-full w-full object-cover" draggable={false} crossOrigin="anonymous" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[var(--board-muted)]">
            <ImageIcon className="h-8 w-8 opacity-40" />
          </div>
        )}
      </div>
      <NodeHandles hidden={data.meta.readOnly} />
    </div>
  );
});
