import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

type FullscreenElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };
type FullscreenDocument = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => Promise<void> | void };

function fullscreenElement(): Element | null {
  const doc = document as FullscreenDocument;
  return doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
}

function exitFullscreen() {
  const doc = document as FullscreenDocument;
  if (!fullscreenElement()) return;
  try {
    void Promise.resolve(doc.exitFullscreen?.() ?? doc.webkitExitFullscreen?.()).catch(() => undefined);
  } catch {
    // already out
  }
}

/**
 * Present mode state. `start` asks the browser for real full screen on `rootRef`
 * and falls back silently to the page's own fixed overlay when that is refused
 * or missing (iPhone Safari); the caller makes the root cover the screen
 * whenever `active` is true. Leaving full screen with the browser's own Escape
 * ends the presentation too.
 */
export function usePresentMode(rootRef: RefObject<HTMLElement>) {
  const [active, setActive] = useState(false);
  const inFullscreen = useRef(false);

  const start = useCallback(async () => {
    setActive(true);
    const el = rootRef.current as FullscreenElement | null;
    if (!el || fullscreenElement()) return;
    try {
      const request = el.requestFullscreen?.bind(el) ?? el.webkitRequestFullscreen?.bind(el);
      if (request) {
        await request();
        inFullscreen.current = true;
      }
    } catch {
      inFullscreen.current = false;
    }
  }, [rootRef]);

  const stop = useCallback(() => {
    inFullscreen.current = false;
    setActive(false);
    exitFullscreen();
  }, []);

  useEffect(() => {
    const onChange = () => {
      if (!fullscreenElement() && inFullscreen.current) {
        inFullscreen.current = false;
        setActive(false);
      }
    };
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('webkitfullscreenchange', onChange);
      exitFullscreen();
    };
  }, []);

  return { active, start, stop };
}
