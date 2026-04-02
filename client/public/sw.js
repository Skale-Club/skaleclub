const APP_CACHE = "skaleclub-app-v3";
const RUNTIME_CACHE = "skaleclub-runtime-v1";
const APP_SHELL = [
  "/",
  "/login",
  "/manifest.webmanifest",
  "/manifest-xpot.webmanifest",
  "/favicon.svg",
  "/favicon-rounded.png",
  "/apple-touch-icon.png",
  "/pwa-192.png",
  "/pwa-512.png",
];
const NETWORK_ONLY_PATHS = [
  /^\/api\//,
  /^\/robots\.txt$/,
  /^\/sitemap(?:_index)?\.xml$/,
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(APP_CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => ![APP_CACHE, RUNTIME_CACHE].includes(key))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  if (NETWORK_ONLY_PATHS.some((pattern) => pattern.test(url.pathname))) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(handleNavigationRequest(request));
    return;
  }

  event.respondWith(handleAssetRequest(request));
});

async function handleNavigationRequest(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return (await caches.match(request)) || caches.match("/");
  }
}

async function handleAssetRequest(request) {
  const cachedResponse = await caches.match(request);

  if (cachedResponse) {
    void refreshAsset(request);
    return cachedResponse;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const fallbackDocument = request.destination === "document" || request.headers.get("accept")?.includes("text/html");
    if (fallbackDocument) {
      return (await caches.match("/")) || new Response("Offline", {
        status: 503,
        headers: { "Content-Type": "text/plain" },
      });
    }

    return new Response("", { status: 503, statusText: "Offline" });
  }
}

async function refreshAsset(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, response);
    }
  } catch {
    // Ignore refresh failures and keep serving the cached version.
  }
}
