import { Switch, Route, Redirect, Router as WouterRouter, useLocation } from "wouter";
import { queryClient as browserQueryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/context/ThemeContext";
import { LanguageProvider, type PageLanguageInfo } from "@/context/LanguageContext";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { useSEO } from "@/hooks/use-seo";
import { initAnalytics, trackPageView } from "@/lib/analytics";
import { useAttribution } from "@/hooks/use-attribution";
import { PageLoader, DotsLoader } from "@/components/ui/spinner";
import { useTranslation } from "@/hooks/useTranslation";
import { useLanguageLocation, languageHref, useRawPathname } from "@/lib/languageRouting";
import { splitLanguagePath } from "@shared/languagePath";
import { useEffect, Suspense, lazy, useMemo, useRef, useState, useContext } from "react";
import type { CompanySettings } from "@shared/schema";
import { buildPagePaths, DEFAULT_PAGE_SLUGS, isRoutePrefixMatch } from "@shared/pageSlugs";
import { RESERVED_SLUGS } from "@shared/reservedSlugs";
import * as Sentry from "@sentry/react";
import { MotionConfig } from "framer-motion";
import { AppErrorFallback } from "@/components/AppErrorFallback";
import { InitialLoadContext, lazyPage, clearInitialShell } from "@/lib/initialLoad";
import { INITIAL_SHELL_TIMEOUT_MS } from "@/lib/initial-shell";
import type { PageSlugs } from "@shared/pageSlugs";
import { ChunkErrorBoundary } from "@/components/ChunkErrorBoundary";

// DEFAULT_PAGE_SLUGS never changes at runtime — compute once instead of on every Router render.
const LEGACY_PATHS = buildPagePaths(DEFAULT_PAGE_SLUGS);

// One importer per page. Each is called both by the lazy() wrapper below and by
// preloadRouteForPath(), so the dynamic import() is written once per page. A second
// copy would be a second chunk request on the wire.
const pageImporters = {
  notFound: () => import("@/pages/not-found"),
  home: () => import("@/pages/Home"),
  publicForm: () => import("@/pages/PublicForm"),
  nfcOrderForm: () => import("@/pages/NfcOrderForm"),
  plaqueOrderForm: () => import("@/pages/PlaqueOrderForm"),
  svgVectorizer: () => import("@/pages/SvgVectorizer"),
  nfcGuide: () => import("@/pages/NfcGuide"),
  leadThankYou: () => import("@/pages/LeadThankYou"),
  privacyPolicy: () => import("@/pages/PrivacyPolicy"),
  termsOfService: () => import("@/pages/TermsOfService"),
  contact: () => import("@/pages/Contact"),
  faq: () => import("@/pages/Faq"),
  blog: () => import("@/pages/Blog"),
  blogPost: () => import("@/pages/BlogPost"),
  portfolio: () => import("@/pages/Portfolio"),
  apps: () => import("@/pages/Apps"),
  services: () => import("@/pages/Services"),
  products: () => import("@/pages/Products"),
  skaleHub: () => import("@/pages/SkaleHub"),
  links: () => import("@/pages/Links"),
  vcard: () => import("@/pages/VCard"),
  estimateViewer: () => import("@/pages/EstimateViewer"),
  contractSigning: () => import("@/pages/ContractSigning"),
  presentationViewer: () => import("@/pages/PresentationViewer"),
  whiteboardViewer: () => import("@/pages/WhiteboardViewer"),
  boardViewer: () => import("@/pages/BoardViewer"),
  printFolder: () => import("@/pages/PrintFolder"),
  dynamicPage: () => import("@/pages/DynamicLanding"),
} as const;

// Lazy load page components for route transitions
const NotFound = lazyPage(pageImporters.notFound);
const Home = lazyPage(pageImporters.home);
const PublicForm = lazyPage(pageImporters.publicForm);
const NfcOrderForm = lazyPage(pageImporters.nfcOrderForm);
const PlaqueOrderForm = lazyPage(pageImporters.plaqueOrderForm);
const SvgVectorizer = lazyPage(pageImporters.svgVectorizer);
const NfcGuide = lazyPage(pageImporters.nfcGuide);
const LeadThankYou = lazyPage(pageImporters.leadThankYou);
const PrivacyPolicy = lazyPage(pageImporters.privacyPolicy);
const TermsOfService = lazyPage(pageImporters.termsOfService);
const Contact = lazyPage(pageImporters.contact);
const Faq = lazyPage(pageImporters.faq);
const Blog = lazyPage(pageImporters.blog);
const BlogPost = lazyPage(pageImporters.blogPost);
const Portfolio = lazyPage(pageImporters.portfolio);
const Apps = lazyPage(pageImporters.apps);
const Services = lazyPage(pageImporters.services);
const Products = lazyPage(pageImporters.products);
const SkaleHub = lazyPage(pageImporters.skaleHub);
const Links = lazyPage(pageImporters.links);
const VCard = lazyPage(pageImporters.vcard);
const EstimateViewer = lazyPage(pageImporters.estimateViewer);
const ContractSigning = lazyPage(pageImporters.contractSigning);
const PresentationViewer = lazyPage(pageImporters.presentationViewer);
const WhiteboardViewer = lazyPage(pageImporters.whiteboardViewer);
const BoardViewer = lazyPage(pageImporters.boardViewer);
const PrintFolder = lazyPage(pageImporters.printFolder);
const DynamicPage = lazyPage(pageImporters.dynamicPage);
// Admin + OAuth live in one lazy shell so AuthProvider and @supabase/* leave the entry chunk.
const AdminShell = lazy(() => import("@/pages/AdminShell"));

// Chat is never needed for first paint: mount it once the browser is idle.
const ChatWidget = lazy(() =>
  import("@/components/chat/ChatWidget")
    .then((m) => ({ default: m.ChatWidget }))
    .catch(() => ({ default: () => null })),
);

function DeferredChatWidget() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (w.requestIdleCallback && w.cancelIdleCallback) {
      const id = w.requestIdleCallback(() => setReady(true), { timeout: 4000 });
      return () => w.cancelIdleCallback?.(id);
    }
    const id = window.setTimeout(() => setReady(true), 2000);
    return () => window.clearTimeout(id);
  }, []);
  return ready ? (
    <Suspense fallback={null}>
      <ChatWidget />
    </Suspense>
  ) : null;
}

