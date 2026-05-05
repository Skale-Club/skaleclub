import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bell, MessageSquare, Send, Plus } from 'lucide-react';
import { SectionHeader } from './shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from '@/components/ui/loader';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import type { NotificationTemplate } from '@shared/schema';

// --- Hardcoded data maps ---

const EVENT_LABELS: Record<string, string> = {
  new_chat: 'New Chat',
  hot_lead: 'Hot Lead',
  low_perf_alert: 'Low Performance Alert',
};

const EVENT_DESCRIPTIONS: Record<string, string> = {
  new_chat: 'Sent when a new visitor starts a chat conversation',
  hot_lead: 'Sent when a lead is classified as hot',
  low_perf_alert: 'Sent when chat response time exceeds threshold',
};

const EVENT_VARIABLES: Record<string, string[]> = {
  new_chat: ['{{company}}', '{{conversationId}}', '{{pageUrl}}'],
  hot_lead: ['{{company}}', '{{name}}', '{{phone}}', '{{classification}}'],
  low_perf_alert: ['{{company}}', '{{avgTime}}', '{{samples}}'],
};

const CHANNEL_LABELS: Record<string, string> = {
  sms: 'SMS (Twilio)',
  telegram: 'Telegram',
};

const CHANNEL_ICONS: Record<string, typeof MessageSquare> = {
  sms: MessageSquare,
  telegram: Send,
};

const EVENT_KEYS = ['new_chat', 'hot_lead', 'low_perf_alert'] as const;
const CHANNELS = ['sms', 'telegram'] as const;

// --- State types ---

type DraftState = { body: string; active: boolean };

