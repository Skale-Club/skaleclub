import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CartProvider } from "@/context/CartContext";
import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { useSEO } from "@/hooks/use-seo";
import { initAnalytics, trackPageView } from "@/lib/analytics";
import { PageLoader } from "@/components/ui/spinner";
import { useEffect, Suspense, lazy, useRef, useState, createContext, useContext } from "react";
import type { CompanySettings } from "@shared/schema";
import { ChatWidget } from "@/components/chat/ChatWidget";

// Context to track initial app load state
const InitialLoadContext = createContext<{ isInitialLoad: boolean; markLoaded: () => void }>({
  isInitialLoad: true,
  markLoaded: () => {},
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
const Services = lazy(() => import("@/pages/Services").then(m => ({ default: () => <PageWrapper><m.default /></PageWrapper> })));
const BookingPage = lazy(() => import("@/pages/BookingPage").then(m => ({ default: () => <PageWrapper><m.default /></PageWrapper> })));
const Confirmation = lazy(() => import("@/pages/Confirmation").then(m => ({ default: () => <PageWrapper><m.default /></PageWrapper> })));
const Admin = lazy(() => import("@/pages/Admin").then(m => ({ default: () => <PageWrapper><m.default /></PageWrapper> })));
const AdminLogin = lazy(() => import("@/pages/AdminLogin").then(m => ({ default: () => <PageWrapper><m.default /></PageWrapper> })));
const PrivacyPolicy = lazy(() => import("@/pages/PrivacyPolicy").then(m => ({ default: () => <PageWrapper><m.default /></PageWrapper> })));
const TermsOfService = lazy(() => import("@/pages/TermsOfService").then(m => ({ default: () => <PageWrapper><m.default /></PageWrapper> })));
const AboutUs = lazy(() => import("@/pages/AboutUs").then(m => ({ default: () => <PageWrapper><m.default /></PageWrapper> })));
const Contact = lazy(() => import("@/pages/Contact").then(m => ({ default: () => <PageWrapper><m.default /></PageWrapper> })));
const Faq = lazy(() => import("@/pages/Faq").then(m => ({ default: () => <PageWrapper><m.default /></PageWrapper> })));
const Blog = lazy(() => import("@/pages/Blog").then(m => ({ default: () => <PageWrapper><m.default /></PageWrapper> })));
const BlogPost = lazy(() => import("@/pages/BlogPost").then(m => ({ default: () => <PageWrapper><m.default /></PageWrapper> })));

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
  const [location] = useLocation();
  const { isInitialLoad } = useContext(InitialLoadContext);
  const isAdminRoute = location.startsWith('/admin');
  const prevLocation = useRef(location);

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
      <Suspense fallback={fallback}>
        <Switch>
          <Route path="/admin/login" component={AdminLogin} />
          <Route path="/admin" component={Admin} />
          <Route path="/admin/:rest*" component={Admin} />
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
            <Route path="/services" component={Services} />
            <Route path="/booking" component={BookingPage} />
            <Route path="/confirmation" component={Confirmation} />
            <Route path="/privacy-policy" component={PrivacyPolicy} />
            <Route path="/terms-of-service" component={TermsOfService} />
            <Route path="/about" component={AboutUs} />
            <Route path="/contact" component={Contact} />
            <Route path="/faq" component={Faq} />
            <Route path="/blog" component={Blog} />
            <Route path="/blog/:slug" component={BlogPost} />
            <Route component={NotFound} />
          </Switch>
        </Suspense>
      </main>
      <Footer />
      <ChatWidget />
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
            <AuthProvider>
              <CartProvider>
                <SEOProvider>
                  <AnalyticsProvider>
                    <Router />
                  </AnalyticsProvider>
                </SEOProvider>
              </CartProvider>
            </AuthProvider>
          </TooltipProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </InitialLoadContext.Provider>
  );
}

export default App;
