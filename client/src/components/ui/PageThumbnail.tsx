import { ImageIcon } from 'lucide-react';

export function PageThumbnail({
  thumbnailUrl,
  title = 'Preview',
}: {
  thumbnailUrl?: string | null;
  title?: string;
}) {
  return (
    <div
      className="shrink-0 rounded-md border border-zinc-800 overflow-hidden bg-zinc-950 relative"
      style={{ width: 88, height: 54 }}
    >
      {thumbnailUrl ? (
        <img
          src={thumbnailUrl}
          alt={title}
          className="h-full w-full object-cover"
          loading="lazy"
          decoding="async"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
          <ImageIcon className="h-4 w-4 text-zinc-600" aria-hidden="true" />
        </div>
      )}
    </div>
  );
}
