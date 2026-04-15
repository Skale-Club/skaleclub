import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bot, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';

const MASKED_KEY = '********';

export function GroqCard() {
  const { toast } = useToast();
  const [groqApiKey, setGroqApiKey] = useState('');
  const [groqEnabled, setGroqEnabled] = useState(false);
  const [groqHasKey, setGroqHasKey] = useState(false);
  const [isTestingGroq, setIsTestingGroq] = useState(false);
  const [isSavingGroq, setIsSavingGroq] = useState(false);
  const [groqTestResult, setGroqTestResult] = useState<'idle' | 'success' | 'error'>('idle');
  const [groqTestMessage, setGroqTestMessage] = useState<string | null>(null);

  const { data: groqSettingsData } = useQuery<{ provider: string; enabled: boolean; hasKey: boolean }>({
    queryKey: ['/api/integrations/groq'],
  });

  useEffect(() => {
    if (groqSettingsData) {
      setGroqEnabled(groqSettingsData.enabled);
      setGroqHasKey(groqSettingsData.hasKey);
      if (groqSettingsData.hasKey) {
        setGroqTestResult('success');
        setGroqTestMessage(groqSettingsData.enabled ? 'Groq is enabled.' : 'Key saved. Run test to verify connection.');
        setGroqApiKey((current) => current || MASKED_KEY);
      } else {
        setGroqTestResult('idle');
        setGroqTestMessage(null);
        setGroqApiKey('');
      }
    }
  }, [groqSettingsData]);

  const saveGroqSettings = async (enabled?: boolean) => {
    setIsSavingGroq(true);
    try {
      await apiRequest('PUT', '/api/integrations/groq', {
        enabled: enabled ?? groqEnabled,
        apiKey: groqApiKey && groqApiKey !== MASKED_KEY ? groqApiKey : undefined,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/integrations/groq'] });
      setGroqApiKey('');
      toast({ title: 'Groq settings saved' });
    } catch (error: any) {
      toast({ title: 'Failed to save Groq settings', description: error.message, variant: 'destructive' });
    } finally {
      setIsSavingGroq(false);
    }
  };

  const testGroqConnection = async () => {
    setIsTestingGroq(true);
    setGroqTestResult('idle');
    setGroqTestMessage(null);
    try {
      const response = await fetch('/api/integrations/groq/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: groqApiKey && groqApiKey !== MASKED_KEY ? groqApiKey : undefined }),
        credentials: 'include',
      });
      const result = await response.json();
      if (result.success) {
        setGroqTestResult('success');
        setGroqTestMessage('Connection successful. Groq is ready for audio transcription.');
        setGroqHasKey(true);
        setGroqApiKey('');
        queryClient.invalidateQueries({ queryKey: ['/api/integrations/groq'] });
        toast({ title: 'Groq connected', description: 'API key saved.' });
      } else {
        setGroqTestResult('error');
        setGroqTestMessage(result.message || 'Could not reach Groq.');
      }
    } catch (error: any) {
      setGroqTestResult('error');
      setGroqTestMessage(error.message || 'Connection failed.');
    } finally {
      setIsTestingGroq(false);
    }
  };

  return (
    <Card className="rounded-2xl shadow-none">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900/30">
              <Bot className="h-4 w-4 text-orange-600 dark:text-orange-400" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-sm sm:text-base leading-tight">Groq</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Voice note transcription for Xpot visits</p>
            </div>
          </div>
          <Switch
            checked={groqEnabled}
            disabled={!groqHasKey}
            onCheckedChange={(checked) => { setGroqEnabled(checked); saveGroqSettings(checked); }}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="groq-api-key" className="text-xs sm:text-sm">API Key</Label>
          <Input
            id="groq-api-key"
            type="password"
            value={groqApiKey}
            onChange={(e) => { setGroqApiKey(e.target.value); setGroqTestResult('idle'); setGroqTestMessage(null); }}
            placeholder={groqHasKey ? '••••••••' : 'gsk_...'}
            className="h-9 text-sm font-mono"
          />
        </div>
        {groqTestMessage && (
          <div className={`flex items-center gap-2 rounded-md border px-2.5 py-2 text-xs ${
            groqTestResult === 'success'
              ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400'
              : 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400'
          }`}>
            {groqTestResult === 'success' && <Check className="h-3.5 w-3.5" />}
            <span>{groqTestMessage}</span>
          </div>
        )}
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={testGroqConnection} disabled={isTestingGroq || (!groqApiKey || groqApiKey === MASKED_KEY)}>
            {isTestingGroq ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : null}
            Test Connection
          </Button>
          <Button size="sm" className="h-8 text-xs" onClick={() => saveGroqSettings()} disabled={isSavingGroq || (!groqApiKey || groqApiKey === MASKED_KEY)}>
            {isSavingGroq ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : null}
            Save
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
