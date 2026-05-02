import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { LanguageProvider } from "@/context/LanguageContext";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { useSEO } from "@/hooks/use-seo";
import { initAnalytics, trackPageView } from "@/lib/analytics";
import { getXpotAppUrl, isLocalHostname, isXpotHost } from "@/lib/xpot";
import { PageLoader, DotsLoader } from "@/components/ui/spinner";
import { useTranslation } from "@/hooks/useTranslation";
import { useEffect, Suspense, lazy, useRef, useState, createContext, useContext } from "react";
import type { CompanySettings } from "@shared/schema";
import { buildPagePaths, DEFAULT_PAGE_SLUGS, isRoutePrefixMatch } from "@shared/pageSlugs";
import { ChatWidget } from "@/components/chat/ChatWidget";

// Context to track initial app load state
const InitialLoadContext = createContext<{ isInitialLoad: boolean; markLoaded: () => void }>({
  isInitialLoad: true,
  markLoaded: () => { },
});

// Hook to hide initial loader after first page renders
function useHideInitialLoader() {
  const { isInitialLoad, markLoaded } = useContext(InitialLoadContext);
  const hasRun = useRef(false);

  useEffect(() => {
    if (isInitialLoad && !hasRun.current) {
      hasRun.current = true;
      const loader = document.getElementById("initial-loader");
      if (loader) {
        loader.classList.add("loader-fade-out");
        setTimeout(() => {
          loader.remove();
          markLoaded();
        }, 150);
      } else {
        markLoaded();
      }
    }
  }, [isInitialLoad, markLoaded]);
}

// Wrapper to call the hook when a lazy component mounts
function PageWrapper({ children }: { children: React.ReactNode }) {
  useHideInitialLoader();
  return <>{children}</>;
}

// Lazy load page components for route transitions
const NotFound = lazy(() => import("@/pages/not-found").then(m => ({ default: () => <PageWrapper><m.default /></PageWrapper> })));
const Home = lazy(() => import("@/pages/Home").then(m => ({ default: () => <PageWrapper><m.default /></PageWrapper> })));
const PublicForm = lazy(() => import("@/pages/PublicForm").then(m => ({ default: () => <PageWrapper><m.default /></PageWrapper> })));
const LeadThankYou = lazy(() => import("@/pages/LeadThankYou").then(m => ({ default: () => <PageWrapper><m.default /></PageWrapper> })));
const Admin = lazy(() => import("@/pages/Admin").then(m => ({ default: () => <PageWrapper><m.default /></PageWrapper> })));
const AdminLogin = lazy(() => import("@/pages/AdminLogin").then(m => ({ default: () => <PageWrapper><m.default /></PageWrapper> })));
const AdminSignup = lazy(() => import("@/pages/AdminSignup").then(m => ({ default: () => <PageWrapper><m.default /></PageWrapper> })));
const PrivacyPolicy = lazy(() => import("@/pages/PrivacyPolicy").then(m => ({ default: () => <PageWrapper><m.default /></PageWrapper> })));
const TermsOfService = lazy(() => import("@/pages/TermsOfService").then(m => ({ default: () => <PageWrapper><m.default /></PageWrapper> })));
const Contact = lazy(() => import("@/pages/Contact").then(m => ({ default: () => <PageWrapper><m.default /></PageWrapper> })));
const Faq = lazy(() => import("@/pages/Faq").then(m => ({ default: () => <PageWrapper><m.default /></PageWrapper> })));
const Blog = lazy(() => import("@/pages/Blog").then(m => ({ default: () => <PageWrapper><m.default /></PageWrapper> })));
const BlogPost = lazy(() => import("@/pages/BlogPost").then(m => ({ default: () => <PageWrapper><m.default /></PageWrapper> })));
const Portfolio = lazy(() => import("@/pages/Portfolio").then(m => ({ default: () => <PageWrapper><m.default /></PageWrapper> })));
const SkaleHub = lazy(() => import("@/pages/SkaleHub").then(m => ({ default: () => <PageWrapper><m.default /></PageWrapper> })));
const SkaleHubGroup = lazy(() => import("@/pages/SkaleHubGroup").then(m => ({ default: () => <PageWrapper><m.default /></PageWrapper> })));
const Links = lazy(() => import("@/pages/Links").then(m => ({ default: () => <PageWrapper><m.default /></PageWrapper> })));
const VCard = lazy(() => import("@/pages/VCard").then(m => ({ default: () => <PageWrapper><m.default /></PageWrapper> })));
const EstimateViewer = lazy(() => import("@/pages/EstimateViewer").then(m => ({ default: () => <PageWrapper><m.default /></PageWrapper> })));
const PresentationViewer = lazy(() => import("@/pages/PresentationViewer").then(m => ({ default: () => <PageWrapper><m.default /></PageWrapper> })));
const XpotApp = lazy(() => import("@/pages/XpotApp").then(m => ({ default: () => <PageWrapper><m.default /></PageWrapper> })));
const XpotLogin = lazy(() => import("@/pages/XpotLogin").then(m => ({ default: () => <PageWrapper><m.default /></PageWrapper> })));