function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const { data: settings } = useQuery<CompanySettings>({
    queryKey: ['/api/company-settings'],
  });
  // Raw pathname so `/br` page views are reported under their real URL
  const pathname = useRawPathname();

  useEffect(() => {
    if (settings && !pathname.startsWith('/contracts/')) {
      initAnalytics({
        gtmContainerId: settings.gtmContainerId || undefined,
        ga4MeasurementId: settings.ga4MeasurementId || undefined,
        facebookPixelId: settings.facebookPixelId || undefined,
        gtmEnabled: settings.gtmEnabled || false,
        ga4Enabled: settings.ga4Enabled || false,
        facebookPixelEnabled: settings.facebookPixelEnabled || false,
      });
    }
  }, [settings, pathname]);

  useEffect(() => {
    if (!pathname.startsWith('/contracts/')) trackPageView(pathname);
  }, [pathname]);

  // Phase 45 — mount the marketing attribution lifecycle alongside GTM/GA4 tracking.
  // The hook has its own /admin guard via isAttributionIgnoredPath, so admin routes
  // are skipped automatically. Runs in the same lifecycle scope as trackPageView.
  useAttribution();

  return <>{children}</>;
}

function SEOProvider({ children }: { children: React.ReactNode }) {
  useSEO();
  return <>{children}</>;
}

// First path segments that are never a managed-landing slug — either handled by a
// dedicated route above the DynamicPage catch-all, or reserved static UI paths.
const RESERVED_LANDING_SEGMENTS = new Set<string>([
  "admin",
  "contracts",
  "oauth",
  "e",
  "p",
  "w",
  "b",
  "f",
  "print",
  "api",
  "assets",
  "nfc-order",
  "plaque-order",
  "nfc-guide",
  "products",
  ...Object.values(DEFAULT_PAGE_SLUGS),
  ...RESERVED_SLUGS,
]);

