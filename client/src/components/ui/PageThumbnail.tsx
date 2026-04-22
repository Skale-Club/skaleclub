import { memo, useEffect, useRef, useState } from 'react';

const THUMB_W = 88;
const THUMB_H = 54;
const FRAME_W = 1280;
const FRAME_H = 800;
const SCALE = THUMB_W / FRAME_W;

interface CacheEntry {
  iframe: HTMLIFrameElement;
  loaded: boolean;
}

// Module-level cache — keeps iframes alive across React unmounts so they never reload
const iframeCache = new Map<string, CacheEntry>();

function getOrCreateEntry(cacheKey: string, src: string): CacheEntry {
  let entry = iframeCache.get(cacheKey);
  if (entry) return entry;

  const iframe = document.createElement('iframe');
  iframe.src = src;
  iframe.title = 'preview';
  iframe.tabIndex = -1;
  iframe.style.cssText = [
    `width:${FRAME_W}px`,
    `height:${FRAME_H}px`,
    `transform:scale(${SCALE})`,
    'transform-origin:top left',
    'pointer-events:none',
    'border:none',
    'opacity:0',
  ].join(';');

  entry = { iframe, loaded: false };
  iframeCache.set(cacheKey, entry);
  return entry;
}

export const PageThumbnail = memo(function PageThumbnail({
  url,
  version,
}: {
  url: string;
  version?: string | number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cacheKey = version != null ? `${url}|${version}` : url;
  const src = url + (url.includes('?') ? '&' : '?') + 'thumbnail=1';

  const [loaded, setLoaded] = useState(() => iframeCache.get(cacheKey)?.loaded ?? false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const entry = getOrCreateEntry(cacheKey, src);

    if (entry.loaded) {
      entry.iframe.style.opacity = '1';
      setLoaded(true);
    } else {
      const onLoad = () => {
        entry.loaded = true;
        entry.iframe.style.opacity = '1';
        setLoaded(true);
      };
      entry.iframe.addEventListener('load', onLoad, { once: true });
    }

    container.appendChild(entry.iframe);

    return () => {
      // Detach — browser preserves loaded iframe state, no reload on remount
      if (entry.iframe.parentElement === container) {
        container.removeChild(entry.iframe);
      }
    };
  }, [cacheKey, src]);

  return (
    <div
      ref={containerRef}
      className="shrink-0 rounded-md border border-zinc-800 overflow-hidden bg-zinc-950 relative"
      style={{ width: THUMB_W, height: THUMB_H }}
    >
      {!loaded && (
        <div className="absolute inset-0 animate-pulse bg-zinc-800/50" />
      )}
    </div>
  );
});
