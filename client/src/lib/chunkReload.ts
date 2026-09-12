// ─── Recovery for lazy chunks that fail to load ───────────────────────────
// A content-hashed chunk (e.g. /assets/Home-BslLVQsI.js) 404s in two situations:
//  1. A stale tab: its index.html predates a deploy and references old hashes.
//  2. A deploy swap: Coolify's rolling update keeps the old and new containers
//     behind Traefik together until `docker stop` times out (31s on the
//     2026-09-11 deploy), so a fresh index.html can get some of its chunks
//     routed to the old container.
// A full reload fixes both, but a reload that lands inside the same swap fails
// again — so the first attempt is immediate and the second waits the swap out.
// The attempt budget lives in sessionStorage and is what makes a loop impossible.

const STORAGE_KEY = "chunkReloadAttempts";
const MAX_ATTEMPTS = 2;
const ATTEMPT_WINDOW_MS = 5 * 60_000;
const RETRY_DELAY_MS = 30_000;

const CHUNK_ERROR_PATTERNS = [
  "Failed to fetch dynamically imported module", // Chromium
  "error loading dynamically imported module", // Firefox
  "Importing a module script failed", // Safari
  "Unable to preload CSS", // Vite's preload helper
  "Loading chunk",
  "Loading CSS chunk",
  "ChunkLoadError",
  "Failed to load module script",
  "Expected a JavaScript-or-Wasm module script",
];

export type ChunkReloadStatus =
  | { kind: "scheduled"; delayMs: number }
  | { kind: "exhausted" };

// Errors Vite reported through `vite:preloadError`, so detection does not hinge
// on each browser's wording.
const preloadErrors = new WeakSet<object>();
let scheduled: ChunkReloadStatus | null = null;

function messageOf(error: unknown): string {
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message ?? "");
  }
  return "";
}

export function isChunkLoadError(error: unknown): boolean {
  if (error && typeof error === "object" && preloadErrors.has(error)) return true;
  const message = messageOf(error);
  return !!message && CHUNK_ERROR_PATTERNS.some((p) => message.includes(p));
}

function readAttempts(now: number): { first: number; count: number } {
  const raw = window.sessionStorage.getItem(STORAGE_KEY);
  let saved: { first?: unknown; count?: unknown } | null = null;
  try {
    saved = raw ? JSON.parse(raw) : null;
  } catch {
    // Corrupt value — start a fresh window.
  }
  if (saved && typeof saved.first === "number" && typeof saved.count === "number" && now - saved.first < ATTEMPT_WINDOW_MS) {
    return { first: saved.first, count: saved.count };
  }
  return { first: now, count: 0 };
}

/**
 * Schedules a reload if the budget allows. The budget is deliberately never
 * refunded on a successful render: a page that renders and then fails a nested
 * chunk would otherwise reload forever.
 */
export function requestChunkReload(): ChunkReloadStatus {
  if (scheduled) return scheduled;

  const now = Date.now();
  let count: number;
  try {
    const attempts = readAttempts(now);
    count = attempts.count;
    if (count >= MAX_ATTEMPTS) return { kind: "exhausted" };
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ first: attempts.first, count: count + 1 }));
  } catch {
    // Without storage the budget can't survive the reload, and an unguarded
    // reload could loop — leave it to the manual button.
    return { kind: "exhausted" };
  }

  const delayMs = count === 0 ? 0 : RETRY_DELAY_MS;
  scheduled = { kind: "scheduled", delayMs };
  window.setTimeout(() => window.location.reload(), delayMs);
  return scheduled;
}

export function installChunkReloadHandlers() {
  window.addEventListener("vite:preloadError", (event) => {
    const payload = (event as Event & { payload?: unknown }).payload;
    if (payload && typeof payload === "object") preloadErrors.add(payload);
  });

  // Route-level lazy failures are handled by ChunkErrorBoundary. These catch
  // chunk errors nothing else handled; an import whose caller catches the error
  // (e.g. PrintFolder's CMYK converter) is left alone, so an in-progress action
  // is never reloaded away.
  window.addEventListener("error", (event) => {
    if (isChunkLoadError(event.error ?? event.message)) requestChunkReload();
  });
  window.addEventListener("unhandledrejection", (event) => {
    if (isChunkLoadError(event.reason)) requestChunkReload();
  });
}
