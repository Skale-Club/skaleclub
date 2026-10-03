import { useCallback, useEffect, useState } from 'react';
import { apiRequest, HttpError } from '@/lib/queryClient';
import { errorMessage } from '@/components/admin/smart-tags/api';
import { classifyScan, type ScanClassification } from '@shared/nfcApp';

export { errorMessage };

export const APP_BASE = '/nfc';
const MANIFEST_HREF = '/nfc.webmanifest';
const RECENTS_KEY = 'nfcAppRecents';
const RECENTS_LIMIT = 15;

// ─── Storage ──────────────────────────────────────────────────────────────────

function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

function writeStorage(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Blocked storage: the app still works, it just forgets.
  }
}

export interface RecentItem {
  kind: 'skale' | 'direct';
  /** Tag code, or the direct URL. */
  value: string;
  label?: string | null;
  at: number;
}

export function getRecents(): RecentItem[] {
  const list = readStorage<RecentItem[]>(RECENTS_KEY, []);
  return Array.isArray(list) ? list : [];
}

export function pushRecent(item: Omit<RecentItem, 'at'>) {
  const next = [{ ...item, at: Date.now() }, ...getRecents().filter((r) => !(r.kind === item.kind && r.value === item.value))].slice(
    0,
    RECENTS_LIMIT,
  );
  writeStorage(RECENTS_KEY, next);
}

export function clearRecents() {
  writeStorage(RECENTS_KEY, []);
}

// ─── Clipboard / feedback ─────────────────────────────────────────────────────

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      area.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

export async function readClipboard(): Promise<string | null> {
  try {
    return (await navigator.clipboard.readText()).trim() || null;
  } catch {
    return null;
  }
}

export function haptic(pattern: number | number[] = 40) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // unsupported
  }
}

export function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function timeAgo(at: number): string {
  const sec = Math.max(0, Math.round((Date.now() - at) / 1000));
  if (sec < 60) return 'agora';
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min`;
  const hours = Math.round(min / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.round(hours / 24);
  return `${days} d`;
}

export function shortUrl(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '');
}

// ─── API ──────────────────────────────────────────────────────────────────────

function bounceToLogin() {
  const next = window.location.pathname + window.location.search;
  window.location.assign(`${APP_BASE}/login?next=${encodeURIComponent(next)}`);
}

async function call<T>(method: 'GET' | 'POST', url: string, body?: unknown): Promise<T> {
  try {
    const res = await apiRequest(method, url, body);
    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof HttpError && (err.status === 401 || err.status === 403)) bounceToLogin();
    throw err;
  }
}

export const nfcGet = <T,>(url: string) => call<T>('GET', url);
export const nfcPost = <T,>(url: string, body: unknown = {}) => call<T>('POST', url, body);

/** Distinguishes "no such tag" from other failures in a lookup. */
export async function lookupTag(code: string): Promise<{ id: string; publicCode: string } | null> {
  try {
    return await call<{ id: string; publicCode: string }>('GET', `/api/admin/smart-tags/lookup/${encodeURIComponent(code)}`);
  } catch (err) {
    if (err instanceof HttpError && err.status === 404) return null;
    throw err;
  }
}

// ─── Scan routing ─────────────────────────────────────────────────────────────

export function extraHosts(): string[] {
  const host = window.location.hostname;
  return host === 'skale.club' || host === 'www.skale.club' ? [] : [host];
}

export function classify(raw: string): ScanClassification {
  return classifyScan(raw, extraHosts());
}

export function directPath(url: string): string {
  return `${APP_BASE}/direct?url=${encodeURIComponent(url)}`;
}

export function tagPath(code: string): string {
  return `${APP_BASE}/t/${encodeURIComponent(code)}`;
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

/** Point the page at this app's own manifest and chrome colors while mounted. */
export function useAppManifest() {
  useEffect(() => {
    const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    const appleTitle = document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-title"]');
    const theme = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const prevHref = link?.getAttribute('href');
    const prevApple = appleTitle?.content;
    const prevTheme = theme?.content;
    const prevTitle = document.title;
    // Real dark mode: native selects, date pickers, autofill and scrollbars render dark.
    const root = document.documentElement;
    const prevScheme = root.style.colorScheme;
    const hadDark = root.classList.contains('dark');
    root.style.colorScheme = 'dark';
    root.classList.add('dark');
    link?.setAttribute('href', MANIFEST_HREF);
    if (appleTitle) appleTitle.content = 'Skale NFC';
    if (theme) theme.content = '#0d121a';
    document.title = 'Skale NFC';
    return () => {
      if (link && prevHref) link.setAttribute('href', prevHref);
      if (appleTitle && prevApple) appleTitle.content = prevApple;
      if (theme && prevTheme) theme.content = prevTheme;
      document.title = prevTitle;
      root.style.colorScheme = prevScheme;
      if (!hadDark) root.classList.remove('dark');
    };
  }, []);
}

type InstallPromptEvent = Event & { prompt: () => Promise<void> };

export function useInstallPrompt() {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(isStandalone);
  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPromptEvent(e as InstallPromptEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);
  const install = useCallback(async () => {
    if (!promptEvent) return;
    await promptEvent.prompt();
    setPromptEvent(null);
  }, [promptEvent]);
  return { canInstall: !!promptEvent && !installed, install };
}

/** Auto-dismissing inline banner state. */
export function useBanner() {
  const [banner, setBanner] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  useEffect(() => {
    if (!banner) return;
    const id = window.setTimeout(() => setBanner(null), banner.tone === 'ok' ? 3500 : 7000);
    return () => window.clearTimeout(id);
  }, [banner]);
  return { banner, show: setBanner, clear: () => setBanner(null) };
}
