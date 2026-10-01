import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { CheckCircle2, Circle, Cpu, Loader2, XCircle } from 'lucide-react';
import { AdminCard } from '@/components/admin/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { OPEN_JOB_STATUSES, type ProvisioningJobStatus } from '@shared/nfcProvisioning';
import type { ProvisionerDeviceItem, TagProvisioningState } from '@shared/smartTagsApi';
import { errorMessage, formatDateTime, getJson, invalidateSmartTags, sendJson, SMART_TAGS_KEY, STALE_MS } from './api';
import { FilterSelect } from './shared';

const NFC_STATUS: Record<string, { label: string; variant: 'secondary' | 'success' | 'destructive' | 'warning' | 'outline' }> = {
  not_programmed: { label: 'Not programmed', variant: 'secondary' },
  programmed: { label: 'Programmed', variant: 'warning' },
  verified: { label: 'Verified', variant: 'success' },
  locked: { label: 'Locked', variant: 'outline' },
  failed: { label: 'Failed', variant: 'destructive' },
};

export function NfcStatusBadge({ status }: { status: string }) {
  const s = NFC_STATUS[status] ?? { label: status, variant: 'outline' as const };
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

const JOB_STEP_LABEL: Record<string, string> = {
  pending: 'Waiting for the desktop provisioner…',
  claimed: 'Provisioner has the job — place the tag on the reader and press Program.',
  writing: 'Writing the chip…',
  verifying: 'Reading back to verify…',
};

const ERROR_LABEL: Record<string, string> = {
  verification_mismatch: 'Read-back did not match the expected URL',
  unsupported_tag: 'Unsupported tag type',
  tag_read_only: 'Tag is read-only',
  insufficient_capacity: 'Not enough memory on the tag',
  tag_removed: 'Tag was removed during the write',
  write_failed: 'Write failed',
  no_tag: 'No tag on the reader',
  no_reader: 'No reader connected',
  expired: 'Job expired before completion',
  superseded: 'Replaced by a newer job',
  cancelled_by_admin: 'Cancelled from the website',
  cancelled_by_operator: 'Cancelled at the provisioner',
  device_revoked: 'Provisioner was revoked',
};

export function useProvisioners() {
  return useQuery<ProvisionerDeviceItem[]>({
    queryKey: [SMART_TAGS_KEY, 'provisioners'],
    queryFn: () => getJson('/api/admin/smart-tag-provisioners'),
    staleTime: STALE_MS,
  });
}

function QaItem({ done, label, at }: { done: boolean; label: string; at?: string | null }) {
  return (
    <li className="flex items-center gap-2 text-sm">
      {done ? <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" /> : <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />}
      <span className={done ? '' : 'text-muted-foreground'}>{label}</span>
      {at ? <span className="ml-auto text-xs text-muted-foreground">{formatDateTime(at)}</span> : null}
    </li>
  );
}

/**
 * NFC chip programming through the "Skale NFC Provisioner" desktop app. The
 * website creates a job; the app writes https://skale.club/n/<code>, reads it
 * back, and the server only marks the chip verified on an exact match.
 */
export function NfcProvisioningCard({ tagId, publicCode, nfcUrl, retired }: { tagId: string; publicCode: string; nfcUrl: string; retired: boolean }) {
  const { toast } = useToast();
  const [deviceId, setDeviceId] = useState<string | undefined>();
  const { data: devices = [] } = useProvisioners();
  const activeDevices = devices.filter((d) => d.status === 'active');

  const { data: state } = useQuery<TagProvisioningState>({
    queryKey: [SMART_TAGS_KEY, 'provisioning', tagId],
    queryFn: () => getJson(`/api/admin/smart-tags/${tagId}/provisioning`),
    staleTime: 2_000,
    // Live progress while a job is open.
    refetchInterval: (q) => {
      const job = (q.state.data as TagProvisioningState | undefined)?.jobs[0];
      return job && OPEN_JOB_STATUSES.includes(job.status as ProvisioningJobStatus) ? 2_000 : false;
    },
  });

  const send = useMutation({
    mutationFn: () => sendJson('POST', `/api/admin/smart-tags/${tagId}/provisioning-jobs`, { deviceId: deviceId ?? null }),
    onSuccess: () => invalidateSmartTags(),
    onError: (err) => toast({ title: 'Could not send to provisioner', description: errorMessage(err), variant: 'destructive' }),
  });
  const cancel = useMutation({
    mutationFn: (jobId: string) => sendJson('POST', `/api/admin/smart-tag-provisioning-jobs/${jobId}/cancel`),
    onSuccess: () => invalidateSmartTags(),
    onError: (err) => toast({ title: 'Could not cancel', description: errorMessage(err), variant: 'destructive' }),
  });

  if (!state) return null;
  const latest = state.jobs[0];
  const open = latest && OPEN_JOB_STATUSES.includes(latest.status as ProvisioningJobStatus);
  const verified = state.status === 'verified' || state.status === 'locked';

  return (
    <AdminCard padding="compact" className="space-y-4" data-testid="nfc-provisioning-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold"><Cpu className="h-4 w-4" />NFC chip</p>
        <NfcStatusBadge status={state.status} />
      </div>

      <p className="text-xs text-muted-foreground">
        The chip must hold exactly <code className="rounded bg-muted px-1">{nfcUrl}</code> — never the destination. Make sure the piece on
        the reader is the one printed <strong className="font-mono">{publicCode}</strong>.
      </p>

      {open ? (
        <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Loader2 className="h-4 w-4 animate-spin" />{JOB_STEP_LABEL[latest.status] ?? latest.status}
          </p>
          <p className="text-xs text-muted-foreground">
            {latest.deviceName ? `On ${latest.deviceName}. ` : ''}Expires {formatDateTime(latest.expiresAt)}.
          </p>
          <Button size="sm" variant="ghost" onClick={() => cancel.mutate(latest.id)} disabled={cancel.isPending}>Cancel job</Button>
        </div>
      ) : retired || state.status === 'locked' ? null : (
        <div className="space-y-2">
          {activeDevices.length === 0 ? (
            <p className="text-sm text-muted-foreground">No paired provisioner yet — pair one in the Provisioners tab.</p>
          ) : (
            <>
              <FilterSelect
                value={deviceId}
                onChange={setDeviceId}
                placeholder="Any paired provisioner"
                options={activeDevices.map((d) => ({ value: d.id, label: d.deviceName }))}
                className="sm:w-full"
              />
              <Button size="sm" onClick={() => send.mutate()} disabled={send.isPending} data-testid="nfc-send-to-provisioner">
                {state.status === 'not_programmed' ? 'Send to provisioner' : 'Program again'}
              </Button>
            </>
          )}
        </div>
      )}

      {latest && !open ? (
        <div className="flex items-start gap-2 text-sm">
          {latest.status === 'succeeded' ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
          ) : (
            <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          )}
          <div className="min-w-0">
            <p>
              Last job {latest.status}
              {latest.tagType ? ` · ${latest.tagType}` : ''}
              {latest.deviceName ? ` · ${latest.deviceName}` : ''} · {formatDateTime(latest.completedAt ?? latest.createdAt)}
            </p>
            {latest.errorCode ? (
              <p className="break-all text-xs text-muted-foreground">
                {ERROR_LABEL[latest.errorCode] ?? latest.errorCode}{latest.errorMessage ? ` — ${latest.errorMessage}` : ''}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      <div>
        <p className="mb-1.5 text-xs uppercase tracking-wide text-muted-foreground">Pairing QA</p>
        <ul className="space-y-1.5">
          <QaItem done={verified} label="Chip written and read back" at={state.verifiedAt} />
          <QaItem done={!!state.tapTestAt} label="Real phone NFC tap reached this tag" at={state.tapTestAt} />
          <QaItem done={!!state.qrTestAt} label="Printed QR scan reached this tag" at={state.qrTestAt} />
        </ul>
        {verified && (!state.tapTestAt || !state.qrTestAt) ? (
          <p className="mt-2 text-xs text-muted-foreground">Tap the chip and scan the printed QR with a phone to confirm both are the same piece.</p>
        ) : null}
      </div>
    </AdminCard>
  );
}
