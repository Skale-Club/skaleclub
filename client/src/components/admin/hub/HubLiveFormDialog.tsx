import { Save, Trash2 } from 'lucide-react';
import { useState } from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
import { HUB_STATUS_LABELS, type HubStatus } from './hubTypes';
import { utcToZonedInput, zonedInputToUtcIso } from './hubTime';

export type LiveFormState = {
  id: number | null;
  slug: string;
  title: string;
  description: string;
  /** Wall-clock "YYYY-MM-DDTHH:mm" values, interpreted in `timezone` (not the browser zone). */
  startsAt: string;
  endsAt: string;
  registrationOpensAt: string;
  registrationClosesAt: string;
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
  endsAt: '',
  registrationOpensAt: '',
  registrationClosesAt: '',
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

export function fromSummaryToForm(live: HubLiveSummary): LiveFormState {
  return {
    id: live.id,
    slug: live.slug,
    title: live.title,
    description: live.description ?? '',
    startsAt: utcToZonedInput(live.startsAt, live.timezone),
    endsAt: utcToZonedInput(live.endsAt, live.timezone),
    registrationOpensAt: utcToZonedInput(live.registrationOpensAt, live.timezone),
    registrationClosesAt: utcToZonedInput(live.registrationClosesAt, live.timezone),
    timezone: live.timezone,
    streamUrl: live.streamUrl ?? '',
    replayUrl: live.replayUrl ?? '',
    status: live.status as HubStatus,
    capacity: live.capacity == null ? '' : String(live.capacity),
  };
}

export type LivePayload = {
  slug: string;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string | null;
  registrationOpensAt: string | null;
  registrationClosesAt: string | null;
  timezone: string;
  streamUrl: string | null;
  replayUrl: string | null;
  status: HubStatus;
  capacity: number | null;
};

/** Returns a human-readable validation problem, or null when the form is valid. */
export function validateLiveForm(form: LiveFormState): string | null {
  const startsAt = zonedInputToUtcIso(form.startsAt, form.timezone);
  if (!startsAt) return 'Enter a valid start date and time.';

  const optional = (value: string, label: string) => {
    if (!value) return { iso: null as string | null, error: null as string | null };
    const iso = zonedInputToUtcIso(value, form.timezone);
    return iso ? { iso, error: null } : { iso: null, error: `${label} is not a valid date and time.` };
  };

  const end = optional(form.endsAt, 'End time');
  if (end.error) return end.error;
  const opens = optional(form.registrationOpensAt, 'Registration opening');
  if (opens.error) return opens.error;
  const closes = optional(form.registrationClosesAt, 'Registration closing');
  if (closes.error) return closes.error;

  if (end.iso && new Date(end.iso).getTime() <= new Date(startsAt).getTime()) {
    return 'End time must be after the start time.';
  }
  if (opens.iso && closes.iso && new Date(closes.iso).getTime() <= new Date(opens.iso).getTime()) {
    return 'Registration must close after it opens.';
  }
  if (form.capacity.trim()) {
    const capacity = Number(form.capacity);
    if (!Number.isInteger(capacity) || capacity < 0) {
      return 'Capacity must be a whole number (0 or more), or empty for unlimited.';
    }
  }
  return null;
}

/** Converts wall-clock form values (in the selected timezone) into the API payload (UTC ISO). */
export function buildLivePayload(form: LiveFormState): LivePayload {
  const startsAt = zonedInputToUtcIso(form.startsAt, form.timezone);
  if (!startsAt) {
    throw new Error('Enter a valid start date and time.');
  }
  return {
    slug: form.slug.trim(),
    title: form.title.trim(),
    description: form.description || null,
    startsAt,
    endsAt: form.endsAt ? zonedInputToUtcIso(form.endsAt, form.timezone) : null,
    registrationOpensAt: form.registrationOpensAt
      ? zonedInputToUtcIso(form.registrationOpensAt, form.timezone)
      : null,
    registrationClosesAt: form.registrationClosesAt
      ? zonedInputToUtcIso(form.registrationClosesAt, form.timezone)
      : null,
    timezone: form.timezone,
    streamUrl: form.streamUrl || null,
    replayUrl: form.replayUrl || null,
    status: form.status,
    capacity: form.capacity.trim() ? Number(form.capacity) : null,
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
  onDelete?: () => void;
  isDeleting?: boolean;
};

export function HubLiveFormDialog(props: HubLiveFormDialogProps): JSX.Element {
  const { open, onOpenChange, form, onFormChange, selectedLive, onSubmit, isPending, onDelete, isDeleting } = props;
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const validationError = form.startsAt ? validateLiveForm(form) : null;
  const canSave = Boolean(form.slug.trim() && form.title.trim() && form.startsAt) && !validationError;

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
                <option value="draft">{HUB_STATUS_LABELS.draft}</option>
                <option value="scheduled">{HUB_STATUS_LABELS.scheduled}</option>
                <option value="live">{HUB_STATUS_LABELS.live}</option>
                <option value="ended">{HUB_STATUS_LABELS.ended}</option>
                <option value="cancelled">{HUB_STATUS_LABELS.cancelled}</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="hub-starts-at">Date and time (in selected timezone)</Label>
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
            <div className="space-y-2">
              <Label htmlFor="hub-ends-at">End time (optional)</Label>
              <Input id="hub-ends-at" type="datetime-local" value={form.endsAt} onChange={(event) => onFormChange((current) => ({ ...current, endsAt: event.target.value }))} data-testid="input-hub-ends-at" />
              <p className="text-xs text-muted-foreground">Defaults to 3h after start. Same timezone as above.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="hub-capacity">Capacity</Label>
              <Input id="hub-capacity" type="number" min="0" step="1" value={form.capacity} onChange={(event) => onFormChange((current) => ({ ...current, capacity: event.target.value }))} data-testid="input-hub-capacity" />
              <p className="text-xs text-muted-foreground">Leave empty for unlimited.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="hub-reg-opens-at">Registration opens (optional)</Label>
              <Input id="hub-reg-opens-at" type="datetime-local" value={form.registrationOpensAt} onChange={(event) => onFormChange((current) => ({ ...current, registrationOpensAt: event.target.value }))} data-testid="input-hub-registration-opens-at" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hub-reg-closes-at">Registration closes (optional)</Label>
              <Input id="hub-reg-closes-at" type="datetime-local" value={form.registrationClosesAt} onChange={(event) => onFormChange((current) => ({ ...current, registrationClosesAt: event.target.value }))} data-testid="input-hub-registration-closes-at" />
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
          </div>

          {validationError ? (
            <p className="text-sm text-destructive" role="alert" data-testid="text-hub-form-error">{validationError}</p>
          ) : null}

          <DialogFooter className="gap-2 sm:space-x-0">
            {form.id != null && onDelete ? (
              <Button
                type="button"
                variant="outline"
                className="gap-2 border-destructive/40 text-destructive hover:bg-destructive/10 sm:mr-auto"
                onClick={() => setConfirmDeleteOpen(true)}
                disabled={isDeleting || isPending}
                data-testid="button-hub-delete-live"
              >
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Delete live
              </Button>
            ) : null}
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            {form.id != null ? (
              <Button type="button" variant="outline" onClick={() => onFormChange(selectedLive && selectedLive.id === form.id ? fromSummaryToForm(selectedLive) : form)} data-testid="button-hub-reset-form">
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

      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this live?</AlertDialogTitle>
            <AlertDialogDescription>
              "{form.title || 'Untitled live'}" and all of its registrations and access history will be permanently deleted. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-hub-delete-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                setConfirmDeleteOpen(false);
                onDelete?.();
              }}
              data-testid="button-hub-delete-confirm"
            >
              Delete live
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
