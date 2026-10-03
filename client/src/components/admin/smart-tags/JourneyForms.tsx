import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  JOURNEY_ENTRY_KINDS,
  JOURNEY_ENTRY_KIND_LABELS,
  JOURNEY_PRODUCTION_ACTIONS,
  PLAN_KINDS,
  PLAN_KIND_LABELS,
  PLAN_STATUSES,
  PLAN_STATUS_LABELS,
  type PlanStatus,
} from '@shared/smartTagJourney';
import type { SmartTagPlanItem } from '@shared/smartTagsApi';
import { errorMessage, invalidateSmartTags, sendJson } from './api';
import { FilterSelect } from './shared';

/** The batch / tag / customer a new entry or plan belongs to. */
export interface JourneyScope {
  batchId?: string;
  tagId?: string;
  customerId?: string;
}

const KIND_OPTIONS = JOURNEY_ENTRY_KINDS.map((k) => ({ value: k, label: JOURNEY_ENTRY_KIND_LABELS[k] }));
const ACTION_OPTIONS = JOURNEY_PRODUCTION_ACTIONS.map((a) => ({ value: a, label: a.replace(/_/g, ' ') }));
const PLAN_KIND_OPTIONS = PLAN_KINDS.map((k) => ({ value: k, label: PLAN_KIND_LABELS[k] }));
const PLAN_STATUS_OPTIONS = PLAN_STATUSES.map((s) => ({ value: s, label: PLAN_STATUS_LABELS[s] }));

export function NewEntryDialog({ open, onOpenChange, scope }: { open: boolean; onOpenChange: (v: boolean) => void; scope: JourneyScope }) {
  const { toast } = useToast();
  const [form, setForm] = useState({ kind: 'observation' as string | undefined, action: undefined as string | undefined, title: '', content: '' });
  const save = useMutation({
    mutationFn: () =>
      sendJson('POST', '/api/admin/smart-tag-journey', {
        ...scope,
        kind: form.kind,
        action: form.kind === 'execution' ? form.action ?? null : null,
        title: form.title,
        content: form.content,
      }),
    onSuccess: () => {
      invalidateSmartTags();
      onOpenChange(false);
      setForm({ kind: 'observation', action: undefined, title: '', content: '' });
      toast({ title: 'Recorded in the journey' });
    },
    onError: (err) => toast({ title: 'Could not record', description: errorMessage(err), variant: 'destructive' }),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Record in the journey</DialogTitle>
          <DialogDescription>Something that happened, was decided or was learned. Entries cannot be edited afterwards, only archived.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Kind</Label>
              <FilterSelect value={form.kind} onChange={(kind) => setForm({ ...form, kind: kind ?? 'observation' })} placeholder="Kind" options={KIND_OPTIONS} className="sm:w-full" />
            </div>
            {form.kind === 'execution' ? (
              <div className="space-y-1.5">
                <Label>Step</Label>
                <FilterSelect value={form.action} onChange={(action) => setForm({ ...form, action })} placeholder="Other" options={ACTION_OPTIONS} className="sm:w-full" />
              </div>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="journey-title">Title</Label>
            <Input id="journey-title" value={form.title} maxLength={200} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Plate printed in PETG" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="journey-content">Details</Label>
            <Textarea id="journey-content" value={form.content} maxLength={4000} rows={4} onChange={(e) => setForm({ ...form, content: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !form.title.trim() || !form.kind}>Record</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function NewPlanDialog({ open, onOpenChange, scope }: { open: boolean; onOpenChange: (v: boolean) => void; scope: JourneyScope }) {
  const { toast } = useToast();
  const [form, setForm] = useState({ kind: 'task' as string | undefined, title: '', description: '', dueDate: '' });
  const save = useMutation({
    mutationFn: () => sendJson('POST', '/api/admin/smart-tag-plans', { ...scope, ...form }),
    onSuccess: () => {
      invalidateSmartTags();
      onOpenChange(false);
      setForm({ kind: 'task', title: '', description: '', dueDate: '' });
      toast({ title: 'Plan created' });
    },
    onError: (err) => toast({ title: 'Could not create plan', description: errorMessage(err), variant: 'destructive' }),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New plan</DialogTitle>
          <DialogDescription>A task, experiment, hypothesis, target or strategy. Closing it records the outcome in the journey.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Kind</Label>
              <FilterSelect value={form.kind} onChange={(kind) => setForm({ ...form, kind: kind ?? 'task' })} placeholder="Kind" options={PLAN_KIND_OPTIONS} className="sm:w-full" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="plan-due">Due</Label>
              <Input id="plan-due" type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="plan-title">Title</Label>
            <Input id="plan-title" value={form.title} maxLength={200} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Choose the size of the bigger plaque" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="plan-description">Description</Label>
            <Textarea id="plan-description" value={form.description} maxLength={4000} rows={4} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !form.title.trim() || !form.kind}>Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function PlanStatusDialog({ plan, onOpenChange }: { plan: SmartTagPlanItem | null; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [outcome, setOutcome] = useState('');
  const next = status ?? plan?.status;
  const save = useMutation({
    // An empty box keeps the saved outcome instead of clearing it.
    mutationFn: () => sendJson('PATCH', `/api/admin/smart-tag-plans/${plan!.id}`, { status: next, ...(outcome.trim() ? { outcome } : {}) }),
    onSuccess: () => {
      invalidateSmartTags();
      onOpenChange(false);
      setStatus(undefined);
      setOutcome('');
      toast({ title: 'Plan updated' });
    },
    onError: (err) => toast({ title: 'Could not update plan', description: errorMessage(err), variant: 'destructive' }),
  });
  return (
    <Dialog open={!!plan} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{plan?.title}</DialogTitle>
          <DialogDescription>Changing the status records it in the journey, with the outcome when the plan is closed.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Status</Label>
            <FilterSelect value={next} onChange={(v) => setStatus(v)} placeholder="Status" options={PLAN_STATUS_OPTIONS} className="sm:w-full" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="plan-outcome">Outcome</Label>
            <Textarea
              id="plan-outcome"
              value={outcome}
              maxLength={4000}
              rows={3}
              placeholder={plan?.outcome ?? 'What did it show?'}
              onChange={(e) => setOutcome(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || (next === plan?.status && !outcome.trim())}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export const planStatusLabel = (status: string) => PLAN_STATUS_LABELS[status as PlanStatus] ?? status;
