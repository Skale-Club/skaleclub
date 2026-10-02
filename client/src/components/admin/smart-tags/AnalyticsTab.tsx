import { useState } from 'react';
import { AnalyticsPanel, FilterSelect, PRODUCT_OPTIONS, RangePicker, type AnalyticsRange } from './shared';
import { useSmartTagBatches, useSmartTagCustomers } from './TagsTab';

export function AnalyticsTab({ onOpenTag }: { onOpenTag: (id: string) => void }) {
  const [range, setRange] = useState<AnalyticsRange>({ preset: '30d' });
  const [scope, setScope] = useState<{ customerId?: string; batchId?: string; productType?: string }>({});
  const { data: customers = [] } = useSmartTagCustomers();
  const { data: batches = [] } = useSmartTagBatches();

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3">
        <RangePicker value={range} onChange={setRange} />
        <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
          <FilterSelect value={scope.productType} onChange={(v) => setScope((s) => ({ ...s, productType: v }))} placeholder="All products" options={PRODUCT_OPTIONS} />
          <FilterSelect
            value={scope.customerId}
            onChange={(v) => setScope((s) => ({ ...s, customerId: v }))}
            placeholder="All customers"
            options={customers.map((c) => ({ value: c.id, label: c.businessName }))}
          />
          <FilterSelect
            value={scope.batchId}
            onChange={(v) => setScope((s) => ({ ...s, batchId: v }))}
            placeholder="All batches"
            options={batches.map((b) => ({ value: b.id, label: b.batchCode }))}
          />
        </div>
      </div>
      <AnalyticsPanel scopeUrl="/api/admin/smart-tags/analytics" scope={scope} range={range} showTopTags onOpenTag={onOpenTag} />
    </div>
  );
}
