import { prerenderToNodeStream } from "react-dom/static";
import { QueryClient, dehydrate, defaultShouldDehydrateQuery, type DehydratedState } from "@tanstack/react-query";
import { splitLanguagePath } from "@shared/languagePath";
import { buildPagePaths, type PageSlugs } from "@shared/pageSlugs";
import { landingPathForSlug, productDbSlugForUrlSlug } from "@shared/landingSeo";
import type { PageLanguageInfo } from "./context/LanguageContext";
import App from "./App";
import { translationCache, TranslationCollectorContext } from "./hooks/useTranslation";

/**
 * Server render entry for the public site.
 *
 * Loaded by server/ssr-react.ts: in production from the bundle `vite build --ssr` writes
 * to dist/server/entry-server.js, in development through `vite.ssrLoadModule`.
 *
 * It renders the same <App> the browser runs, after prefetching the API queries the
 * route reads, so the HTML is the finished page and main.tsx can hydrate onto it instead
 * of replacing it. The prefetch goes through this server's own HTTP API (loopback) rather
 * than calling storage, so what the page renders can never drift from what the browser
 * would have fetched.
 */

const COMPANY_SETTINGS_KEY = ["/api/company-settings"] as const;

/** Ceiling for the prefetch and the render together. A rejection of any kind (this
 * timeout included) tells the caller to serve the text fallback instead. */
const RENDER_TIMEOUT_MS = 3000;

const BLOG_POSTS_PER_PAGE = 9;

export interface RenderPageOptions {
  /** Request path, `/br` prefix included, e.g. "/" or "/br/services". */
  url: string;
  /** Loopback origin of this server's own API, e.g. "http://127.0.0.1:7000". */
  origin: string;
}

export interface RenderPageResult {
  html: string;
  /** dehydrate(queryClient): inlined by the caller, merged into the browser's cache
   * before hydration. */
  dehydratedState: DehydratedState;
  /** Portuguese strings the render used that are not in the static dictionary. The
   * browser seeds its translation cache with them before hydrating. Empty for English. */
  translations: Record<string, string>;
  /** Set for a managed landing whose language differs from its URL (/grupo): the browser
   * passes it to <App> so its first render matches this HTML. */
  pageInfo: PageLanguageInfo | null;
}

export interface PrefetchSpec {
  /** Must equal the component's useQuery key exactly: the cache is looked up by key. */
  queryKey: readonly unknown[];
  /** Request URI (path and query) appended to `origin`. */
  path: string;
  /** Set when the component reads the key with useInfiniteQuery: the cache entry must
   * then be `{ pages, pageParams }`. */
  infinite?: { initialPageParam: number };
  /** Keep a failed result in the dehydrated cache (as an error entry). Needed where the
   * component branches on `isError`: without it the browser would see a pending query. */
  keepError?: boolean;
}

// Every public route renders the navbar (portfolio menu) and footer, which read these.
const LAYOUT_SPECS: PrefetchSpec[] = [
  { queryKey: [...COMPANY_SETTINGS_KEY], path: "/api/company-settings" },
  { queryKey: ["/api/portfolio-services"], path: "/api/portfolio-services" },
];

function safeDecode(segment: string): string | null {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}

// client/src/pages/DynamicLanding.tsx: `/br/x` asks for the `x-br` row first and falls
// back to the base row when it does not exist.
function landingSpecs(segment: string, language: "en" | "pt"): PrefetchSpec[] {
  const dbSlug = segment;
  const brSlug = language === "pt" && !dbSlug.endsWith("-br") ? `${dbSlug}-br` : null;
  const specs: PrefetchSpec[] = [];
  if (brSlug) {
    specs.push({
      queryKey: [`/api/pages/slug/${brSlug}`],
      path: `/api/pages/slug/${encodeURIComponent(brSlug)}`,
      keepError: true,
    });
  }
  specs.push({
    queryKey: [`/api/pages/slug/${dbSlug}`],
    path: `/api/pages/slug/${encodeURIComponent(dbSlug)}`,
  });
  return specs;
}

/**
 * The queries a route's components read, beyond the layout's. Each key is copied from the
 * component named next to it; change both together (see the test, which fails when a page
 * renders its loading state because a key here drifted).
 */
