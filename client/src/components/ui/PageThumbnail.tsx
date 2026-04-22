import { useState } from 'react';

const THUMB_W = 88;
const THUMB_H = 54;
const FRAME_W = 1280;
const FRAME_H = 800;
const SCALE = THUMB_W / FRAME_W;

export function PageThumbnail({ url }: { url: string }) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div
      className="shrink-0 rounded-md border border-zinc-800 overflow-hidden bg-zinc-950 relative"
      style={{ width: THUMB_W, height: THUMB_H }}
    >
      {!loaded && (
        <div className="absolute inset-0 animate-pulse bg-zinc-800/50" />
      )}
      <iframe
        src={url}
        title="preview"
        loading="lazy"
        tabIndex={-1}
        onLoad={() => setLoaded(true)}
        style={{
          width: FRAME_W,
          height: FRAME_H,
          transform: `scale(${SCALE})`,
          transformOrigin: 'top left',
          pointerEvents: 'none',
          border: 'none',
          opacity: loaded ? 1 : 0,
        }}
      />
    </div>
  );
}
