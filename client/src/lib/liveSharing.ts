import { useQuery } from '@tanstack/react-query';

export class LiveRequestError extends Error {
  constructor(public status: number, public code?: string, public state?: import('@shared/liveSharing').LiveState) {
    super('Live session request failed');
  }
}

// Never include server error bodies or audience/controller secrets in errors.
export async function liveRequest<T>(path: string, body?: unknown): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(`/api/live-sessions${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new LiveRequestError(response.status, data.code, data.state);
    return data as T;
  } finally {
    window.clearTimeout(timeout);
  }
}

export function useLiveSharingEnabled() {
  return useQuery<{ enabled: boolean }>({
    queryKey: ['/api/live-sessions/config'],
    queryFn: () => liveRequest('/config'),
    staleTime: 60_000,
    retry: false,
  }).data?.enabled === true;
}

export const controllerKey = (id: string) => `live-controller:${id}`;

export function readController(id: string): string | null {
  try { return sessionStorage.getItem(controllerKey(id)); } catch { return null; }
}

export function storeController(id: string, token: string | null) {
  try {
    if (token) sessionStorage.setItem(controllerKey(id), token);
    else sessionStorage.removeItem(controllerKey(id));
  } catch { /* The active tab can still control when storage is unavailable. */ }
}