function Router() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [location] = useLocation();
  const { isInitialLoad } = useContext(InitialLoadContext);
  const { data: settings, isLoading, errorUpdateCount } = useQuery<CompanySettings>({
    queryKey: ['/api/company-settings'],
  });
  const pagePaths = useMemo(() => buildPagePaths(settings?.pageSlugs), [settings?.pageSlugs]);

  // Prefetch the landing row in parallel with /api/company-settings instead of
  // waiting for it to resolve before DynamicLanding even mounts — cuts a sequential
  // round trip on every ad landing. Runs once on mount, off of window.location so it
  // fires before the settings-driven route matching above even completes.
  useEffect(() => {
    const { path, language } = splitLanguagePath(window.location.pathname);
    const match = path.match(/^\/([a-z0-9-]+)\/?$/);
    if (!match) return;
    const [, first] = match;
    if (RESERVED_LANDING_SEGMENTS.has(first)) return;
    const slug = language === "pt" ? `${first}-br` : first;
    void queryClient.prefetchQuery({ queryKey: [`/api/pages/slug/${slug}`], retry: false });
    // Mount-only: this is a one-shot prefetch racing the initial settings fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const isOAuthRoute = location.startsWith('/oauth/');
  const isAdminRoute = location.startsWith('/admin');
  const isLinksRoute = isRoutePrefixMatch(location, pagePaths.links) || isRoutePrefixMatch(location, LEGACY_PATHS.links);
  const isVCardRoute = isRoutePrefixMatch(location, pagePaths.vcard) || isRoutePrefixMatch(location, LEGACY_PATHS.vcard);
  const isEstimateRoute = location.startsWith('/e/');
  const isPresentationRoute = location.startsWith('/p/');
  const isWhiteboardRoute = location.startsWith('/w/');
  const isBoardRoute = location.startsWith('/b/');
  const isPrintRoute = location.startsWith('/print/');
  // Full-screen order pages: no navbar, footer or chat widget.
  const isOrderRoute = location === '/nfc-order' || location === '/plaque-order';
  const prevLocation = useRef(location);

  // Xpot was extracted to a standalone app on xpot.skale.club.
  // Any leftover /xpot/* request hitting this app falls through to the catch-all 404,
  // or is redirected at the proxy layer (preferred for SEO).

  // Scroll to top when navigating to a new page (not hash links)
  useEffect(() => {
    // Skip if it's the same path (hash change only) or initial load
    if (prevLocation.current !== location && !isInitialLoad) {
      // Don't scroll if there's a hash in the URL (handled by the page itself)
      if (!window.location.hash) {
        window.scrollTo({ top: 0, behavior: 'instant' });
      }
    }
    prevLocation.current = location;
  }, [location, isInitialLoad]);

  // During initial load, show PageLoader for route transitions
  const fallback = isInitialLoad ? null : <PageLoader />;

  if (isOAuthRoute || isAdminRoute) {
    return (
      <Suspense fallback={fallback}>
        <AdminShell kind={isOAuthRoute ? "oauth" : "admin"} showLoader={!isInitialLoad} />
      </Suspense>
    );
  }

  if (location.startsWith('/contracts/')) {
    return <Suspense fallback={fallback}><Switch><Route path="/contracts/:id" component={ContractSigning} /><Route component={NotFound} /></Switch></Suspense>;
  }

  // Block only the first load. A refetch after a failure puts the query back in
  // "pending" (it has no data), and gating on that would unmount the whole layout
  // (Navbar, page, lead forms, ChatWidget) and, if anything refetches it again on
  // remount, loop. Once it has failed, the site renders with default slugs instead.
  if (isLoading && errorUpdateCount === 0) {
    return fallback;
  }

  if (isLinksRoute) {
    return (
      <Suspense fallback={fallback}>
        <Switch>
          <Route path={pagePaths.links} component={Links} />
          {pagePaths.links !== LEGACY_PATHS.links && <Route path={LEGACY_PATHS.links} component={Links} />}
          <Route component={NotFound} />
        </Switch>
      </Suspense>
    );
  }

  if (isVCardRoute) {
    return (
      <Suspense fallback={fallback}>
        <Switch>
          <Route path={pagePaths.vcard} component={VCard} />
          <Route path={pagePaths.vcardPattern} component={VCard} />
          {pagePaths.vcard !== LEGACY_PATHS.vcard && <Route path={LEGACY_PATHS.vcard} component={VCard} />}
          {pagePaths.vcardPattern !== LEGACY_PATHS.vcardPattern && <Route path={LEGACY_PATHS.vcardPattern} component={VCard} />}
          <Route component={NotFound} />
        </Switch>
      </Suspense>
    );
  }

  if (isEstimateRoute) {
    return (
      <Suspense fallback={fallback}>
        <Switch>
          <Route path="/e/:slug" component={EstimateViewer} />
          <Route component={NotFound} />
        </Switch>
      </Suspense>
    );
  }

  if (isPresentationRoute) {
    return (
      <Suspense fallback={fallback}>
        <Switch>
          <Route path="/p/:slug" component={PresentationViewer} />
          <Route component={NotFound} />
        </Switch>
      </Suspense>
    );
  }

  if (isWhiteboardRoute) {
    return (
      <Suspense fallback={fallback}>
        <Switch>
          <Route path="/w/:slug" component={WhiteboardViewer} />
          <Route component={NotFound} />
        </Switch>
      </Suspense>
    );
  }

  if (isBoardRoute) {
    return (
      <Suspense fallback={fallback}>
        <Switch>
          <Route path="/b/:slug" component={BoardViewer} />
          <Route component={NotFound} />
        </Switch>
      </Suspense>
    );
  }

  if (isPrintRoute) {
    return (
      <Suspense fallback={fallback}>
        <Switch>
          <Route path="/print/folder" component={PrintFolder} />
          <Route component={NotFound} />
        </Switch>
      </Suspense>
    );
  }

  if (isOrderRoute) {
    return (
      <Suspense fallback={fallback}>
        <Switch>
          <Route path="/nfc-order" component={NfcOrderForm} />
          <Route path="/plaque-order" component={PlaqueOrderForm} />
          <Route component={NotFound} />
        </Switch>
      </Suspense>
    );
  }

  // Hide everything during initial load to prevent footer flash
  // The initial-loader in index.html covers the screen until content is ready
  return (
    <div className={`flex flex-col min-h-screen ${isInitialLoad ? 'invisible' : ''}`}>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-cta focus:px-5 focus:py-3 focus:font-bold focus:text-white"
      >
        {t("Skip to content")}
      </a>
      <Navbar />
      <main id="main" tabIndex={-1} className="flex flex-col flex-grow focus:outline-none">
        <Suspense fallback={fallback}>
          <Switch>
            <Route path="/" component={Home} />
            <Route path="/f/:slug" component={PublicForm} />
            <Route path="/nfc-guide" component={NfcGuide} />
            <Route path="/svg" component={SvgVectorizer} />
            <Route path={pagePaths.thankYou} component={LeadThankYou} />
            {pagePaths.thankYou !== LEGACY_PATHS.thankYou && <Route path={LEGACY_PATHS.thankYou} component={LeadThankYou} />}
            <Route path={pagePaths.privacyPolicy} component={PrivacyPolicy} />
            {pagePaths.privacyPolicy !== LEGACY_PATHS.privacyPolicy && <Route path={LEGACY_PATHS.privacyPolicy} component={PrivacyPolicy} />}
            <Route path={pagePaths.termsOfService} component={TermsOfService} />
            {pagePaths.termsOfService !== LEGACY_PATHS.termsOfService && <Route path={LEGACY_PATHS.termsOfService} component={TermsOfService} />}
            <Route path={pagePaths.contact} component={Contact} />
            {pagePaths.contact !== LEGACY_PATHS.contact && <Route path={LEGACY_PATHS.contact} component={Contact} />}
            <Route path={pagePaths.faq} component={Faq} />
            {pagePaths.faq !== LEGACY_PATHS.faq && <Route path={LEGACY_PATHS.faq} component={Faq} />}
            <Route path={pagePaths.blog} component={Blog} />
            {pagePaths.blog !== LEGACY_PATHS.blog && <Route path={LEGACY_PATHS.blog} component={Blog} />}
            <Route path={pagePaths.blogPostPattern} component={BlogPost} />
            {pagePaths.blogPostPattern !== LEGACY_PATHS.blogPostPattern && <Route path={LEGACY_PATHS.blogPostPattern} component={BlogPost} />}
            <Route path={pagePaths.portfolio} component={Portfolio} />
            {pagePaths.portfolio !== LEGACY_PATHS.portfolio && <Route path={LEGACY_PATHS.portfolio} component={Portfolio} />}
            {/* The portfolio's category pages; fixed paths, reserved in shared/reservedSlugs.ts. */}
            <Route path="/apps" component={Apps} />
            <Route path="/services" component={Services} />
            {/* /products is the third category page (React, like /apps and /services).
                The "products" DB row (scripts/seed-products-landing.ts) is no longer
                rendered here; the server still reads its SEO from LANDING_SEO. */}
            <Route path="/products" component={Products} />
            {/* Legacy Skale Hub group URLs — 301 to managed landing /grupo (43-05).
                Production redirects run in server/canonicalHost.ts; these are the client-side fallback. */}
            <Route path={`${pagePaths.hub}/grupo`}>{() => <Redirect to="/grupo" />}</Route>
            <Route path={`${pagePaths.hub}/group`}>{() => <Redirect to="/grupo" />}</Route>
            {pagePaths.hub !== LEGACY_PATHS.hub && <Route path={`${LEGACY_PATHS.hub}/grupo`}>{() => <Redirect to="/grupo" />}</Route>}
            {pagePaths.hub !== LEGACY_PATHS.hub && <Route path={`${LEGACY_PATHS.hub}/group`}>{() => <Redirect to="/grupo" />}</Route>}
            <Route path={pagePaths.hub} component={SkaleHub} />
            {pagePaths.hub !== LEGACY_PATHS.hub && <Route path={LEGACY_PATHS.hub} component={SkaleHub} />}
            {/* /products/<slug> managed landings (scripts/seed-products-landing.ts).
                Bare "/products" is the React category page above. Must stay ABOVE
                the catch-all. See PRODUCT_ROUTES in shared/landingSeo.ts for the
                URL-segment -> DB-slug mapping these pages need on top of it. */}
            {/* The keychain product is its landing (server/canonicalHost.ts 301s it). */}
            <Route path="/products/nfc-keychains">{() => <Redirect to="/nfc-keychains" />}</Route>
            <Route path="/products/:slug" component={DynamicPage} />
            {/* The review-plaque product's DB slug equals its own URL segment, so
                the bare "/:slug" catch-all below would also resolve it directly.
                301 it to the /products/ URL (server/canonicalHost.ts does this
                for a real navigation; this is the client-side fallback, same
                pattern as the Skale Hub group redirects above). Not needed for
                "nfc-keychains": that bare segment is a different, existing page. */}
            <Route path="/nfc-review-plaque">{() => <Redirect to="/products/nfc-review-plaque" />}</Route>
            {/* Catch-all dynamic landing route — MUST be last before the 404 fallback.
                Wouter matches top-down, so any new known route must be added ABOVE this line.
                A `/br` prefix never reaches the routes (useLanguageLocation strips it):
                `/br/x` matches here as `/x` and DynamicLanding resolves the `x-br` row. */}
            <Route path="/:slug" component={DynamicPage} />
            <Route component={NotFound} />
          </Switch>
        </Suspense>
      </main>
      <Footer />
      <DeferredChatWidget />
    </div>
  );
}

function TranslationLoadingOverlay() {
  const { isTranslating } = useTranslation();
  if (!isTranslating) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-navy-950/80 backdrop-blur-sm transition-opacity duration-200">
      <DotsLoader size="lg" />
    </div>
  );
}

