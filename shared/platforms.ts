export const PLATFORM_ROUTES = {
  xkedule: "scheduling-system", xtimator: "xtimator", xphere: "crm-setup",
  xareable: "xareable", xcraper: "xcraper",
  xpot: "xpot", xmartmenu: "smart-menu", xpeed: "xpeed",
} as const;
export type PlatformSlug = keyof typeof PLATFORM_ROUTES;

export function platformSlug(value: string): string | undefined {
  // Website services are not software platforms, even while their legacy row exists.
  if (value === "xsites" || value === "websites") return undefined;
  if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(value) || value.length > 80) return undefined;
  return (Object.keys(PLATFORM_ROUTES) as PlatformSlug[]).find((key) => key === value || PLATFORM_ROUTES[key] === value) ?? value;
}

export function platformDbSlug(value: string): string | undefined {
  const key = platformSlug(value);
  if (!key) return undefined;
  return Object.hasOwn(PLATFORM_ROUTES, key) ? PLATFORM_ROUTES[key as PlatformSlug] : key;
}

export function platformPath(value: string): string | undefined {
  const key = platformSlug(value);
  return key ? `/platforms/${key}` : undefined;
}

export function safePlatformUrl(value: string | null | undefined): string | undefined {
  if (!value?.trim()) return undefined;
  try {
    const raw = value.trim();
    const url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`);
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) return undefined;
    return url.href;
  } catch { return undefined; }
}