export function specsForRoute(url: string, pageSlugs?: Partial<PageSlugs> | null): PrefetchSpec[] {
  const pathname = url.split(/[?#]/, 1)[0];
  const { path, language } = splitLanguagePath(pathname);
  const paths = buildPagePaths(pageSlugs);

  if (path === "/") {
    // components/home/BlogSection.tsx
    return [
      ...LAYOUT_SPECS,
      { queryKey: ["/api/blog", "published", 3, 0], path: "/api/blog?status=published&limit=3&offset=0" },
    ];
  }

  // pages/Faq.tsx
  if (path === paths.faq) return [...LAYOUT_SPECS, { queryKey: ["/api/faqs"], path: "/api/faqs" }];

  if (path === paths.blog) {
    // pages/Blog.tsx (useInfiniteQuery)
    return [
      ...LAYOUT_SPECS,
      {
        queryKey: ["/api/blog", "published", BLOG_POSTS_PER_PAGE],
        path: `/api/blog?status=published&limit=${BLOG_POSTS_PER_PAGE}&offset=0`,
        infinite: { initialPageParam: 0 },
      },
    ];
  }

  const segments = path.split("/").slice(1);
  const blogSegments = paths.blog.split("/").slice(1);
  const isBlogPost =
    segments.length === blogSegments.length + 1 && blogSegments.every((segment, index) => segments[index] === segment);
  if (isBlogPost) {
    // pages/BlogPost.tsx. The related-posts query depends on the post id and stays
    // client-side: the article itself is what a crawler needs.
    const slug = safeDecode(segments[segments.length - 1]);
    if (!slug) return LAYOUT_SPECS;
    return [...LAYOUT_SPECS, { queryKey: ["/api/blog", slug], path: `/api/blog/${encodeURIComponent(slug)}` }];
  }

  // Pages that only read company settings (home aside): portfolio, apps, services,
  // products, contact, privacy, terms, hub, nfc-guide.
  const settingsOnly = new Set<string>([
    paths.portfolio,
    paths.contact,
    paths.privacyPolicy,
    paths.termsOfService,
    paths.hub,
    "/apps",
    "/services",
    "/products",
    "/nfc-guide",
  ]);
  if (settingsOnly.has(path)) return LAYOUT_SPECS;

  // /products/<slug> and the bare /<slug> catch-all: pages/DynamicLanding.tsx
  if (segments.length === 2 && segments[0] === "products") {
    const dbSlug = productDbSlugForUrlSlug(segments[1]);
    return dbSlug ? [...LAYOUT_SPECS, ...landingSpecs(dbSlug, language)] : LAYOUT_SPECS;
  }
  if (segments.length === 1 && segments[0]) {
    const slug = safeDecode(segments[0]);
    return slug ? [...LAYOUT_SPECS, ...landingSpecs(slug, language)] : LAYOUT_SPECS;
  }

  return LAYOUT_SPECS;
}

async function fetchJson(origin: string, path: string): Promise<unknown> {
  const res = await fetch(`${origin}${path}`, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

async function prefetchOne(queryClient: QueryClient, spec: PrefetchSpec, origin: string): Promise<void> {
  const queryFn = () => fetchJson(origin, spec.path);
  if (spec.infinite) {
    // Only the first page: the browser loads the rest on scroll.
    await queryClient.prefetchInfiniteQuery({
      queryKey: spec.queryKey,
      queryFn,
      initialPageParam: spec.infinite.initialPageParam,
    });
  } else {
    await queryClient.prefetchQuery({ queryKey: spec.queryKey, queryFn });
  }
  // prefetchQuery never rejects, so a failure is silent unless it is looked up here. A
  // failed entry is left out of the dehydrated cache; the browser then fetches it itself.
  const state = queryClient.getQueryState(spec.queryKey);
  if (state?.status === "error" && !spec.keepError) {
    console.error(`[entry-server] prefetch failed for ${spec.path}:`, state.error);
  }
}

// The AI translation cache the client preloads after mount (GET /api/translations/preload),
// read once per few minutes instead of on every Portuguese request.
const TRANSLATIONS_TTL_MS = 5 * 60 * 1000;
let translationsLoadedAt = 0;
let translationsInFlight: Promise<void> | null = null;

async function ensureServerTranslations(origin: string): Promise<void> {
  if (Date.now() - translationsLoadedAt < TRANSLATIONS_TTL_MS) return;
  translationsInFlight ??= (async () => {
    try {
      const body = (await fetchJson(origin, "/api/translations/preload?lang=pt")) as {
        translations?: Record<string, string>;
      };
      for (const [source, translated] of Object.entries(body.translations ?? {})) {
        translationCache.set(`pt:${source}`, translated);
      }
      translationsLoadedAt = Date.now();
    } finally {
      translationsInFlight = null;
    }
  })();
  await translationsInFlight;
}

interface LandingRow {
  language?: "en" | "pt";
  alternateSlug?: string | null;
}

/** What DynamicLanding registers once mounted, computed from the prefetched row. */
function landingPageInfo(queryClient: QueryClient, url: string, pageSlugs?: Partial<PageSlugs> | null): PageLanguageInfo | null {
  const { language: urlLanguage } = splitLanguagePath(url.split(/[?#]/, 1)[0]);
  if (urlLanguage !== "en") return null;
  for (const spec of specsForRoute(url, pageSlugs)) {
    const key = spec.queryKey[0];
    if (typeof key !== "string" || !key.startsWith("/api/pages/slug/")) continue;
    const row = queryClient.getQueryData<LandingRow>(spec.queryKey);
    if (!row || row.language !== "pt") continue;
    const alternatePath = row.alternateSlug ? landingPathForSlug(row.alternateSlug) : null;
    return { language: "pt", alternatePath: alternatePath && alternatePath !== url ? alternatePath : null };
  }
  return null;
}

export async function renderPage(opts: RenderPageOptions): Promise<RenderPageResult> {
  // A fresh QueryClient per request: one process renders every request, so a shared cache
  // would hand one visitor's data to another.
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Infinity,
        // As in the browser (lib/queryClient.ts): a query that failed stays failed. Left on,
        // the render would treat it as refetching and show a loader instead of the fallback
        // branch the page takes after the failure.
        retryOnMount: false,
        // Components read their data from the cache the prefetch above filled. A key that
        // was not prefetched must stay pending (the browser fetches it after hydration),
        // not log "No queryFn was passed" once per observer.
        queryFn: () => new Promise<never>(() => {}),
      },
    },
  });
  const collector = new Set<string>();
  const { language } = splitLanguagePath(opts.url.split(/[?#]/, 1)[0]);

  return new Promise<RenderPageResult>((resolve, reject) => {
    let settled = false;
    const fail = (err: unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      reject(err instanceof Error ? err : new Error(String(err)));
    };
    const timeoutId = setTimeout(
      () => fail(new Error(`[entry-server] render timed out after ${RENDER_TIMEOUT_MS}ms for "${opts.url}"`)),
      RENDER_TIMEOUT_MS,
    );

    (async () => {
      // The page slugs decide which URL is the FAQ or the blog, and live in the settings.
      // Fetch them first, then everything else the route needs at once.
      await prefetchOne(queryClient, LAYOUT_SPECS[0], opts.origin);
      const settings = queryClient.getQueryData<{ pageSlugs?: Partial<PageSlugs> | null }>(COMPANY_SETTINGS_KEY);
      const specs = specsForRoute(opts.url, settings?.pageSlugs).filter(
        (spec) => spec.queryKey[0] !== COMPANY_SETTINGS_KEY[0],
      );
      await Promise.allSettled([
        ...specs.map((spec) => prefetchOne(queryClient, spec, opts.origin)),
        language === "pt" ? ensureServerTranslations(opts.origin).catch((err) => {
          console.error("[entry-server] translations preload failed:", err);
        }) : Promise.resolve(),
      ]);

      const pageInfo = landingPageInfo(queryClient, opts.url, settings?.pageSlugs);
      // prerender, not renderToPipeableStream: every route is React.lazy, and the streaming
      // renderer would ship the route as a loading placeholder plus a hidden segment that
      // an inline script swaps in. prerender waits for every lazy chunk and Suspense
      // boundary and returns the finished markup, with no placeholders or scripts: the
      // text is in the HTML where a crawler (and the first paint) reads it.
      const { prelude } = await prerenderToNodeStream(
        <TranslationCollectorContext.Provider value={collector}>
          <App ssrPath={opts.url} serverRendered queryClient={queryClient} initialPageInfo={pageInfo} />
        </TranslationCollectorContext.Provider>,
        // Never ship partial HTML: any render error, even one an error boundary would
        // recover from, sends the caller to the text fallback.
        // React outlines any completed boundary bigger than this (default ~12.8 KB) into a
        // hidden segment swapped in by an inline script. Every page is bigger than that, so
        // raise it: the finished markup stays where the browser and crawlers read it.
        { onError: fail, progressiveChunkSize: Number.MAX_SAFE_INTEGER },
      );
      const chunks: Buffer[] = [];
      for await (const chunk of prelude) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);

      const translations: Record<string, string> = {};
      for (const source of Array.from(collector)) {
        const translated = translationCache.get(`pt:${source}`);
        if (translated !== undefined && translated !== source) translations[source] = translated;
      }
      resolve({
        html: Buffer.concat(chunks).toString("utf-8"),
        dehydratedState: dehydrate(queryClient, {
          shouldDehydrateQuery: (query) =>
            defaultShouldDehydrateQuery(query) ||
            (query.state.status === "error" && specs.some((spec) => spec.keepError && spec.queryKey[0] === query.queryKey[0])),
        }),
        translations,
        pageInfo,
      });
    })().catch(fail);
  });
}
