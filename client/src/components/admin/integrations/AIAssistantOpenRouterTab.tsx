import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Loader2 } from '@/components/ui/loader';
import type { OpenAISettings } from '../shared/types';

const MASKED_KEY = '********';
const DEFAULT_OPENROUTER_MODEL = 'openai/gpt-4o-mini';

type OpenRouterModelsResponse = {
  models: {
    id: string;
    name?: string;
    description?: string;
    contextLength?: number;
    pricing?: { prompt?: string; completion?: string };
  }[];
  count?: number;
};

export type AIAssistantOpenRouterTabProps = {
  onEnabledChange?: (enabled: boolean) => void;
};

export function AIAssistantOpenRouterTab({ onEnabledChange }: AIAssistantOpenRouterTabProps): JSX.Element {
  const { toast } = useToast();

  const [openRouterSettings, setOpenRouterSettings] = useState<OpenAISettings>({
    provider: 'openrouter', enabled: false, model: DEFAULT_OPENROUTER_MODEL, hasKey: false,
  });
  const [openRouterApiKey, setOpenRouterApiKey] = useState('');
  const [isTestingOpenRouter, setIsTestingOpenRouter] = useState(false);
  const [isSavingOpenRouter, setIsSavingOpenRouter] = useState(false);
  const [openRouterTestResult, setOpenRouterTestResult] = useState<'idle' | 'success' | 'error'>('idle');
  const [openRouterTestMessage, setOpenRouterTestMessage] = useState<string | null>(null);
  const [openRouterModelPickerOpen, setOpenRouterModelPickerOpen] = useState(false);
  const [openRouterModelSearch, setOpenRouterModelSearch] = useState('');

  const { data: openRouterSettingsData } = useQuery<OpenAISettings>({
    queryKey: ['/api/integrations/openrouter'],
  });
  const { data: openRouterModelsData, isLoading: loadingOpenRouterModels } = useQuery<OpenRouterModelsResponse>({
    queryKey: ['/api/integrations/openrouter/models'],
  });

  useEffect(() => {
    if (openRouterSettingsData) {
      setOpenRouterSettings({ ...openRouterSettingsData, model: openRouterSettingsData.model || DEFAULT_OPENROUTER_MODEL });
      onEnabledChange?.(openRouterSettingsData.enabled);
      if (openRouterSettingsData.hasKey) {
        setOpenRouterTestResult('success');
        setOpenRouterTestMessage(openRouterSettingsData.enabled ? 'OpenRouter is enabled.' : 'Key saved. Run test to verify connection.');
        setOpenRouterApiKey((current) => current || MASKED_KEY);
      } else {
        setOpenRouterTestResult('idle');
        setOpenRouterTestMessage(null);
        setOpenRouterApiKey('');
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openRouterSettingsData]);

  const saveOpenRouterSettings = async (
    settingsToSave?: Partial<OpenAISettings> & { apiKey?: string },
    options?: { silent?: boolean }
  ) => {
    setIsSavingOpenRouter(true);
    try {
      await apiRequest('PUT', '/api/integrations/openrouter', {
        enabled: settingsToSave?.enabled ?? openRouterSettings.enabled,
        model: settingsToSave?.model || openRouterSettings.model || DEFAULT_OPENROUTER_MODEL,
        apiKey: (settingsToSave?.apiKey && settingsToSave.apiKey !== MASKED_KEY ? settingsToSave.apiKey : undefined) ||
                (openRouterApiKey && openRouterApiKey !== MASKED_KEY ? openRouterApiKey : undefined),
      });
      queryClient.invalidateQueries({ queryKey: ['/api/integrations/openrouter'] });
      setOpenRouterApiKey('');
      if (!options?.silent) toast({ title: 'OpenRouter settings saved' });
    } catch (error: any) {
      if (!options?.silent) {
        toast({ title: 'Failed to save OpenRouter settings', description: error.message, variant: 'destructive' });
      } else {
        setOpenRouterTestResult('error');
        setOpenRouterTestMessage(error.message || 'Failed to save selected model.');
      }
    } finally {
      setIsSavingOpenRouter(false);
    }
  };

  const handleToggleOpenRouter = async (checked: boolean) => {
    if (checked && !(openRouterTestResult === 'success' || openRouterSettings.hasKey)) {
      toast({ title: 'Please run Test Connection', description: 'You must have a successful test before enabling OpenRouter.', variant: 'destructive' });
      return;
    }
    const next = { ...openRouterSettings, enabled: checked };
    setOpenRouterSettings(next);
    onEnabledChange?.(checked);
    if (checked) { setOpenRouterTestResult('success'); setOpenRouterTestMessage('OpenRouter is enabled.'); }
    else { setOpenRouterTestResult('idle'); setOpenRouterTestMessage(null); }
    await saveOpenRouterSettings(next);
  };

  const testOpenRouterConnection = async () => {
    setIsTestingOpenRouter(true);
    setOpenRouterTestResult('idle');
    setOpenRouterTestMessage(null);
    try {
      const response = await fetch('/api/integrations/openrouter/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: openRouterApiKey && openRouterApiKey !== MASKED_KEY ? openRouterApiKey : undefined, model: openRouterSettings.model || DEFAULT_OPENROUTER_MODEL }),
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
        setOpenRouterTestResult('success');
        setOpenRouterTestMessage('Connection successful. You can now enable OpenRouter.');
        setOpenRouterSettings(prev => ({ ...prev, hasKey: true }));
        setOpenRouterApiKey('');
        queryClient.invalidateQueries({ queryKey: ['/api/integrations/openrouter'] });
        toast({ title: 'OpenRouter connected', description: 'API key saved. You can now enable the integration.' });
      } else {
        setOpenRouterTestResult('error');
        setOpenRouterTestMessage(result.message || 'Could not reach OpenRouter.');
        toast({ title: 'OpenRouter test failed', description: result.message || 'Could not reach OpenRouter', variant: 'destructive' });
      }
    } catch (error: any) {
      toast({ title: 'OpenRouter test failed', description: error.message, variant: 'destructive' });
      setOpenRouterTestResult('error');
      setOpenRouterTestMessage(error.message || 'Connection failed.');
    } finally {
      setIsTestingOpenRouter(false);
    }
  };

  const openRouterTestButtonClass = openRouterTestResult === 'success' ? 'bg-green-100 text-green-700 border-green-300 hover:bg-green-200' : openRouterTestResult === 'error' ? 'bg-red-100 text-red-700 border-red-300 hover:bg-red-200' : '';

  const openRouterModels = openRouterModelsData?.models || [];
  const selectedOpenRouterModel = openRouterModels.find(model => model.id === openRouterSettings.model);
  const filteredOpenRouterModels = useMemo(() => {
    const query = openRouterModelSearch.trim().toLowerCase();
    if (!query) return openRouterModels;
    const terms = query.split(/\s+/).filter(Boolean);
    const ranked = openRouterModels
      .map((model) => {
        const id = (model.id || '').toLowerCase();
        const name = (model.name || '').toLowerCase();
        const description = (model.description || '').toLowerCase();
        const haystack = `${id} ${name} ${description}`;
        const matchesAll = terms.every((term) => haystack.includes(term));
        if (!matchesAll) return null;
        let score = 0;
        if (id.startsWith(query)) score += 4;
        if (id.includes(query)) score += 3;
        if (name.startsWith(query)) score += 2;
        if (name.includes(query)) score += 1;
        return { model, score };
      })
      .filter((item): item is { model: OpenRouterModelsResponse['models'][number]; score: number } => Boolean(item))
      .sort((a, b) => b.score - a.score || a.model.id.localeCompare(b.model.id));
    return ranked.map((item) => item.model);
  }, [openRouterModels, openRouterModelSearch]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between p-4 bg-white dark:bg-card rounded-lg border">
        <div>
          <p className="font-medium text-sm">Enable OpenRouter</p>
          <p className="text-xs text-muted-foreground">Use OpenRouter models for responses</p>
        </div>
        <Switch checked={openRouterSettings.enabled} onCheckedChange={handleToggleOpenRouter} disabled={isSavingOpenRouter} data-testid="switch-openrouter-enabled" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="openrouter-api-key">API Key</Label>
          <Input
            id="openrouter-api-key"
            type="password"
            value={openRouterApiKey}
            onChange={(e) => setOpenRouterApiKey(e.target.value)}
            onFocus={() => { if (openRouterApiKey === MASKED_KEY) setOpenRouterApiKey(''); }}
            onBlur={() => { if (!openRouterApiKey && openRouterSettings.hasKey) setOpenRouterApiKey(MASKED_KEY); }}
            placeholder="sk-or-v1-..."
            data-testid="input-openrouter-api-key"
          />
          <p className="text-xs text-muted-foreground">Stored securely on the server. Not returned after saving.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="openrouter-model">Model</Label>
          <Popover open={openRouterModelPickerOpen} onOpenChange={(open) => { setOpenRouterModelPickerOpen(open); if (!open) setOpenRouterModelSearch(''); }}>
            <PopoverTrigger asChild>
              <button
                type="button"
                id="openrouter-model"
                role="combobox"
                aria-expanded={openRouterModelPickerOpen}
                className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background transition-colors focus:outline-none focus:ring-0 focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
                data-testid="select-openrouter-model"
              >
                <span className="truncate text-left">{selectedOpenRouterModel?.id || openRouterSettings.model || DEFAULT_OPENROUTER_MODEL}</span>
                <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
              <Command shouldFilter={false}>
                <CommandInput placeholder="Search models..." value={openRouterModelSearch} onValueChange={setOpenRouterModelSearch} />
                <CommandList className="max-h-72">
                  <CommandEmpty>{loadingOpenRouterModels ? 'Loading models...' : 'No models found for this search.'}</CommandEmpty>
                  {filteredOpenRouterModels.map((model) => (
                    <CommandItem
                      key={model.id}
                      value={`${model.id} ${model.name || ''}`}
                      onSelect={() => {
                        const nextModel = model.id;
                        setOpenRouterSettings(prev => ({ ...prev, model: nextModel }));
                        setOpenRouterModelPickerOpen(false);
                        setOpenRouterModelSearch('');
                        void saveOpenRouterSettings({ model: nextModel, enabled: openRouterSettings.enabled }, { silent: true });
                      }}
                      className="items-start py-2"
                    >
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm">{model.id}</span>
                        <span className="truncate text-xs text-muted-foreground">{model.name || 'OpenRouter model'}</span>
                      </div>
                      <Check className={`ml-2 mt-0.5 h-4 w-4 ${openRouterSettings.model === model.id ? 'opacity-100' : 'opacity-0'}`} />
                    </CommandItem>
                  ))}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          <p className="text-xs text-muted-foreground">
            Showing {filteredOpenRouterModels.length} of {openRouterModels.length} models from OpenRouter. Use search to find the best one.
          </p>
        </div>
      </div>
      <Button variant="outline" className={openRouterTestButtonClass} onClick={testOpenRouterConnection} disabled={isTestingOpenRouter || (!openRouterApiKey && !openRouterSettings.hasKey)} data-testid="button-test-openrouter">
        {isTestingOpenRouter && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        {openRouterTestResult === 'success' ? 'Test OK' : openRouterTestResult === 'error' ? 'Test Failed' : 'Test Connection'}
      </Button>
      {!openRouterSettings.hasKey && !openRouterSettings.enabled && (
        <div className="text-xs text-muted-foreground">Add a key and test the connection to enable OpenRouter responses.</div>
      )}
    </div>
  );
}
