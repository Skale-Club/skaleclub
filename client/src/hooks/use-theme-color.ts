import { useEffect } from "react";

/**
 * Dynamically sets the iOS Safari / Chrome `theme-color` meta tag — controls
 * the tint of the URL bar (mobile Safari) and notification area (PWA mode).
 *
 * Pass a CSS color (hex, rgb, etc.) to apply. Pass null/undefined to skip.
 * On unmount, restores the previous theme-color (or removes the meta if we
 * created it) so other pages aren't left with this color.
 *
 * Use for full-bleed pages (slide decks, presentations, estimate viewers)
 * where the page background extends to the device edges and the default
 * white Safari chrome would clash.
 */
export function useThemeColor(color: string | null | undefined): void {
  useEffect(() => {
    if (!color) return;

    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    let createdByUs = false;
    const previous = meta?.getAttribute("content") ?? null;

    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "theme-color");
      document.head.appendChild(meta);
      createdByUs = true;
    }
    meta.setAttribute("content", color);

    return () => {
      if (!meta) return;
      if (createdByUs) {
        meta.remove();
      } else if (previous !== null) {
        meta.setAttribute("content", previous);
      }
    };
  }, [color]);
}
