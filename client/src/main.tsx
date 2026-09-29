import * as Sentry from "@sentry/react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { registerServiceWorker, unregisterStaleServiceWorker } from "./lib/pwa";
import { installChunkReloadHandlers } from "./lib/chunkReload";

function sentryEnvironment(): string {
  const host = window.location.hostname;
  if (host === "skale.club" || host === "www.skale.club") return "production";
  if (host.startsWith("skaleclub-stage.")) return "staging";
  return "development";
}

// Session Replay is ~50 KB: load it only after the first error is captured, so
// visitors who never hit one never download it. That first error itself has no
// replay; every later one does (replaysOnErrorSampleRate below).
let replayRequested = false;
function loadReplayOnce() {
  if (replayRequested) return;
  replayRequested = true;
  Sentry.lazyLoadIntegration("replayIntegration")
    .then((replayIntegration) => {
      Sentry.addIntegration(replayIntegration({ maskAllText: true, blockAllMedia: false }));
    })
    .catch(() => {
      // CDN blocked (ad blocker, CSP): replays are best-effort.
    });
}

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: sentryEnvironment(),
  release: import.meta.env.VITE_RELEASE || undefined,
  enabled: !!import.meta.env.VITE_SENTRY_DSN && import.meta.env.PROD,
  integrations: [Sentry.browserTracingIntegration()],
  // TODO: enable once the server exposes the Sentry tunnel route (avoids ad-blocker loss):
  // tunnel: "/api/monitoring",
  tracesSampleRate: 0.1,
  // Only record replays when an error happens: session replays of normal traffic
  // burned the org-wide Sentry replay quota. Errors still get a full replay.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,
  ignoreErrors: [
    "ResizeObserver loop",
    // Handled by lib/chunkReload.ts (reload + fallback UI).
    "Failed to fetch dynamically imported module",
  ],
  denyUrls: [
    /extensions\//i,
    /^chrome:\/\//i,
    /^chrome-extension:\/\//i,
    /^moz-extension:\/\//i,
    /^safari-(web-)?extension:\/\//i,
  ],
  beforeSend(event) {
    loadReplayOnce();
    return event;
  },
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
