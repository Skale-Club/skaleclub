import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Archive, ArrowLeft, Check, Copy, Download, ExternalLink, Power, PowerOff, RotateCcw, Undo2, UserPlus } from 'lucide-react';
import { AdminCard } from '@/components/admin/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { defaultUtmEnabled, planTransition, validateDestinationUrl } from '@shared/smartTags';
import type { SmartTagDetail } from '@shared/smartTagsApi';
import { copyText, errorMessage, formatDateTime, getJson, invalidateSmartTags, sendJson, SMART_TAGS_KEY, STALE_MS } from './api';
import { AnalyticsPanel, DESTINATION_OPTIONS, destinationLabel, FilterSelect, productLabel, RangePicker, StatusBadge, type AnalyticsRange } from './shared';
import { useSmartTagCustomers } from './TagsTab';
import { NfcProvisioningCard } from './NfcProvisioningCard';

const URL_HINTS: Record<string, string> = {
  google_review: 'The customer\'s official Google review link (Google Business Profile → "Ask for reviews").',
  website: 'Customer website, e.g. https://example.com',
  booking: 'Booking page URL',
  vcard: 'Digital business card URL',
  menu: 'Menu URL',
  social: 'Instagram / Facebook / TikTok profile URL',
  custom: 'Any https:// URL',
};

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-1">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-md bg-muted px-2 py-1.5 text-xs">{value}</code>
        <Button
          size="icon"
          variant="outline"
          className="h-8 w-8 shrink-0"
          aria-label={`Copy ${label}`}
          onClick={async () => {
            if (await copyText(value)) {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }
          }}
        >
          {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
        </Button>
      </div>
    </div>
  );
}

function useTagMutation(id: string, successTitle: string) {
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ path, method = 'POST', body }: { path: string; method?: 'POST' | 'PATCH'; body?: unknown }) =>
      sendJson<SmartTagDetail>(method, `/api/admin/smart-tags/${id}${path}`, body ?? {}),
    onSuccess: () => {
      invalidateSmartTags();
      toast({ title: successTitle });
    },
    onError: (err) => toast({ title: 'Action failed', description: errorMessage(err), variant: 'destructive' }),
  });
}

function CustomerStep({ tag }: { tag: SmartTagDetail }) {
  const { data: customers = [] } = useSmartTagCustomers();
  const [customerId, setCustomerId] = useState<string | undefined>(tag.customerId ?? undefined);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ businessName: '', contactName: '', phone: '', email: '' });
  const assign = useTagMutation(tag.id, 'Customer assigned');
  const locked = tag.status === 'retired';

  const submit = () => {
    if (creating) assign.mutate({ path: '/assign', body: { customer: draft } });
    else if (customerId) {
      if (tag.customerId && tag.customerId !== customerId && tag.destinationUrl &&
        !window.confirm('Moving this tag to another customer clears its current destination. Continue?')) return;
      assign.mutate({ path: '/assign', body: { customerId } });
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold">1. Customer</p>
      {tag.customerName ? <p className="text-sm">Assigned to <strong>{tag.customerName}</strong></p> : <p className="text-sm text-muted-foreground">Not assigned yet.</p>}
      {locked ? null : creating ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <Input placeholder="Business name *" value={draft.businessName} onChange={(e) => setDraft({ ...draft, businessName: e.target.value })} />
          <Input placeholder="Contact name" value={draft.contactName} onChange={(e) => setDraft({ ...draft, contactName: e.target.value })} />
          <Input placeholder="Phone" inputMode="tel" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
          <Input placeholder="Email" inputMode="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
        </div>
      ) : (
        <FilterSelect
          value={customerId}
          onChange={setCustomerId}
          placeholder="Select customer…"
          options={customers.map((c) => ({ value: c.id, label: c.businessName }))}
          className="sm:w-full"
          testId="smart-tag-customer-select"
        />
      )}
      {locked ? null : (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={submit}
            disabled={assign.isPending || (creating ? !draft.businessName.trim() : !customerId || customerId === tag.customerId)}
            data-testid="smart-tag-assign"
          >
            {creating ? 'Create & assign' : 'Assign'}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setCreating((v) => !v)}>
            <UserPlus className="mr-1.5 h-3.5 w-3.5" />{creating ? 'Pick existing' : 'New customer'}
          </Button>
        </div>
      )}
    </div>
  );
}

