import type { ViteDevServer } from "vite";
import { injectSeo, type InjectContext } from "./inject.js";
import { resolveRoute } from "./routes.js";
import { getSeoSettings } from "./data.js";
import { applyPageContent, buildPageContentHtml } from "./content/index.js";
import { injectHydrationState, renderReactPage } from "../ssr-react.js";

// Builds the HTML document for a page request: the per-page <head>, then the body.
//
// The body is the real page rendered by React (server/ssr-react.ts), which the browser
// hydrates. When that render is unavailable, empty or throws, it is the text summary
// (server/seo/content) as an ordinary block ahead of #root. The pre-React loader and
// either of those are mutually exclusive: an opaque loader over server-rendered text is
// what made Google score the site as Soft 404.
//
// Both render paths call this: server/static.ts (production) and server/vite.ts
// (development). Keep them on this one function so a dev-only shell cannot drift.

const LOADER_BLOCK = /<!-- INITIAL_LOADER_START -->[\s\S]*?<!-- INITIAL_LOADER_END -->/;
const CONTENT_PLACEHOLDER = "<!-- SEO_CONTENT -->";
const EMPTY_ROOT = '<div id="root"></div>';

/** Edge cache for public HTML: the shell embeds per-page tags and data, so keep it
 * short. A browser always revalidates (max-age=0); a CDN may hold it for a minute. */
export const PUBLIC_HTML_CACHE_CONTROL = "public, max-age=0, s-maxage=60, stale-while-revalidate=60";
/** Not cached anywhere: publishing a page at a URL has to make it live on the next request. */
export const NOT_FOUND_CACHE_CONTROL = "public, max-age=0, s-maxage=0, stale-while-revalidate=0";
/** Private and tooling URLs (admin, forms, viewers). */
export const PRIVATE_HTML_CACHE_CONTROL = "no-cache";

export interface ShellResult {
  html: string;
  status: 200 | 404;
  noindex: boolean;
  cacheControl: string;
  /** True when #root carries the server-rendered React page. */
  reactRendered: boolean;
}

function stripLoader(html: string): string {
  return html.replace(LOADER_BLOCK, "");
}

export async function buildShell(opts: {
  /** client/index.html (production: the built one). */
  template: string;
  pathname: string;
  /** The dev Vite server, when rendering in development. */
  vite?: ViteDevServer;
  /** Development never lets a CDN or browser hold the HTML. */
  dev?: boolean;
}): Promise<ShellResult> {
  const { template, pathname, vite, dev } = opts;

  let settings = null;
  try {
    settings = await getSeoSettings();
  } catch (err) {
    console.error("[seo] company settings unavailable:", (err as Error).message);
  }
  const route = await resolveRoute(pathname, settings?.pageSlugs);
  const ctx: InjectContext = { settings, route };
  const head = injectSeo(template, pathname, ctx);

  const indexable = route.status === 200 && !route.noindex;
  const cacheControl = dev
    ? PRIVATE_HTML_CACHE_CONTROL
    : route.status === 404
      ? NOT_FOUND_CACHE_CONTROL
      : indexable
        ? PUBLIC_HTML_CACHE_CONTROL
        : PRIVATE_HTML_CACHE_CONTROL;
  const base = { status: route.status, noindex: route.noindex, cacheControl };

  if (indexable) {
    const rendered = await renderReactPage({ vite, url: pathname });
    if (rendered && head.includes(EMPTY_ROOT)) {
      const body = stripLoader(head)
        .replace(CONTENT_PLACEHOLDER, "")
        .replace(EMPTY_ROOT, () => `<div id="root">${rendered.html}</div>`);
      return { ...base, html: injectHydrationState(body, rendered), reactRendered: true };
    }
  }

  const content = await buildPageContentHtml(pathname, ctx);
  return { ...base, html: applyPageContent(head, content), reactRendered: false };
}
