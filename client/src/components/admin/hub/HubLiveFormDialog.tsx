import { Save } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from '@/components/ui/loader';
import type { HubLiveSummary } from '@shared/schema';
import type { HubStatus } from './hubTypes';

export type LiveFormState = {
  id: number | null;
  slug: string;
  title: string;
  description: string;
  startsAt: string;
  timezone: string;
  streamUrl: string;
  replayUrl: string;
  status: HubStatus;
  capacity: string;
};

export const EMPTY_FORM: LiveFormState = {
  id: null,
  slug: '',
  title: '',
  description: '',
  startsAt: '',
  timezone: 'America/New_York',
  streamUrl: '',
  replayUrl: '',
  status: 'scheduled',
  capacity: '',
};

const COMMON_TIMEZONES: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'America/New_York', label: 'New York (ET)' },
  { value: 'America/Chicago', label: 'Chicago (CT)' },
  { value: 'America/Denver', label: 'Denver (MT)' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (PT)' },
  { value: 'America/Sao_Paulo', label: 'São Paulo (BRT)' },
  { value: 'America/Mexico_City', label: 'Mexico City (CST)' },
  { value: 'Europe/London', label: 'London (UK)' },
  { value: 'UTC', label: 'UTC' },
];

function toDateTimeLocal(value?: string | Date | null) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60_000);
  return localDate.toISOString().slice(0, 16);
}

export function fromSummaryToForm(live: HubLiveSummary): LiveFormState {
  return {
    id: live.id,
    slug: live.slug,
    title: live.title,
    description: live.description ?? '',
    startsAt: toDateTimeLocal(live.startsAt),
    timezone: live.timezone,
    streamUrl: live.streamUrl ?? '',
    replayUrl: live.replayUrl ?? '',
    status: live.status as HubStatus,
    capacity: live.capacity == null ? '' : String(live.capacity),
  };
}

export type HubLiveFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: LiveFormState;
  onFormChange: (next: LiveFormState | ((prev: LiveFormState) => LiveFormState)) => void;
  selectedLive: HubLiveSummary | null;
  onSubmit: () => void;
  isPending: boolean;
};

export function HubLiveFormDialog(props: HubLiveFormDialogProps): JSX.Element {
  const { open, onOpenChange, form, onFormChange, selectedLive, onSubmit, isPending } = props;
  const canSave = Boolean(form.slug.trim() && form.title.trim() && form.startsAt);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2 pr-8">
            <DialogTitle>{form.id == null ? 'Create live' : 'Edit live'}</DialogTitle>
            {form.status === 'live' ? <Badge variant="success">Currently active</Badge> : null}
          </div>
          <DialogDescription>
            Manage the title, schedule, destination link, and status from one place.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            if (canSave && !isPending) {
              onSubmit();
            }
          }}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="hub-title">Live title</Label>
              <Input id="hub-title" value={form.title} onChange={(event) => onFormChange((current) => ({ ...current, title: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hub-slug">Slug</Label>
              <Input id="hub-slug" value={form.slug} onChange={(event) => onFormChange((current) => ({ ...current, slug: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hub-status">Status</Label>
              <select
                id="hub-status"
                value={form.status}
                onChange={(event) => onFormChange((current) => ({ ...current, status: event.target.value as HubStatus }))}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="draft">Draft</option>
                <option value="scheduled">Inactive</option>
                <option value="live">Active</option>
                <option value="ended">Ended</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="hub-starts-at">Date and time</Label>
              <Input id="hub-starts-at" type="datetime-local" value={form.startsAt} onChange={(event) => onFormChange((current) => ({ ...current, startsAt: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hub-timezone">Timezone</Label>
              <select
                id="hub-timezone"
                value={form.timezone}
                onChange={(event) => onFormChange((current) => ({ ...current, timezone: event.target.value }))}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {COMMON_TIMEZONES.some((tz) => tz.value === form.timezone) ? null : (
                  <option value={form.timezone}>{form.timezone}</option>
                )}
                {COMMON_TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>{tz.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="hub-description">Description</Label>
              <Textarea id="hub-description" rows={4} value={form.description} onChange={(event) => onFormChange((current) => ({ ...current, description: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hub-stream-url">Live link</Label>
              <Input id="hub-stream-url" value={form.streamUrl} onChange={(event) => onFormChange((current) => ({ ...current, streamUrl: event.target.value }))} placeholder="https://zoom.us/..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hub-replay-url">Replay link</Label>
              <Input id="hub-replay-url" value={form.replayUrl} onChange={(event) => onFormChange((current) => ({ ...current, replayUrl: event.target.value }))} placeholder="https://example.com/replay" />
            </div>
            <div className="space-y-2 md:max-w-[180px]">
              <Label htmlFor="hub-capacity">Capacity</Label>
              <Input id="hub-capacity" type="number" min="0" value={form.capacity} onChange={(event) => onFormChange((current) => ({ ...current, capacity: event.target.value }))} />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:space-x-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            {form.id != null ? (
              <Button type="button" variant="outline" onClick={() => onFormChange(selectedLive ? fromSummaryToForm(selectedLive) : EMPTY_FORM)}>
                Reset
              </Button>
            ) : null}
            <Button type="submit" className="gap-2" disabled={!canSave || isPending}>
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {form.id == null ? 'Create live' : 'Save changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