function DestinationStep({ tag }: { tag: SmartTagDetail }) {
  const [destinationType, setDestinationType] = useState<string | undefined>(tag.destinationType ?? undefined);
  const [destinationUrl, setDestinationUrl] = useState(tag.destinationUrl ?? '');
  const [utmEnabled, setUtmEnabled] = useState(tag.utmEnabled);
  const [utmTouched, setUtmTouched] = useState(false);
  const [utmCampaign, setUtmCampaign] = useState(tag.utmCampaign ?? '');
  const [reason, setReason] = useState('');
  const save = useTagMutation(tag.id, 'Destination saved');
  const locked = tag.status === 'retired';
  const check = destinationUrl.trim() ? validateDestinationUrl(destinationUrl, { allowHttp: import.meta.env.DEV }) : null;
  const dirty =
    destinationType !== (tag.destinationType ?? undefined) ||
    destinationUrl.trim() !== (tag.destinationUrl ?? '') ||
    utmEnabled !== tag.utmEnabled ||
    utmCampaign.trim() !== (tag.utmCampaign ?? '');

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold">2. Destination</p>
      <FilterSelect
        value={destinationType}
        onChange={(v) => {
          setDestinationType(v);
          if (!utmTouched) setUtmEnabled(defaultUtmEnabled(v));
        }}
        placeholder="Destination type…"
        options={DESTINATION_OPTIONS}
        className="sm:w-full"
        testId="smart-tag-destination-type"
      />
      <div className="space-y-1">
        <Input
          value={destinationUrl}
          onChange={(e) => setDestinationUrl(e.target.value)}
          placeholder="https://"
          inputMode="url"
          autoCapitalize="off"
          autoCorrect="off"
          disabled={locked}
          data-testid="smart-tag-destination-url"
        />
        <p className="text-xs text-muted-foreground">
          {check && !check.ok ? <span className="text-destructive">{check.error}</span> : URL_HINTS[destinationType ?? ''] ?? 'Paste the full URL.'}
        </p>
      </div>
      <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
        <div>
          <Label htmlFor="utm-switch" className="text-sm">Add tracking parameters (UTM)</Label>
          <p className="text-xs text-muted-foreground">utm_medium=qr or nfc. Off by default for Google Review links.</p>
        </div>
        <Switch id="utm-switch" checked={utmEnabled} onCheckedChange={(v) => { setUtmEnabled(v); setUtmTouched(true); }} disabled={locked} />
      </div>
      {utmEnabled ? (
        <Input value={utmCampaign} onChange={(e) => setUtmCampaign(e.target.value)} placeholder="Campaign (defaults to none), e.g. johns-barber" maxLength={80} />
      ) : null}
      {tag.destinationUrl ? (
        <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for change (optional, kept in history)" maxLength={300} />
      ) : null}
      {locked ? null : (
        <Button
          size="sm"
          disabled={!dirty || save.isPending || !destinationType || !check?.ok}
          onClick={() => save.mutate({
            path: '',
            method: 'PATCH',
            body: { destinationType, destinationUrl: destinationUrl.trim(), utmEnabled, utmCampaign, reason },
          })}
          data-testid="smart-tag-save-destination"
        >
          Save destination
        </Button>
      )}
    </div>
  );
}

function LifecycleStep({ tag }: { tag: SmartTagDetail }) {
  const run = useTagMutation(tag.id, 'Tag updated');
  const can = (action: Parameters<typeof planTransition>[1]) => planTransition(tag, action).ok;
  const act = (action: string, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    run.mutate({ path: `/${action}` });
  };
  const activateBlocker = (() => {
    const plan = planTransition(tag, 'activate');
    return plan.ok ? null : plan.error;
  })();

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold">3. Test & go live</p>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={!tag.destinationUrl}
          onClick={() => tag.destinationUrl && window.open(tag.destinationUrl, '_blank', 'noopener,noreferrer')}
        >
          <ExternalLink className="mr-1.5 h-3.5 w-3.5" />Test destination
        </Button>
        {tag.status !== 'active' && tag.status !== 'retired' ? (
          <Button size="sm" disabled={!can('activate') || run.isPending} onClick={() => act('activate')} data-testid="smart-tag-activate">
            <Power className="mr-1.5 h-3.5 w-3.5" />Activate
          </Button>
        ) : null}
        {can('disable') ? (
          <Button size="sm" variant="outline" disabled={run.isPending} onClick={() => act('disable', 'Disable this tag? Scans will show an "unavailable" page.')}>
            <PowerOff className="mr-1.5 h-3.5 w-3.5" />Disable
          </Button>
        ) : null}
        {can('unassign') ? (
          <Button size="sm" variant="ghost" disabled={run.isPending} onClick={() => act('unassign', 'Return this tag to inventory? Customer and destination are cleared (history is kept).')}>
            <Undo2 className="mr-1.5 h-3.5 w-3.5" />Unassign
          </Button>
        ) : null}
        {can('retire') ? (
          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" disabled={run.isPending} onClick={() => act('retire', 'Retire this tag permanently? It stops redirecting. Analytics and history are kept.')}>
            <Archive className="mr-1.5 h-3.5 w-3.5" />Retire
          </Button>
        ) : null}
        {can('restore') ? (
          <Button size="sm" variant="outline" disabled={run.isPending} onClick={() => act('restore', 'Restore this retired tag? It comes back as not live.')}>
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />Restore
          </Button>
        ) : null}
      </div>
      {tag.status !== 'active' && tag.status !== 'retired' && activateBlocker ? (
        <p className="text-xs text-muted-foreground">{activateBlocker}.</p>
      ) : null}
      {tag.status === 'active' ? (
        <p className="text-xs text-green-600 dark:text-green-400">Live — both the QR and the NFC URL redirect to the destination.</p>
      ) : null}
    </div>
  );
}

