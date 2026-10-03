// Client helpers shared by the NFC app auth screens (trusted device + passkeys).
import { startAuthentication, startRegistration, browserSupportsWebAuthn } from '@simplewebauthn/browser';
import { initSupabase } from '@/lib/supabase';

const HAS_PASSKEY_KEY = 'nfcHasPasskey';
const PROMPT_DISMISSED_KEY = 'nfcPasskeyPromptDismissedAt';
const APP_LOCK_KEY = 'nfcAppLock';
const PROMPT_SNOOZE_MS = 30 * 24 * 60 * 60 * 1000;

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Storage can be blocked (private mode); the app still works without it.
  }
}

export const deviceFlags = {
  hasPasskey: () => read(HAS_PASSKEY_KEY) === '1',
  setHasPasskey: (on: boolean) => write(HAS_PASSKEY_KEY, on ? '1' : null),
  promptSnoozed: () => {
    const at = Number(read(PROMPT_DISMISSED_KEY));
    return Number.isFinite(at) && at > 0 && Date.now() - at < PROMPT_SNOOZE_MS;
  },
  snoozePrompt: () => write(PROMPT_DISMISSED_KEY, String(Date.now())),
  appLock: () => read(APP_LOCK_KEY) === '1',
  setAppLock: (on: boolean) => write(APP_LOCK_KEY, on ? '1' : null),
};

export function passkeySupported(): boolean {
  return typeof window !== 'undefined' && typeof PublicKeyCredential !== 'undefined' && browserSupportsWebAuthn();
}

export async function platformAuthenticatorAvailable(): Promise<boolean> {
  if (!passkeySupported()) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

export function isIos(): boolean {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
}

/** "Face ID" on Apple devices, a neutral label elsewhere. */
export function biometricLabel(): string {
  return isIos() ? 'Face ID' : 'Face ID / digital';
}

/** Only /nfc paths are valid post-login targets; anything else falls back to home. */
export function safeNfcPath(value: string | null | undefined): string | null {
  if (!value || !/^\/nfc(\/[A-Za-z0-9/_-]*)?$/.test(value)) return null;
  return /^\/nfc\/login\b/.test(value) ? null : value;
}

export function nextFromLocation(): string {
  return safeNfcPath(new URLSearchParams(window.location.search).get('next')) ?? '/nfc/home';
}

export class PasskeyCancelled extends Error {
  constructor() {
    super('cancelled');
  }
}

function isCancel(err: unknown): boolean {
  const name = (err as { name?: string })?.name;
  return name === 'NotAllowedError' || name === 'AbortError';
}

export async function api<T = unknown>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(path, {
    method: init?.method ?? 'GET',
    credentials: 'include',
    headers: init?.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error((data as { message?: string })?.message || 'Falha na requisição') as Error & { status: number };
    err.status = res.status;
    throw err;
  }
  return data as T;
}

export function trustDevice(deviceName?: string) {
  return api('/api/auth/trust-device', { method: 'POST', body: deviceName ? { deviceName } : {} });
}

type AuthOptions = Parameters<typeof startAuthentication>[0]['optionsJSON'];
type RegOptions = Parameters<typeof startRegistration>[0]['optionsJSON'];

export async function registerPasskey(deviceName?: string): Promise<void> {
  const optionsJSON = await api<RegOptions>('/api/auth/passkeys/register/options', { method: 'POST', body: {} });
  let response;
  try {
    response = await startRegistration({ optionsJSON });
  } catch (err) {
    if (isCancel(err)) throw new PasskeyCancelled();
    throw err;
  }
  await api('/api/auth/passkeys/register/verify', { method: 'POST', body: { response, deviceName } });
  deviceFlags.setHasPasskey(true);
}

async function assertWithPasskey(optionsPath: string, verifyPath: string): Promise<void> {
  const optionsJSON = await api<AuthOptions>(optionsPath, { method: 'POST', body: {} });
  let response;
  try {
    response = await startAuthentication({ optionsJSON });
  } catch (err) {
    if (isCancel(err)) throw new PasskeyCancelled();
    throw err;
  }
  await api(verifyPath, { method: 'POST', body: { response } });
}

/** Discoverable-credential login: no email needed. The server also marks the session trusted. */
export async function loginWithPasskey(): Promise<void> {
  await assertWithPasskey('/api/auth/passkeys/login/options', '/api/auth/passkeys/login/verify');
  deviceFlags.setHasPasskey(true);
}

/** Biometric check against the current session (app lock). */
export function reauthWithPasskey(): Promise<void> {
  return assertWithPasskey('/api/auth/passkeys/reauth/options', '/api/auth/passkeys/reauth/verify');
}

export async function nfcLogout(): Promise<void> {
  try {
    const supabase = await initSupabase();
    await supabase.auth.signOut();
  } catch {
    // Supabase sign-out is best effort; the server session is what matters.
  }
  try {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  } finally {
    window.location.href = '/nfc/login';
  }
}

export function formatDate(iso: string | null): string {
  if (!iso) return 'nunca';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime()) || d.getTime() < 86_400_000) return 'nunca';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}
