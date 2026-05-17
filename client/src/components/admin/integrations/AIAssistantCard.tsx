import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bot, LayoutGrid } from 'lucide-react';
import { SiGoogle, SiOpenai } from 'react-icons/si';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import type { ChatSettingsData } from '../shared/types';
import { AIAssistantOpenAITab } from './AIAssistantOpenAITab';
import { AIAssistantGeminiTab } from './AIAssistantGeminiTab';
import { AIAssistantOpenRouterTab } from './AIAssistantOpenRouterTab';

type AIProviderTab = 'openai' | 'gemini' | 'openrouter';

const VALID_AI_PROVIDERS: AIProviderTab[] = ['openai', 'gemini', 'openrouter'];
const AI_PROVIDER_LABELS: Record<AIProviderTab, string> = {
  openai: 'OpenAI',
  gemini: 'Gemini',
  openrouter: 'OpenRouter',
};

export function AIAssistantCard() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<AIProviderTab>('openai');
  const [openAIEnabled, setOpenAIEnabled] = useState(false);
  const [geminiEnabled, setGeminiEnabled] = useState(false);
  const [openRouterEnabled, setOpenRouterEnabled] = useState(false);

  const { data: chatSettingsData } = useQuery<ChatSettingsData>({
    queryKey: ['/api/chat/settings'],
  });

  useEffect(() => {
    if (chatSettingsData?.activeAiProvider && VALID_AI_PROVIDERS.includes(chatSettingsData.activeAiProvider as AIProviderTab)) {
      setActiveTab(chatSettingsData.activeAiProvider as AIProviderTab);
    }
  }, [chatSettingsData]);

  const switchActiveProvider = async (provider: AIProviderTab) => {
    setActiveTab(provider);
    try {
      await apiRequest('PUT', '/api/chat/settings', { activeAiProvider: provider });
      queryClient.invalidateQueries({ queryKey: ['/api/chat/settings'] });
    } catch (error: any) {
      toast({ title: 'Failed to switch active provider', description: error.message, variant: 'destructive' });
    }
  };

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
              provider === 'openai' ? openAIEnabled
              : provider === 'gemini' ? geminiEnabled
              : openRouterEnabled;
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

        <div hidden={activeTab !== 'openai'}>
          <AIAssistantOpenAITab onEnabledChange={setOpenAIEnabled} />
        </div>
        <div hidden={activeTab !== 'gemini'}>
          <AIAssistantGeminiTab onEnabledChange={setGeminiEnabled} />
        </div>
        <div hidden={activeTab !== 'openrouter'}>
          <AIAssistantOpenRouterTab onEnabledChange={setOpenRouterEnabled} />
        </div>
      </CardContent>
    </Card>
  );
}
