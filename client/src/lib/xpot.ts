const DEFAULT_XPOT_CANONICAL_ORIGIN = "https://xpot.skale.club";
const DEFAULT_MARKETING_CANONICAL_ORIGIN = "https://skale.club";

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function normalizePath(path = "/") {
  if (!path) return "/";
  return path.startsWith("/") ? path : `/${path}`;
}

function getConfiguredOrigin(envKey: "VITE_XPOT_CANONICAL_ORIGIN" | "VITE_CANONICAL_ORIGIN") {
  const envValue = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env?.[envKey];
  return envValue ? trimTrailingSlash(envValue.trim()) : "";
}

export function isLocalHostname(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

export function isXpotHost(hostname = typeof window !== "undefined" ? window.location.hostname : "") {
  if (!hostname) return false;
  return hostname === "xpot.skale.club" || hostname.startsWith("xpot.");
}

export function isXpotPath(pathname = typeof window !== "undefined" ? window.location.pathname : "") {
  return pathname === "/xpot" || pathname.startsWith("/xpot/");
}

export function isXpotContext(
  pathname = typeof window !== "undefined" ? window.location.pathname : "",
  hostname = typeof window !== "undefined" ? window.location.hostname : "",
) {
  return isXpotHost(hostname) || isXpotPath(pathname);
}

export function getXpotPath(path = "/") {
  const normalizedPath = normalizePath(path);
  if (typeof window !== "undefined" && isXpotHost(window.location.hostname)) {
    return normalizedPath;
  }

  return normalizedPath === "/" ? "/xpot" : `/xpot${normalizedPath}`;
}

export function getXpotHomePath() {
  return getXpotPath("/");
}

export function getXpotLoginPath() {
  return getXpotPath("/login");
}

export function getXpotSection(pathname = typeof window !== "undefined" ? window.location.pathname : "") {
  const relativePath = pathname.startsWith("/xpot/") ? pathname.slice("/xpot".length) : pathname;
  const [section] = relativePath.split("/").filter(Boolean);
  return section || null;
}

export function getXpotCanonicalOrigin() {
  const configuredOrigin = getConfiguredOrigin("VITE_XPOT_CANONICAL_ORIGIN");
  if (configuredOrigin) return configuredOrigin;
  return DEFAULT_XPOT_CANONICAL_ORIGIN;
}

export function getMarketingCanonicalOrigin() {
  const configuredOrigin = getConfiguredOrigin("VITE_CANONICAL_ORIGIN");
  if (configuredOrigin) return configuredOrigin;
  return DEFAULT_MARKETING_CANONICAL_ORIGIN;
}

export function getXpotAppUrl(path = "/") {
  const normalizedPath = normalizePath(path);

  if (typeof window === "undefined") {
    return `${getXpotCanonicalOrigin()}${normalizedPath}`;
  }

  const { hostname, origin } = window.location;

  if (isXpotHost(hostname)) {
    return `${origin}${normalizedPath}`;
  }

  if (isLocalHostname(hostname) || hostname.endsWith(".vercel.app")) {
    return `${origin}${getXpotPath(normalizedPath)}`;
  }

  return `${getXpotCanonicalOrigin()}${normalizedPath}`;
}

export function getMarketingAppUrl(path = "/") {
  const normalizedPath = normalizePath(path);

  if (typeof window === "undefined") {
    return `${getMarketingCanonicalOrigin()}${normalizedPath}`;
  }

  const { hostname, origin } = window.location;

  if (isLocalHostname(hostname) || hostname.endsWith(".vercel.app")) {
    return `${origin}${normalizedPath}`;
  }

  if (isXpotHost(hostname)) {
    return `${getMarketingCanonicalOrigin()}${normalizedPath}`;
  }

  return `${origin}${normalizedPath}`;
}
