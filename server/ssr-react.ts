import type { ViteDevServer } from "vite";
import path from "path";
import { pathToFileURL } from "url";

/**
 * Loads client/src/entry-server.tsx and turns a request path into the page's HTML.
 *
 * Development loads the entry through `vite.ssrLoadModule`; production imports the bundle
 * `vite build --ssr` writes to dist/server/entry-server.js (script/build.ts), once per
 * process.
 *
 * On by default. `ENABLE_REACT_SSR=false` is the kill switch: the page then ships the text
 * fallback (server/seo/content) and the browser renders it client-side, as before.
 *
 * Every failure resolves to `null`, never a throw: a broken render must degrade to the
 * fallback, not 500 a page.
 */

export interface RenderReactPageOptions {
  /** The running dev Vite server. Omit it in production. */
  vite?: ViteDevServer;
  /** Request path, `/br` prefix included. */
  url: string;
}

export interface RenderReactPageResult {
  html: string;
  /** dehydrate(queryClient) output: inline it with injectHydrationState(). */
  dehydratedState: unknown;
  /** Portuguese strings the render used, for the browser to seed before hydrating. */
  translations: Record<string, string>;
  /** Language a managed landing registers for itself (/grupo), for the browser's first render. */
  pageInfo: { language?: "en" | "pt"; alternatePath?: string | null } | null;
}

type EntryServerModule = {
  renderPage?: (opts: { url: string; origin: string }) => Promise<RenderReactPageResult>;
};

export function isReactSsrEnabled(): boolean {
  return process.env.ENABLE_REACT_SSR !== "false";
}

/**
 * Loopback origin of this server's own HTTP API. The entry prefetches through the real
 * API (so what it renders cannot drift from what the browser would fetch) and a Node
 * process has no implicit "current origin". The default port mirrors server/index.ts.
 */
export function resolveLoopbackOrigin(): string {
  return `http://127.0.0.1:${process.env.PORT || "1000"}`;
}

/** Element ids the browser reads in client/src/main.tsx before hydrateRoot(). */
export const REACT_QUERY_STATE_ELEMENT_ID = "__REACT_QUERY_STATE__";
export const SSR_TRANSLATIONS_ELEMENT_ID = "__SSR_TRANSLATIONS__";
export const SSR_PAGE_INFO_ELEMENT_ID = "__SSR_PAGE_INFO__";

// Escaping every `<` removes the only `</script>` breakout without an HTML parser;
// JSON.parse() on the client reverses it.
function jsonScript(id: string, value: unknown): string {
  const json = JSON.stringify(value).replace(/</g, "\\u003c");
  return `<script id="${id}" type="application/json">${json}</script>`;
}

/**
 * Inline the dehydrated React Query cache (and, for Portuguese, the strings the render
 * used) immediately before `</body>`. A function replacer, because the payload is content
 * and may contain `$&`, which a string replacement would expand.
 *
 * Never throws: a failure degrades to "no snapshot" (the browser fetches every query
 * itself) rather than breaking the page.
 */
export function injectHydrationState(
  html: string,
  state: { dehydratedState: unknown; translations: Record<string, string>; pageInfo?: unknown },
): string {
  try {
    let tags = jsonScript(REACT_QUERY_STATE_ELEMENT_ID, state.dehydratedState);
    if (Object.keys(state.translations).length > 0) {
      tags += jsonScript(SSR_TRANSLATIONS_ELEMENT_ID, state.translations);
    }
    if (state.pageInfo) tags += jsonScript(SSR_PAGE_INFO_ELEMENT_ID, state.pageInfo);
    return html.replace("</body>", () => `${tags}</body>`);
  } catch (err) {
    console.error("[ssr-react] failed to inline hydration state:", err);
    return html;
  }
}

// `undefined` = not tried yet; `null` = tried and failed. A missing or broken build is not
// retried on every request: a fresh deploy starts a fresh process.
let prodEntryModule: EntryServerModule | null | undefined;

async function loadProdEntryModule(): Promise<EntryServerModule | null> {
  if (prodEntryModule !== undefined) return prodEntryModule;
  try {
    // server/index.ts is esbuild'd to the CJS file dist/index.cjs, where `__dirname` is
    // `dist/` (import.meta.url is not usable there). script/build.ts emits the SSR bundle
    // next to it, at dist/server/entry-server.js: an ES module, so it needs a real
    // file:// URL for import().
    const entryPath = path.join(__dirname, "server", "entry-server.js");
    prodEntryModule = (await import(pathToFileURL(entryPath).href)) as EntryServerModule;
  } catch (err) {
    console.error("[ssr-react] failed to load production SSR bundle:", err);
    prodEntryModule = null;
  }
  return prodEntryModule;
}

/** Visible text a render needs, without a heading, to count as a real page. */
export const MIN_MAIN_CONTENT_TEXT_CHARS = 500;

/** What is inside <main>: the route's own output, without the navbar and footer around it
 * (the navbar alone carries more than 500 characters, so it must not count). */
function mainRegion(html: string): string {
  const start = html.search(/<main[\s>]/i);
  if (start === -1) return html;
  const end = html.indexOf("</main>", start);
  return end === -1 ? html.slice(start) : html.slice(start, end);
}

/**
 * Whether server-rendered markup carries the page itself, not just the layout.
 *
 * Looks only inside <main>, where the route renders. It counts as content when it has an
 * <h1> or <h2>, or enough visible text without one. A render stuck in a loading state (a
 * query that was not prefetched, a landing that does not exist) leaves <main> holding only
 * a spinner, fails both tests, and the caller serves the text fallback instead of an
 * empty-looking page.
 */
export function hasMainContent(html: string): boolean {
  const main = mainRegion(html);
  if (/<h[12][\s>]/i.test(main)) return true;
  const text = main
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z0-9#]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length >= MIN_MAIN_CONTENT_TEXT_CHARS;
}

export async function renderReactPage(opts: RenderReactPageOptions): Promise<RenderReactPageResult | null> {
  if (!isReactSsrEnabled()) return null;
  try {
    let mod: EntryServerModule | null;
    if (opts.vite) {
      // Vite's root is client/, so this id resolves to client/src/entry-server.tsx.
      mod = (await opts.vite.ssrLoadModule("/src/entry-server.tsx")) as EntryServerModule;
    } else {
      mod = await loadProdEntryModule();
    }
    if (!mod) return null;
    if (typeof mod.renderPage !== "function") {
      console.error("[ssr-react] entry-server does not export renderPage()");
      return null;
    }

    const result = await mod.renderPage({ url: opts.url, origin: resolveLoopbackOrigin() });
    if (!result.html) return null;
    if (!hasMainContent(result.html)) {
      console.warn(`[ssr-react] render for "${opts.url}" has no main content; serving the text fallback`);
      return null;
    }
    return result;
  } catch (err) {
    console.error("[ssr-react] render failed:", err);
    return null;
  }
}
