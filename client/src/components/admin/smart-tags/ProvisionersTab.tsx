import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { KeyRound, Laptop } from 'lucide-react';
import { AdminCard } from '@/components/admin/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { errorMessage, formatDateTime, invalidateSmartTags, sendJson } from './api';
import { useProvisioners } from './NfcProvisioningCard';

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'outline'> = { active: 'success', pairing: 'warning', revoked: 'outline' };

/** Pair and revoke the desktop "Skale NFC Provisioner" installs. */
export function ProvisionersTab() {
  const { toast } = useToast();
  const { data: devices = [], isLoading, isError } = useProvisioners();
  const [name, setName] = useState('');
  const [pairing, setPairing] = useState<{ code: string; expiresAt: string | null; deviceName: string } | null>(null);

  const create = useMutation({
    mutationFn: () => sendJson<{ pairingCode: string; device: { deviceName: string; pairingExpiresAt: string | null } }>(
      'POST', '/api/admin/smart-tag-provisioners', { deviceName: name },
    ),
    onSuccess: (r) => {
      setPairing({ code: r.pairingCode, expiresAt: r.device.pairingExpiresAt, deviceName: r.device.deviceName });
      setName('');
      invalidateSmartTags();
    },
    onError: (err) => toast({ title: 'Could not create pairing code', description: errorMessage(err), variant: 'destructive' }),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => sendJson('POST', `/api/admin/smart-tag-provisioners/${id}/revoke`),
    onSuccess: () => { invalidateSmartTags(); toast({ title: 'Provisioner revoked' }); },
    onError: (err) => toast({ title: 'Could not revoke', description: errorMessage(err), variant: 'destructive' }),
  });

  return (
    <div className="space-y-4">
      <AdminCard padding="compact" className="space-y-3">
        <p className="flex items-center gap-2 text-sm font-semibold"><KeyRound className="h-4 w-4" />Pair a computer</p>
        <p className="text-xs text-muted-foreground">
          Install Skale NFC Provisioner on the computer with the USB NFC reader, then enter this one-time code in the app.
          The app gets a token that can only fetch and report NFC programming jobs — no admin access.
        </p>
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => { e.preventDefault(); create.mutate(); }}
        >
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Computer name, e.g. Workshop PC" maxLength={80} />
          <Button type="submit" disabled={!name.trim() || create.isPending}>Create pairing code</Button>
        </form>
        {pairing ? (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-center" data-testid="pairing-code">
            <p className="text-xs text-muted-foreground">Code for {pairing.deviceName}</p>
            <p className="my-1 font-mono text-3xl font-bold tracking-[0.2em]">{pairing.code}</p>
            <p className="text-xs text-muted-foreground">Single use · expires {formatDateTime(pairing.expiresAt)}</p>
          </div>
        ) : null}
      </AdminCard>

      <AdminCard padding="compact">
        {isLoading ? (
          <div className="space-y-2">{[0, 1].map((i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : isError ? (
          <p className="text-sm text-destructive">Could not load provisioners.</p>
        ) : devices.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No provisioners paired yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {devices.map((d) => (
              <li key={d.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <Laptop className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{d.deviceName} <Badge variant={STATUS_VARIANT[d.status] ?? 'outline'} className="ml-1">{d.status}</Badge></p>
                    <p className="truncate text-xs text-muted-foreground">
                      {d.status === 'pairing'
                        ? `Waiting for the code · expires ${formatDateTime(d.pairingExpiresAt)}`
                        : `${d.platform ?? '—'} · v${d.appVersion ?? '?'} · last seen ${formatDateTime(d.lastSeenAt)}${d.tokenPrefix ? ` · ${d.tokenPrefix}…` : ''}`}
                    </p>
                  </div>
                </div>
                {d.status !== 'revoked' ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    disabled={revoke.isPending}
                    onClick={() => window.confirm(`Revoke "${d.deviceName}"? It stops working immediately and its open jobs are cancelled.`) && revoke.mutate(d.id)}
                  >
                    Revoke
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground">Revoked {formatDateTime(d.revokedAt)}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </AdminCard>
    </div>
  );
}
