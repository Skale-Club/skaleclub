import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2 } from '@/components/ui/loader';
import { CountryCodePicker, type CountryOption } from '@/components/CountryCodePicker';
import { FLAG_CODES } from '@/components/CountryFlag';
import { AUTH_INPUT, AUTH_INPUT_ICON } from '@/components/admin/AuthLayout';
import {
  PHONE_COUNTRIES,
  formatPhoneForCountry,
  type PhoneCountry,
} from '@/lib/phoneCountries';
import {
  cancelGooglePhoneChallenge,
  confirmGooglePhoneCode,
  googlePhoneError,
  prepareGoogleIdentity,
  sendGooglePhoneCode,
  signInErrorMessage,
  type GoogleLoginConfig,
} from '@/lib/googleIdentity';
import { formatSignInPhone, normalizePhone } from '@shared/signInPhone';

export interface PhoneCodeResult {
  ok: boolean;
  /** A server error code (see signInErrorMessage) when `ok` is false. */
  code?: string;
}

interface PhoneCodeFlowProps {
  config: GoogleLoginConfig;
  /** `auth` is the dark sign-in screen; `app` is a regular admin card. */
  variant: 'auth' | 'app';
  /** Gets the Firebase ID token that proves the phone. Resolve `{ ok: true }` when the server accepted it. */
  onVerified: (idToken: string) => Promise<PhoneCodeResult>;
  sendLabel?: string;
  verifyLabel?: string;
  onCancel?: () => void;
}

const RESEND_SECONDS = 30;

// Only countries with a drawing in CountryFlag are offered; the picker shows SVG flags.
const SIGN_IN_PHONE_COUNTRIES = PHONE_COUNTRIES.filter((c) => FLAG_CODES.includes(c.flagCode.toUpperCase()));
const COUNTRY_OPTIONS: CountryOption[] = SIGN_IN_PHONE_COUNTRIES.map((c) => ({
  id: c.code,
  iso: c.flagCode.toUpperCase(),
  label: c.name,
  dial: c.dialCode,
}));
// Default country is +1 (US); +55 (Brazil) is in the picker.
const DEFAULT_COUNTRY: PhoneCountry = PHONE_COUNTRIES[0];

