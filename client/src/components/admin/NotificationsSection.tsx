import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
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

const EVENT_KEYS = ['new_chat', 'hot_lead', 'low_perf_alert'] as const;
const CHANNELS = ['sms', 'telegram'] as const;

// --- State types ---

type DraftState = { body: string; active: boolean };

export function NotificationsSection() {
  const { toast } = useToast();
  const [drafts, setDrafts] = useState<Record<number, DraftState>>({});
  const [savingIds, setSavingIds] = useState<Record<number, boolean>>({});

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

              <CardContent className="space-y-6">
                {CHANNELS.map(channel => {
                  const template = grouped[eventKey]?.find(t => t.channel === channel);

                  if (!template) {
                    return (
                      <div key={channel} className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                        <span className="font-medium">{CHANNEL_LABELS[channel]}</span> — Not configured
                      </div>
                    );
                  }

                  const draft = drafts[template.id];
                  const isSaving = !!savingIds[template.id];
                  const currentBody = draft?.body ?? template.body;
                  const currentActive = draft?.active ?? template.active;

                  return (
                    <div key={channel} className="space-y-3 rounded-lg border border-border p-4">
                      {/* Channel label + active toggle */}
                      <div className="flex items-center justify-between gap-3">
                        <Label className="text-sm font-semibold">{CHANNEL_LABELS[channel]}</Label>
                        <div className="flex items-center gap-2">
                          <Switch
                            id={`active-${template.id}`}
                            checked={currentActive}
                            onCheckedChange={(checked) =>
                              setDrafts(prev => ({
                                ...prev,
                                [template.id]: { ...prev[template.id] ?? { body: template.body, active: template.active }, active: checked },
                              }))
                            }
                          />
                          <Label htmlFor={`active-${template.id}`} className="text-sm text-muted-foreground">
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
                          rows={3}
                          value={currentBody}
                          onChange={(e) =>
                            setDrafts(prev => ({
                              ...prev,
                              [template.id]: { ...prev[template.id] ?? { body: template.body, active: template.active }, body: e.target.value },
                            }))
                          }
                          placeholder="Enter template message..."
                          className="resize-none font-mono text-sm"
                        />
                      </div>

                      {/* Variable badges */}
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Available variables — click to copy:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {EVENT_VARIABLES[eventKey]?.map(v => (
                            <button
                              key={v}
                              type="button"
                              onClick={() => navigator.clipboard.writeText(v)}
                              className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded border border-border hover:bg-muted/80 transition-colors"
                              title="Click to copy"
                            >
                              {v}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Save button */}
                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          onClick={() => handleSave(template.id)}
                          disabled={!draft || draft.body.trim() === '' || isSaving}
                        >
                          {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                          Save
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
