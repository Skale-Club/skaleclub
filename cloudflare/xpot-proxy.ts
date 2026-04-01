interface Env {
  XPOT_UPSTREAM_ORIGIN?: string;
  XPOT_UPSTREAM_PREFIX?: string;
}

const DEFAULT_UPSTREAM_ORIGIN = "https://skale.club";
const DEFAULT_UPSTREAM_PREFIX = "/xpot";

const PASSTHROUGH_PREFIXES = [
  "/api/",
  "/assets/",
  "/attached_assets/",
];

const PASSTHROUGH_EXACT = new Set([
  "/favicon.ico",
  "/favicon.svg",
  "/favicon.png",
  "/favicon-rounded.png",
  "/apple-touch-icon.png",
  "/manifest.webmanifest",
  "/manifest-xpot.webmanifest",
  "/pwa-192.png",
  "/pwa-512.png",
  "/robots.txt",
  "/sitemap.xml",
  "/sitemap_index.xml",
  "/sw.js",
]);

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function normalizePrefix(value: string | undefined, fallback: string) {
  const normalized = (value || fallback).trim();
  if (!normalized || normalized === "/") return "";
  return normalized.startsWith("/") ? trimTrailingSlash(normalized) : `/${trimTrailingSlash(normalized)}`;
}

function shouldPassthrough(pathname: string) {
  if (PASSTHROUGH_EXACT.has(pathname)) {
    return true;
  }

  if (pathname.startsWith("/sitemap")) {
    return true;
  }

  return PASSTHROUGH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function buildUpstreamUrl(requestUrl: URL, env: Env) {
  const upstreamOrigin = trimTrailingSlash(env.XPOT_UPSTREAM_ORIGIN || DEFAULT_UPSTREAM_ORIGIN);
  const upstreamPrefix = normalizePrefix(env.XPOT_UPSTREAM_PREFIX, DEFAULT_UPSTREAM_PREFIX);
  const upstreamUrl = new URL(requestUrl.toString());
  upstreamUrl.protocol = new URL(upstreamOrigin).protocol;
  upstreamUrl.host = new URL(upstreamOrigin).host;

  if (!shouldPassthrough(requestUrl.pathname)) {
    const incomingPath = requestUrl.pathname === "/" ? "" : requestUrl.pathname;
    upstreamUrl.pathname = `${upstreamPrefix}${incomingPath}` || "/";
  }

  return upstreamUrl;
}

function rewriteRedirectLocation(location: string, requestUrl: URL, upstreamUrl: URL, env: Env) {
  const upstreamOrigin = trimTrailingSlash(env.XPOT_UPSTREAM_ORIGIN || DEFAULT_UPSTREAM_ORIGIN);
  const upstreamPrefix = normalizePrefix(env.XPOT_UPSTREAM_PREFIX, DEFAULT_UPSTREAM_PREFIX);

  try {
    const redirectUrl = new URL(location, upstreamUrl);

    if (trimTrailingSlash(redirectUrl.origin) !== upstreamOrigin) {
      return location;
    }

    const rewrittenUrl = new URL(requestUrl.toString());

    if (redirectUrl.pathname.startsWith(`${upstreamPrefix}/`)) {
      rewrittenUrl.pathname = redirectUrl.pathname.slice(upstreamPrefix.length) || "/";
    } else if (redirectUrl.pathname === upstreamPrefix) {
      rewrittenUrl.pathname = "/";
    } else {
      rewrittenUrl.pathname = redirectUrl.pathname;
    }

    rewrittenUrl.search = redirectUrl.search;
    rewrittenUrl.hash = redirectUrl.hash;
    return rewrittenUrl.toString();
  } catch {
    return location;
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const requestUrl = new URL(request.url);
    const upstreamUrl = buildUpstreamUrl(requestUrl, env);
    const upstreamRequest = new Request(upstreamUrl.toString(), request);
    upstreamRequest.headers.set("x-forwarded-host", requestUrl.host);
    upstreamRequest.headers.set("x-forwarded-proto", requestUrl.protocol.replace(":", ""));

    const response = await fetch(upstreamRequest, {
      redirect: "manual",
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (location) {
        const headers = new Headers(response.headers);
        headers.set("location", rewriteRedirectLocation(location, requestUrl, upstreamUrl, env));
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers,
        });
      }
    }

    return response;
  },
};
