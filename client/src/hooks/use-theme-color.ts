import { useEffect } from "react";

/**
 * Sets the page's effective "chrome color" — what iOS Safari, Chrome mobile,
 * and PWA-installed shells use to tint their surrounding chrome (URL bar,
 * status bar area, notification region).
 *
 * Mobile Safari in particular doesn't reliably honor only the `theme-color`
 * meta tag — it also samples the actual `html`/`body` background color.
 * So this hook writes to BOTH on mount and restores BOTH on unmount.
 *
 * Pass a CSS color (hex, rgb, etc.) to apply. Pass null/undefined to skip.
 *
 * Use for full-bleed pages (slide decks, presentations, estimate viewers)
 * where the page background extends to the device edges and the default
 * white Safari chrome would clash.
 */
export function useThemeColor(color: string | null | undefined): void {
  useEffect(() => {
    if (!color) return;

    // ── meta[name="theme-color"] ──────────────────────────────────────────
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    let createdByUs = false;
    const previousMeta = meta?.getAttribute("content") ?? null;

    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "theme-color");
      document.head.appendChild(meta);
      createdByUs = true;
    }
    meta.setAttribute("content", color);

    // ── html + body background-color ─────────────────────────────────────
    // iOS Safari (and several PWA shells) sample these to tint the bars
    // above/below the viewport. Without this, even a correct theme-color
    // can be overridden by a light system bg.
    const html = document.documentElement;
    const body = document.body;
    const previousHtmlBg = html.style.backgroundColor;
    const previousBodyBg = body.style.backgroundColor;
    html.style.backgroundColor = color;
    body.style.backgroundColor = color;

    return () => {
      if (meta) {
        if (createdByUs) meta.remove();
        else if (previousMeta !== null) meta.setAttribute("content", previousMeta);
      }
      html.style.backgroundColor = previousHtmlBg;
      body.style.backgroundColor = previousBodyBg;
    };
  }, [color]);
}