/**
 * Starts loading the lazy route chunk for `pathname` and returns its promise (null when
 * the path is not server-rendered).
 *
 * client/src/main.tsx awaits this before hydrateRoot() on a server-rendered page. Without
 * it the route's Suspense boundary is still unresolved when hydration starts, and any
 * state change in that window makes React throw the server markup away and client-render
 * it, which is the flash this whole change exists to remove.
 *
 * Mirrors the public <Switch> in Router() below: a route added to one needs adding to the
 * other. Admin, OAuth and the viewer routes are never server-rendered, so they return null.
 */
export function preloadRouteForPath(rawPathname: string, pageSlugs?: Partial<PageSlugs> | null): Promise<unknown> | null {
  try {
    const path = splitLanguagePath(rawPathname).path;
    if (path === "/") return pageImporters.home();
    const paths = buildPagePaths(pageSlugs);
    const exact: Array<[string, () => Promise<unknown>]> = [
      [paths.privacyPolicy, pageImporters.privacyPolicy],
      [paths.termsOfService, pageImporters.termsOfService],
      [paths.contact, pageImporters.contact],
      [paths.faq, pageImporters.faq],
      [paths.blog, pageImporters.blog],
      [paths.portfolio, pageImporters.portfolio],
      [paths.hub, pageImporters.skaleHub],
      ["/apps", pageImporters.apps],
      ["/services", pageImporters.services],
      ["/products", pageImporters.products],
      ["/nfc-guide", pageImporters.nfcGuide],
    ];
    for (const [route, importer] of exact) {
      if (path === route) return importer();
    }
    if (isRoutePrefixMatch(path, paths.blog) && path.split("/").length === paths.blog.split("/").length + 1) {
      return pageImporters.blogPost();
    }
    // Everything else public (managed landings, /products/<slug>) is the /:slug catch-all.
    if (/^\/[^/]+$/.test(path) || /^\/products\/[^/]+$/.test(path)) return pageImporters.dynamicPage();
    return null;
  } catch {
    return null;
  }
}

