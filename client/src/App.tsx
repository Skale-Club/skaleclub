import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CartProvider } from "@/context/CartContext";
import { AuthProvider } from "@/context/AuthContext";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { useSEO } from "@/hooks/use-seo";
import { initAnalytics, trackPageView } from "@/lib/analytics";
import { useEffect } from "react";
import type { CompanySettings } from "@shared/schema";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import Services from "@/pages/Services";
import BookingPage from "@/pages/BookingPage";
import Confirmation from "@/pages/Confirmation";
import Admin from "@/pages/Admin";
import AdminLogin from "@/pages/AdminLogin";
import PrivacyPolicy from "@/pages/PrivacyPolicy";
import TermsOfService from "@/pages/TermsOfService";
import AboutUs from "@/pages/AboutUs";
import Contact from "@/pages/Contact";
import Faq from "@/pages/Faq";

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
  const isAdminRoute = location.startsWith('/admin');

  if (isAdminRoute) {
    return (
      <Switch>
        <Route path="/admin/login" component={AdminLogin} />
        <Route path="/admin" component={Admin} />
        <Route component={NotFound} />
      </Switch>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-grow">
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
          <Route component={NotFound} />
        </Switch>
      </main>
      <Footer />
    </div>
  );
}

function App() {
  return (
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
  );
}

export default App;
