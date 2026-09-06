import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarCheck, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Loader2 } from '@/components/ui/loader';
import type { XphereDelivery, XphereSettings } from '../shared/types';

const SETTINGS_KEY = '/api/integrations/xphere';
const DELIVERIES_KEY = '/api/integrations/xphere/deliveries?limit=10';

const EMPTY_SETTINGS: XphereSettings = {
  enabled: false,
  apiKey: '',
  keyPrefix: null,
  xphereOrgId: null,
  xphereOrgName: null,
  status: 'disconnected',
  lastValidatedAt: null,
  lastSuccessAt: null,
  lastErrorAt: null,
  lastErrorCode: null,
  bookingEnabled: false,
  bookingProfileSlug: '',
  inPersonEventSlug: '',
  onlineEventSlug: '',
  visitTypeQuestionId: 'tipoVisita',
  inPersonAnswerValue: 'presencial',
  onlineAnswerValue: 'online',
  tenantRef: 'skaleclub',
};

const STATUS_CLASS: Record<string, string> = {
  delivered: 'text-green-600',
  retry: 'text-amber-600',
  pending: 'text-amber-600',
  processing: 'text-amber-600',
  dead_letter: 'text-red-600',
  cancelled: 'text-muted-foreground',
};

async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const body = await response.json();
    return body?.message || fallback;
  } catch {
    return fallback;
  }
}

