import { Suspense } from "react";
import { Route, Switch } from "wouter";
import { AuthProvider } from "@/context/AuthContext";
import { PageLoader } from "@/components/ui/spinner";
import { lazyPage } from "@/lib/initialLoad";

// Everything that needs Supabase (AuthProvider, admin pages, OAuth consent) lives
// behind this lazy shell so `@supabase/*` stays out of the public entry chunk.
const loadAdmin = () => import("@/pages/Admin");
const Admin = lazyPage(loadAdmin);
// Start the (large) admin chunk now instead of after the shell renders.
// The review-link tool is opened on phones and never needs it, so skip it there.
if (window.location.pathname.startsWith("/admin") && !window.location.pathname.startsWith("/admin/review-link")) {
  void loadAdmin();
}
const AdminLogin = lazyPage(() => import("@/pages/AdminLogin"));
const AdminSignup = lazyPage(() => import("@/pages/AdminSignup"));
const NotFound = lazyPage(() => import("@/pages/not-found"));
const OAuthAuthorize = lazyPage(() => import("@/pages/OAuthAuthorize"));
// Full-screen, phone-first tool with its own installable manifest — outside the admin layout.
const ReviewLinkTool = lazyPage(() => import("@/pages/ReviewLinkTool"));
// Skale NFC phone app (/nfc/*): same idea, its own PWA scope and login screen.
const NfcApp = lazyPage(() => import("@/pages/NfcApp"));

export default function AdminShell({ kind, showLoader }: { kind: "admin" | "oauth"; showLoader: boolean }) {
  const fallback = showLoader ? <PageLoader /> : null;

  if (kind === "oauth") {
    return (
      <Suspense fallback={fallback}>
        <Switch>
          <Route path="/oauth/authorize" component={OAuthAuthorize} />
          <Route component={NotFound} />
        </Switch>
      </Suspense>
    );
  }

  return (
    <AuthProvider>
      <Suspense fallback={fallback}>
        <Switch>
          <Route path="/admin/login" component={AdminLogin} />
          <Route path="/admin/signup" component={AdminSignup} />
          <Route path="/admin/review-link" component={ReviewLinkTool} />
          <Route path="/nfc/*?" component={NfcApp} />
          <Route path="/admin/*?" component={Admin} />
          <Route component={NotFound} />
        </Switch>
      </Suspense>
    </AuthProvider>
  );
}
