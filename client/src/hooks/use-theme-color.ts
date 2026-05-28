import { useEffect } from "react";

/**
 * Sets the page's effective "chrome color" — what iOS Safari, Chrome mobile,
 * and PWA-installed shells use to tint their surrounding chrome (URL bar,
 * status bar area, notification region).
 *
 * Mobile Safari in particular doesn't reliably honor only the `theme-color`
 * meta tag — it also samples:
 *   - the actual `html` / `body` background color
 *   - the `color-scheme` meta tag / CSS property
 * to decide chrome tint AT FIRST PAINT (then caches the decision).
 *
 * For first-paint correctness, /e/* and /p/* routes also get a dark prelude
 * in client/index.html's boot script. This hook handles RUNTIME updates
 * (e.g. presentation slide changes that flip between dark and light bgColors).
 *
 * Pass a CSS color (hex/rgb/etc.) to apply. Pass null/undefined to skip.
 *
 * Use for full-bleed pages (slide decks, presentations, estimate viewers)
 * where the page background extends to the device edges and the default
 * white Safari chrome would clash.
 */
export function useThemeColor(color: string | null | undefined): void {
  useEffect(() => {
    if (!color) return;

    const isLight = isLightColor(color);
    const scheme = isLight ? "light" : "dark";

    // ── meta[name="theme-color"] ──────────────────────────────────────────
    let themeMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    let createdThemeMeta = false;
    const previousThemeMeta = themeMeta?.getAttribute("content") ?? null;
    if (!themeMeta) {
      themeMeta = document.createElement("meta");
      themeMeta.setAttribute("name", "theme-color");
      document.head.appendChild(themeMeta);
      createdThemeMeta = true;
    }
    themeMeta.setAttribute("content", color);

    // ── meta[name="color-scheme"] ────────────────────────────────────────
    let csMeta = document.querySelector<HTMLMetaElement>('meta[name="color-scheme"]');
    let createdCsMeta = false;
    const previousCsMeta = csMeta?.getAttribute("content") ?? null;
    if (!csMeta) {
      csMeta = document.createElement("meta");
      csMeta.setAttribute("name", "color-scheme");
      document.head.appendChild(csMeta);
      createdCsMeta = true;
    }
    csMeta.setAttribute("content", scheme);

    // ── html + body inline styles (bg + colorScheme) ─────────────────────
    // iOS Safari samples these to tint surrounding chrome.
    const html = document.documentElement;
    const body = document.body;
    const previousHtmlBg = html.style.backgroundColor;
    const previousBodyBg = body?.style.backgroundColor ?? "";
    const previousHtmlColorScheme = html.style.colorScheme;
    html.style.backgroundColor = color;
    html.style.colorScheme = scheme;
    if (body) body.style.backgroundColor = color;

    return () => {
      // Meta restore
      if (themeMeta) {
        if (createdThemeMeta) themeMeta.remove();
        else if (previousThemeMeta !== null) themeMeta.setAttribute("content", previousThemeMeta);
      }
      if (csMeta) {
        if (createdCsMeta) csMeta.remove();
        else if (previousCsMeta !== null) csMeta.setAttribute("content", previousCsMeta);
      }
      // Inline style restore
      html.style.backgroundColor = previousHtmlBg;
      html.style.colorScheme = previousHtmlColorScheme;
      if (body) body.style.backgroundColor = previousBodyBg;
    };
  }, [color]);
}

// Crude relative-luminance check. Anything brighter than ~50% perceived
// brightness is treated as light. Handles #rgb, #rrggbb, and rgb()/rgba()
// strings; for anything else (named colors, etc.) defaults to dark.
function isLightColor(c: string): boolean {
  const trimmed = c.trim();
  let r = 0, g = 0, b = 0;
  const hex = trimmed.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const h = hex[1];
    if (h.length === 3) {
      r = parseInt(h[0] + h[0], 16);
      g = parseInt(h[1] + h[1], 16);
      b = parseInt(h[2] + h[2], 16);
    } else {
      r = parseInt(h.slice(0, 2), 16);
      g = parseInt(h.slice(2, 4), 16);
      b = parseInt(h.slice(4, 6), 16);
    }
  } else {
    const rgb = trimmed.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
    if (rgb) {
      r = parseInt(rgb[1], 10);
      g = parseInt(rgb[2], 10);
      b = parseInt(rgb[3], 10);
    } else {
      return false;
    }
  }
  // Perceived luminance (Rec. 709)
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.5;
}
