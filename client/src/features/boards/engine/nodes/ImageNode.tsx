import { memo, useState } from 'react';
import { ImageIcon, ImageOff } from 'lucide-react';
import { CanvasNodeShell, cn, selectionRing, type BoardNodeProps } from './nodeUtils';

// An uploaded picture, loaded lazily; resizing always keeps its aspect ratio.
export const ImageNode = memo(function ImageNode({ id, data, selected, width, height }: BoardNodeProps<'image'>) {
  const [failed, setFailed] = useState(false);
  return (
    <CanvasNodeShell
      id={id}
      selected={selected}
      data={data}
      testId="board-node-image"
      editable={false}
      resize={{ minWidth: 40, minHeight: 40, keepAspect: true }}
    >
      <div
        className={cn('overflow-hidden bg-[var(--board-frame-bg)] shadow-sm', selectionRing(selected))}
        style={{ width: width || 320, height: height || 200, borderRadius: 8 }}
      >
        {data.url && !failed ? (
          <img
            src={data.url}
            alt={data.alt ?? ''}
            loading="lazy"
            decoding="async"
            className="pointer-events-none h-full w-full select-none object-cover"
            draggable={false}
            crossOrigin="anonymous"
            onError={() => setFailed(true)}
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-xs text-[var(--board-muted)]">
            {failed ? <ImageOff className="h-7 w-7 opacity-50" /> : <ImageIcon className="h-8 w-8 opacity-40" />}
            {failed && <span>Image unavailable</span>}
          </div>
        )}
      </div>
    </CanvasNodeShell>
  );
});
