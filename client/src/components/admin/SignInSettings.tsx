import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Phone, Unlink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Loader2 } from '@/components/ui/loader';
import { useToast } from '@/hooks/use-toast';
import { PhoneCodeFlow, type PhoneCodeResult } from '@/components/admin/PhoneCodeFlow';
import {
  googlePhoneError,
  isPopupDismissed,
  loadAuthConfig,
  signInErrorMessage,
  signInGoogleAlternative,
  type AuthConfig,
} from '@/lib/googleIdentity';
import { formatSignInPhone } from '@shared/signInPhone';

interface SignInLinks {
  phone: string | null;
  google: Array<{ email: string | null }>;
}

const LINKS_KEY = ['/api/auth/links'];

async function callLinks(method: 'POST' | 'DELETE', path: string, body?: unknown): Promise<PhoneCodeResult> {
  try {
    const res = await fetch(`/api/auth/links/${path}`, {
      method,
      credentials: 'include',
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.ok) return { ok: true };
    const data = await res.json().catch(() => ({}));
    return { ok: false, code: data.code };
  } catch {
    return { ok: false, code: 'generic' };
  }
}

/** The signed-in admin's own sign-in methods: add or change the phone, link or unlink Google. */
export function SignInSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<AuthConfig | null>(null);
  const [editingPhone, setEditingPhone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void loadAuthConfig().then((value) => active && setConfig(value));
    return () => {
      active = false;
    };
  }, []);

  const { data: links, isLoading } = useQuery<SignInLinks>({
    queryKey: LINKS_KEY,
    queryFn: async () => {
      const res = await fetch('/api/auth/links', { credentials: 'include' });
      if (!res.ok) throw new Error('Could not load sign-in methods');
      return res.json();
    },
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: LINKS_KEY });
  const fail = (code: string | undefined) =>
    toast({ title: 'Could not update sign-in', description: signInErrorMessage(code), variant: 'destructive' });

  const savePhone = async (idToken: string): Promise<PhoneCodeResult> => {
    const result = await callLinks('POST', 'phone', { idToken });
    if (result.ok) {
      await refresh();
      setEditingPhone(false);
      toast({ title: 'Phone saved', description: 'You can now sign in with a code sent to it.' });
    }
    return result;
  };

  const linkGoogle = async () => {
    if (!config?.enabled) return;
    setBusy(true);
    try {
      const result = await callLinks('POST', 'google', { idToken: await signInGoogleAlternative(config) });
      if (result.ok) {
        await refresh();
        toast({ title: 'Google account linked' });
      } else fail(result.code);
    } catch (err) {
      if (!isPopupDismissed(err)) fail(googlePhoneError(err));
    } finally {
      setBusy(false);
    }
  };

  const unlinkGoogle = async () => {
    setBusy(true);
    try {
      const result = await callLinks('DELETE', 'google');
      if (result.ok) {
        await refresh();
        toast({ title: 'Google account unlinked' });
      } else fail(result.code);
    } finally {
      setBusy(false);
    }
  };

  const canLink = config?.enabled === true;

  return (
    <section className="rounded-2xl border p-5 space-y-5" data-testid="signin-settings">
      <div className="flex items-start gap-3">
        <KeyRound className="mt-0.5 h-5 w-5 text-muted-foreground" />
        <div>
          <h2 className="font-semibold">Your sign-in</h2>
          <p className="text-sm text-muted-foreground">
            Sign in with a code texted to your phone, or with Google. Add either one here.
          </p>
        </div>
      </div>

      {isLoading || config === null ? (
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      ) : (
        <div className="space-y-5">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Phone</span>
                <span className="text-muted-foreground" data-testid="signin-current-phone">
                  {links?.phone ? formatSignInPhone(links.phone) : 'Not added'}
                </span>
              </div>
              {!editingPhone && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!canLink}
                  onClick={() => setEditingPhone(true)}
                  data-testid="button-edit-phone"
                >
                  {links?.phone ? 'Change phone' : 'Add phone'}
                </Button>
              )}
            </div>
            {editingPhone && config.enabled && (
              <div className="max-w-sm pt-1">
                <PhoneCodeFlow
                  config={config}
                  variant="app"
                  sendLabel="Send code"
                  verifyLabel="Save phone"
                  onVerified={savePhone}
                  onCancel={() => setEditingPhone(false)}
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm">
                <span className="font-medium">Google</span>{' '}
                <span className="text-muted-foreground" data-testid="signin-current-google">
                  {links?.google.length
                    ? links.google.map((account) => account.email ?? 'Linked account').join(', ')
                    : 'Not linked'}
                </span>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={!canLink || busy} onClick={linkGoogle} data-testid="button-link-google">
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {links?.google.length ? 'Link another' : 'Link Google'}
                </Button>
                {links?.google.length ? (
                  <Button size="sm" variant="ghost" disabled={busy} onClick={unlinkGoogle} data-testid="button-unlink-google">
                    <Unlink className="mr-2 h-4 w-4" />
                    Unlink
                  </Button>
                ) : null}
              </div>
            </div>
            {!links?.phone && links?.google.length ? (
              <p className="text-xs text-muted-foreground">Add a phone before unlinking Google.</p>
            ) : null}
          </div>

          {!canLink && (
            <p className="text-sm text-muted-foreground">Sign-in changes are unavailable right now.</p>
          )}
        </div>
      )}
    </section>
  );
}
