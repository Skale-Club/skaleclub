import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new HttpError(res.status, `${res.status}: ${text}`);
  }
}

// For custom queryFns: same !ok handling as the default queryFn, so an error body
// (e.g. `{"message": ...}` on a 5xx) never lands in `data` and crashes a `.map()`.
export async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  await throwIfResNotOk(res);
  return res.json();
}

// Retry only failures that can clear on their own (network drop, 5xx, 408/429),
// at most twice with the default exponential backoff, so a backend outage costs
// each visitor a bounded handful of requests per query. fetch() rejects with a
// TypeError on network failure; our 15s timeout (AbortError) is not retried.
function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (failureCount >= 2) return false;
  if (error instanceof HttpError) {
    return error.status >= 500 || error.status === 408 || error.status === 429;
  }
  return error instanceof TypeError;
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

export async function authenticatedRequest(
  method: string,
  url: string,
  token: string,
  data?: unknown | undefined,
): Promise<Response> {
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${token}`,
  };
  if (data) {
    headers['Content-Type'] = 'application/json';
  }
  
  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    let res: Response;
    try {
      res = await fetch(queryKey.join("/") as string, {
        credentials: "include",
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

/**
 * The public site never refetches (staleTime Infinity). Admin data is edited from
 * several places, so it goes stale after 30s and refetches when the tab regains focus.
 */
export const adminQueryOptions = {
  staleTime: 30_000,
  refetchOnWindowFocus: true,
} as const;

/**
 * Applies `adminQueryOptions` as the shared client's defaults while the calling
 * admin screen is mounted, then restores the public defaults. Applied during the
 * first render because child queries resolve their defaults when they are created,
 * before any effect of this component would run.
 */
export function useAdminQueryDefaults() {
  const applied = useRef(false);
  if (!applied.current) {
    applied.current = true;
    applyAdminDefaults();
  }
  useEffect(() => {
    // Re-apply (StrictMode runs effect, cleanup, effect) and restore on unmount.
    applyAdminDefaults();
    return () => queryClient.setDefaultOptions(publicDefaults);
  }, []);
}

function applyAdminDefaults() {
  queryClient.setDefaultOptions({
    ...publicDefaults,
    queries: { ...publicDefaults.queries, ...adminQueryOptions },
  });
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: shouldRetryQuery,
      // A failed query is not refetched just because another component mounts an
      // observer on it. With the default (true), any parent that swaps its subtree
      // for a loader while the query is pending loops forever: the errored query
      // refetches on child mount, goes back to pending, the children unmount, it
      // errors, they remount... Errors recover via reload or explicit invalidation.
      retryOnMount: false,
    },
    mutations: {
      retry: false,
    },
  },
});

// Snapshot of the public defaults, restored when leaving the admin.
const publicDefaults = queryClient.getDefaultOptions();
