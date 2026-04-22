import type { LinksPageConfig, LinksPageLink, LinksPageSocial, LinksPageTheme } from "./schema.js";

// Isomorphic UUID generator — works in Node 19+ and all modern browsers via globalThis.crypto.
// Avoids `import { randomUUID } from "crypto"` which Vite cannot bundle for the client.
const randomUUID = (): string => globalThis.crypto.randomUUID();

/**
 * Default theme values for the /links page. Matches the current visual state
 * (dark background, primary-blue accent) so legacy rows normalize without a
 * visible change. Admins customize via the Phase 13 theme editor.
 */
export const DEFAULT_LINKS_PAGE_THEME: Required<Pick<LinksPageTheme, 'primaryColor' | 'backgroundColor' | 'backgroundGradient' | 'backgroundImageUrl'>> = {
  primaryColor: "#1C53A3",
  backgroundColor: "#0f1014",
  backgroundGradient: "",
  backgroundImageUrl: "",
};

/**
 * Lazy-normalize a (possibly legacy) linksPageConfig JSONB payload.
 *
 * Guarantees every returned link has:
 *   - id (RFC 4122 v4 UUID, stamped here if missing)
 *   - iconType ('lucide' | 'upload' | 'auto', default 'auto')
 *   - iconValue (string, default '')
 *   - visible (boolean, default true)
 *   - clickCount (integer, default 0)
 *   - order (integer, falls back to array index when missing)
 *
 * Guarantees every returned config has:
 *   - avatarUrl / title / description as strings
 *   - links / socialLinks as arrays
 *   - theme merged with DEFAULT_LINKS_PAGE_THEME
 *
 * Called from server/storage.ts::getCompanySettings() on every read, so the
 * first admin save after deploy persists the normalized (UUID-stamped) shape.
 * Safe to call repeatedly — existing UUIDs are preserved.
 */
export function normalizeLinksPageConfig(
  raw: Partial<LinksPageConfig> | Record<string, unknown> | null | undefined,
): LinksPageConfig {
  const src = (raw ?? {}) as Record<string, unknown>;

  const rawLinks = Array.isArray(src.links) ? (src.links as Record<string, unknown>[]) : [];
  const links: LinksPageLink[] = rawLinks.map((l, i) => ({
    id: typeof l.id === "string" && l.id.length > 0 ? l.id : randomUUID(),
    title: typeof l.title === "string" ? l.title : "",
    url: typeof l.url === "string" ? l.url : "",
    order: typeof l.order === "number" ? l.order : i,
    iconType: (l.iconType === "lucide" || l.iconType === "upload" || l.iconType === "auto")
      ? l.iconType
      : "auto",
    iconValue: typeof l.iconValue === "string" ? l.iconValue : "",
    visible: typeof l.visible === "boolean" ? l.visible : true,
    clickCount: typeof l.clickCount === "number" ? l.clickCount : 0,
  }));

  const rawSocial = Array.isArray(src.socialLinks) ? (src.socialLinks as Record<string, unknown>[]) : [];
  const socialLinks: LinksPageSocial[] = rawSocial.map((s, i) => ({
    platform: typeof s.platform === "string" ? s.platform : "",
    url: typeof s.url === "string" ? s.url : "",
    order: typeof s.order === "number" ? s.order : i,
  }));

  const rawTheme = (src.theme && typeof src.theme === "object") ? (src.theme as Record<string, unknown>) : {};
  const theme: LinksPageTheme = {
    primaryColor: typeof rawTheme.primaryColor === "string" ? rawTheme.primaryColor : DEFAULT_LINKS_PAGE_THEME.primaryColor,
    backgroundColor: typeof rawTheme.backgroundColor === "string" ? rawTheme.backgroundColor : DEFAULT_LINKS_PAGE_THEME.backgroundColor,
    backgroundGradient: typeof rawTheme.backgroundGradient === "string" ? rawTheme.backgroundGradient : DEFAULT_LINKS_PAGE_THEME.backgroundGradient,
    backgroundImageUrl: typeof rawTheme.backgroundImageUrl === "string" ? rawTheme.backgroundImageUrl : DEFAULT_LINKS_PAGE_THEME.backgroundImageUrl,
  };

  return {
    avatarUrl: typeof src.avatarUrl === "string" ? src.avatarUrl : "",
    title: typeof src.title === "string" ? src.title : "",
    description: typeof src.description === "string" ? src.description : "",
    links,
    socialLinks,
    theme,
  };
}
