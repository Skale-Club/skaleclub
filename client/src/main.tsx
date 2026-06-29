import * as Sentry from "@sentry/react";
import { createRoot } from "react-dom/client";
import { Analytics } from "@vercel/analytics/react";
import App from "./App";
import "./index.css";
import { registerServiceWorker } from "./lib/pwa";

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

// ─── Stale-tab recovery for lazy chunks ───────────────────────────────────
// After a deploy, content-hashed chunks (e.g. /assets/PresentationsSection-XYZ.js)
// get new hashes. An open tab whose HTML references the OLD hashes will fail to
// fetch them — the server returns 404 (or the SPA fallback used to return
// index.html with text/html, which fails strict MIME checking on module scripts).
// Either way: one hard reload pulls the fresh index.html + the new chunk names.
// SessionStorage guard prevents infinite reload loops if something else is broken.
const CHUNK_RELOAD_KEY = "chunkReloadAttempt";
const CHUNK_ERROR_PATTERNS = [
  "Failed to fetch dynamically imported module",
  "Loading chunk",
  "Loading CSS chunk",
  "ChunkLoadError",
  "Failed to load module script",
  "Expected a JavaScript-or-Wasm module script",
];

function isChunkLoadError(message: string | undefined | null): boolean {
  if (!message) return false;
  return CHUNK_ERROR_PATTERNS.some((p) => message.includes(p));
}

function maybeReloadForStaleChunk(message: string | undefined | null) {
  if (!isChunkLoadError(message)) return;
  try {
    const last = Number(window.sessionStorage.getItem(CHUNK_RELOAD_KEY) || "0");
    const now = Date.now();
    if (now - last < 10_000) return; // already reloaded recently — avoid loop
    window.sessionStorage.setItem(CHUNK_RELOAD_KEY, String(now));
  } catch {
    // sessionStorage unavailable — best-effort reload anyway
  }
  window.location.reload();
}

if (typeof window !== "undefined") {
  window.addEventListener("error", (event) => {
    maybeReloadForStaleChunk(event.message);
  });
  window.addEventListener("unhandledrejection", (event) => {
    const reason: unknown = event.reason;
    const message =
      typeof reason === "string"
        ? reason
        : reason && typeof reason === "object" && "message" in reason
          ? String((reason as { message?: unknown }).message ?? "")
          : "";
    maybeReloadForStaleChunk(message);
  });
}

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

createRoot(document.getElementById("root")!).render(
  <>
    <App />
    <Analytics />
  </>
);
