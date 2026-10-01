import { apiRequest, HttpError, queryClient } from '@/lib/queryClient';

// Thin fetch helpers for the Smart Tags admin API. Server errors arrive as
// "400: {\"message\":\"…\"}"; surface only the message to the admin.

export function errorMessage(err: unknown): string {
  if (err instanceof HttpError || err instanceof Error) {
    const raw = err.message.replace(/^\d{3}:\s*/, '');
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed?.message === 'string') return parsed.message;
    } catch {
      // not JSON
    }
    return raw || 'Request failed';
  }
  return 'Request failed';
}

export async function getJson<T>(url: string): Promise<T> {
  const res = await apiRequest('GET', url);
  return res.json();
}

export async function sendJson<T>(method: 'POST' | 'PATCH', url: string, body: unknown = {}): Promise<T> {
  const res = await apiRequest(method, url, body);
  return res.json();
}

export function withQuery(url: string, params: Record<string, string | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const qs = search.toString();
  return qs ? `${url}?${qs}` : url;
}

/** Every Smart Tags query key starts with this, so one call refreshes them all. */
export const SMART_TAGS_KEY = 'smart-tags';

export function invalidateSmartTags() {
  return queryClient.invalidateQueries({ queryKey: [SMART_TAGS_KEY] });
}

export const STALE_MS = 30_000;

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, { dateStyle: 'medium' });
}

export function percent(part: number, total: number): string {
  if (!total) return '0%';
  return `${Math.round((part / total) * 100)}%`;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
