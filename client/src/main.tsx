import * as Sentry from "@sentry/react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { registerServiceWorker, unregisterStaleServiceWorker } from "./lib/pwa";
import { installChunkReloadHandlers } from "./lib/chunkReload";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  enabled: !!import.meta.env.VITE_SENTRY_DSN && import.meta.env.PROD,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({ maskAllText: false, blockAllMedia: false }),
  ],
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0.05,
  replaysOnErrorSampleRate: 1.0,
});

// Stale-tab / deploy-swap recovery for lazy chunks — see lib/chunkReload.ts.
installChunkReloadHandlers();

// Xpot was extracted on 2026-05-18 to its own standalone app at xpot.skale.club;
// the post-login bounce logic that lived here is now handled inside that app.

// Supabase OAuth can sometimes return to "/" (Site URL fallback). If we have a transient hint that
// the user is logging into the admin area, jump to /admin/login before rendering the homepage.
try {
  const raw = window.sessionStorage.getItem("adminPostLoginRedirect");
  if (raw && !window.location.pathname.startsWith("/admin")) {
    let ts: number | null = null;
    try {
      const parsed = JSON.parse(raw) as { ts?: unknown };
      ts = typeof parsed?.ts === "number" ? parsed.ts : null;
    } catch {
      // Old string format, no timestamp.
    }

    // If the hint is stale, drop it; otherwise route to the admin login screen.
    if (ts && Date.now() - ts > 10 * 60 * 1000) {
      window.sessionStorage.removeItem("adminPostLoginRedirect");
    } else {
      window.location.replace("/admin/login");
    }
  }
} catch {
  // Ignore storage/navigation errors.
}

// Fallback: hide loader after 5 seconds even if React fails to mount
setTimeout(() => {
  const loader = document.getElementById("initial-loader");
  if (loader) {
    loader.classList.add("loader-fade-out");
    setTimeout(() => loader.remove(), 150);
  }
}, 5000);

registerServiceWorker();
unregisterStaleServiceWorker();

createRoot(document.getElementById("root")!).render(<App />);
