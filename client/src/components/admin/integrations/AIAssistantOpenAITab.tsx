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

export type AIAssistantOpenAITabProps = {
  onEnabledChange?: (enabled: boolean) => void;
};

export function AIAssistantOpenAITab({ onEnabledChange }: AIAssistantOpenAITabProps): JSX.Element {
  const { toast } = useToast();

  const [openAISettings, setOpenAISettings] = useState<OpenAISettings>({
    provider: 'openai', enabled: false, model: 'gpt-4o-mini', hasKey: false,
  });
  const [openAIApiKey, setOpenAIApiKey] = useState('');
  const [isTestingOpenAI, setIsTestingOpenAI] = useState(false);
  const [isSavingOpenAI, setIsSavingOpenAI] = useState(false);
  const [openAITestResult, setOpenAITestResult] = useState<'idle' | 'success' | 'error'>('idle');
  const [openAITestMessage, setOpenAITestMessage] = useState<string | null>(null);

  const { data: openaiSettingsData } = useQuery<OpenAISettings>({
    queryKey: ['/api/integrations/openai'],
  });

  useEffect(() => {
    if (openaiSettingsData) {
      setOpenAISettings(openaiSettingsData);
      onEnabledChange?.(openaiSettingsData.enabled);
      if (openaiSettingsData.hasKey) {
        setOpenAITestResult('success');
        setOpenAITestMessage(openaiSettingsData.enabled ? 'OpenAI is enabled.' : 'Key saved. Run test to verify connection.');
        setOpenAIApiKey((current) => current || MASKED_KEY);
      } else {
        setOpenAITestResult('idle');
        setOpenAITestMessage(null);
        setOpenAIApiKey('');
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openaiSettingsData]);

  const saveOpenAISettings = async (settingsToSave?: Partial<OpenAISettings> & { apiKey?: string }) => {
    setIsSavingOpenAI(true);
    try {
      await apiRequest('PUT', '/api/integrations/openai', {
        enabled: settingsToSave?.enabled ?? openAISettings.enabled,
        model: settingsToSave?.model || openAISettings.model,
        apiKey: (settingsToSave?.apiKey && settingsToSave.apiKey !== MASKED_KEY ? settingsToSave.apiKey : undefined) ||
                (openAIApiKey && openAIApiKey !== MASKED_KEY ? openAIApiKey : undefined),
      });
      queryClient.invalidateQueries({ queryKey: ['/api/integrations/openai'] });
      setOpenAIApiKey('');
      toast({ title: 'OpenAI settings saved' });
    } catch (error: any) {
      toast({ title: 'Failed to save OpenAI settings', description: error.message, variant: 'destructive' });
    } finally {
      setIsSavingOpenAI(false);
    }
  };

  const handleToggleOpenAI = async (checked: boolean) => {
    if (checked && !(openAITestResult === 'success' || openAISettings.hasKey)) {
      toast({ title: 'Please run Test Connection', description: 'You must have a successful test before enabling OpenAI.', variant: 'destructive' });
      return;
    }
    const next = { ...openAISettings, enabled: checked };
    setOpenAISettings(next);
    onEnabledChange?.(checked);
    if (checked) { setOpenAITestResult('success'); setOpenAITestMessage('OpenAI is enabled.'); }
    else { setOpenAITestResult('idle'); setOpenAITestMessage(null); }
    await saveOpenAISettings(next);
  };

  const testOpenAIConnection = async () => {
    setIsTestingOpenAI(true);
    setOpenAITestResult('idle');
    setOpenAITestMessage(null);
    try {
      const response = await fetch('/api/integrations/openai/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: openAIApiKey && openAIApiKey !== MASKED_KEY ? openAIApiKey : undefined, model: openAISettings.model }),
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
        setOpenAITestResult('success');
        setOpenAITestMessage('Connection successful. You can now enable OpenAI.');
        setOpenAISettings(prev => ({ ...prev, hasKey: true }));
        setOpenAIApiKey('');
        queryClient.invalidateQueries({ queryKey: ['/api/integrations/openai'] });
        toast({ title: 'OpenAI connected', description: 'API key saved. You can now enable the integration.' });
      } else {
        setOpenAITestResult('error');
        setOpenAITestMessage(result.message || 'Could not reach OpenAI.');
        toast({ title: 'OpenAI test failed', description: result.message || 'Could not reach OpenAI', variant: 'destructive' });
      }
    } catch (error: any) {
      toast({ title: 'OpenAI test failed', description: error.message, variant: 'destructive' });
      setOpenAITestResult('error');
      setOpenAITestMessage(error.message || 'Connection failed.');
    } finally {
      setIsTestingOpenAI(false);
    }
  };

  const openAITestButtonClass = openAITestResult === 'success' ? 'bg-green-100 text-green-700 border-green-300 hover:bg-green-200' : openAITestResult === 'error' ? 'bg-red-100 text-red-700 border-red-300 hover:bg-red-200' : '';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between p-4 bg-white dark:bg-card rounded-lg border">
        <div>
          <p className="font-medium text-sm">Enable OpenAI</p>
          <p className="text-xs text-muted-foreground">Use ChatGPT models for responses</p>
        </div>
        <Switch checked={openAISettings.enabled} onCheckedChange={handleToggleOpenAI} disabled={isSavingOpenAI} data-testid="switch-openai-enabled" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="openai-api-key">API Key</Label>
          <Input
            id="openai-api-key"
            type="password"
            value={openAIApiKey}
            onChange={(e) => setOpenAIApiKey(e.target.value)}
            onFocus={() => { if (openAIApiKey === MASKED_KEY) setOpenAIApiKey(''); }}
            onBlur={() => { if (!openAIApiKey && openAISettings.hasKey) setOpenAIApiKey(MASKED_KEY); }}
            placeholder="sk-..."
            data-testid="input-openai-api-key"
          />
          <p className="text-xs text-muted-foreground">Stored securely on the server. Not returned after saving.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="openai-model">Model</Label>
          <Select value={openAISettings.model} onValueChange={(val) => setOpenAISettings(prev => ({ ...prev, model: val }))}>
            <SelectTrigger id="openai-model"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="gpt-4o-mini">gpt-4o-mini</SelectItem>
              <SelectItem value="gpt-4o">gpt-4o</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button variant="outline" className={openAITestButtonClass} onClick={testOpenAIConnection} disabled={isTestingOpenAI || (!openAIApiKey && !openAISettings.hasKey)} data-testid="button-test-openai">
        {isTestingOpenAI && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        {openAITestResult === 'success' ? 'Test OK' : openAITestResult === 'error' ? 'Test Failed' : 'Test Connection'}
      </Button>
      {!openAISettings.hasKey && !openAISettings.enabled && (
        <div className="text-xs text-muted-foreground">Add a key and test the connection to enable OpenAI responses.</div>
      )}
    </div>
  );
}