function App({
  ssrPath,
  serverRendered = false,
  queryClient: injectedQueryClient,
  initialPageInfo,
}: {
  /** Server render only: the request path, which wouter has no `window.location` to read. */
  ssrPath?: string;
  /**
   * True when the server already put the page in #root. It must be passed identically on
   * both sides of hydration (client/src/entry-server.tsx and client/src/main.tsx): it
   * decides whether the shell starts `invisible`, and a difference makes React discard the
   * server markup.
   */
  serverRendered?: boolean;
  /**
   * Server render only. The browser uses the module-level singleton, which is right for
   * one tab. On the server one process renders every request, so a shared cache would
   * leak one visitor's data into another's render: entry-server.tsx builds a fresh
   * QueryClient per request and passes it in.
   */
  queryClient?: QueryClient;
  /** Server-rendered managed landing whose language differs from its URL: see LanguageProvider. */
  initialPageInfo?: PageLanguageInfo | null;
} = {}) {
  // The pre-React loader (and the text fallback) cover the page until the first route
  // mounts. When the server rendered the real page there is nothing to hide: starting
  // `invisible` would ship the HTML hidden and read as empty to a crawler.
  const [isInitialLoad, setIsInitialLoad] = useState(!serverRendered);
  const markLoaded = useRef(() => setIsInitialLoad(false)).current;

  // Never let the shell stay hidden: if no route ever mounts (a chunk that stalls, a query
  // that hangs) reveal whatever has rendered after a fixed ceiling.
  useEffect(() => {
    const timer = setTimeout(() => {
      clearInitialShell();
      markLoaded();
    }, INITIAL_SHELL_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [markLoaded]);

  const tree = (
    <InitialLoadContext.Provider value={{ isInitialLoad, markLoaded }}>
      <MotionConfig reducedMotion="user">
      <ThemeProvider>
        <QueryClientProvider client={injectedQueryClient ?? browserQueryClient}>
          <TooltipProvider>
            <WouterRouter hook={useLanguageLocation} hrefs={languageHref} ssrPath={ssrPath}>
              <LanguageProvider initialPageInfo={initialPageInfo}>
                <SEOProvider>
                  <AnalyticsProvider>
                    <Sentry.ErrorBoundary fallback={<AppErrorFallback />}>
                      <ChunkErrorBoundary>
                        <Router />
                      </ChunkErrorBoundary>
                    </Sentry.ErrorBoundary>
                    <TranslationLoadingOverlay />
                  </AnalyticsProvider>
                </SEOProvider>
              </LanguageProvider>
            </WouterRouter>
          </TooltipProvider>
        </QueryClientProvider>
      </ThemeProvider>
      </MotionConfig>
      <Toaster />
    </InitialLoadContext.Provider>
  );

  // ThemeProvider sits above the language-aware router below and reads the location from
  // wouter's default one. In the browser that reads `window.location`; on the server it
  // needs the request path, which only a router carrying `ssrPath` can supply.
  return ssrPath !== undefined ? <WouterRouter ssrPath={ssrPath}>{tree}</WouterRouter> : tree;
}

export default App;
