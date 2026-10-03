// __BUILD_HASH__ is replaced at build time (script/build.ts) so every deploy gets
// fresh cache names and the activate step drops the previous build's caches.
const APP_CACHE = "skaleclub-app-__BUILD_HASH__";
const RUNTIME_CACHE = "skaleclub-runtime-__BUILD_HASH__";
const RUNTIME_MAX_ENTRIES = 60;
const APP_SHELL = [
  "/",
  "/manifest.webmanifest",
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
  // Private, per-client or authenticated surfaces: never cache.
  /^\/e\//,
  /^\/p\//,
  /^\/admin(?:\/|$)/,
  /^\/nfc(?:\/|$)/,
  /^\/print(?:\/|$)/,
  /\.wasm$/,
];
// Fingerprinted build output: immutable, so serve from cache without revalidating.
const IMMUTABLE_ASSET = /^\/assets\//;

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
      .then(() => pruneRuntimeCache())
      .then(() => self.clients.claim()),
  );
});

// Keep only the newest entries; Cache.keys() returns them in insertion order.
async function pruneRuntimeCache() {
  const cache = await caches.open(RUNTIME_CACHE);
  const keys = await cache.keys();
  const excess = keys.length - RUNTIME_MAX_ENTRIES;
  for (let i = 0; i < excess; i++) {
    await cache.delete(keys[i]);
  }
}

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
    event.respondWith(handleNavigationRequest(event, request));
    return;
  }

  event.respondWith(handleAssetRequest(event, request, url));
});

// Store a response, then trim the runtime cache; kept alive past respondWith.
function putAndPrune(event, request, response) {
  event.waitUntil(
    caches
      .open(RUNTIME_CACHE)
      .then((cache) => cache.put(request, response))
      .then(pruneRuntimeCache)
      .catch(() => {}),
  );
}

async function handleNavigationRequest(event, request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      putAndPrune(event, request, response.clone());
    }
    return response;
  } catch {
    return (await caches.match(request)) || caches.match("/");
  }
}

async function handleAssetRequest(event, request, url) {
  const cachedResponse = await caches.match(request);

  if (cachedResponse) {
    if (!IMMUTABLE_ASSET.test(url.pathname)) {
      event.waitUntil(refreshAsset(event, request));
    }
    return cachedResponse;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      putAndPrune(event, request, response.clone());
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

async function refreshAsset(event, request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      putAndPrune(event, request, response);
    }
  } catch {
    // Ignore refresh failures and keep serving the cached version.
  }
}