export function TagDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const [range, setRange] = useState<AnalyticsRange>({ preset: '30d' });
  const { data: tag, isLoading, isError } = useQuery<SmartTagDetail>({
    queryKey: [SMART_TAGS_KEY, 'tag', id],
    queryFn: () => getJson(`/api/admin/smart-tags/${id}`),
    staleTime: STALE_MS,
  });

  if (isLoading) return <Skeleton className="h-96 rounded-2xl" />;
  if (isError || !tag) {
    return (
      <div className="space-y-3">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="mr-1.5 h-4 w-4" />All tags</Button>
        <p className="text-sm text-destructive">Tag not found.</p>
      </div>
    );
  }

  const qrImg = `/api/admin/smart-tags/${tag.id}/qr.svg?v=${encodeURIComponent(tag.publicCode)}`;

  return (
    <div className="space-y-4" data-testid="smart-tag-detail">
      <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="mr-1.5 h-4 w-4" />All tags</Button>

      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-mono text-2xl font-bold tracking-wider" data-testid="smart-tag-code">{tag.publicCode}</h2>
        <StatusBadge status={tag.status} />
        <span className="text-sm text-muted-foreground">
          {productLabel(tag.productType)}
          {tag.batchCode ? ` · ${tag.batchCode}${tag.serialNumber ? ` #${tag.serialNumber}` : ''}` : ''}
          {tag.label ? ` · ${tag.label}` : ''}
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        {/* key: re-seed the forms whenever the saved tag changes */}
        <AdminCard padding="compact" className="space-y-6" key={tag.updatedAt}>
          <CustomerStep tag={tag} />
          <div className="border-t border-border" />
          <DestinationStep tag={tag} />
          <div className="border-t border-border" />
          <LifecycleStep tag={tag} />
        </AdminCard>

        <AdminCard padding="compact" className="space-y-4">
          <div className="mx-auto w-44 rounded-lg bg-white p-2">
            <img src={qrImg} alt={`QR code for ${tag.publicCode}`} className="h-full w-full" />
          </div>
          <div className="flex justify-center gap-2">
            <Button size="sm" variant="outline" asChild>
              <a href={`/api/admin/smart-tags/${tag.id}/qr.svg?download=1`} download><Download className="mr-1.5 h-3.5 w-3.5" />SVG</a>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <a href={`/api/admin/smart-tags/${tag.id}/qr.png?download=1`} download><Download className="mr-1.5 h-3.5 w-3.5" />PNG</a>
            </Button>
          </div>
          <CopyRow label="QR URL (printed)" value={tag.qrUrl} />
          <CopyRow label="NFC URL (program the chip)" value={tag.nfcUrl} />
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
            <dt className="text-muted-foreground">Destination</dt><dd className="truncate">{destinationLabel(tag.destinationType)}</dd>
            <dt className="text-muted-foreground">Assigned</dt><dd>{formatDateTime(tag.assignedAt)}</dd>
            <dt className="text-muted-foreground">Activated</dt><dd>{formatDateTime(tag.activatedAt)}</dd>
            <dt className="text-muted-foreground">Disabled</dt><dd>{formatDateTime(tag.disabledAt)}</dd>
            <dt className="text-muted-foreground">Last interaction</dt><dd>{formatDateTime(tag.lastInteractionAt)}</dd>
          </dl>
        </AdminCard>
      </div>

      <NfcProvisioningCard tagId={tag.id} publicCode={tag.publicCode} nfcUrl={tag.nfcUrl} retired={tag.status === 'retired'} />

      <AdminCard padding="compact">
        <p className="mb-3 text-sm font-semibold">Destination history</p>
        {tag.history.length === 0 ? (
          <p className="text-sm text-muted-foreground">No destination set yet.</p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {tag.history.map((h) => (
              <li key={h.id} className="space-y-0.5 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>{formatDateTime(h.createdAt)} · {h.changedByEmail ?? 'admin'}</span>
                  {h.reason ? <span className="italic">“{h.reason}”</span> : null}
                </div>
                <p className="break-all">
                  <span className="text-muted-foreground">{destinationLabel(h.previousDestinationType)}: {h.previousUrl ?? '—'}</span>
                  <span className="mx-1">→</span>
                  <span>{destinationLabel(h.newDestinationType)}: {h.newUrl ?? 'cleared'}</span>
                </p>
              </li>
            ))}
          </ul>
        )}
      </AdminCard>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold">Analytics</p>
          <RangePicker value={range} onChange={setRange} />
        </div>
        <AnalyticsPanel scopeUrl={`/api/admin/smart-tags/${tag.id}/analytics`} range={range} />
      </div>
    </div>
  );
}
