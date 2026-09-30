import { Switch, Route, Redirect, Router as WouterRouter, useLocation } from "wouter";
import { usePathname } from "wouter/use-browser-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/context/ThemeContext";
import { LanguageProvider } from "@/context/LanguageContext";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { useSEO } from "@/hooks/use-seo";
import { initAnalytics, trackPageView } from "@/lib/analytics";
import { useAttribution } from "@/hooks/use-attribution";
import { PageLoader, DotsLoader } from "@/components/ui/spinner";
import { useTranslation } from "@/hooks/useTranslation";
import { useLanguageLocation, languageHref } from "@/lib/languageRouting";
import { splitLanguagePath } from "@shared/languagePath";
import { useEffect, Suspense, lazy, useMemo, useRef, useState, useContext } from "react";
import type { CompanySettings } from "@shared/schema";
import { buildPagePaths, DEFAULT_PAGE_SLUGS, isRoutePrefixMatch } from "@shared/pageSlugs";
import { RESERVED_SLUGS } from "@shared/reservedSlugs";
import * as Sentry from "@sentry/react";
import { MotionConfig } from "framer-motion";
import { AppErrorFallback } from "@/components/AppErrorFallback";
import { InitialLoadContext, PageWrapper } from "@/lib/initialLoad";
import { ChunkErrorBoundary } from "@/components/ChunkErrorBoundary";

// DEFAULT_PAGE_SLUGS never changes at runtime — compute once instead of on every Router render.
const LEGACY_PATHS = buildPagePaths(DEFAULT_PAGE_SLUGS);

// Lazy load page components for route transitions
const NotFound = lazy(() => import("@/pages/not-found").then(m => ({ default: () => <PageWrapper><m.default /></PageWrapper> })));
const Home = lazy(() => import("@/pages/Home").then(m => ({ default: () => <PageWrapper><m.default /></PageWrapper> })));
const PublicForm = lazy(() => import("@/pages/PublicForm").then(m => ({ default: () => <PageWrapper><m.default /></PageWrapper> })));
const NfcOrderForm = lazy(() => import("@/pages/NfcOrderForm").then(m => ({ default: () => <PageWrapper><m.default /></PageWrapper> })));
const NfcGuide = lazy(() => import("@/pages/NfcGuide").then(m => ({ default: () => <PageWrapper><m.default /></PageWrapper> })));
const LeadThankYou = lazy(() => import("@/pages/LeadThankYou").then(m => ({ default: () => <PageWrapper><m.default /></PageWrapper> })));
const PrivacyPolicy = lazy(() => import("@/pages/PrivacyPolicy").then(m => ({ default: () => <PageWrapper><m.default /></PageWrapper> })));
const TermsOfService = lazy(() => import("@/pages/TermsOfService").then(m => ({ default: () => <PageWrapper><m.default /></PageWrapper> })));
const Contact = lazy(() => import("@/pages/Contact").then(m => ({ default: () => <PageWrapper><m.default /></PageWrapper> })));
const Faq = lazy(() => import("@/pages/Faq").then(m => ({ default: () => <PageWrapper><m.default /></PageWrapper> })));
const Blog = lazy(() => import("@/pages/Blog").then(m => ({ default: () => <PageWrapper><m.default /></PageWrapper> })));
const BlogPost = lazy(() => import("@/pages/BlogPost").then(m => ({ default: () => <PageWrapper><m.default /></PageWrapper> })));
const Portfolio = lazy(() => import("@/pages/Portfolio").then(m => ({ default: () => <PageWrapper><m.default /></PageWrapper> })));
const SkaleHub = lazy(() => import("@/pages/SkaleHub").then(m => ({ default: () => <PageWrapper><m.default /></PageWrapper> })));
const Links = lazy(() => import("@/pages/Links").then(m => ({ default: () => <PageWrapper><m.default /></PageWrapper> })));
const VCard = lazy(() => import("@/pages/VCard").then(m => ({ default: () => <PageWrapper><m.default /></PageWrapper> })));
const EstimateViewer = lazy(() => import("@/pages/EstimateViewer").then(m => ({ default: () => <PageWrapper><m.default /></PageWrapper> })));
const PresentationViewer = lazy(() => import("@/pages/PresentationViewer").then(m => ({ default: () => <PageWrapper><m.default /></PageWrapper> })));
const PrintFolder = lazy(() => import("@/pages/PrintFolder").then(m => ({ default: () => <PageWrapper><m.default /></PageWrapper> })));
const DynamicPage = lazy(() => import("@/pages/DynamicLanding").then(m => ({ default: () => <PageWrapper><m.default /></PageWrapper> })));
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
  const pathname = usePathname();

  useEffect(() => {
    if (settings) {
      initAnalytics({
        gtmContainerId: settings.gtmContainerId || undefined,
        ga4MeasurementId: settings.ga4MeasurementId || undefined,
        facebookPixelId: settings.facebookPixelId || undefined,
        gtmEnabled: settings.gtmEnabled || false,
        ga4Enabled: settings.ga4Enabled || false,
        facebookPixelEnabled: settings.facebookPixelEnabled || false,
      });
    }
  }, [settings]);

  useEffect(() => {
    trackPageView(pathname);
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
  "oauth",
  "e",
  "p",
  "f",
  "print",
  "api",
  "assets",
  "nfc-order",
  "nfc-guide",
  ...Object.values(DEFAULT_PAGE_SLUGS),
  ...RESERVED_SLUGS,
]);

function Router() {
  const { t } = useTranslation();
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
  const isPrintRoute = location.startsWith('/print/');
  const isNfcOrderRoute = location === '/nfc-order';
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

  if (isNfcOrderRoute) {
    return (
      <Suspense fallback={fallback}>
        <Switch>
          <Route path="/nfc-order" component={NfcOrderForm} />
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
            {/* Legacy Skale Hub group URLs — 301 to managed landing /grupo (43-05).
                Production redirects run in server/canonicalHost.ts; these are the client-side fallback. */}
            <Route path={`${pagePaths.hub}/grupo`}>{() => <Redirect to="/grupo" />}</Route>
            <Route path={`${pagePaths.hub}/group`}>{() => <Redirect to="/grupo" />}</Route>
            {pagePaths.hub !== LEGACY_PATHS.hub && <Route path={`${LEGACY_PATHS.hub}/grupo`}>{() => <Redirect to="/grupo" />}</Route>}
            {pagePaths.hub !== LEGACY_PATHS.hub && <Route path={`${LEGACY_PATHS.hub}/group`}>{() => <Redirect to="/grupo" />}</Route>}
            <Route path={pagePaths.hub} component={SkaleHub} />
            {pagePaths.hub !== LEGACY_PATHS.hub && <Route path={LEGACY_PATHS.hub} component={SkaleHub} />}
            {/* /products/<slug> managed landings (scripts/seed-products-landing.ts).
                Bare "/products" needs no entry here — it's a single segment, so
                the catch-all "/:slug" below already resolves it. Must stay ABOVE
                that catch-all. See PRODUCT_ROUTES in shared/landingSeo.ts for the
                URL-segment -> DB-slug mapping these pages need on top of it. */}
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

function App() {
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const markLoaded = useRef(() => setIsInitialLoad(false)).current;

  return (
    <InitialLoadContext.Provider value={{ isInitialLoad, markLoaded }}>
      <MotionConfig reducedMotion="user">
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <WouterRouter hook={useLanguageLocation} hrefs={languageHref}>
              <LanguageProvider>
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
}

export default App;
