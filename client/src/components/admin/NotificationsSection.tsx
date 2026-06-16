import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, MessageSquare, Send, Mail, Plus, Trash2, PanelLeft, PanelLeftClose, type LucideIcon } from 'lucide-react';
import { SectionHeader, AdminCard, EmptyState } from './shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from '@/components/ui/loader';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { cn } from '@/lib/utils';

interface Template {
  id: number;
  name: string | null;
  eventKey: string;
  channel: string;
  subject: string | null;
  body: string;
  active: boolean;
}

type Draft = Omit<Template, 'id'> & { id?: number };

const TRIGGERS: { value: string; label: string; description: string }[] = [
  { value: 'new_chat', label: 'New Chat', description: 'A new visitor starts a chat conversation' },
  { value: 'hot_lead', label: 'Hot Lead', description: 'A lead is classified as hot' },
  { value: 'low_perf_alert', label: 'Low Performance', description: 'Chat response time exceeds the threshold' },
];

const CHANNELS: { value: string; label: string; icon: LucideIcon }[] = [
  { value: 'sms', label: 'SMS (Twilio)', icon: MessageSquare },
  { value: 'telegram', label: 'Telegram', icon: Send },
  { value: 'email', label: 'Email (Resend)', icon: Mail },
];

const TRIGGER_VARIABLES: Record<string, string[]> = {
  new_chat: ['{{company}}', '{{conversationId}}', '{{pageUrl}}'],
  hot_lead: ['{{company}}', '{{name}}', '{{phone}}', '{{classification}}'],
  low_perf_alert: ['{{company}}', '{{avgTime}}', '{{samples}}'],
};

const triggerLabel = (key: string) => TRIGGERS.find(t => t.value === key)?.label ?? key;
const channelMeta = (key: string) => CHANNELS.find(c => c.value === key);
const channelLabel = (key: string) => channelMeta(key)?.label ?? key;

function templateLabel(t: { name?: string | null; eventKey: string; channel: string }) {
  if (t.name && t.name.trim()) return t.name.trim();
  return `${triggerLabel(t.eventKey)} · ${channelMeta(t.channel)?.label.split(' ')[0] ?? t.channel}`;
}