/** Phone number, then the 6-digit code texted to it. The caller decides what the verified token is used for. */
export function PhoneCodeFlow({
  config,
  variant,
  onVerified,
  sendLabel = 'Send code',
  verifyLabel = 'Verify',
  onCancel,
}: PhoneCodeFlowProps) {
  const isAuth = variant === 'auth';
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [country, setCountry] = useState<PhoneCountry>(DEFAULT_COUNTRY);
  const [phoneInput, setPhoneInput] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const pending = useRef(false);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void prepareGoogleIdentity(config).catch(() => {});
    return cancelGooglePhoneChallenge;
  }, [config]);

  useEffect(() => {
    if (step !== 'code') return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    window.setTimeout(() => codeRef.current?.focus(), 50);
    return () => window.clearInterval(id);
  }, [step]);

  const sendCode = async (target: string) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      const e164 = normalizePhone(target, country.dialCode);
      if (!e164) {
        setError(signInErrorMessage('invalid_phone'));
        return;
      }
      await sendGooglePhoneCode(config, e164);
      setPhone(e164);
      setCode('');
      setResendAt(Date.now() + RESEND_SECONDS * 1000);
      setStep('code');
    } catch (err) {
      setError(signInErrorMessage(googlePhoneError(err)));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };

  const verify = async (value: string) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      const result = await onVerified(await confirmGooglePhoneCode(phone, value));
      if (!result.ok) {
        setCode('');
        setError(signInErrorMessage(result.code));
      }
    } catch (err) {
      setCode('');
      setError(signInErrorMessage(googlePhoneError(err)));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };

  const onCode = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 6);
    setCode(digits);
    if (digits.length === 6 && !busy) void verify(digits);
  };

  const submitPhone = (e: FormEvent) => {
    e.preventDefault();
    void sendCode(phoneInput);
  };

  const restart = () => {
    cancelGooglePhoneChallenge();
    setStep('phone');
    setCode('');
    setError('');
  };

  const errorBox = error ? (
    <div
      role="alert"
      data-testid="signin-error"
      className={
        isAuth
          ? 'rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300'
          : 'rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive'
      }
    >
      {error}
    </div>
  ) : null;

  const primaryClass = isAuth
    ? 'group !mt-6 h-12 w-full rounded-full bg-cta text-base font-bold text-white hover:bg-cta-hover focus-visible:ring-2 focus-visible:ring-cta/40 focus-visible:ring-offset-0 disabled:opacity-60'
    : '';
  const linkClass = isAuth
    ? 'text-sm font-medium text-fog-400 transition-colors hover:text-fog-50 disabled:opacity-50'
    : 'text-sm text-muted-foreground hover:text-foreground disabled:opacity-50';

  if (step === 'code') {
    const wait = Math.max(0, Math.ceil((resendAt - now) / 1000));
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (code.length === 6) void verify(code);
        }}
        className="space-y-4"
        data-testid="signin-code"
      >
        <button type="button" onClick={restart} className={`inline-flex items-center gap-2 ${linkClass}`}>
          <ArrowLeft className="h-3.5 w-3.5" />
          Change number
        </button>
        <p className={isAuth ? 'text-sm text-fog-400' : 'text-sm text-muted-foreground'}>
          We texted a 6-digit code to {formatSignInPhone(phone)}.
        </p>
        {errorBox}
        <Input
          ref={codeRef}
          value={code}
          onChange={(e) => onCode(e.target.value)}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          aria-label="Verification code"
          placeholder="000000"
          className={
            isAuth
              ? `${AUTH_INPUT} pl-4 text-center font-mono text-2xl tracking-[0.5em]`
              : 'text-center font-mono text-lg tracking-[0.4em]'
          }
          data-testid="input-code"
        />
        <Button type="submit" className={primaryClass} disabled={busy || code.length !== 6} data-testid="button-verify-code">
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {verifyLabel}
        </Button>
        <div className="flex items-center justify-between">
          <button type="button" disabled={busy || wait > 0} onClick={() => void sendCode(phone)} className={linkClass}>
            {wait > 0 ? `Resend in ${wait}s` : 'Resend code'}
          </button>
          {onCancel ? (
            <button type="button" onClick={onCancel} className={linkClass}>
              Cancel
            </button>
          ) : null}
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={submitPhone} className="space-y-4" data-testid="signin-phone">
      {errorBox}
      <div className="flex gap-2">
        <CountryCodePicker
          options={COUNTRY_OPTIONS}
          value={country.code}
          onChange={(id) => {
            const next = SIGN_IN_PHONE_COUNTRIES.find((c) => c.code === id) ?? country;
            setCountry(next);
            setPhoneInput((current) => formatPhoneForCountry(current, next));
          }}
          label="Phone country"
          tone={isAuth ? 'dark' : 'light'}
          className={
            isAuth
              ? 'h-12 rounded-xl border border-white/10 bg-navy-900 px-3 text-base text-fog-50 hover:border-white/20 hover:bg-white/[0.08]'
              : 'h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground hover:bg-muted'
          }
        />
        <div className="group relative flex-1">
          {isAuth ? <Phone className={AUTH_INPUT_ICON} /> : null}
          <Input
            id="signin-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            aria-label="Phone number"
            placeholder={country.placeholder}
            value={phoneInput}
            onChange={(e) => setPhoneInput(formatPhoneForCountry(e.target.value, country))}
            className={isAuth ? AUTH_INPUT : undefined}
            autoFocus={isAuth}
            required
            data-testid="input-phone"
          />
        </div>
      </div>
      <Button
        type="submit"
        className={primaryClass}
        disabled={busy || phoneInput.replace(/\D/g, '').length < 7}
        data-testid="button-send-code"
      >
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {sendLabel}
        {!busy && isAuth ? (
          <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        ) : null}
      </Button>
      {onCancel ? (
        <button type="button" onClick={onCancel} className={linkClass}>
          Cancel
        </button>
      ) : null}
    </form>
  );
}
