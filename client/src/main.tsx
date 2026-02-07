import { createRoot } from "react-dom/client";
import { Analytics } from "@vercel/analytics/react";
import App from "./App";
import "./index.css";

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

createRoot(document.getElementById("root")!).render(
  <>
    <App />
    <Analytics />
  </>
);
