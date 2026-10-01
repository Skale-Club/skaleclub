import { useState } from 'react';
import { useLocation } from 'wouter';
import { Nfc, ScanLine } from 'lucide-react';
import { SectionHeader } from '@/components/admin/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { normalizeTagCode } from '@shared/smartTags';
import { errorMessage, getJson } from './api';
import { OverviewTab } from './OverviewTab';
import { TagsTab } from './TagsTab';
import { TagDetail } from './TagDetail';
import { CustomersTab, CustomerDetail } from './CustomersTab';
import { BatchesTab, BatchDetail } from './BatchesTab';
import { AnalyticsTab } from './AnalyticsTab';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'tags', label: 'Tags' },
  { id: 'customers', label: 'Customers' },
  { id: 'batches', label: 'Batches' },
  { id: 'analytics', label: 'Analytics' },
] as const;
type TabId = (typeof TABS)[number]['id'];

/** Field-sales entry point: type the code printed on the piece, open its record. */
function CodeLookup({ onFound }: { onFound: (id: string) => void }) {
  const { toast } = useToast();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = normalizeTagCode(code);
    if (!normalized) {
      toast({ title: 'Invalid code', description: 'Codes are 8 letters/numbers, e.g. A7K3P9X2.', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      const tag = await getJson<{ id: string }>(`/api/admin/smart-tags/lookup/${normalized}`);
      setCode('');
      onFound(tag.id);
    } catch (err) {
      toast({ title: 'Tag not found', description: errorMessage(err), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="flex w-full gap-2 lg:w-auto">
      <Input
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        placeholder="Tag code, e.g. A7K3P9X2"
        className="font-mono lg:w-56"
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        inputMode="text"
        data-testid="smart-tag-code-lookup"
      />
      <Button type="submit" disabled={busy || !code.trim()}>
        <ScanLine className="mr-1.5 h-4 w-4" />Open
      </Button>
    </form>
  );
}

export function SmartTagsSection() {
  const [location, setLocation] = useLocation();
  const [, tabSegment, idSegment] = location.replace(/^\/admin\/smart-tags\/?/, '/').split('/');
  const tab: TabId = (TABS.find((t) => t.id === tabSegment)?.id ?? 'overview');
  const id = idSegment || null;

  const go = (path: string) => setLocation(`/admin/smart-tags${path}`);
  const openTag = (tagId: string) => go(`/tags/${tagId}`);

  let body: React.ReactNode;
  if (tab === 'tags' && id) body = <TagDetail id={id} onBack={() => go('/tags')} />;
  else if (tab === 'customers' && id) body = <CustomerDetail id={id} onBack={() => go('/customers')} onOpenTag={openTag} />;
  else if (tab === 'batches' && id) body = <BatchDetail id={id} onBack={() => go('/batches')} onOpenTag={openTag} />;
  else if (tab === 'tags') body = <TagsTab onOpenTag={openTag} />;
  else if (tab === 'customers') body = <CustomersTab onOpenCustomer={(cid) => go(`/customers/${cid}`)} />;
  else if (tab === 'batches') body = <BatchesTab onOpenBatch={(bid) => go(`/batches/${bid}`)} />;
  else if (tab === 'analytics') body = <AnalyticsTab onOpenTag={openTag} />;
  else body = <OverviewTab onOpenTag={openTag} />;

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Smart Tags"
        description="Dynamic QR/NFC redirects for physical products — the printed code never changes, the destination does."
        icon={<Nfc className="h-5 w-5" />}
        action={<CodeLookup onFound={openTag} />}
      />
      <Tabs value={tab} onValueChange={(value) => go(value === 'overview' ? '' : `/${value}`)}>
        <div className="-mx-1 overflow-x-auto px-1">
          <TabsList>
            {TABS.map((t) => (
              <TabsTrigger key={t.id} value={t.id} data-testid={`smart-tags-tab-${t.id}`}>{t.label}</TabsTrigger>
            ))}
          </TabsList>
        </div>
      </Tabs>
      {body}
    </div>
  );
}
