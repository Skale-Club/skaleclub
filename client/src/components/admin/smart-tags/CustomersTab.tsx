import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, Plus } from 'lucide-react';
import { AdminCard } from '@/components/admin/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import type { SmartTagCustomerItem, SmartTagListItem } from '@shared/smartTagsApi';
import { errorMessage, formatDateTime, getJson, invalidateSmartTags, sendJson, SMART_TAGS_KEY, STALE_MS } from './api';
import { AnalyticsPanel, RangePicker, type AnalyticsRange } from './shared';
import { TagTable } from './TagTable';
import { useSmartTagCustomers } from './TagsTab';

type CustomerForm = {
  businessName: string;
  contactName: string;
  email: string;
  phone: string;
  externalCrmId: string;
  notes: string;
};

const EMPTY: CustomerForm = { businessName: '', contactName: '', email: '', phone: '', externalCrmId: '', notes: '' };

function toForm(c: Partial<SmartTagCustomerItem> | undefined): CustomerForm {
  return {
    businessName: c?.businessName ?? '',
    contactName: c?.contactName ?? '',
    email: c?.email ?? '',
    phone: c?.phone ?? '',
    externalCrmId: c?.externalCrmId ?? '',
    notes: c?.notes ?? '',
  };
}

function CustomerFields({ form, setForm }: { form: CustomerForm; setForm: (f: CustomerForm) => void }) {
  const field = (key: keyof CustomerForm, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div className="space-y-1.5">
      <Label htmlFor={`cust-${key}`}>{label}</Label>
      <Input id={`cust-${key}`} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} {...props} />
    </div>
  );
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {field('businessName', 'Business name *', { maxLength: 200 })}
      {field('contactName', 'Contact name', { maxLength: 200 })}
      {field('phone', 'Phone', { inputMode: 'tel', maxLength: 40 })}
      {field('email', 'Email', { inputMode: 'email', maxLength: 200 })}
      {field('externalCrmId', 'CRM id', { maxLength: 120 })}
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="cust-notes">Notes</Label>
        <Textarea id="cust-notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} maxLength={2000} rows={3} />
      </div>
    </div>
  );
}

export function CustomersTab({ onOpenCustomer }: { onOpenCustomer: (id: string) => void }) {
  const { toast } = useToast();
  const { data: customers = [], isLoading, isError } = useSmartTagCustomers();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CustomerForm>(EMPTY);
  const create = useMutation({
    mutationFn: () => sendJson<{ id: string }>('POST', '/api/admin/smart-tag-customers', form),
    onSuccess: (c) => {
      invalidateSmartTags();
      setOpen(false);
      setForm(EMPTY);
      onOpenCustomer(c.id);
    },
    onError: (err) => toast({ title: 'Could not create customer', description: errorMessage(err), variant: 'destructive' }),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)}><Plus className="mr-1.5 h-4 w-4" />New customer</Button>
      </div>
      <AdminCard padding="compact">
        {isLoading ? (
          <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : isError ? (
          <p className="text-sm text-destructive">Could not load customers.</p>
        ) : customers.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No customers yet. They are also created while activating a tag.</p>
        ) : (
          <ul className="divide-y divide-border">
            {customers.map((c) => (
              <li key={c.id}>
                <button type="button" onClick={() => onOpenCustomer(c.id)} className="flex w-full flex-col gap-1 py-3 text-left hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{c.businessName}</p>
                    <p className="truncate text-xs text-muted-foreground">{[c.contactName, c.phone, c.email].filter(Boolean).join(' · ') || 'No contact info'}</p>
                  </div>
                  <div className="flex shrink-0 gap-4 text-xs tabular-nums text-muted-foreground">
                    <span>{c.tagCount} tags ({c.activeTags} active)</span>
                    <span>{c.interactions} interactions</span>
                    <span>Last {formatDateTime(c.lastInteractionAt)}</span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </AdminCard>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>New customer</DialogTitle></DialogHeader>
          <CustomerFields form={form} setForm={setForm} />
          <DialogFooter>
            <Button onClick={() => create.mutate()} disabled={!form.businessName.trim() || create.isPending}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function CustomerDetail({ id, onBack, onOpenTag }: { id: string; onBack: () => void; onOpenTag: (id: string) => void }) {
  const { toast } = useToast();
  const [range, setRange] = useState<AnalyticsRange>({ preset: '30d' });
  const { data: customer, isLoading, isError } = useQuery<SmartTagCustomerItem>({
    queryKey: [SMART_TAGS_KEY, 'customer', id],
    queryFn: () => getJson(`/api/admin/smart-tag-customers/${id}`),
    staleTime: STALE_MS,
  });
  const { data: tags = [] } = useQuery<SmartTagListItem[]>({
    queryKey: [SMART_TAGS_KEY, 'tags', `customer:${id}`],
    queryFn: () => getJson(`/api/admin/smart-tags?customerId=${id}`),
    staleTime: STALE_MS,
  });
  const [form, setForm] = useState<CustomerForm | null>(null);
  const save = useMutation({
    mutationFn: () => sendJson('PATCH', `/api/admin/smart-tag-customers/${id}`, form),
    onSuccess: () => { invalidateSmartTags(); setForm(null); toast({ title: 'Customer saved' }); },
    onError: (err) => toast({ title: 'Could not save', description: errorMessage(err), variant: 'destructive' }),
  });

  if (isLoading) return <Skeleton className="h-64 rounded-2xl" />;
  if (isError || !customer) return <p className="text-sm text-destructive">Customer not found.</p>;

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="mr-1.5 h-4 w-4" />All customers</Button>
      <AdminCard padding="compact" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-bold">{customer.businessName}</h2>
          {form ? null : <Button size="sm" variant="outline" onClick={() => setForm(toForm(customer))}>Edit</Button>}
        </div>
        {form ? (
          <>
            <CustomerFields form={form} setForm={setForm} />
            <div className="flex gap-2">
              <Button size="sm" onClick={() => save.mutate()} disabled={!form.businessName.trim() || save.isPending}>Save</Button>
              <Button size="sm" variant="ghost" onClick={() => setForm(null)}>Cancel</Button>
            </div>
          </>
        ) : (
          <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
            <dt className="text-muted-foreground">Contact</dt><dd>{customer.contactName || '—'}</dd>
            <dt className="text-muted-foreground">Phone</dt><dd>{customer.phone || '—'}</dd>
            <dt className="text-muted-foreground">Email</dt><dd className="break-all">{customer.email || '—'}</dd>
            <dt className="text-muted-foreground">CRM id</dt><dd>{customer.externalCrmId || '—'}</dd>
            <dt className="text-muted-foreground">Notes</dt><dd className="whitespace-pre-wrap">{customer.notes || '—'}</dd>
          </dl>
        )}
      </AdminCard>

      <AdminCard padding="compact">
        <p className="mb-3 text-sm font-semibold">Tags ({tags.length})</p>
        <TagTable tags={tags} onOpen={onOpenTag} showCustomer={false} />
      </AdminCard>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold">Analytics</p>
          <RangePicker value={range} onChange={setRange} />
        </div>
        <AnalyticsPanel scopeUrl="/api/admin/smart-tags/analytics" scope={{ customerId: id }} range={range} showTopTags onOpenTag={onOpenTag} />
      </div>
    </div>
  );
}
