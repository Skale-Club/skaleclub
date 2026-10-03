import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, Download, Factory, Plus } from 'lucide-react';
import { AdminCard } from '@/components/admin/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { SMART_TAG_BATCH_STATUSES, SMART_TAG_MAX_BATCH_QUANTITY } from '@shared/smartTags';
import type { SmartTagBatchItem, SmartTagListItem } from '@shared/smartTagsApi';
import { errorMessage, formatDate, getJson, invalidateSmartTags, percent, sendJson, SMART_TAGS_KEY, STALE_MS } from './api';
import { AnalyticsPanel, FilterSelect, MetricCard, PRODUCT_OPTIONS, productLabel, RangePicker, type AnalyticsRange } from './shared';
import { TagTable } from './TagTable';
import { useSmartTagBatches } from './TagsTab';
import { JourneyPanel } from './JourneyPanel';

const BATCH_STATUS_OPTIONS = SMART_TAG_BATCH_STATUSES.map((s) => ({ value: s, label: s[0].toUpperCase() + s.slice(1) }));

function NewBatchDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: (id: string) => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({ name: '', batchCode: '', productType: 'google_review_sign' as string | undefined, vendor: '', quantity: '100', notes: '' });
  const quantity = Number(form.quantity);
  const validQuantity = Number.isInteger(quantity) && quantity >= 1 && quantity <= SMART_TAG_MAX_BATCH_QUANTITY;
  const create = useMutation({
    mutationFn: () => sendJson<{ id: string; batchCode: string }>('POST', '/api/admin/smart-tag-batches', { ...form, quantity }),
    onSuccess: (batch) => {
      invalidateSmartTags();
      onOpenChange(false);
      toast({ title: `Batch ${batch.batchCode} generated`, description: `${quantity} unique tags are in inventory.` });
      onCreated(batch.id);
    },
    onError: (err) => toast({ title: 'Could not create batch', description: errorMessage(err), variant: 'destructive' }),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New production batch</DialogTitle>
          <DialogDescription>Generates N inventory tags, each with its own permanent QR and NFC URL.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="batch-name">Name *</Label>
            <Input id="batch-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Google Review signs — first run" maxLength={120} />
          </div>
          <div className="space-y-1.5">
            <Label>Product type</Label>
            <FilterSelect value={form.productType} onChange={(v) => setForm({ ...form, productType: v })} placeholder="Choose…" options={PRODUCT_OPTIONS} className="sm:w-full" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="batch-qty">Quantity *</Label>
            <Input id="batch-qty" type="number" min={1} max={SMART_TAG_MAX_BATCH_QUANTITY} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="batch-code">Batch code</Label>
            <Input id="batch-code" value={form.batchCode} onChange={(e) => setForm({ ...form, batchCode: e.target.value.toUpperCase() })} placeholder="Auto, e.g. REV-2026-001" maxLength={40} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="batch-vendor">Vendor</Label>
            <Input id="batch-vendor" value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} maxLength={120} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="batch-notes">Notes</Label>
            <Textarea id="batch-notes" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} maxLength={2000} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => create.mutate()} disabled={!form.name.trim() || !form.productType || !validQuantity || create.isPending}>
            {create.isPending ? 'Generating…' : `Generate ${validQuantity ? quantity : ''} tags`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function BatchesTab({ onOpenBatch }: { onOpenBatch: (id: string) => void }) {
  const { data: batches = [], isLoading, isError } = useSmartTagBatches();
  const [creating, setCreating] = useState(false);
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setCreating(true)} data-testid="smart-tags-new-batch"><Plus className="mr-1.5 h-4 w-4" />New batch</Button>
      </div>
      <AdminCard padding="compact">
        {isLoading ? (
          <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : isError ? (
          <p className="text-sm text-destructive">Could not load batches.</p>
        ) : batches.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No batches yet. Create one to generate printable QR codes.</p>
        ) : (
          <ul className="divide-y divide-border">
            {batches.map((b: SmartTagBatchItem) => (
              <li key={b.id}>
                <button type="button" onClick={() => onOpenBatch(b.id)} className="flex w-full flex-col gap-1 py-3 text-left hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate font-medium"><span className="font-mono">{b.batchCode}</span> · {b.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {productLabel(b.productType)} · {b.vendor || 'No vendor'} · {b.status} · {formatDate(b.createdAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-4 text-xs tabular-nums text-muted-foreground">
                    <span>{b.quantity} pcs</span>
                    <span>{b.inventoryCount} inventory</span>
                    <span>{b.assignedCount} assigned ({b.activeCount} active)</span>
                    <span>{b.nfcVerifiedCount} chips verified</span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </AdminCard>
      <NewBatchDialog open={creating} onOpenChange={setCreating} onCreated={onOpenBatch} />
    </div>
  );
}

interface BatchDetailData {
  id: string;
  batchCode: string;
  name: string;
  productType: string;
  vendor: string | null;
  quantity: number;
  status: string;
  notes: string | null;
  createdAt: string;
  tags: SmartTagListItem[];
}

export function BatchDetail({ id, onBack, onOpenTag }: { id: string; onBack: () => void; onOpenTag: (id: string) => void }) {
  const { toast } = useToast();
  const [range, setRange] = useState<AnalyticsRange>({ preset: '30d' });
  const { data: batch, isLoading, isError } = useQuery<BatchDetailData>({
    queryKey: [SMART_TAGS_KEY, 'batch', id],
    queryFn: () => getJson(`/api/admin/smart-tag-batches/${id}`),
    staleTime: STALE_MS,
  });
  const setStatus = useMutation({
    mutationFn: (status: string) => sendJson('PATCH', `/api/admin/smart-tag-batches/${id}`, { status }),
    onSuccess: () => { invalidateSmartTags(); toast({ title: 'Batch status updated' }); },
    onError: (err) => toast({ title: 'Could not update', description: errorMessage(err), variant: 'destructive' }),
  });

  if (isLoading) return <Skeleton className="h-64 rounded-2xl" />;
  if (isError || !batch) return <p className="text-sm text-destructive">Batch not found.</p>;

  const total = batch.tags.length;
  const inventory = batch.tags.filter((t) => t.status === 'inventory').length;
  const active = batch.tags.filter((t) => t.status === 'active').length;
  const chipsVerified = batch.tags.filter((t) => t.nfcStatus === 'verified' || t.nfcStatus === 'locked').length;
  const exportBase = `/api/admin/smart-tag-batches/${batch.id}`;

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="mr-1.5 h-4 w-4" />All batches</Button>
      <AdminCard padding="compact" className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold"><span className="font-mono">{batch.batchCode}</span> · {batch.name}</h2>
            <p className="text-sm text-muted-foreground">
              {productLabel(batch.productType)} · {batch.vendor || 'No vendor'} · created {formatDate(batch.createdAt)}
            </p>
            {batch.notes ? <p className="mt-1 whitespace-pre-wrap text-sm">{batch.notes}</p> : null}
          </div>
          <FilterSelect
            value={batch.status}
            onChange={(v) => v && v !== batch.status && setStatus.mutate(v)}
            placeholder="Status"
            options={BATCH_STATUS_OPTIONS}
          />
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="Tags" value={total} helper={`${batch.quantity} ordered`} />
          <MetricCard label="Inventory" value={inventory} />
          <MetricCard label="Assigned / live" value={total - inventory} helper={`${percent(total - inventory, total)} of batch`} />
          <MetricCard label="Active" value={active} helper={`${chipsVerified} chip(s) verified`} />
        </div>
        <div className="rounded-xl border border-dashed border-border p-4">
          <p className="mb-1 flex items-center gap-2 text-sm font-semibold"><Factory className="h-4 w-4" />Manufacturing package</p>
          <p className="mb-3 text-xs text-muted-foreground">
            CSV maps serial → code → QR/NFC URL → QR file. The ZIP holds the CSV plus one SVG (and optional 1200px PNG) per tag.
            Program each NFC chip with its row's nfc_url; lock it only after the QR and NFC of that piece both pass a phone test.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" asChild>
              <a href={`${exportBase}/export.csv`} download><Download className="mr-1.5 h-3.5 w-3.5" />CSV</a>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <a href={`${exportBase}/qr-assets.zip`} download><Download className="mr-1.5 h-3.5 w-3.5" />QR ZIP (SVG)</a>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <a href={`${exportBase}/qr-assets.zip?png=1`} download><Download className="mr-1.5 h-3.5 w-3.5" />QR ZIP (SVG + PNG)</a>
            </Button>
          </div>
        </div>
      </AdminCard>

      <AdminCard padding="compact">
        <p className="mb-3 text-sm font-semibold">Tags</p>
        <TagTable tags={batch.tags} onOpen={onOpenTag} showBatch={false} />
      </AdminCard>

      <JourneyPanel scope={{ batchId: id }} title="Batch journey" />

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold">Analytics</p>
          <RangePicker value={range} onChange={setRange} />
        </div>
        <AnalyticsPanel scopeUrl="/api/admin/smart-tags/analytics" scope={{ batchId: id }} range={range} showTopTags onOpenTag={onOpenTag} />
      </div>
    </div>
  );
}
