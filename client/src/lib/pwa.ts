export function registerServiceWorker() {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) {
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((error: unknown) => {
      console.error("Service worker registration failed", error);
    });
  });
}

// Dev mode never registers a service worker itself, but a stale one left over
// from an earlier production visit to the same origin (e.g. localhost:1000
// previously serving a prod build) persists across sessions and keeps
// intercepting requests — silently serving old cached assets underneath the
// dev server, which looks like broken/missing content with no obvious cause.
export function unregisterStaleServiceWorker() {
  if (import.meta.env.PROD || !("serviceWorker" in navigator)) {
    return;
  }

  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => registration.unregister());
  });
}
