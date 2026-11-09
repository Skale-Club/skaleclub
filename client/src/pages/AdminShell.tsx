import { Suspense } from "react";
import { Route, Switch } from "wouter";
import { AuthProvider } from "@/context/AuthContext";
import { PageLoader } from "@/components/ui/spinner";
import { lazyPage } from "@/lib/initialLoad";

// Everything that needs sign-in (AuthProvider, admin pages, OAuth consent) lives
// behind this lazy shell so Firebase and the admin code stay out of the public entry chunk.
const loadAdmin = () => import("@/pages/Admin");
const Admin = lazyPage(loadAdmin);
// Start the (large) admin chunk now instead of after the shell renders.
if (window.location.pathname.startsWith("/admin")) {
  void loadAdmin();
}
const AdminLogin = lazyPage(() => import("@/pages/AdminLogin"));
const AdminNotInvited = lazyPage(() => import("@/pages/AdminNotInvited"));
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
          <Route path="/admin/not-invited" component={AdminNotInvited} />
          <Route path="/admin/*?" component={Admin} />
          <Route component={NotFound} />
        </Switch>
      </Suspense>
    </AuthProvider>
  );
}
