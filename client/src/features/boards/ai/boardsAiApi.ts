import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

export type AiLanguage = 'en' | 'pt';

const STATUS_KEY = ['/api/boards/ai/status'];

/** Whether the server has an AI provider configured. The AI buttons exist only when it does. */
export function useBoardsAiEnabled(): boolean {
  const { data } = useQuery<{ enabled?: boolean }>({
    queryKey: STATUS_KEY,
    queryFn: () => apiRequest('GET', '/api/boards/ai/status').then((r) => r.json()),
    staleTime: 5 * 60_000,
    retry: false,
    refetchOnWindowFocus: false,
  });
  return data?.enabled === true;
}

/** The server's `message` from an error thrown by apiRequest ("422: {json}"), or a generic line. */
export function aiErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : '';
  const json = raw.slice(raw.indexOf(':') + 1).trim();
  try {
    const message = (JSON.parse(json) as { message?: unknown }).message;
    if (typeof message === 'string' && message) return message;
  } catch {
    // not JSON
  }
  return 'The AI request failed. Try again.';
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await apiRequest('POST', `/api/boards/ai/${path}`, body);
  return (await res.json()) as T;
}

export async function requestMindmap(input: { topic: string; depth: 2 | 3; language: AiLanguage }): Promise<string> {
  return (await post<{ outline: string }>('mindmap', input)).outline;
}

export async function requestExpand(input: { topic: string; path: string[]; existing: string[]; language: AiLanguage; count?: number }): Promise<string[]> {
  return (await post<{ children: string[] }>('expand', input)).children;
}

export async function requestSummary(input: { outline: string; language: AiLanguage }): Promise<string> {
  return (await post<{ summary: string }>('summarize', input)).summary;
}