export function NotificationsSection() {
  const { toast } = useToast();
  const [drafts, setDrafts] = useState<Record<number, DraftState>>({});
  const [savingIds, setSavingIds] = useState<Record<number, boolean>>({});
  const textareaRefs = useRef<Record<number, HTMLTextAreaElement | null>>({});

  const { data: templates, isLoading } = useQuery<NotificationTemplate[]>({
    queryKey: ['/api/notifications/templates'],
  });

  useEffect(() => {
    if (templates) {
      const initial: Record<number, DraftState> = {};
      templates.forEach(t => {
        initial[t.id] = { body: t.body, active: t.active };
      });
      setDrafts(initial);
    }
  }, [templates]);

  const grouped = (templates ?? []).reduce((acc, t) => {
    if (!acc[t.eventKey]) acc[t.eventKey] = [];
    acc[t.eventKey].push(t);
    return acc;
  }, {} as Record<string, NotificationTemplate[]>);

  const updateDraft = (template: NotificationTemplate, patch: Partial<DraftState>) => {
    setDrafts(prev => ({
      ...prev,
      [template.id]: {
        ...(prev[template.id] ?? { body: template.body, active: template.active }),
        ...patch,
      },
    }));
  };

  const insertVariable = (template: NotificationTemplate, variable: string) => {
    const textarea = textareaRefs.current[template.id];
    const current = drafts[template.id]?.body ?? template.body;

    if (textarea) {
      const start = textarea.selectionStart ?? current.length;
      const end = textarea.selectionEnd ?? current.length;
      const next = current.slice(0, start) + variable + current.slice(end);
      updateDraft(template, { body: next });
      // Restore focus + put cursor right after the inserted variable
      requestAnimationFrame(() => {
        textarea.focus();
        const cursor = start + variable.length;
        textarea.setSelectionRange(cursor, cursor);
      });
    } else {
      updateDraft(template, { body: current + variable });
    }
  };

  const handleSave = async (templateId: number) => {
    const draft = drafts[templateId];
    if (!draft || draft.body.trim() === '') return;
    setSavingIds(prev => ({ ...prev, [templateId]: true }));
    try {
      await apiRequest('PUT', `/api/notifications/templates/${templateId}`, {
        body: draft.body,
        active: draft.active,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/templates'] });
      toast({ title: 'Template saved' });
    } catch (err: any) {
      toast({ title: 'Failed to save template', description: err.message, variant: 'destructive' });
    } finally {
      setSavingIds(prev => ({ ...prev, [templateId]: false }));
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Notifications"
        description="Configure notification templates for SMS and Telegram alerts."
        icon={<Bell className="w-5 h-5" />}
      />

      <div className="space-y-6">
        {EVENT_KEYS.map(eventKey => {
          const activeChannels = grouped[eventKey]?.filter(t => t.active) ?? [];
          const variables = EVENT_VARIABLES[eventKey] ?? [];

          return (
            <Card key={eventKey}>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle>{EVENT_LABELS[eventKey]}</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">{EVENT_DESCRIPTIONS[eventKey]}</p>
                  </div>
                  {activeChannels.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {activeChannels.map(t => (
                        <Badge key={t.id} variant="secondary" className="text-xs">
                          {CHANNEL_LABELS[t.channel] ?? t.channel}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </CardHeader>

              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {CHANNELS.map(channel => {
                    const template = grouped[eventKey]?.find(t => t.channel === channel);
                    const Icon = CHANNEL_ICONS[channel] ?? MessageSquare;

                    if (!template) {
                      return (
                        <div
                          key={channel}
                          className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground flex items-center gap-2"
                        >
                          <Icon className="w-4 h-4" />
                          <span className="font-medium">{CHANNEL_LABELS[channel]}</span>
                          <span>— Not configured</span>
                        </div>
                      );
                    }

                    const draft = drafts[template.id];
                    const isSaving = !!savingIds[template.id];
                    const currentBody = draft?.body ?? template.body;
                    const currentActive = draft?.active ?? template.active;
                    const isDirty =
                      !!draft && (draft.body !== template.body || draft.active !== template.active);

                    return (
                      <div
                        key={channel}
                        className="flex flex-col gap-3 rounded-lg border border-border bg-card/40 p-4"
                      >
                        {/* Channel label + active toggle */}
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <Icon className="w-4 h-4 text-muted-foreground" />
                            <Label className="text-sm font-semibold">{CHANNEL_LABELS[channel]}</Label>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              id={`active-${template.id}`}
                              checked={currentActive}
                              onCheckedChange={(checked) => updateDraft(template, { active: checked })}
                            />
                            <Label htmlFor={`active-${template.id}`} className="text-xs text-muted-foreground">
                              Active
                            </Label>
                          </div>
                        </div>

                        {/* Template body */}
                        <div className="space-y-1.5">
                          <Label htmlFor={`body-${template.id}`} className="text-xs text-muted-foreground">
                            Message body
                          </Label>
                          <Textarea
                            id={`body-${template.id}`}
                            ref={(el) => { textareaRefs.current[template.id] = el; }}
                            rows={4}
                            value={currentBody}
                            onChange={(e) => updateDraft(template, { body: e.target.value })}
                            placeholder="Enter template message..."
                            className="resize-y font-mono text-sm min-h-[96px]"
                          />
                        </div>

                        {/* Clickable variables */}
                        {variables.length > 0 && (
                          <div className="space-y-1.5">
                            <p className="text-xs text-muted-foreground">
                              Click a variable to insert it at the cursor:
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {variables.map(v => (
                                <button
                                  key={v}
                                  type="button"
                                  onClick={() => insertVariable(template, v)}
                                  className="group inline-flex items-center gap-1 font-mono text-xs bg-muted hover:bg-primary/10 hover:text-primary px-2 py-1 rounded border border-border hover:border-primary/40 transition-colors"
                                  title={`Insert ${v}`}
                                >
                                  <Plus className="w-3 h-3 opacity-60 group-hover:opacity-100" />
                                  {v}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Save button */}
                        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
                          <span className="text-xs text-muted-foreground">
                            {isDirty ? 'Unsaved changes' : 'Saved'}
                          </span>
                          <Button
                            size="sm"
                            onClick={() => handleSave(template.id)}
                            disabled={!isDirty || currentBody.trim() === '' || isSaving}
                          >
                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                            Save
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
