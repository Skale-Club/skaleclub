import { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { JOURNEY_ENTRY_KINDS, JOURNEY_ENTRY_KIND_LABELS } from '@shared/smartTagJourney';
import { FilterSelect } from './shared';
import { useSmartTagBatches } from './TagsTab';
import { JourneyPanel } from './JourneyPanel';

const KIND_OPTIONS = JOURNEY_ENTRY_KINDS.map((k) => ({ value: k, label: JOURNEY_ENTRY_KIND_LABELS[k] }));

/** Every batch's story in one timeline, filterable by batch and kind. */
export function JourneyTab() {
  const { data: batches } = useSmartTagBatches();
  const [batchId, setBatchId] = useState<string | undefined>();
  const [kind, setKind] = useState<string | undefined>();
  const [includeArchived, setIncludeArchived] = useState(false);
  const batchOptions = (batches ?? []).map((b) => ({ value: b.id, label: `${b.batchCode} · ${b.name}` }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <FilterSelect value={batchId} onChange={setBatchId} placeholder="All batches" options={batchOptions} className="sm:w-72" testId="journey-filter-batch" />
        <FilterSelect value={kind} onChange={setKind} placeholder="All kinds" options={KIND_OPTIONS} testId="journey-filter-kind" />
        <div className="flex items-center gap-2 px-1">
          <Switch id="journey-archived" checked={includeArchived} onCheckedChange={setIncludeArchived} />
          <Label htmlFor="journey-archived" className="text-sm text-muted-foreground">Show archived</Label>
        </div>
      </div>
      <JourneyPanel scope={{ batchId }} kind={kind} includeArchived={includeArchived} />
    </div>
  );
}
