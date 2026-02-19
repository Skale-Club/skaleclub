import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bot, Check, LayoutGrid, Loader2 } from 'lucide-react';
import { SiFacebook, SiGoogle, SiGoogleanalytics, SiGoogletagmanager, SiOpenai } from 'react-icons/si';
import ghlLogo from '@assets/ghl-logo.webp';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { SIDEBAR_MENU_ITEMS } from './shared/constants';
import type { AnalyticsSettings, ChatSettingsData, GHLSettings, OpenAISettings } from './shared/types';
import { TwilioSection } from './TwilioSection';

type AIProviderTab = 'openai' | 'gemini';

export function IntegrationsSection() {
  const { toast } = useToast();
  const MASKED_OPENAI_KEY = '********';
  const [activeTab, setActiveTab] = useState<AIProviderTab>('openai');
  const [settings, setSettings] = useState<GHLSettings>({
    provider: 'gohighlevel',
    apiKey: '',
    locationId: '',
    calendarId: '2irhr47AR6K0AQkFqEQl',
    isEnabled: false
  });
  const [openAISettings, setOpenAISettings] = useState<OpenAISettings>({
    provider: 'openai',
    enabled: false,
    model: 'gpt-4o-mini',
    hasKey: false
  });
  const [openAIApiKey, setOpenAIApiKey] = useState('');
  const [isTestingOpenAI, setIsTestingOpenAI] = useState(false);
  const [isSavingOpenAI, setIsSavingOpenAI] = useState(false);
  const [openAITestResult, setOpenAITestResult] = useState<'idle' | 'success' | 'error'>('idle');
  const [openAITestMessage, setOpenAITestMessage] = useState<string | null>(null);

  // Gemini Integration State
  const [geminiSettings, setGeminiSettings] = useState<OpenAISettings>({
    provider: 'gemini',
    enabled: false,
    model: 'gemini-2.0-flash',
    hasKey: false
  });
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [isTestingGemini, setIsTestingGemini] = useState(false);
  const [isSavingGemini, setIsSavingGemini] = useState(false);
  const [geminiTestResult, setGeminiTestResult] = useState<'idle' | 'success' | 'error'>('idle');
  const [geminiTestMessage, setGeminiTestMessage] = useState<string | null>(null);

  const [analyticsSettings, setAnalyticsSettings] = useState<AnalyticsSettings>({
    gtmContainerId: '',
    ga4MeasurementId: '',
    facebookPixelId: '',
    gtmEnabled: false,
    ga4Enabled: false,
    facebookPixelEnabled: false
  });
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingAnalytics, setIsSavingAnalytics] = useState(false);
  const [lastSavedAnalytics, setLastSavedAnalytics] = useState<Date | null>(null);
  const saveAnalyticsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [ghlTestResult, setGhlTestResult] = useState<'idle' | 'success' | 'error'>('idle');
  const integrationsMenuTitle = SIDEBAR_MENU_ITEMS.find((item) => item.id === 'integrations')?.title ?? 'Integrations';

  const { data: ghlSettings, isLoading } = useQuery<GHLSettings>({
    queryKey: ['/api/integrations/ghl']
  });

  const { data: openaiSettingsData } = useQuery<OpenAISettings>({
    queryKey: ['/api/integrations/openai']
  });

  const { data: geminiSettingsData } = useQuery<OpenAISettings>({
    queryKey: ['/api/integrations/gemini']
  });

  const { data: companySettings } = useQuery<any>({
    queryKey: ['/api/company-settings']
  });

  const { data: chatSettingsData } = useQuery<ChatSettingsData>({
    queryKey: ['/api/chat/settings']
  });

  // Sync active tab with persisted activeAiProvider
  useEffect(() => {
    if (chatSettingsData?.activeAiProvider) {
      setActiveTab(chatSettingsData.activeAiProvider as AIProviderTab);
    }
  }, [chatSettingsData]);

  useEffect(() => {
    if (ghlSettings) {
      setSettings(ghlSettings);
    }
  }, [ghlSettings]);

  useEffect(() => {
    if (openaiSettingsData) {
      setOpenAISettings(openaiSettingsData);
      if (openaiSettingsData.hasKey) {
        setOpenAITestResult('success');
        setOpenAITestMessage(openaiSettingsData.enabled ? 'OpenAI is enabled.' : 'Key saved. Run test to verify connection.');
        setOpenAIApiKey((current) => current || MASKED_OPENAI_KEY);
      } else {
        setOpenAITestResult('idle');
        setOpenAITestMessage(null);
        setOpenAIApiKey('');
      }
    }
  }, [openaiSettingsData]);

  const VALID_GEMINI_MODELS = ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-pro'];

  useEffect(() => {
    if (geminiSettingsData) {
      const model = VALID_GEMINI_MODELS.includes(geminiSettingsData.model)
        ? geminiSettingsData.model
        : 'gemini-2.0-flash';
      setGeminiSettings({ ...geminiSettingsData, model });
      if (geminiSettingsData.hasKey) {
        setGeminiTestResult('success');
        setGeminiTestMessage(geminiSettingsData.enabled ? 'Gemini is enabled.' : 'Key saved. Run test to verify connection.');
        setGeminiApiKey((current) => current || MASKED_OPENAI_KEY);
      } else {
        setGeminiTestResult('idle');
        setGeminiTestMessage(null);
        setGeminiApiKey('');
      }
    }
  }, [geminiSettingsData]);

  useEffect(() => {
    if (companySettings) {
      setAnalyticsSettings({
        gtmContainerId: companySettings.gtmContainerId || '',
        ga4MeasurementId: companySettings.ga4MeasurementId || '',
        facebookPixelId: companySettings.facebookPixelId || '',
        gtmEnabled: companySettings.gtmEnabled || false,
        ga4Enabled: companySettings.ga4Enabled || false,
        facebookPixelEnabled: companySettings.facebookPixelEnabled || false
      });
    }
  }, [companySettings]);

  useEffect(() => {
    return () => {
      if (saveAnalyticsTimeoutRef.current) {
        clearTimeout(saveAnalyticsTimeoutRef.current);
      }
    };
  }, []);

  const saveAnalyticsSettings = useCallback(async (newSettings: Partial<AnalyticsSettings>) => {
    setIsSavingAnalytics(true);
    try {
      await apiRequest('PUT', '/api/company-settings', newSettings);
      queryClient.invalidateQueries({ queryKey: ['/api/company-settings'] });
      setLastSavedAnalytics(new Date());
    } catch (error: any) {
      toast({ 
        title: 'Error saving analytics settings', 
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsSavingAnalytics(false);
    }
  }, [toast]);

  const updateAnalyticsField = useCallback(<K extends keyof AnalyticsSettings>(field: K, value: AnalyticsSettings[K]) => {
    setAnalyticsSettings(prev => ({ ...prev, [field]: value }));
    
    if (saveAnalyticsTimeoutRef.current) {
      clearTimeout(saveAnalyticsTimeoutRef.current);
    }
    
    saveAnalyticsTimeoutRef.current = setTimeout(() => {
      saveAnalyticsSettings({ [field]: value });
    }, 800);
  }, [saveAnalyticsSettings]);

  const saveOpenAISettings = async (settingsToSave?: Partial<OpenAISettings> & { apiKey?: string }) => {
    setIsSavingOpenAI(true);
    try {
      await apiRequest('PUT', '/api/integrations/openai', {
        enabled: settingsToSave?.enabled ?? openAISettings.enabled,
        model: settingsToSave?.model || openAISettings.model,
        apiKey: (settingsToSave?.apiKey && settingsToSave.apiKey !== MASKED_OPENAI_KEY ? settingsToSave.apiKey : undefined) ||
               (openAIApiKey && openAIApiKey !== MASKED_OPENAI_KEY ? openAIApiKey : undefined)
      });
      queryClient.invalidateQueries({ queryKey: ['/api/integrations/openai'] });
      setOpenAIApiKey('');
      toast({ title: 'OpenAI settings saved' });
    } catch (error: any) {
      toast({
        title: 'Failed to save OpenAI settings',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsSavingOpenAI(false);
    }
  };

  const handleToggleOpenAI = async (checked: boolean) => {
    if (checked && !(openAITestResult === 'success' || openAISettings.hasKey)) {
      toast({
        title: 'Please run Test Connection',
        description: 'You must have a successful test before enabling OpenAI.',
        variant: 'destructive'
      });
      return;
    }
    const next = { ...openAISettings, enabled: checked };
    setOpenAISettings(next);
    if (checked) {
      setOpenAITestResult('success');
      setOpenAITestMessage('OpenAI is enabled.');
    } else {
      setOpenAITestResult('idle');
      setOpenAITestMessage(null);
    }
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
        body: JSON.stringify({
          apiKey: openAIApiKey && openAIApiKey !== MASKED_OPENAI_KEY ? openAIApiKey : undefined,
          model: openAISettings.model
        }),
        credentials: 'include'
      });
      const text = await response.text();
      const contentType = response.headers.get('content-type') || '';
      let result: any = {};
      if (contentType.includes('application/json')) {
        try {
          result = text ? JSON.parse(text) : {};
        } catch {
          result = { success: false, message: text || 'Unexpected response from server' };
        }
      } else {
        const snippet = (text || '').replace(/\s+/g, ' ').slice(0, 140);
        result = {
          success: false,
          message: `Unexpected response (status ${response.status}, content-type: ${contentType || 'unknown'}). The API route may not be running. Try restarting the server and testing again. Snippet: ${snippet}`
        };
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
        toast({
          title: 'OpenAI test failed',
          description: result.message || 'Could not reach OpenAI',
          variant: 'destructive'
        });
      }
    } catch (error: any) {
      toast({
        title: 'OpenAI test failed',
        description: error.message,
        variant: 'destructive'
      });
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
        apiKey: (settingsToSave?.apiKey && settingsToSave.apiKey !== MASKED_OPENAI_KEY ? settingsToSave.apiKey : undefined) ||
               (geminiApiKey && geminiApiKey !== MASKED_OPENAI_KEY ? geminiApiKey : undefined)
      });
      queryClient.invalidateQueries({ queryKey: ['/api/integrations/gemini'] });
      setGeminiApiKey('');
      toast({ title: 'Gemini settings saved' });
    } catch (error: any) {
      toast({
        title: 'Failed to save Gemini settings',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsSavingGemini(false);
    }
  };

  const handleToggleGemini = async (checked: boolean) => {
    if (checked && !(geminiTestResult === 'success' || geminiSettings.hasKey)) {
      toast({
        title: 'Please run Test Connection',
        description: 'You must have a successful test before enabling Gemini.',
        variant: 'destructive'
      });
      return;
    }
    const next = { ...geminiSettings, enabled: checked };
    setGeminiSettings(next);
    if (checked) {
      setGeminiTestResult('success');
      setGeminiTestMessage('Gemini is enabled.');
    } else {
      setGeminiTestResult('idle');
      setGeminiTestMessage(null);
    }
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
        body: JSON.stringify({
          apiKey: geminiApiKey && geminiApiKey !== MASKED_OPENAI_KEY ? geminiApiKey : undefined,
          model: geminiSettings.model
        }),
        credentials: 'include'
      });
      const text = await response.text();
      const contentType = response.headers.get('content-type') || '';
      let result: any = {};
      if (contentType.includes('application/json')) {
        try {
          result = text ? JSON.parse(text) : {};
        } catch {
          result = { success: false, message: text || 'Unexpected response from server' };
        }
      } else {
        const snippet = (text || '').replace(/\s+/g, ' ').slice(0, 140);
        result = {
          success: false,
          message: `Unexpected response (status ${response.status}, content-type: ${contentType || 'unknown'}). The API route may not be running. Try restarting the server and testing again. Snippet: ${snippet}`
        };
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
        toast({
          title: 'Gemini test failed',
          description: result.message || 'Could not reach Gemini',
          variant: 'destructive'
        });
      }
    } catch (error: any) {
      toast({
        title: 'Gemini test failed',
        description: error.message,
        variant: 'destructive'
      });
      setGeminiTestResult('error');
      setGeminiTestMessage(error.message || 'Connection failed.');
    } finally {
      setIsTestingGemini(false);
    }
  };

  const switchActiveProvider = async (provider: AIProviderTab) => {
    setActiveTab(provider);
    try {
      await apiRequest('PUT', '/api/chat/settings', { activeAiProvider: provider });
      queryClient.invalidateQueries({ queryKey: ['/api/chat/settings'] });
    } catch (error: any) {
      toast({
        title: 'Failed to switch active provider',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const ghlTestButtonClass =
    ghlTestResult === 'success'
      ? 'bg-green-100 text-green-700 border-green-300 hover:bg-green-200'
      : ghlTestResult === 'error'
      ? 'bg-red-100 text-red-700 border-red-300 hover:bg-red-200'
      : '';

  const openAITestButtonClass =
    openAITestResult === 'success'
      ? 'bg-green-100 text-green-700 border-green-300 hover:bg-green-200'
      : openAITestResult === 'error'
      ? 'bg-red-100 text-red-700 border-red-300 hover:bg-red-200'
      : '';

  const geminiTestButtonClass =
    geminiTestResult === 'success'
      ? 'bg-green-100 text-green-700 border-green-300 hover:bg-green-200'
      : geminiTestResult === 'error'
      ? 'bg-red-100 text-red-700 border-red-300 hover:bg-red-200'
      : '';

  const hasGtmId = analyticsSettings.gtmContainerId.trim().length > 0;
  const hasGa4Id = analyticsSettings.ga4MeasurementId.trim().length > 0;
  const hasFacebookPixelId = analyticsSettings.facebookPixelId.trim().length > 0;

  const saveSettings = async (settingsToSave?: GHLSettings) => {
    setIsSaving(true);
    try {
      await apiRequest('PUT', '/api/integrations/ghl', settingsToSave || settings);
      queryClient.invalidateQueries({ queryKey: ['/api/integrations/ghl'] });
      toast({ title: 'Settings saved successfully' });
    } catch (error: any) {
      toast({ 
        title: 'Failed to save settings', 
        description: error.message, 
        variant: 'destructive' 
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleEnabled = async (checked: boolean) => {
    if (checked && ghlTestResult !== 'success') {
      toast({
        title: 'Please run Test Connection',
        description: 'You must have a successful test before enabling GoHighLevel.',
        variant: 'destructive'
      });
      return;
    }
    const newSettings = { ...settings, isEnabled: checked };
    setSettings(newSettings);
    await saveSettings(newSettings);
  };

  const testConnection = async () => {
    setIsTesting(true);
    setGhlTestResult('idle');
    try {
      const response = await fetch('/api/integrations/ghl/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: settings.apiKey,
          locationId: settings.locationId
        }),
        credentials: 'include'
      });
      const result = await response.json();
      
      if (result.success) {
        setGhlTestResult('success');
        await saveSettings(settings);
        toast({ title: 'Connection successful', description: 'Settings saved. You can now enable the integration.' });
      } else {
        setGhlTestResult('error');
        toast({ 
          title: 'Connection failed', 
          description: result.message || 'Could not connect to GoHighLevel',
          variant: 'destructive'
        });
      }
    } catch (error: any) {
      setGhlTestResult('error');
      toast({ 
        title: 'Connection failed', 
        description: error.message, 
        variant: 'destructive' 
      });
    } finally {
      setIsTesting(false);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">{integrationsMenuTitle}</h1>
        <p className="text-muted-foreground">Connect your lead and chat workflows with external services</p>
      </div>

      <Card className="border-0 bg-muted">
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
          {/* Provider tabs */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => switchActiveProvider('openai')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all flex-1 ${
                activeTab === 'openai'
                  ? 'bg-white dark:bg-card border-border shadow-sm'
                  : 'bg-transparent border-transparent hover:bg-white/50 dark:hover:bg-card/50'
              }`}
            >
              <SiOpenai className="w-4 h-4" />
              <span>OpenAI</span>
              <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full ${
                openAISettings.enabled
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
              }`}>
                {openAISettings.enabled ? 'ON' : 'OFF'}
              </span>
            </button>
            <button
              type="button"
              onClick={() => switchActiveProvider('gemini')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all flex-1 ${
                activeTab === 'gemini'
                  ? 'bg-white dark:bg-card border-border shadow-sm'
                  : 'bg-transparent border-transparent hover:bg-white/50 dark:hover:bg-card/50'
              }`}
            >
              <SiGoogle className="w-4 h-4" />
              <span>Gemini</span>
              <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full ${
                geminiSettings.enabled
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
              }`}>
                {geminiSettings.enabled ? 'ON' : 'OFF'}
              </span>
            </button>
          </div>

          {/* Active in chat indicator */}
          <p className="text-xs text-muted-foreground">
            Active in chat now: <span className="font-semibold text-foreground">{activeTab === 'openai' ? 'OpenAI' : 'Gemini'}</span>
          </p>

          {/* OpenAI panel */}
          {activeTab === 'openai' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-white dark:bg-card rounded-lg border">
                <div>
                  <p className="font-medium text-sm">Enable OpenAI</p>
                  <p className="text-xs text-muted-foreground">Use ChatGPT models for responses</p>
                </div>
                <Switch
                  checked={openAISettings.enabled}
                  onCheckedChange={handleToggleOpenAI}
                  disabled={isSavingOpenAI}
                  data-testid="switch-openai-enabled"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="openai-api-key">API Key</Label>
                  <Input
                    id="openai-api-key"
                    type="password"
                    value={openAIApiKey}
                    onChange={(e) => setOpenAIApiKey(e.target.value)}
                    onFocus={() => {
                      if (openAIApiKey === MASKED_OPENAI_KEY) {
                        setOpenAIApiKey('');
                      }
                    }}
                    onBlur={() => {
                      if (!openAIApiKey && openAISettings.hasKey) {
                        setOpenAIApiKey(MASKED_OPENAI_KEY);
                      }
                    }}
                    placeholder="sk-..."
                    data-testid="input-openai-api-key"
                  />
                  <p className="text-xs text-muted-foreground">
                    Stored securely on the server. Not returned after saving.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="openai-model">Model</Label>
                  <Select
                    value={openAISettings.model}
                    onValueChange={(val) => setOpenAISettings(prev => ({ ...prev, model: val }))}
                  >
                    <SelectTrigger id="openai-model">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gpt-4o-mini">gpt-4o-mini</SelectItem>
                      <SelectItem value="gpt-4o">gpt-4o</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button
                variant="outline"
                className={openAITestButtonClass}
                onClick={testOpenAIConnection}
                disabled={isTestingOpenAI || (!openAIApiKey && !openAISettings.hasKey)}
                data-testid="button-test-openai"
              >
                {isTestingOpenAI && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {openAITestResult === 'success' ? 'Test OK' : openAITestResult === 'error' ? 'Test Failed' : 'Test Connection'}
              </Button>

              {!openAISettings.hasKey && !openAISettings.enabled && (
                <div className="text-xs text-muted-foreground">
                  Add a key and test the connection to enable OpenAI responses.
                </div>
              )}
            </div>
          )}

          {/* Gemini panel */}
          {activeTab === 'gemini' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-white dark:bg-card rounded-lg border">
                <div>
                  <p className="font-medium text-sm">Enable Gemini</p>
                  <p className="text-xs text-muted-foreground">Use Google Gemini models for responses</p>
                </div>
                <Switch
                  checked={geminiSettings.enabled}
                  onCheckedChange={handleToggleGemini}
                  disabled={isSavingGemini}
                  data-testid="switch-gemini-enabled"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="gemini-api-key">API Key</Label>
                  <Input
                    id="gemini-api-key"
                    type="password"
                    value={geminiApiKey}
                    onChange={(e) => setGeminiApiKey(e.target.value)}
                    onFocus={() => {
                      if (geminiApiKey === MASKED_OPENAI_KEY) {
                        setGeminiApiKey('');
                      }
                    }}
                    onBlur={() => {
                      if (!geminiApiKey && geminiSettings.hasKey) {
                        setGeminiApiKey(MASKED_OPENAI_KEY);
                      }
                    }}
                    placeholder="AI..."
                    data-testid="input-gemini-api-key"
                  />
                  <p className="text-xs text-muted-foreground">
                    Stored securely on the server. Not returned after saving.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gemini-model">Model</Label>
                  <Select
                    value={geminiSettings.model}
                    onValueChange={(val) => setGeminiSettings(prev => ({ ...prev, model: val }))}
                  >
                    <SelectTrigger id="gemini-model">
                      <SelectValue />
                    </SelectTrigger>
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

              <Button
                variant="outline"
                className={geminiTestButtonClass}
                onClick={testGeminiConnection}
                disabled={isTestingGemini || (!geminiApiKey && !geminiSettings.hasKey)}
                data-testid="button-test-gemini"
              >
                {isTestingGemini && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {geminiTestResult === 'success' ? 'Test OK' : geminiTestResult === 'error' ? 'Test Failed' : 'Test Connection'}
              </Button>

              {!geminiSettings.hasKey && !geminiSettings.enabled && (
                <div className="text-xs text-muted-foreground">
                  Add a key and test the connection to enable Gemini responses.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card className="border-0 bg-muted">
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-transparent flex items-center justify-center overflow-hidden">
                  <img src={ghlLogo} alt="GoHighLevel" className="w-9 h-9 rounded-md object-contain" />
                </div>
                <div>
                  <CardTitle className="text-lg">GoHighLevel</CardTitle>
                  <p className="text-sm text-muted-foreground">Sync calendars, contacts, and appointments</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isSaving && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                <Label htmlFor="ghl-enabled" className="text-sm">
                  {settings.isEnabled ? 'Enabled' : 'Disabled'}
                </Label>
                <Switch
                  id="ghl-enabled"
                  checked={settings.isEnabled}
                  onCheckedChange={handleToggleEnabled}
                  disabled={isSaving}
                  data-testid="switch-ghl-enabled"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ghl-api-key">API Key</Label>
                <Input
                  id="ghl-api-key"
                  type="password"
                  value={settings.apiKey}
                  onChange={(e) => setSettings(prev => ({ ...prev, apiKey: e.target.value }))}
                  placeholder="Enter your GoHighLevel API key"
                  data-testid="input-ghl-api-key"
                />
                <p className="text-xs text-muted-foreground">
                  Find this in your GHL account under Settings {'->'} Private Integrations
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ghl-location-id">Location ID</Label>
                <Input
                  id="ghl-location-id"
                  value={settings.locationId}
                  onChange={(e) => setSettings(prev => ({ ...prev, locationId: e.target.value }))}
                  placeholder="Enter your Location ID"
                  data-testid="input-ghl-location-id"
                />
                <p className="text-xs text-muted-foreground">
                  Your GHL sub-account/location identifier
                </p>
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="ghl-calendar-id">Calendar ID</Label>
                <Input
                  id="ghl-calendar-id"
                  value={settings.calendarId}
                  onChange={(e) => setSettings(prev => ({ ...prev, calendarId: e.target.value }))}
                  placeholder="Enter your Calendar ID"
                  data-testid="input-ghl-calendar-id"
                />
                <p className="text-xs text-muted-foreground">ID of the GHL calendar to sync appointments with</p>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-4 border-t">
              <Button
                variant="outline"
                className={ghlTestButtonClass}
                onClick={testConnection}
                disabled={isTesting || !settings.apiKey || !settings.locationId}
                data-testid="button-test-ghl"
              >
                {isTesting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {ghlTestResult === 'success' ? 'Test OK' : ghlTestResult === 'error' ? 'Test Failed' : 'Test Connection'}
              </Button>
            </div>

            {settings.isEnabled && (
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                  <Check className="w-4 h-4" />
                  <span className="font-medium text-sm">Integration Active</span>
                </div>
                <p className="text-xs text-green-600 dark:text-green-500 mt-1">
                  New captured leads can be synced to GoHighLevel automatically
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <TwilioSection />

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
                <Switch
                  checked={analyticsSettings.gtmEnabled}
                  onCheckedChange={(checked) => updateAnalyticsField('gtmEnabled', checked)}
                  className="shrink-0"
                  data-testid="switch-gtm-enabled"
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-2.5">
              <div className="space-y-2">
                <Label htmlFor="gtm-id" className="text-xs sm:text-sm">Container ID</Label>
                <Input
                  id="gtm-id"
                  value={analyticsSettings.gtmContainerId}
                  onChange={(e) => updateAnalyticsField('gtmContainerId', e.target.value)}
                  placeholder="GTM-XXXXXXX"
                  className="h-9 text-sm"
                  data-testid="input-gtm-id"
                />
              </div>
              <p className="text-xs text-muted-foreground leading-snug">
                Find this in GTM under Admin {'->'} Container Settings
              </p>
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
                <Switch
                  checked={analyticsSettings.ga4Enabled}
                  onCheckedChange={(checked) => updateAnalyticsField('ga4Enabled', checked)}
                  className="shrink-0"
                  data-testid="switch-ga4-enabled"
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-2.5">
              <div className="space-y-2">
                <Label htmlFor="ga4-id" className="text-xs sm:text-sm">Measurement ID</Label>
                <Input
                  id="ga4-id"
                  value={analyticsSettings.ga4MeasurementId}
                  onChange={(e) => updateAnalyticsField('ga4MeasurementId', e.target.value)}
                  placeholder="G-XXXXXXXXXX"
                  className="h-9 text-sm"
                  data-testid="input-ga4-id"
                />
              </div>
              <p className="text-xs text-muted-foreground leading-snug">
                Find this in GA4 Admin {'->'} Data Streams
              </p>
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
                <Switch
                  checked={analyticsSettings.facebookPixelEnabled}
                  onCheckedChange={(checked) => updateAnalyticsField('facebookPixelEnabled', checked)}
                  className="shrink-0"
                  data-testid="switch-fb-pixel-enabled"
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-2.5">
              <div className="space-y-2">
                <Label htmlFor="fb-pixel-id" className="text-xs sm:text-sm">Pixel ID</Label>
                <Input
                  id="fb-pixel-id"
                  value={analyticsSettings.facebookPixelId}
                  onChange={(e) => updateAnalyticsField('facebookPixelId', e.target.value)}
                  placeholder="123456789012345"
                  className="h-9 text-sm"
                  data-testid="input-fb-pixel-id"
                />
              </div>
              <p className="text-xs text-muted-foreground leading-snug">
                Find this in Meta Events Manager
              </p>
              {analyticsSettings.facebookPixelEnabled && hasFacebookPixelId && (
                <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-2.5 py-2 text-xs text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400">
                  <Check className="h-3.5 w-3.5" />
                  <span className="font-medium">Integration Active</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="bg-muted p-6 rounded-lg space-y-4 transition-all">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <LayoutGrid className="w-5 h-5 text-primary" />
          Tracked Events
        </h2>
        <div className="p-4 bg-card/60 rounded-lg">
          <p className="text-xs text-muted-foreground mb-3">
            When enabled, the following events are automatically tracked:
          </p>
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

