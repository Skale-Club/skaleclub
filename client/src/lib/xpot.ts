const DEFAULT_XPOT_CANONICAL_ORIGIN = "https://xpot.skale.club";
const DEFAULT_MARKETING_CANONICAL_ORIGIN = "https://skale.club";
const XPOT_POST_LOGIN_COOKIE = "xpot_post_login_target";

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function normalizePath(path = "/") {
  if (!path) return "/";
  return path.startsWith("/") ? path : `/${path}`;
}

function getCookieDomain(hostname: string) {
  if (isLocalHostname(hostname)) return "";
  if (hostname === "xpot.skale.club" || hostname === "skale.club" || hostname.endsWith(".skale.club")) {
    return ".skale.club";
  }
  return "";
}

function readCookie(name: string) {
  if (typeof document === "undefined") return "";
  const prefix = `${name}=`;
  const cookie = document.cookie
    .split("; ")
    .find((item) => item.startsWith(prefix));
  return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : "";
}

function writeCookie(name: string, value: string, maxAgeSeconds: number) {
  if (typeof document === "undefined" || typeof window === "undefined") return;
  const parts = [`${name}=${encodeURIComponent(value)}`, "Path=/", `Max-Age=${maxAgeSeconds}`, "SameSite=Lax"];
  const domain = getCookieDomain(window.location.hostname);
  if (domain) {
    parts.push(`Domain=${domain}`);
  }
  if (window.location.protocol === "https:") {
    parts.push("Secure");
  }
  document.cookie = parts.join("; ");
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

export function setXpotPostLoginHint(targetUrl = getXpotAppUrl("/login")) {
  writeCookie(XPOT_POST_LOGIN_COOKIE, targetUrl, 10 * 60);
}

export function getXpotPostLoginHint() {
  return readCookie(XPOT_POST_LOGIN_COOKIE);
}

export function clearXpotPostLoginHint() {
  writeCookie(XPOT_POST_LOGIN_COOKIE, "", 0);
}