export function NotificationsSection() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Template | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);

  const { data: templates = [], isLoading } = useQuery<Template[]>({
    queryKey: ['/api/notifications/templates'],
  });

  // Auto-select the first template once loaded / keep selection valid after deletes.
  useEffect(() => {
    if (!templates.length) {
      if (selectedId !== null) { setSelectedId(null); setDraft(null); }
      return;
    }
    if (selectedId === null || !templates.some(t => t.id === selectedId)) {
      const first = templates[0];
      setSelectedId(first.id);
      setDraft({ ...first });
    }
  }, [templates, selectedId]);

  const select = (t: Template) => {
    setSelectedId(t.id);
    setDraft({ ...t });
  };

  const source = useMemo(() => templates.find(t => t.id === selectedId) ?? null, [templates, selectedId]);
  const isDirty = !!draft && !!source && (
    (draft.name ?? '') !== (source.name ?? '') ||
    draft.eventKey !== source.eventKey ||
    draft.channel !== source.channel ||
    (draft.subject ?? '') !== (source.subject ?? '') ||
    draft.body !== source.body ||
    draft.active !== source.active
  );

  const createMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/notifications/templates', {
      name: 'New template', eventKey: 'new_chat', channel: 'sms', subject: '', body: '', active: false,
    }).then(r => r.json() as Promise<Template>),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ['/api/notifications/templates'] });
      select(created);
      toast({ title: 'Template created' });
    },
    onError: (e: any) => toast({ title: 'Could not create template', description: e?.message, variant: 'destructive' }),
  });

  const saveMutation = useMutation({
    mutationFn: (d: Draft) => apiRequest('PUT', `/api/notifications/templates/${d.id}`, {
      name: d.name, eventKey: d.eventKey, channel: d.channel,
      subject: d.subject ?? '', body: d.body, active: d.active,
    }).then(r => r.json() as Promise<Template>),
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/templates'] });
      setDraft({ ...saved });
      toast({ title: 'Template saved' });
    },
    onError: (e: any) => toast({ title: 'Could not save template', description: e?.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/notifications/templates/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/notifications/templates'] });
      setSelectedId(null);
      setDraft(null);
      toast({ title: 'Template deleted' });
    },
    onError: (e: any) => toast({ title: 'Could not delete template', description: e?.message, variant: 'destructive' }),
  });

  const patch = (p: Partial<Draft>) => setDraft(prev => (prev ? { ...prev, ...p } : prev));

  const insertVariable = (v: string) => {
    if (!draft) return;
    const el = bodyRef.current;
    const current = draft.body ?? '';
    if (el) {
      const start = el.selectionStart ?? current.length;
      const end = el.selectionEnd ?? current.length;
      const next = current.slice(0, start) + v + current.slice(end);
      patch({ body: next });
      requestAnimationFrame(() => {
        el.focus();
        const cursor = start + v.length;
        el.setSelectionRange(cursor, cursor);
      });
    } else {
      patch({ body: current + v });
    }
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  const variables = draft ? (TRIGGER_VARIABLES[draft.eventKey] ?? []) : [];

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Notifications"
        description="Message templates sent on SMS, Telegram and Email when key events happen."
        icon={<Bell className="w-5 h-5" />}
      />

      {templates.length === 0 ? (
        <EmptyState
          icon={<Bell />}
          title="No templates yet"
          description="Create a template to send SMS, Telegram or Email alerts when a chat starts or a hot lead arrives."
          action={
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
              {createMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              New template
            </Button>
          }
        />
      ) : (
        <div className="flex gap-4 items-start">
          {/* Sub-sidebar */}
          <div className={cn(
            'flex-shrink-0 border rounded-lg overflow-hidden transition-all duration-200',
            sidebarOpen ? 'w-52' : 'w-10',
          )}>
            {sidebarOpen ? (
              <>
                <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Templates</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground"
                    onClick={() => setSidebarOpen(false)}
                  >
                    <PanelLeftClose className="h-4 w-4" />
                  </Button>
                </div>
                <div>
                  {templates.map(t => {
                    const Icon = channelMeta(t.channel)?.icon ?? MessageSquare;
                    const active = t.id === selectedId;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => select(t)}
                        className={cn(
                          'flex items-center gap-2 w-full px-3 py-2.5 text-sm text-left transition-colors border-l-2',
                          active
                            ? 'border-l-primary bg-primary/5 text-primary'
                            : 'border-l-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="truncate flex-1 min-w-0">{templateLabel(active && draft ? draft : t)}</span>
                        {!t.active && <span className="text-[10px] opacity-50">off</span>}
                      </button>
                    );
                  })}
                </div>
                <div className="border-t p-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="w-full gap-1.5"
                    onClick={() => createMutation.mutate()}
                    disabled={createMutation.isPending}
                  >
                    <Plus className="h-4 w-4" /> New
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center py-2 gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground"
                  onClick={() => setSidebarOpen(true)}
                >
                  <PanelLeft className="h-4 w-4" />
                </Button>
                {templates.map(t => {
                  const Icon = channelMeta(t.channel)?.icon ?? MessageSquare;
                  const active = t.id === selectedId;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => select(t)}
                      title={templateLabel(t)}
                      className={cn(
                        'flex items-center justify-center h-8 w-8 rounded transition-colors',
                        active
                          ? 'text-primary bg-primary/10'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Editor */}
          <div className="flex-1 min-w-0">
            {draft && (
              <AdminCard className="space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <h3 className="text-sm font-semibold text-foreground">Edit template</h3>
                    <p className="text-sm text-muted-foreground">
                      Sent when <span className="font-medium text-foreground">{triggerLabel(draft.eventKey)}</span> fires,
                      via <span className="font-medium text-foreground">{channelLabel(draft.channel)}</span>.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={draft.active} onCheckedChange={(c) => patch({ active: c })} id="tpl-active" />
                    <Label htmlFor="tpl-active" className="text-sm text-muted-foreground">Active</Label>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="tpl-name">Name</Label>
                    <Input
                      id="tpl-name"
                      value={draft.name ?? ''}
                      onChange={(e) => patch({ name: e.target.value })}
                      placeholder="e.g. Hot Lead alert"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Trigger</Label>
                      <Select value={draft.eventKey} onValueChange={(v) => patch({ eventKey: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {TRIGGERS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Channel</Label>
                      <Select value={draft.channel} onValueChange={(v) => patch({ channel: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {CHANNELS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {draft.channel === 'email' && (
                  <div className="space-y-2">
                    <Label htmlFor="tpl-subject">Email subject</Label>
                    <Input
                      id="tpl-subject"
                      value={draft.subject ?? ''}
                      onChange={(e) => patch({ subject: e.target.value })}
                      placeholder="New lead from {{company}}"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="tpl-body">Message body</Label>
                  <Textarea
                    id="tpl-body"
                    ref={bodyRef}
                    rows={5}
                    value={draft.body}
                    onChange={(e) => patch({ body: e.target.value })}
                    placeholder="Enter the message…"
                    className="resize-y font-mono text-sm min-h-[120px]"
                  />
                  {variables.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs text-muted-foreground">Click a variable to insert it at the cursor:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {variables.map(v => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => insertVariable(v)}
                            className="group inline-flex items-center gap-1 rounded border bg-muted px-2 py-1 font-mono text-xs transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
                            title={`Insert ${v}`}
                          >
                            <Plus className="h-3 w-3 opacity-60 group-hover:opacity-100" />
                            {v}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2 border-t pt-4">
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => source && setDeleteTarget(source)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" /> Delete
                  </Button>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">{isDirty ? 'Unsaved changes' : 'Saved'}</span>
                    <Button
                      onClick={() => draft.id && saveMutation.mutate(draft)}
                      disabled={!isDirty || saveMutation.isPending}
                    >
                      {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Save
                    </Button>
                  </div>
                </div>
              </AdminCard>
            )}
          </div>
        </div>
      )}

      {deleteTarget && (
        <AlertDialog open onOpenChange={(o) => !o && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this template?</AlertDialogTitle>
              <AlertDialogDescription>
                "{templateLabel(deleteTarget)}" will be permanently removed. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => { deleteMutation.mutate(deleteTarget.id); setDeleteTarget(null); }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
