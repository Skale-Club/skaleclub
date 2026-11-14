import * as Sentry from "@sentry/react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { hydrate } from "@tanstack/react-query";
import App, { preloadRouteForPath } from "./App";
import { queryClient } from "./lib/queryClient";
import type { PageLanguageInfo } from "./context/LanguageContext";
import { translationCache } from "./hooks/useTranslation";
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
  if (window.location.pathname.startsWith('/contracts/')) return;
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
  enabled: !!import.meta.env.VITE_SENTRY_DSN && import.meta.env.PROD && !window.location.pathname.startsWith('/contracts/'),
  integrations: [Sentry.browserTracingIntegration()],
  // Same-origin relay (server/routes/monitoring.ts) so ad blockers do not drop events.
  tunnel: "/api/monitoring",
  tracesSampleRate: 0.1,
  // Only record replays when an error happens: session replays of normal traffic
  // burned the org-wide Sentry replay quota. Errors still get a full replay.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,
  ignoreErrors: [
    "ResizeObserver loop",
    // Handled by lib/chunkReload.ts (reload + fallback UI).
    "Failed to fetch dynamically imported module",
    "error loading dynamically imported module", // Firefox
    "Importing a module script failed", // Safari
  ],
  denyUrls: [
    /extensions\//i,
    /^chrome:\/\//i,
    /^chrome-extension:\/\//i,
    /^moz-extension:\/\//i,
    /^safari-(web-)?extension:\/\//i,
  ],
  beforeSend(event) {
    if (window.location.pathname.startsWith('/contracts/')) return null;
    loadReplayOnce();
    return event;
  },
  beforeSendTransaction(event) {
    return window.location.pathname.startsWith('/contracts/') ? null : event;
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

const rootEl = document.getElementById("root")!;

// The server (server/seo/shell.ts) renders the page into #root when it can. Whether it did
// must be known before App is built: `serverRendered` has to be passed to <App>
// identically on both sides of hydration, because it decides whether the shell starts
// hidden, and a difference makes React throw the server markup away.
const serverRendered = rootEl.firstElementChild !== null;

function readJsonScript<T>(id: string): T | null {
  const text = document.getElementById(id)?.textContent;
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch (err) {
    // A malformed payload must never block boot: the affected components fetch for
    // themselves, as if the server had not prefetched.
    console.error(`[hydrate] failed to parse #${id}:`, err);
    return null;
  }
}

if (serverRendered) {
  // Both go in BEFORE hydrateRoot(): the first client render has to read the same data the
  // server render read, or React reports a mismatch and re-renders the whole tree.
  const state = readJsonScript<Parameters<typeof hydrate>[1]>("__REACT_QUERY_STATE__");
  if (state) hydrate(queryClient, state);
  // Portuguese strings from the AI translation cache that the server used. Without them
  // the first client render shows English where the server rendered Portuguese.
  const translations = readJsonScript<Record<string, string>>("__SSR_TRANSLATIONS__");
  if (translations) {
    for (const [source, translated] of Object.entries(translations)) translationCache.set(`pt:${source}`, translated);
  }
}

// Language a managed landing registers for itself, known to the server up front.
const initialPageInfo = serverRendered
  ? readJsonScript<PageLanguageInfo>("__SSR_PAGE_INFO__")
  : null;

const appElement = <App serverRendered={serverRendered} initialPageInfo={initialPageInfo} />;

if (serverRendered) {
  const settings = queryClient.getQueryData<{ pageSlugs?: Record<string, string> | null }>(["/api/company-settings"]);
  // The route's lazy chunk is still loading when this script runs, which would leave its
  // Suspense boundary unresolved while hydrating. Any state change in that window makes
  // React discard the server markup and client-render instead. Loading the chunk first lets
  // the boundary hydrate in one pass.
  const preload = preloadRouteForPath(window.location.pathname, settings?.pageSlugs);
  const start = () => hydrateRoot(rootEl, appElement);
  if (preload) preload.catch(() => {}).finally(start);
  else start();
} else {
  createRoot(rootEl).render(appElement);
}
