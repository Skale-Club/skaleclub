import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, Loader2 } from 'lucide-react';
import { SiGoogle } from 'react-icons/si';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';

const MASKED_KEY = '********';

export function GooglePlacesCard() {
  const { toast } = useToast();
  const [googlePlacesSettings, setGooglePlacesSettings] = useState<{
    provider: string; apiKey: string; isEnabled: boolean; hasKey?: boolean;
  }>({ provider: 'google_places', apiKey: '', isEnabled: false, hasKey: false });
  const [googlePlacesApiKey, setGooglePlacesApiKey] = useState('');
  const [googlePlacesTesting, setGooglePlacesTesting] = useState(false);
  const [googlePlacesSaving, setGooglePlacesSaving] = useState(false);
  const [googlePlacesTestResult, setGooglePlacesTestResult] = useState<'idle' | 'success' | 'error'>('idle');

  const { data: googlePlacesSettingsData } = useQuery<any>({
    queryKey: ['/api/integrations/google-places'],
  });

  useEffect(() => {
    if (googlePlacesSettingsData) {
      setGooglePlacesSettings(googlePlacesSettingsData);
      if (googlePlacesSettingsData.hasKey || googlePlacesSettingsData.apiKey) {
        setGooglePlacesTestResult('success');
        setGooglePlacesSettings(prev => ({ ...prev, hasKey: true }));
        setGooglePlacesApiKey(MASKED_KEY);
      } else if (!googlePlacesSettingsData.apiKey && googlePlacesSettingsData.isEnabled) {
        setGooglePlacesTestResult('idle');
        setGooglePlacesApiKey('');
      }
    }
  }, [googlePlacesSettingsData]);

  const saveGooglePlacesSettings = async (settingsToSave?: { apiKey?: string; isEnabled?: boolean }) => {
    setGooglePlacesSaving(true);
    try {
      await apiRequest('PUT', '/api/integrations/google-places', {
        apiKey: settingsToSave?.apiKey !== undefined && settingsToSave.apiKey !== MASKED_KEY ? settingsToSave.apiKey : undefined,
        isEnabled: settingsToSave?.isEnabled ?? googlePlacesSettings.isEnabled,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/integrations/google-places'] });
      toast({ title: 'Google Places settings saved' });
    } catch (error: any) {
      toast({ title: 'Failed to save Google Places settings', description: error.message, variant: 'destructive' });
    } finally {
      setGooglePlacesSaving(false);
    }
  };

  const handleToggleGooglePlaces = async (checked: boolean) => {
    if (checked && googlePlacesTestResult !== 'success' && !googlePlacesSettings.hasKey) {
      toast({ title: 'Please run Test Connection', description: 'You must have a successful test before enabling Google Places.', variant: 'destructive' });
      return;
    }
    setGooglePlacesSettings(prev => ({ ...prev, isEnabled: checked }));
    if (checked) setGooglePlacesTestResult('success');
    await saveGooglePlacesSettings({ isEnabled: checked });
  };

  const testGooglePlacesConnection = async () => {
    setGooglePlacesTesting(true);
    setGooglePlacesTestResult('idle');
    try {
      const response = await fetch('/api/integrations/google-places/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: googlePlacesApiKey && googlePlacesApiKey !== MASKED_KEY ? googlePlacesApiKey : undefined }),
        credentials: 'include',
      });
      const result = await response.json();
      if (result.success) {
        setGooglePlacesTestResult('success');
        setGooglePlacesSettings(prev => ({ ...prev, hasKey: true }));
        setGooglePlacesApiKey('');
        queryClient.invalidateQueries({ queryKey: ['/api/integrations/google-places'] });
        toast({ title: 'Google Places connected', description: 'API key saved. You can now enable the integration.' });
      } else {
        setGooglePlacesTestResult('error');
        toast({ title: 'Connection failed', description: result.message || 'Could not connect to Google Places', variant: 'destructive' });
      }
    } catch (error: any) {
      setGooglePlacesTestResult('error');
      toast({ title: 'Connection failed', description: error.message, variant: 'destructive' });
    } finally {
      setGooglePlacesTesting(false);
    }
  };

  const googlePlacesTestButtonClass =
    googlePlacesTestResult === 'success' ? 'bg-green-100 text-green-700 border-green-300 hover:bg-green-200'
    : googlePlacesTestResult === 'error' ? 'bg-red-100 text-red-700 border-red-300 hover:bg-red-200'
    : '';

  return (
    <Card className="border-0 bg-muted">
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#4285F4]/10 flex items-center justify-center">
              <SiGoogle className="w-5 h-5 text-[#4285F4]" />
            </div>
            <div>
              <CardTitle className="text-lg">Google Places API</CardTitle>
              <p className="text-sm text-muted-foreground">Enable business search in Xpot app</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {googlePlacesSaving && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
            <Label htmlFor="google-places-enabled" className="text-sm">
              {googlePlacesSettings?.isEnabled ? 'Enabled' : 'Disabled'}
            </Label>
            <Switch
              id="google-places-enabled"
              checked={googlePlacesSettings?.isEnabled ?? false}
              onCheckedChange={handleToggleGooglePlaces}
              disabled={googlePlacesSaving}
              data-testid="switch-google-places-enabled"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="google-places-api-key">API Key</Label>
          <div className="flex gap-3">
            <Input
              id="google-places-api-key"
              type="password"
              value={googlePlacesApiKey}
              onChange={(e) => setGooglePlacesApiKey(e.target.value)}
              onFocus={() => { if (googlePlacesApiKey === MASKED_KEY) setGooglePlacesApiKey(''); }}
              onBlur={() => { if (!googlePlacesApiKey && googlePlacesSettings?.hasKey) setGooglePlacesApiKey(MASKED_KEY); }}
              placeholder="Enter your Google Places API key"
              className="flex-1"
              data-testid="input-google-places-api-key"
            />
            <Button
              variant="outline"
              className={googlePlacesTestButtonClass}
              onClick={testGooglePlacesConnection}
              disabled={googlePlacesTesting || (!googlePlacesApiKey && !googlePlacesSettings?.hasKey)}
              data-testid="button-test-google-places"
            >
              {googlePlacesTesting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {googlePlacesTestResult === 'success' ? 'Test OK' : googlePlacesTestResult === 'error' ? 'Test Failed' : 'Test Connection'}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Get your API key from Google Cloud Console {'>'} APIs {'>'} Places API
          </p>
        </div>
        {googlePlacesSettings?.isEnabled && (
          <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
            <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
              <Check className="w-4 h-4" />
              <span className="font-medium text-sm">Integration Active</span>
            </div>
            <p className="text-xs text-green-600 dark:text-green-500 mt-1">
              Xpot app can now search businesses using Google Places
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
