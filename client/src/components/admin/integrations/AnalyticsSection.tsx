import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, LayoutGrid } from 'lucide-react';
import { SiFacebook, SiGoogleanalytics, SiGoogletagmanager } from 'react-icons/si';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import type { AnalyticsSettings } from '../shared/types';

export function AnalyticsSection() {
  const { toast } = useToast();
  const [analyticsSettings, setAnalyticsSettings] = useState<AnalyticsSettings>({
    gtmContainerId: '',
    ga4MeasurementId: '',
    facebookPixelId: '',
    gtmEnabled: false,
    ga4Enabled: false,
    facebookPixelEnabled: false,
  });
  const [isSavingAnalytics, setIsSavingAnalytics] = useState(false);
  const saveAnalyticsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: companySettings } = useQuery<any>({
    queryKey: ['/api/company-settings'],
  });

  useEffect(() => {
    if (companySettings) {
      setAnalyticsSettings({
        gtmContainerId: companySettings.gtmContainerId || '',
        ga4MeasurementId: companySettings.ga4MeasurementId || '',
        facebookPixelId: companySettings.facebookPixelId || '',
        gtmEnabled: companySettings.gtmEnabled || false,
        ga4Enabled: companySettings.ga4Enabled || false,
        facebookPixelEnabled: companySettings.facebookPixelEnabled || false,
      });
    }
  }, [companySettings]);

  useEffect(() => {
    return () => {
      if (saveAnalyticsTimeoutRef.current) clearTimeout(saveAnalyticsTimeoutRef.current);
    };
  }, []);

  const saveAnalyticsSettings = useCallback(async (newSettings: Partial<AnalyticsSettings>) => {
    setIsSavingAnalytics(true);
    try {
      await apiRequest('PUT', '/api/company-settings', newSettings);
      queryClient.invalidateQueries({ queryKey: ['/api/company-settings'] });
    } catch (error: any) {
      toast({ title: 'Error saving analytics settings', description: error.message, variant: 'destructive' });
    } finally {
      setIsSavingAnalytics(false);
    }
  }, [toast]);

  const updateAnalyticsField = useCallback(<K extends keyof AnalyticsSettings>(field: K, value: AnalyticsSettings[K]) => {
    setAnalyticsSettings(prev => ({ ...prev, [field]: value }));
    if (saveAnalyticsTimeoutRef.current) clearTimeout(saveAnalyticsTimeoutRef.current);
    saveAnalyticsTimeoutRef.current = setTimeout(() => {
      saveAnalyticsSettings({ [field]: value });
    }, 800);
  }, [saveAnalyticsSettings]);

  const hasGtmId = analyticsSettings.gtmContainerId.trim().length > 0;
  const hasGa4Id = analyticsSettings.ga4MeasurementId.trim().length > 0;
  const hasFacebookPixelId = analyticsSettings.facebookPixelId.trim().length > 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Card className="border-0 bg-muted min-w-0">
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                  <SiGoogletagmanager className="w-4 h-4 text-[#1A73E8] dark:text-[#8AB4F8]" />
                </div>
                <CardTitle className="text-sm sm:text-base leading-tight">Google Tag Manager</CardTitle>
              </div>
              <Switch checked={analyticsSettings.gtmEnabled} onCheckedChange={(checked) => updateAnalyticsField('gtmEnabled', checked)} className="shrink-0" data-testid="switch-gtm-enabled" />
            </div>
          </CardHeader>
          <CardContent className="space-y-2.5">
            <div className="space-y-2">
              <Label htmlFor="gtm-id" className="text-xs sm:text-sm">Container ID</Label>
              <Input id="gtm-id" value={analyticsSettings.gtmContainerId} onChange={(e) => updateAnalyticsField('gtmContainerId', e.target.value)} placeholder="GTM-XXXXXXX" className="h-9 text-sm" data-testid="input-gtm-id" />
            </div>
            <p className="text-xs text-muted-foreground leading-snug">Find this in GTM under Admin {'->'} Container Settings</p>
            {analyticsSettings.gtmEnabled && hasGtmId && (
              <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-2.5 py-2 text-xs text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400">
                <Check className="h-3.5 w-3.5" />
                <span className="font-medium">Integration Active</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 bg-muted min-w-0">
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                  <SiGoogleanalytics className="w-4 h-4 text-[#E37400] dark:text-[#FFB74D]" />
                </div>
                <CardTitle className="text-sm sm:text-base leading-tight">Google Analytics 4</CardTitle>
              </div>
              <Switch checked={analyticsSettings.ga4Enabled} onCheckedChange={(checked) => updateAnalyticsField('ga4Enabled', checked)} className="shrink-0" data-testid="switch-ga4-enabled" />
            </div>
          </CardHeader>
          <CardContent className="space-y-2.5">
            <div className="space-y-2">
              <Label htmlFor="ga4-id" className="text-xs sm:text-sm">Measurement ID</Label>
              <Input id="ga4-id" value={analyticsSettings.ga4MeasurementId} onChange={(e) => updateAnalyticsField('ga4MeasurementId', e.target.value)} placeholder="G-XXXXXXXXXX" className="h-9 text-sm" data-testid="input-ga4-id" />
            </div>
            <p className="text-xs text-muted-foreground leading-snug">Find this in GA4 Admin {'->'} Data Streams</p>
            {analyticsSettings.ga4Enabled && hasGa4Id && (
              <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-2.5 py-2 text-xs text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400">
                <Check className="h-3.5 w-3.5" />
                <span className="font-medium">Integration Active</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 bg-muted min-w-0">
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center shrink-0">
                  <SiFacebook className="w-4 h-4 text-[#1877F2] dark:text-[#5AA2FF]" />
                </div>
                <CardTitle className="text-sm sm:text-base leading-tight">Facebook Pixel</CardTitle>
              </div>
              <Switch checked={analyticsSettings.facebookPixelEnabled} onCheckedChange={(checked) => updateAnalyticsField('facebookPixelEnabled', checked)} className="shrink-0" data-testid="switch-fb-pixel-enabled" />
            </div>
          </CardHeader>
          <CardContent className="space-y-2.5">
            <div className="space-y-2">
              <Label htmlFor="fb-pixel-id" className="text-xs sm:text-sm">Pixel ID</Label>
              <Input id="fb-pixel-id" value={analyticsSettings.facebookPixelId} onChange={(e) => updateAnalyticsField('facebookPixelId', e.target.value)} placeholder="123456789012345" className="h-9 text-sm" data-testid="input-fb-pixel-id" />
            </div>
            <p className="text-xs text-muted-foreground leading-snug">Find this in Meta Events Manager</p>
            {analyticsSettings.facebookPixelEnabled && hasFacebookPixelId && (
              <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-2.5 py-2 text-xs text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400">
                <Check className="h-3.5 w-3.5" />
                <span className="font-medium">Integration Active</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="bg-muted p-6 rounded-lg space-y-4 transition-all">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <LayoutGrid className="w-5 h-5 text-primary" />
          Tracked Events
        </h2>
        <div className="p-4 bg-card/60 rounded-lg">
          <p className="text-xs text-muted-foreground mb-3">When enabled, the following events are automatically tracked:</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { event: 'cta_click', desc: 'Button clicks' },
              { event: 'purchase', desc: 'Conversion tracked' },
              { event: 'view_item_list', desc: 'Services page viewed' },
            ].map(({ event, desc }) => (
              <div key={event} className="text-xs bg-muted/40 p-2 rounded">
                <code className="text-primary font-mono">{event}</code>
                <p className="text-muted-foreground mt-0.5">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
