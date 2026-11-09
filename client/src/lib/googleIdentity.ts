import type { Auth, ConfirmationResult, RecaptchaVerifier } from 'firebase/auth';

// Google Identity Platform (Firebase Auth) in the browser. Firebase only proves a
// phone or a Google account; the Express cookie owns the application session.
// Everything is imported lazily so Firebase never loads on public pages.

export interface GoogleLoginConfig {
  enabled: boolean;
  projectId: string;
  apiKey: string;
  authDomain: string;
  googleClientId: string;
}

export type AuthConfig = { enabled: false } | ({ enabled: true } & GoogleLoginConfig);

let auth: Auth | undefined;
let initializing: Promise<Auth> | undefined;
let confirmation: { phone: string; result: ConfirmationResult } | undefined;
let captcha: RecaptchaVerifier | undefined;
let node: HTMLDivElement | undefined;
let generation = 0;

export function prepareGoogleIdentity(config: GoogleLoginConfig): Promise<Auth> {
  initializing ??= (async () => {
    const [appSdk, sdk] = await Promise.all([import('firebase/app'), import('firebase/auth')]);
    const { apiKey, authDomain, projectId } = config;
    const app =
      appSdk.getApps().find((existing) => existing.name === 'skaleclub-auth') ??
      appSdk.initializeApp({ apiKey, authDomain, projectId }, 'skaleclub-auth');
    auth = sdk.getAuth(app);
    // The Express cookie owns the application session. Do not retain a second
    // persistent login in the browser after the app signs out or is reloaded.
    await sdk.setPersistence(auth, sdk.inMemoryPersistence);
    auth.useDeviceLanguage();
    return auth;
  })().catch((error) => {
    initializing = undefined;
    throw error;
  });
  return initializing;
}

export function cancelGooglePhoneChallenge() {
  ++generation;
  confirmation = undefined;
  captcha?.clear();
  captcha = undefined;
  node?.remove();
  node = undefined;
}

export async function sendGooglePhoneCode(config: GoogleLoginConfig, phone: string) {
  cancelGooglePhoneChallenge();
  const current = generation;
  const [instance, sdk] = await Promise.all([prepareGoogleIdentity(config), import('firebase/auth')]);
  if (current !== generation) throw new DOMException('Cancelled', 'AbortError');
  node = document.createElement('div');
  document.body.appendChild(node);
  const challenge = new sdk.RecaptchaVerifier(instance, node, { size: 'invisible' });
  captcha = challenge;
  try {
    const result = await sdk.signInWithPhoneNumber(instance, phone, challenge);
    if (current !== generation) throw new DOMException('Cancelled', 'AbortError');
    confirmation = { phone, result };
  } finally {
    if (captcha === challenge) {
      captcha.clear();
      captcha = undefined;
      node?.remove();
      node = undefined;
    }
  }
}

/** Confirms the SMS code and returns a fresh Firebase ID token (proof of the phone). */
export async function confirmGooglePhoneCode(phone: string, code: string) {
  if (confirmation?.phone !== phone) {
    throw Object.assign(new Error('Request another code'), { code: 'auth/code-expired' });
  }
  return (await confirmation.result.confirm(code)).user.getIdToken(true);
}

/** Opens the Google popup and returns a fresh Firebase ID token (proof of the Google account). */
export async function signInGoogleAlternative(config: GoogleLoginConfig) {
  const [instance, sdk] = await Promise.all([prepareGoogleIdentity(config), import('firebase/auth')]);
  return (await sdk.signInWithPopup(instance, new sdk.GoogleAuthProvider())).user.getIdToken(true);
}

export async function signOutGoogleIdentity() {
  cancelGooglePhoneChallenge();
  if (auth) await (await import('firebase/auth')).signOut(auth);
}

export type SignInErrorKey =
  | 'invalid_phone'
  | 'rate_limited'
  | 'too_many_codes'
  | 'wrong_code'
  | 'sms_failed'
  | 'popup_blocked'
  | 'generic';

/** Maps a Firebase error to one of our message keys. */
export function googlePhoneError(error: unknown): SignInErrorKey {
  const code = (error as { code?: string })?.code;
  if (code === 'auth/invalid-phone-number') return 'invalid_phone';
  if (code === 'auth/too-many-requests') return 'rate_limited';
  if (code === 'auth/quota-exceeded') return 'too_many_codes';
  if (['auth/invalid-verification-code', 'auth/code-expired', 'auth/session-expired'].includes(code ?? '')) {
    return 'wrong_code';
  }
  if (['auth/network-request-failed', 'auth/captcha-check-failed', 'auth/invalid-app-credential'].includes(code ?? '')) {
    return 'sms_failed';
  }
  if (code === 'auth/popup-blocked') return 'popup_blocked';
  return 'generic';
}

/** Whether a Google popup error is only the person closing the window. */
export function isPopupDismissed(error: unknown): boolean {
  const code = (error as { code?: string })?.code;
  return code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request';
}

/** User-facing message for a Firebase error key or a server `code`. */
const SIGN_IN_ERRORS: Record<string, string> = {
  invalid_phone: 'Enter a valid phone number.',
  rate_limited: 'Too many attempts. Wait a few minutes and try again.',
  too_many_codes: 'Too many codes were sent to this number. Try again later.',
  wrong_code: 'That code is not right or has expired. Request a new one.',
  sms_failed: 'We could not send the code. Check the number and try again.',
  popup_blocked: 'Your browser blocked the Google window. Allow pop-ups and try again.',
  invalid_token: 'We could not verify that sign-in. Try again.',
  origin_denied: 'Sign-in is not allowed from this address.',
  auth_unavailable: 'Sign-in is unavailable right now. Try again in a moment.',
  identity_linked_elsewhere: 'That phone or Google account already belongs to another user.',
  last_method: 'Add a phone number before removing Google.',
  generic: 'Something went wrong. Try again.',
};

export function signInErrorMessage(code: string | undefined): string {
  return SIGN_IN_ERRORS[code ?? 'generic'] ?? SIGN_IN_ERRORS.generic;
}

let configPromise: Promise<AuthConfig> | undefined;

/** The public Firebase SDK values from the server; `{ enabled: false }` when sign-in is off or unreachable. */
export function loadAuthConfig(): Promise<AuthConfig> {
  configPromise ??= fetch('/api/auth/config', { credentials: 'include' })
    .then((res) => (res.ok ? (res.json() as Promise<AuthConfig>) : { enabled: false as const }))
    .catch(() => ({ enabled: false as const }))
    .then((config) => {
      if (!config.enabled) configPromise = undefined; // retry on the next mount
      return config;
    });
  return configPromise;
}
