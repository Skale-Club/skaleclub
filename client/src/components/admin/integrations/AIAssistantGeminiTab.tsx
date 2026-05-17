import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Loader2 } from '@/components/ui/loader';
import type { OpenAISettings } from '../shared/types';

const MASKED_KEY = '********';
const VALID_GEMINI_MODELS = ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-pro'];

export type AIAssistantGeminiTabProps = {
  onEnabledChange?: (enabled: boolean) => void;
};

export function AIAssistantGeminiTab({ onEnabledChange }: AIAssistantGeminiTabProps): JSX.Element {
  const { toast } = useToast();

  const [geminiSettings, setGeminiSettings] = useState<OpenAISettings>({
    provider: 'gemini', enabled: false, model: 'gemini-2.0-flash', hasKey: false,
  });
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [isTestingGemini, setIsTestingGemini] = useState(false);
  const [isSavingGemini, setIsSavingGemini] = useState(false);
  const [geminiTestResult, setGeminiTestResult] = useState<'idle' | 'success' | 'error'>('idle');
  const [geminiTestMessage, setGeminiTestMessage] = useState<string | null>(null);

  const { data: geminiSettingsData } = useQuery<OpenAISettings>({
    queryKey: ['/api/integrations/gemini'],
  });

  useEffect(() => {
    if (geminiSettingsData) {
      const model = VALID_GEMINI_MODELS.includes(geminiSettingsData.model) ? geminiSettingsData.model : 'gemini-2.0-flash';
      setGeminiSettings({ ...geminiSettingsData, model });
      onEnabledChange?.(geminiSettingsData.enabled);
      if (geminiSettingsData.hasKey) {
        setGeminiTestResult('success');
        setGeminiTestMessage(geminiSettingsData.enabled ? 'Gemini is enabled.' : 'Key saved. Run test to verify connection.');
        setGeminiApiKey((current) => current || MASKED_KEY);
      } else {
        setGeminiTestResult('idle');
        setGeminiTestMessage(null);
        setGeminiApiKey('');
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geminiSettingsData]);

  const saveGeminiSettings = async (settingsToSave?: Partial<OpenAISettings> & { apiKey?: string }) => {
    setIsSavingGemini(true);
    try {
      await apiRequest('PUT', '/api/integrations/gemini', {
        enabled: settingsToSave?.enabled ?? geminiSettings.enabled,
        model: settingsToSave?.model || geminiSettings.model,
        apiKey: (settingsToSave?.apiKey && settingsToSave.apiKey !== MASKED_KEY ? settingsToSave.apiKey : undefined) ||
                (geminiApiKey && geminiApiKey !== MASKED_KEY ? geminiApiKey : undefined),
      });
      queryClient.invalidateQueries({ queryKey: ['/api/integrations/gemini'] });
      setGeminiApiKey('');
      toast({ title: 'Gemini settings saved' });
    } catch (error: any) {
      toast({ title: 'Failed to save Gemini settings', description: error.message, variant: 'destructive' });
    } finally {
      setIsSavingGemini(false);
    }
  };

  const handleToggleGemini = async (checked: boolean) => {
    if (checked && !(geminiTestResult === 'success' || geminiSettings.hasKey)) {
      toast({ title: 'Please run Test Connection', description: 'You must have a successful test before enabling Gemini.', variant: 'destructive' });
      return;
    }
    const next = { ...geminiSettings, enabled: checked };
    setGeminiSettings(next);
    onEnabledChange?.(checked);
    if (checked) { setGeminiTestResult('success'); setGeminiTestMessage('Gemini is enabled.'); }
    else { setGeminiTestResult('idle'); setGeminiTestMessage(null); }
    await saveGeminiSettings(next);
  };

  const testGeminiConnection = async () => {
    setIsTestingGemini(true);
    setGeminiTestResult('idle');
    setGeminiTestMessage(null);
    try {
      const response = await fetch('/api/integrations/gemini/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: geminiApiKey && geminiApiKey !== MASKED_KEY ? geminiApiKey : undefined, model: geminiSettings.model }),
        credentials: 'include',
      });
      const text = await response.text();
      const contentType = response.headers.get('content-type') || '';
      let result: any = {};
      if (contentType.includes('application/json')) {
        try { result = text ? JSON.parse(text) : {}; } catch { result = { success: false, message: text || 'Unexpected response from server' }; }
      } else {
        const snippet = (text || '').replace(/\s+/g, ' ').slice(0, 140);
        result = { success: false, message: `Unexpected response (status ${response.status}, content-type: ${contentType || 'unknown'}). The API route may not be running. Try restarting the server and testing again. Snippet: ${snippet}` };
      }
      if (result.success) {
        setGeminiTestResult('success');
        setGeminiTestMessage('Connection successful. You can now enable Gemini.');
        setGeminiSettings(prev => ({ ...prev, hasKey: true }));
        setGeminiApiKey('');
        queryClient.invalidateQueries({ queryKey: ['/api/integrations/gemini'] });
        toast({ title: 'Gemini connected', description: 'API key saved. You can now enable the integration.' });
      } else {
        setGeminiTestResult('error');
        setGeminiTestMessage(result.message || 'Could not reach Gemini.');
        toast({ title: 'Gemini test failed', description: result.message || 'Could not reach Gemini', variant: 'destructive' });
      }
    } catch (error: any) {
      toast({ title: 'Gemini test failed', description: error.message, variant: 'destructive' });
      setGeminiTestResult('error');
      setGeminiTestMessage(error.message || 'Connection failed.');
    } finally {
      setIsTestingGemini(false);
    }
  };

  const geminiTestButtonClass = geminiTestResult === 'success' ? 'bg-green-100 text-green-700 border-green-300 hover:bg-green-200' : geminiTestResult === 'error' ? 'bg-red-100 text-red-700 border-red-300 hover:bg-red-200' : '';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between p-4 bg-white dark:bg-card rounded-lg border">
        <div>
          <p className="font-medium text-sm">Enable Gemini</p>
          <p className="text-xs text-muted-foreground">Use Google Gemini models for responses</p>
        </div>
        <Switch checked={geminiSettings.enabled} onCheckedChange={handleToggleGemini} disabled={isSavingGemini} data-testid="switch-gemini-enabled" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="gemini-api-key">API Key</Label>
          <Input
            id="gemini-api-key"
            type="password"
            value={geminiApiKey}
            onChange={(e) => setGeminiApiKey(e.target.value)}
            onFocus={() => { if (geminiApiKey === MASKED_KEY) setGeminiApiKey(''); }}
            onBlur={() => { if (!geminiApiKey && geminiSettings.hasKey) setGeminiApiKey(MASKED_KEY); }}
            placeholder="AI..."
            data-testid="input-gemini-api-key"
          />
          <p className="text-xs text-muted-foreground">Stored securely on the server. Not returned after saving.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="gemini-model">Model</Label>
          <Select value={geminiSettings.model} onValueChange={(val) => setGeminiSettings(prev => ({ ...prev, model: val }))}>
            <SelectTrigger id="gemini-model"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="gemini-2.0-flash">gemini-2.0-flash</SelectItem>
              <SelectItem value="gemini-2.0-flash-lite">gemini-2.0-flash-lite</SelectItem>
              <SelectItem value="gemini-2.5-flash">gemini-2.5-flash</SelectItem>
              <SelectItem value="gemini-2.5-flash-lite">gemini-2.5-flash-lite</SelectItem>
              <SelectItem value="gemini-2.5-pro">gemini-2.5-pro</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button variant="outline" className={geminiTestButtonClass} onClick={testGeminiConnection} disabled={isTestingGemini || (!geminiApiKey && !geminiSettings.hasKey)} data-testid="button-test-gemini">
        {isTestingGemini && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        {geminiTestResult === 'success' ? 'Test OK' : geminiTestResult === 'error' ? 'Test Failed' : 'Test Connection'}
      </Button>
      {!geminiSettings.hasKey && !geminiSettings.enabled && (
        <div className="text-xs text-muted-foreground">Add a key and test the connection to enable Gemini responses.</div>
      )}
    </div>
  );
}
