import { Suspense } from "react";
import { Route, Switch } from "wouter";
import { AuthProvider } from "@/context/AuthContext";
import { PageLoader } from "@/components/ui/spinner";
import { lazyPage } from "@/lib/initialLoad";

// Everything that needs Supabase (AuthProvider, admin pages, OAuth consent) lives
// behind this lazy shell so `@supabase/*` stays out of the public entry chunk.
const Admin = lazyPage(() => import("@/pages/Admin"));
const AdminLogin = lazyPage(() => import("@/pages/AdminLogin"));
const AdminSignup = lazyPage(() => import("@/pages/AdminSignup"));
const NotFound = lazyPage(() => import("@/pages/not-found"));
const OAuthAuthorize = lazyPage(() => import("@/pages/OAuthAuthorize"));

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
          <Route path="/admin/*?" component={Admin} />
          <Route component={NotFound} />
        </Switch>
      </Suspense>
    </AuthProvider>
  );
}
