import { createRoot } from "react-dom/client";
import { Analytics } from "@vercel/analytics/react";
import App from "./App";
import "./index.css";
import { registerServiceWorker } from "./lib/pwa";
import { clearXpotPostLoginHint, getXpotPostLoginHint, getXpotCanonicalOrigin, isXpotHost } from "./lib/xpot";

// Supabase OAuth can sometimes fall back to the main domain. If that happens, preserve the callback
// params/hash and bounce the user back to the Xpot subdomain before the marketing app boots.
try {
  const xpotHint = getXpotPostLoginHint();
  if (xpotHint && typeof window !== "undefined" && !isXpotHost(window.location.hostname)) {
    const hasSupabaseCallback = Boolean(window.location.hash) || window.location.search.includes("code=") || window.location.search.includes("access_token=");
    if (hasSupabaseCallback || window.location.pathname === "/") {
      const xpotUrl = new URL(xpotHint || `${getXpotCanonicalOrigin()}/login`);
      xpotUrl.search = window.location.search;
      xpotUrl.hash = window.location.hash;
      clearXpotPostLoginHint();
      window.location.replace(xpotUrl.toString());
    }
  }
} catch {
  // Ignore storage/navigation errors.
}

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