export function XphereCard() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<XphereSettings>(EMPTY_SETTINGS);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<'idle' | 'success' | 'error'>('idle');

  const { data: remoteSettings, isLoading } = useQuery<XphereSettings>({ queryKey: [SETTINGS_KEY] });
  const { data: deliveries } = useQuery<XphereDelivery[]>({
    queryKey: [DELIVERIES_KEY],
    refetchInterval: 30_000,
  });

  useEffect(() => {
    if (remoteSettings) setSettings(remoteSettings);
  }, [remoteSettings]);

  const saveSettings = async (settingsToSave?: XphereSettings): Promise<boolean> => {
    setIsSaving(true);
    try {
      const response = await apiRequest('PUT', SETTINGS_KEY, settingsToSave || settings);
      if (!response.ok) throw new Error(await readError(response, 'Could not save Xphere settings'));
      queryClient.invalidateQueries({ queryKey: [SETTINGS_KEY] });
      toast({ title: 'Settings saved successfully' });
      return true;
    } catch (error: any) {
      toast({ title: 'Failed to save settings', description: error.message, variant: 'destructive' });
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleEnabled = async (checked: boolean) => {
    if (checked && testResult !== 'success' && !settings.xphereOrgId) {
      toast({ title: 'Please run Test connection', description: 'A successful test is required before enabling Xphere.', variant: 'destructive' });
      return;
    }
    const next = { ...settings, enabled: checked };
    setSettings(next);
    const ok = await saveSettings(next);
    if (!ok) setSettings(settings);
  };

  const handleToggleBooking = (checked: boolean) => {
    setSettings((prev) => ({ ...prev, bookingEnabled: checked }));
  };

  const testConnection = async () => {
    setIsTesting(true);
    setTestResult('idle');
    try {
      const response = await apiRequest('POST', `${SETTINGS_KEY}/test`, { apiKey: settings.apiKey });
      const result = await response.json();
      if (response.ok && result.success) {
        setTestResult('success');
        queryClient.invalidateQueries({ queryKey: [SETTINGS_KEY] });
        toast({ title: `Connected to ${result.organization?.name ?? 'Xphere'}`, description: 'Key saved. You can now enable the handoff.' });
      } else {
        setTestResult('error');
        toast({ title: 'Connection failed', description: result.message || 'Could not connect to Xphere', variant: 'destructive' });
      }
    } catch (error: any) {
      setTestResult('error');
      toast({ title: 'Connection failed', description: error.message, variant: 'destructive' });
    } finally {
      setIsTesting(false);
    }
  };

  const retryDelivery = async (id: string) => {
    setRetryingId(id);
    try {
      const response = await apiRequest('POST', `/api/integrations/xphere/deliveries/${id}/retry`);
      if (!response.ok) throw new Error(await readError(response, 'Could not retry delivery'));
      queryClient.invalidateQueries({ queryKey: [DELIVERIES_KEY] });
      toast({ title: 'Delivery queued for retry' });
    } catch (error: any) {
      toast({ title: 'Retry failed', description: error.message, variant: 'destructive' });
    } finally {
      setRetryingId(null);
    }
  };

  const testButtonClass =
    testResult === 'success' ? 'bg-green-100 text-green-700 border-green-300 hover:bg-green-200'
    : testResult === 'error' ? 'bg-red-100 text-red-700 border-red-300 hover:bg-red-200'
    : '';

  const field = (key: keyof XphereSettings) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setSettings((prev) => ({ ...prev, [key]: e.target.value }));

  if (isLoading) {
    return <div className="flex w-full justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <Card className="rounded-2xl shadow-none">
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <CalendarCheck className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Xphere</CardTitle>
              <p className="text-sm text-muted-foreground">Send captured leads to Xphere and let them book a visit</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isSaving && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
            <Label htmlFor="xphere-enabled" className="text-sm">{settings.enabled ? 'Enabled' : 'Disabled'}</Label>
            <Switch id="xphere-enabled" checked={settings.enabled} onCheckedChange={handleToggleEnabled} disabled={isSaving} data-testid="switch-xphere-enabled" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Connection */}
        <div className="space-y-2">
          <Label htmlFor="xphere-api-key">API key</Label>
          <Input id="xphere-api-key" type="password" value={settings.apiKey} onChange={field('apiKey')} placeholder="xph_..." data-testid="input-xphere-api-key" />
          <p className="text-xs text-muted-foreground">Xphere {'->'} Settings {'->'} API Keys, scope leads:write</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" className={testButtonClass} onClick={testConnection} disabled={isTesting || !settings.apiKey} data-testid="button-test-xphere">
            {isTesting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {testResult === 'success' ? 'Test OK' : testResult === 'error' ? 'Test failed' : 'Test connection'}
          </Button>
          <p className="text-xs text-muted-foreground">
            Status: <span className="font-medium">{settings.status}</span>
            {settings.xphereOrgName && <> · {settings.xphereOrgName}</>}
            {settings.status === 'degraded' && settings.lastErrorCode && (
              <> · <span className="text-red-600">{settings.lastErrorCode}</span></>
            )}
          </p>
        </div>

        {/* Visit booking */}
        <div className="space-y-4 pt-4 border-t">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h4 className="font-medium text-sm">Visit booking</h4>
              <p className="text-xs text-muted-foreground">Redirects completed leads to your Xphere booking page based on their visit-type answer</p>
            </div>
            <Switch id="xphere-booking" checked={settings.bookingEnabled} onCheckedChange={handleToggleBooking} disabled={isSaving} data-testid="switch-xphere-booking" />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="xphere-profile-slug">Booking profile slug</Label>
              <Input id="xphere-profile-slug" value={settings.bookingProfileSlug} onChange={field('bookingProfileSlug')} placeholder="your-profile" data-testid="input-xphere-profile-slug" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="xphere-in-person-slug">In-person event slug</Label>
              <Input id="xphere-in-person-slug" value={settings.inPersonEventSlug} onChange={field('inPersonEventSlug')} placeholder="in-person-visit" data-testid="input-xphere-in-person-slug" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="xphere-online-slug">Online event slug</Label>
              <Input id="xphere-online-slug" value={settings.onlineEventSlug} onChange={field('onlineEventSlug')} placeholder="online-meeting" data-testid="input-xphere-online-slug" />
            </div>
          </div>
          <details className="rounded-lg border p-3">
            <summary className="cursor-pointer text-sm font-medium">Advanced</summary>
            <div className="mt-3 grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="xphere-question-id">Visit-type question id</Label>
                <Input id="xphere-question-id" value={settings.visitTypeQuestionId} onChange={field('visitTypeQuestionId')} placeholder="tipoVisita" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="xphere-in-person-value">In-person answer value</Label>
                <Input id="xphere-in-person-value" value={settings.inPersonAnswerValue} onChange={field('inPersonAnswerValue')} placeholder="presencial" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="xphere-online-value">Online answer value</Label>
                <Input id="xphere-online-value" value={settings.onlineAnswerValue} onChange={field('onlineAnswerValue')} placeholder="online" />
              </div>
              <div className="space-y-2 sm:col-span-3">
                <Label htmlFor="xphere-tenant-ref">Tenant reference</Label>
                <Input id="xphere-tenant-ref" value={settings.tenantRef} onChange={field('tenantRef')} placeholder="skaleclub" data-testid="input-xphere-tenant-ref" />
                <p className="text-xs text-muted-foreground">Sent to Xphere as source.tenant_ref on every lead. Default: skaleclub</p>
              </div>
            </div>
          </details>
          <Button onClick={() => saveSettings(settings)} disabled={isSaving} data-testid="button-save-xphere-booking">
            {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save booking settings
          </Button>
        </div>

        {/* Recent deliveries */}
        <div className="space-y-3 pt-4 border-t">
          <h4 className="font-medium text-sm">Recent deliveries</h4>
          {!deliveries?.length ? (
            <p className="text-sm text-muted-foreground">No deliveries yet</p>
          ) : (
            <ul className="divide-y rounded-lg border text-sm">
              {deliveries.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <div className="min-w-0">
                    <span className={`font-medium ${STATUS_CLASS[d.status] ?? ''}`}>{d.status}</span>
                    <span className="text-muted-foreground"> · lead #{d.aggregateId} · {new Date(d.createdAt).toLocaleString()}</span>
                    {d.lastErrorCode && <span className="text-red-600"> · {d.lastErrorCode}</span>}
                    {d.attemptCount > 0 && <span className="text-muted-foreground"> · {d.attemptCount} attempt{d.attemptCount === 1 ? '' : 's'}</span>}
                  </div>
                  {d.status === 'dead_letter' && (
                    <Button size="sm" variant="outline" onClick={() => retryDelivery(d.id)} disabled={retryingId === d.id}>
                      {retryingId === d.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                      <span className="ml-1">Retry</span>
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
