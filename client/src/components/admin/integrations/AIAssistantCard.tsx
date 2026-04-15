import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bot, Check, ChevronDown, LayoutGrid, Loader2 } from 'lucide-react';
import { SiGoogle, SiOpenai } from 'react-icons/si';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import type { ChatSettingsData, OpenAISettings } from '../shared/types';

type AIProviderTab = 'openai' | 'gemini' | 'openrouter';

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

const VALID_AI_PROVIDERS: AIProviderTab[] = ['openai', 'gemini', 'openrouter'];
const AI_PROVIDER_LABELS: Record<AIProviderTab, string> = {
  openai: 'OpenAI',
  gemini: 'Gemini',
  openrouter: 'OpenRouter',
};
const DEFAULT_OPENROUTER_MODEL = 'openai/gpt-4o-mini';
const MASKED_KEY = '********';

export function AIAssistantCard() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<AIProviderTab>('openai');

  // OpenAI state
  const [openAISettings, setOpenAISettings] = useState<OpenAISettings>({
    provider: 'openai', enabled: false, model: 'gpt-4o-mini', hasKey: false,
  });
  const [openAIApiKey, setOpenAIApiKey] = useState('');
  const [isTestingOpenAI, setIsTestingOpenAI] = useState(false);
  const [isSavingOpenAI, setIsSavingOpenAI] = useState(false);
  const [openAITestResult, setOpenAITestResult] = useState<'idle' | 'success' | 'error'>('idle');
  const [openAITestMessage, setOpenAITestMessage] = useState<string | null>(null);

  // Gemini state
  const [geminiSettings, setGeminiSettings] = useState<OpenAISettings>({
    provider: 'gemini', enabled: false, model: 'gemini-2.0-flash', hasKey: false,
  });
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [isTestingGemini, setIsTestingGemini] = useState(false);
  const [isSavingGemini, setIsSavingGemini] = useState(false);
  const [geminiTestResult, setGeminiTestResult] = useState<'idle' | 'success' | 'error'>('idle');
  const [geminiTestMessage, setGeminiTestMessage] = useState<string | null>(null);

  // OpenRouter state
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

  const { data: chatSettingsData } = useQuery<ChatSettingsData>({
    queryKey: ['/api/chat/settings'],
  });
  const { data: openaiSettingsData } = useQuery<OpenAISettings>({
    queryKey: ['/api/integrations/openai'],
  });
  const { data: geminiSettingsData } = useQuery<OpenAISettings>({
    queryKey: ['/api/integrations/gemini'],
  });
  const { data: openRouterSettingsData } = useQuery<OpenAISettings>({
    queryKey: ['/api/integrations/openrouter'],
  });
  const { data: openRouterModelsData, isLoading: loadingOpenRouterModels } = useQuery<OpenRouterModelsResponse>({
    queryKey: ['/api/integrations/openrouter/models'],
  });

  useEffect(() => {
    if (chatSettingsData?.activeAiProvider && VALID_AI_PROVIDERS.includes(chatSettingsData.activeAiProvider as AIProviderTab)) {
      setActiveTab(chatSettingsData.activeAiProvider as AIProviderTab);
    }
  }, [chatSettingsData]);

  const VALID_GEMINI_MODELS = ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-pro'];

  useEffect(() => {
    if (openaiSettingsData) {
      setOpenAISettings(openaiSettingsData);
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
  }, [openaiSettingsData]);

  useEffect(() => {
    if (geminiSettingsData) {
      const model = VALID_GEMINI_MODELS.includes(geminiSettingsData.model) ? geminiSettingsData.model : 'gemini-2.0-flash';
      setGeminiSettings({ ...geminiSettingsData, model });
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
  }, [geminiSettingsData]);

  useEffect(() => {
    if (openRouterSettingsData) {
      setOpenRouterSettings({ ...openRouterSettingsData, model: openRouterSettingsData.model || DEFAULT_OPENROUTER_MODEL });
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
  }, [openRouterSettingsData]);

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

  const switchActiveProvider = async (provider: AIProviderTab) => {
    setActiveTab(provider);
    try {
      await apiRequest('PUT', '/api/chat/settings', { activeAiProvider: provider });
      queryClient.invalidateQueries({ queryKey: ['/api/chat/settings'] });
    } catch (error: any) {
      toast({ title: 'Failed to switch active provider', description: error.message, variant: 'destructive' });
    }
  };

  const openAITestButtonClass = openAITestResult === 'success' ? 'bg-green-100 text-green-700 border-green-300 hover:bg-green-200' : openAITestResult === 'error' ? 'bg-red-100 text-red-700 border-red-300 hover:bg-red-200' : '';
  const geminiTestButtonClass = geminiTestResult === 'success' ? 'bg-green-100 text-green-700 border-green-300 hover:bg-green-200' : geminiTestResult === 'error' ? 'bg-red-100 text-red-700 border-red-300 hover:bg-red-200' : '';
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
    <Card className="rounded-2xl shadow-none">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Bot className="w-5 h-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">AI Assistant</CardTitle>
            <p className="text-sm text-muted-foreground">Configure your AI-powered chat assistant</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex gap-2">
          {(['openai', 'gemini', 'openrouter'] as AIProviderTab[]).map((provider) => {
            const isActive = activeTab === provider;
            const enabled =
              provider === 'openai' ? openAISettings.enabled
              : provider === 'gemini' ? geminiSettings.enabled
              : openRouterSettings.enabled;
            return (
              <button
                key={provider}
                type="button"
                onClick={() => switchActiveProvider(provider)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all flex-1 ${
                  isActive ? 'bg-white dark:bg-card border-border shadow-sm' : 'bg-transparent border-transparent hover:bg-white/50 dark:hover:bg-card/50'
                }`}
              >
                {provider === 'openai' && <SiOpenai className="w-4 h-4" />}
                {provider === 'gemini' && <SiGoogle className="w-4 h-4" />}
                {provider === 'openrouter' && <LayoutGrid className="w-4 h-4" />}
                <span>{AI_PROVIDER_LABELS[provider]}</span>
                <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  enabled ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                }`}>
                  {enabled ? 'ON' : 'OFF'}
                </span>
              </button>
            );
          })}
        </div>

        <p className="text-xs text-muted-foreground">
          Active in chat now: <span className="font-semibold text-foreground">{AI_PROVIDER_LABELS[activeTab]}</span>
        </p>

        {activeTab === 'openai' && (
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
        )}

        {activeTab === 'gemini' && (
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
        )}

        {activeTab === 'openrouter' && (
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
        )}
      </CardContent>
    </Card>
  );
}