function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const { data: settings } = useQuery<CompanySettings>({
    queryKey: ['/api/company-settings'],
  });
  const [location] = useLocation();

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
    trackPageView(location);
  }, [location]);

  return <>{children}</>;
}

function SEOProvider({ children }: { children: React.ReactNode }) {
  useSEO();
  return <>{children}</>;
}

function Router() {
  const [location, setLocation] = useLocation();
  const xpotHost = typeof window !== "undefined" && isXpotHost(window.location.hostname);
  const { isInitialLoad } = useContext(InitialLoadContext);
  const { data: settings, isLoading } = useQuery<CompanySettings>({
    queryKey: ['/api/company-settings'],
  });
  const pagePaths = buildPagePaths(settings?.pageSlugs);
  const legacyPaths = buildPagePaths(DEFAULT_PAGE_SLUGS);
  const isAdminRoute = location.startsWith('/admin');
  const isXpotRoute = xpotHost || location.startsWith('/xpot');
  const isLinksRoute = isRoutePrefixMatch(location, pagePaths.links) || isRoutePrefixMatch(location, legacyPaths.links);
  const isVCardRoute = isRoutePrefixMatch(location, pagePaths.vcard) || isRoutePrefixMatch(location, legacyPaths.vcard);
  const isEstimateRoute = location.startsWith('/e/');
  const isPresentationRoute = location.startsWith('/p/');
  const prevLocation = useRef(location);

  useEffect(() => {
    if (typeof window === "undefined" || !location.startsWith("/xpot") || xpotHost) {
      return;
    }

    const { hostname, origin } = window.location;
    if (isLocalHostname(hostname) || hostname.endsWith(".vercel.app")) {
      return;
    }

    const targetPath = location.replace(/^\/xpot/, "") || "/";
    const targetUrl = getXpotAppUrl(targetPath);
    if (targetUrl !== `${origin}${location}`) {
      window.location.replace(targetUrl);
    }
  }, [location, xpotHost]);

  // On xpot host, normalize /xpot/* paths → strip /xpot prefix
  useEffect(() => {
    if (!xpotHost || !location.startsWith("/xpot/")) {
      return;
    }
    setLocation(location.slice("/xpot".length));
  }, [location, xpotHost, setLocation]);

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

  if (isAdminRoute) {
    return (
      <AuthProvider>
        <Suspense fallback={fallback}>
          <Switch>
            <Route path="/admin/login" component={AdminLogin} />
            <Route path="/admin/signup" component={AdminSignup} />
            <Route path="/admin/*?" component={Admin} />
            <Route component={NotFound} />
          </Switch>
        </Suspense>
      </AuthProvider>
    );
  }

  if (isXpotRoute) {
    return (
      <Suspense fallback={fallback}>
        <Switch>
          {xpotHost ? (
            <>
              <Route path="/login" component={XpotLogin} />
              <Route path="/*?" component={XpotApp} />
            </>
          ) : (
            <>
              <Route path="/xpot/login" component={XpotLogin} />
              <Route path="/xpot/*?" component={XpotApp} />
            </>
          )}
          <Route component={NotFound} />
        </Switch>
      </Suspense>
    );
  }

  if (isLoading && !settings) {
    return fallback;
  }

  if (isLinksRoute) {
    return (
      <Suspense fallback={fallback}>
        <Switch>
          <Route path={pagePaths.links} component={Links} />
          {pagePaths.links !== legacyPaths.links && <Route path={legacyPaths.links} component={Links} />}
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
          {pagePaths.vcard !== legacyPaths.vcard && <Route path={legacyPaths.vcard} component={VCard} />}
          {pagePaths.vcardPattern !== legacyPaths.vcardPattern && <Route path={legacyPaths.vcardPattern} component={VCard} />}
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

  // Hide everything during initial load to prevent footer flash
  // The initial-loader in index.html covers the screen until content is ready
  return (
    <div className={`flex flex-col min-h-screen ${isInitialLoad ? 'invisible' : ''}`}>
      <Navbar />
      <main className="flex-grow">
        <Suspense fallback={fallback}>
          <Switch>
            <Route path="/" component={Home} />
            <Route path="/f/:slug" component={PublicForm} />
            <Route path={pagePaths.thankYou} component={LeadThankYou} />
            {pagePaths.thankYou !== legacyPaths.thankYou && <Route path={legacyPaths.thankYou} component={LeadThankYou} />}
            <Route path={pagePaths.privacyPolicy} component={PrivacyPolicy} />
            {pagePaths.privacyPolicy !== legacyPaths.privacyPolicy && <Route path={legacyPaths.privacyPolicy} component={PrivacyPolicy} />}
            <Route path={pagePaths.termsOfService} component={TermsOfService} />
            {pagePaths.termsOfService !== legacyPaths.termsOfService && <Route path={legacyPaths.termsOfService} component={TermsOfService} />}
            <Route path={pagePaths.contact} component={Contact} />
            {pagePaths.contact !== legacyPaths.contact && <Route path={legacyPaths.contact} component={Contact} />}
            <Route path={pagePaths.faq} component={Faq} />
            {pagePaths.faq !== legacyPaths.faq && <Route path={legacyPaths.faq} component={Faq} />}
            <Route path={pagePaths.blog} component={Blog} />
            {pagePaths.blog !== legacyPaths.blog && <Route path={legacyPaths.blog} component={Blog} />}
            <Route path={pagePaths.blogPostPattern} component={BlogPost} />
            {pagePaths.blogPostPattern !== legacyPaths.blogPostPattern && <Route path={legacyPaths.blogPostPattern} component={BlogPost} />}
            <Route path={pagePaths.portfolio} component={Portfolio} />
            {pagePaths.portfolio !== legacyPaths.portfolio && <Route path={legacyPaths.portfolio} component={Portfolio} />}
            <Route path={`${pagePaths.hub}/grupo`} component={SkaleHubGroup} />
            <Route path={`${pagePaths.hub}/group`} component={SkaleHubGroup} />
            {pagePaths.hub !== legacyPaths.hub && <Route path={`${legacyPaths.hub}/grupo`} component={SkaleHubGroup} />}
            {pagePaths.hub !== legacyPaths.hub && <Route path={`${legacyPaths.hub}/group`} component={SkaleHubGroup} />}
            <Route path={pagePaths.hub} component={SkaleHub} />
            {pagePaths.hub !== legacyPaths.hub && <Route path={legacyPaths.hub} component={SkaleHub} />}
            <Route component={NotFound} />
          </Switch>
        </Suspense>
      </main>
      <Footer />
      <ChatWidget />
    </div>
  );
}

function TranslationLoadingOverlay() {
  const { isTranslating } = useTranslation();
  if (!isTranslating) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#0f1014]/80 backdrop-blur-sm transition-opacity duration-200">
      <DotsLoader size="lg" />
    </div>
  );
}

function App() {
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const markLoaded = useRef(() => setIsInitialLoad(false)).current;

  return (
    <InitialLoadContext.Provider value={{ isInitialLoad, markLoaded }}>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <LanguageProvider>
              <SEOProvider>
                <AnalyticsProvider>
                  <Router />
                  <TranslationLoadingOverlay />
                </AnalyticsProvider>
              </SEOProvider>
            </LanguageProvider>
          </TooltipProvider>
        </QueryClientProvider>
      </ThemeProvider>
      <Toaster />
    </InitialLoadContext.Provider>
  );
}

export default App;
