import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import { AdminCard } from '@/components/admin/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { SMART_TAG_STATUSES } from '@shared/smartTags';
import type { SmartTagBatchItem, SmartTagCustomerItem, SmartTagDetail, SmartTagListItem } from '@shared/smartTagsApi';
import { errorMessage, getJson, invalidateSmartTags, sendJson, SMART_TAGS_KEY, STALE_MS, withQuery } from './api';
import { FilterSelect, PRODUCT_OPTIONS } from './shared';
import { TagTable } from './TagTable';

const STATUS_OPTIONS = SMART_TAG_STATUSES.map((s) => ({ value: s, label: s[0].toUpperCase() + s.slice(1) }));
const METHOD_OPTIONS = [
  { value: 'qr', label: 'Has QR scans' },
  { value: 'nfc', label: 'Has NFC taps' },
];

interface Filters {
  status?: string;
  productType?: string;
  customerId?: string;
  batchId?: string;
  method?: string;
  search?: string;
}

export function useSmartTagCustomers() {
  return useQuery<SmartTagCustomerItem[]>({
    queryKey: [SMART_TAGS_KEY, 'customers'],
    queryFn: () => getJson('/api/admin/smart-tag-customers'),
    staleTime: STALE_MS,
  });
}

export function useSmartTagBatches() {
  return useQuery<SmartTagBatchItem[]>({
    queryKey: [SMART_TAGS_KEY, 'batches'],
    queryFn: () => getJson('/api/admin/smart-tag-batches'),
    staleTime: STALE_MS,
  });
}

function NewTagDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: (id: string) => void }) {
  const { toast } = useToast();
  const [productType, setProductType] = useState<string | undefined>('google_review_sign');
  const [label, setLabel] = useState('');
  const create = useMutation({
    mutationFn: () => sendJson<SmartTagDetail>('POST', '/api/admin/smart-tags', { productType, label }),
    onSuccess: (tag) => {
      invalidateSmartTags();
      onOpenChange(false);
      setLabel('');
      toast({ title: `Tag ${tag.publicCode} created` });
      onCreated(tag.id);
    },
    onError: (err) => toast({ title: 'Could not create tag', description: errorMessage(err), variant: 'destructive' }),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New single tag</DialogTitle>
          <DialogDescription>For one-off pieces. Production runs go through Batches.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Product type</Label>
            <FilterSelect value={productType} onChange={setProductType} placeholder="Choose…" options={PRODUCT_OPTIONS} className="sm:w-full" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-tag-label">Internal label (optional)</Label>
            <Input id="new-tag-label" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={120} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => create.mutate()} disabled={!productType || create.isPending}>Create tag</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function TagsTab({ onOpenTag }: { onOpenTag: (id: string) => void }) {
  const [filters, setFilters] = useState<Filters>({});
  const [searchDraft, setSearchDraft] = useState('');
  const [creating, setCreating] = useState(false);
  const { data: customers = [] } = useSmartTagCustomers();
  const { data: batches = [] } = useSmartTagBatches();

  const url = withQuery('/api/admin/smart-tags', { ...filters });
  const { data: tags = [], isLoading, isError } = useQuery<SmartTagListItem[]>({
    queryKey: [SMART_TAGS_KEY, 'tags', url],
    queryFn: () => getJson(url),
    staleTime: STALE_MS,
  });

  const set = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }));

  return (
    <div className="space-y-4">
      <AdminCard padding="compact" className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <form
            className="flex flex-1 gap-2"
            onSubmit={(e) => { e.preventDefault(); set({ search: searchDraft.trim() || undefined }); }}
          >
            <Input
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              placeholder="Search code, business, label or batch"
              data-testid="smart-tags-search"
            />
            <Button type="submit" variant="outline" size="icon" aria-label="Search"><Search className="h-4 w-4" /></Button>
          </form>
          <Button onClick={() => setCreating(true)} data-testid="smart-tags-new">
            <Plus className="mr-1.5 h-4 w-4" />New tag
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <FilterSelect value={filters.status} onChange={(v) => set({ status: v })} placeholder="All statuses" options={STATUS_OPTIONS} />
          <FilterSelect value={filters.productType} onChange={(v) => set({ productType: v })} placeholder="All products" options={PRODUCT_OPTIONS} />
          <FilterSelect
            value={filters.customerId}
            onChange={(v) => set({ customerId: v })}
            placeholder="All customers"
            options={customers.map((c) => ({ value: c.id, label: c.businessName }))}
          />
          <FilterSelect
            value={filters.batchId}
            onChange={(v) => set({ batchId: v })}
            placeholder="All batches"
            options={batches.map((b) => ({ value: b.id, label: b.batchCode }))}
          />
          <FilterSelect value={filters.method} onChange={(v) => set({ method: v })} placeholder="Any method" options={METHOD_OPTIONS} />
        </div>
      </AdminCard>

      <AdminCard padding="compact">
        {isLoading ? (
          <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-10" />)}</div>
        ) : isError ? (
          <p className="text-sm text-destructive">Could not load tags.</p>
        ) : (
          <>
            <TagTable tags={tags} onOpen={onOpenTag} />
            {tags.length >= 500 ? <p className="mt-3 text-xs text-muted-foreground">Showing the first 500 — narrow the filters to see more.</p> : null}
          </>
        )}
      </AdminCard>

      <NewTagDialog open={creating} onOpenChange={setCreating} onCreated={onOpenTag} />
    </div>
  );
}
