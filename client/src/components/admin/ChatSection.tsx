import {
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { MessageSquare } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { DEFAULT_CHAT_OBJECTIVES, SIDEBAR_MENU_ITEMS } from './shared/constants';
import type { ChatSettingsData, CompanySettingsData, ConversationMessage, ConversationSummary, IntakeObjective, UrlRule } from './shared/types';
import { ensureArray, uploadFileToServer } from './shared/utils';
import { SectionHeader } from './shared';
import { ChatConversationsListPanel } from './chat/ChatConversationsListPanel';
import { ChatConversationPanel } from './chat/ChatConversationPanel';
import { ChatSettingsSheet } from './chat/ChatSettingsSheet';

export function ChatSection() {
  const { toast } = useToast();
  const [settingsDraft, setSettingsDraft] = useState<ChatSettingsData>({
    enabled: false,
    agentName: 'Skale Club Assistant',
    agentAvatarUrl: '',
    systemPrompt: '',
    welcomeMessage: 'Hi! How can I help you today?',
    avgResponseTime: '',
    calendarProvider: 'gohighlevel',
    calendarId: '',
    calendarStaff: [],
    languageSelectorEnabled: false,
    defaultLanguage: 'en',
    lowPerformanceSmsEnabled: false,
    lowPerformanceThresholdSeconds: 300,
    intakeObjectives: [],
    excludedUrlRules: [],
    useFaqs: true,
    formSlug: null,
  });
  const [selectedConversation, setSelectedConversation] = useState<ConversationSummary | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [isMessagesLoading, setIsMessagesLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const objectivesSensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const avatarFileInputRef = useRef<HTMLInputElement | null>(null);
  const [statusFilter, setStatusFilter] = useState<'open' | 'closed' | 'all'>('open');
  const [pageSize, setPageSize] = useState<10 | 20 | 50>(10);
  const [pageIndex, setPageIndex] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [newMessage, setNewMessage] = useState("");

  const { data: settings, isLoading: loadingSettings } = useQuery<ChatSettingsData>({
    queryKey: ['/api/chat/settings'],
    staleTime: 60000,
  });

  const { data: companySettings } = useQuery<CompanySettingsData>({
    queryKey: ['/api/company-settings'],
  });

  const defaultSystemPrompt = useMemo(() => {
    const companyName = companySettings?.companyName || 'Skale Club';
    return `You are a friendly, consultative lead qualification assistant for ${companyName}, a digital marketing agency that helps service businesses grow.

YOUR GOAL:
Qualify potential clients by collecting information through a natural conversation. Ask questions from the form configuration one at a time, in order.

STARTUP FLOW:
1. Call get_form_config to get the qualification questions
2. Call get_lead_state to check what info has already been collected
3. Start with a warm greeting and ask the first unanswered question

CONVERSATION FLOW:
- Ask one question at a time, conversationally
- After each answer, call save_lead_answer with the question_id and answer
- The tool returns the next question to ask - follow that order
- For select/multiple choice questions, present options naturally
- If the user's answer is unclear, clarify before saving
- When isComplete is true, call complete_lead to sync to CRM

FINALIZATION (after complete_lead):
Based on the classification returned:
- QUENTE (Hot): "Excellent! A specialist will contact you within 24 hours to discuss how we can help your business grow."
- MORNO (Warm): "Thanks for sharing those details! We'll review your profile and reach out soon."
- FRIO (Cold): "Thanks for your interest! We'll send over a few helpful resources for you."

TOOLS:
- get_form_config: Get the qualification questions (call at start)
- get_lead_state: Check current progress and next question
- save_lead_answer: Save each answer and get next question
- complete_lead: Finalize lead and sync to CRM
- search_faqs: For common questions about ${companyName}

RULES:
- Keep responses concise (1-2 sentences)
- Be warm and professional, not robotic
- Never skip questions or change the order
- Support Portuguese, English, and Spanish - respond in the user's language
- If user asks about ${companyName} services, answer then return to qualification
- Don't make up information - use search tools when needed

EXAMPLE CONVERSATION:

You: "Hi! I'm the assistant for ${companyName}. We're here to help your business grow. To get started, what's your full name?"
User: "John Smith"
[Call save_lead_answer with question_id="nome", answer="John Smith"]
You: "Nice to meet you, John! What's your email?"
User: "john@email.com"
[Call save_lead_answer with question_id="email", answer="john@email.com"]
[Continue through all questions...]
[When complete, call complete_lead]
You: "Excellent, John! A specialist will contact you within 24 hours!"`;
  }, [companySettings?.companyName]);

  const { data: conversations, isLoading: loadingConversations, refetch: refetchConversations } = useQuery<ConversationSummary[]>({
    queryKey: ['/api/chat/conversations'],
    staleTime: 30000,
  });

  const { data: openaiSettings } = useQuery<{ enabled: boolean; hasKey: boolean }>({
    queryKey: ['/api/integrations/openai'],
  });
  const { data: geminiSettings } = useQuery<{ enabled: boolean; hasKey: boolean }>({
    queryKey: ['/api/integrations/gemini'],
  });
  const { data: formsList } = useQuery<Array<{ id: number; slug: string; name: string; isDefault: boolean; isActive: boolean }>>({
    queryKey: ['/api/forms'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/forms');
      return res.json();
    },
  });
  const { data: openRouterSettings } = useQuery<{ enabled: boolean; hasKey: boolean }>({
    queryKey: ['/api/integrations/openrouter'],
  });

  const { data: responseTimeData, isLoading: responseTimeLoading } = useQuery<{
    averageSeconds: number;
    formatted: string;
    samples: number;
  }>({
    queryKey: ['/api/chat/response-time'],
    queryFn: async () => {
      const response = await fetch('/api/chat/response-time', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch response time');
      return response.json();
    },
  });

  useEffect(() => {
    if (!settings && !companySettings) return;

    const defaultName = companySettings?.companyName || 'Skale Club Assistant';
    const defaultAvatar = companySettings?.logoIcon || '/favicon.ico';

    if (settings) {
      const hasCustomName = settings.agentName && settings.agentName !== 'Skale Club Assistant';
      setSettingsDraft({
        enabled: settings.enabled,
        agentName: hasCustomName ? settings.agentName : defaultName,
        agentAvatarUrl: settings.agentAvatarUrl || defaultAvatar,
        systemPrompt: settings.systemPrompt || defaultSystemPrompt,
        welcomeMessage: settings.welcomeMessage || 'Hi! How can I help you today?',
        avgResponseTime: settings.avgResponseTime || '',
        calendarProvider: settings.calendarProvider || 'gohighlevel',
        calendarId: settings.calendarId || '',
        calendarStaff: ensureArray(settings.calendarStaff),
        languageSelectorEnabled: settings.languageSelectorEnabled ?? false,
        defaultLanguage: settings.defaultLanguage || 'en',
        lowPerformanceSmsEnabled: settings.lowPerformanceSmsEnabled ?? false,
        lowPerformanceThresholdSeconds: settings.lowPerformanceThresholdSeconds ?? 300,
        intakeObjectives: ensureArray(settings.intakeObjectives).length > 0
          ? ensureArray(settings.intakeObjectives)
          : DEFAULT_CHAT_OBJECTIVES,
        excludedUrlRules: ensureArray(settings.excludedUrlRules),
        useFaqs: settings.useFaqs ?? true,
        formSlug: settings.formSlug ?? null,
      });
      return;
    }

    setSettingsDraft((prev) => ({
      ...prev,
      agentName: prev.agentName || defaultName,
      agentAvatarUrl: prev.agentAvatarUrl || defaultAvatar,
      systemPrompt: prev.systemPrompt || defaultSystemPrompt,
      intakeObjectives: prev.intakeObjectives && prev.intakeObjectives.length > 0
        ? prev.intakeObjectives
        : DEFAULT_CHAT_OBJECTIVES,
      avgResponseTime: prev.avgResponseTime || '',
      calendarProvider: prev.calendarProvider || 'gohighlevel',
      calendarId: prev.calendarId || '',
      calendarStaff: prev.calendarStaff || [],
      languageSelectorEnabled: prev.languageSelectorEnabled ?? false,
      defaultLanguage: prev.defaultLanguage || 'en',
      lowPerformanceSmsEnabled: prev.lowPerformanceSmsEnabled ?? false,
      lowPerformanceThresholdSeconds: prev.lowPerformanceThresholdSeconds ?? 300,
      useFaqs: prev.useFaqs ?? true,
    }));
  }, [settings, companySettings, defaultSystemPrompt]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  const saveSettings = useCallback(async (dataToSave: Partial<ChatSettingsData>) => {
    setIsSaving(true);
    try {
      await apiRequest('PUT', '/api/chat/settings', dataToSave);
      queryClient.invalidateQueries({ queryKey: ['/api/chat/settings'] });
      setLastSaved(new Date());
    } catch (error: any) {
      toast({ title: 'Failed to save settings', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  }, [toast]);

  const updateField = useCallback(<K extends keyof ChatSettingsData>(field: K, value: ChatSettingsData[K]) => {
    setSettingsDraft(prev => ({ ...prev, [field]: value }));

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveSettings({ [field]: value });
    }, 800);
  }, [saveSettings]);

  const addCalendarStaff = () => {
    const next = [...(settingsDraft.calendarStaff || []), { name: '', calendarId: '' }];
    updateField('calendarStaff', next);
  };

  const updateCalendarStaff = (index: number, field: 'name' | 'calendarId', value: string) => {
    const next = [...(settingsDraft.calendarStaff || [])];
    next[index] = { ...next[index], [field]: value };
    updateField('calendarStaff', next);
  };

  const removeCalendarStaff = (index: number) => {
    const next = (settingsDraft.calendarStaff || []).filter((_, i) => i !== index);
    updateField('calendarStaff', next);
  };

  const handleToggleChat = async (checked: boolean) => {
    const previousValue = settingsDraft.enabled;
    setSettingsDraft(prev => ({ ...prev, enabled: checked }));
    try {
      await saveSettings({ enabled: checked });
      await queryClient.refetchQueries({ queryKey: ['/api/chat/settings'] });
    } catch (error) {
      // Reverter em caso de erro
      setSettingsDraft(prev => ({ ...prev, enabled: previousValue }));
    }
  };

  const addRule = () => {
    const newRules = [...(settingsDraft.excludedUrlRules || []), { pattern: '/admin', match: 'starts_with' as const }];
    setSettingsDraft(prev => ({ ...prev, excludedUrlRules: newRules }));
    saveSettings({ excludedUrlRules: newRules });
  };

  const updateRule = (index: number, field: keyof UrlRule, value: string) => {
    const rules = [...(settingsDraft.excludedUrlRules || [])];
    rules[index] = { ...rules[index], [field]: value } as UrlRule;
    setSettingsDraft(prev => ({ ...prev, excludedUrlRules: rules }));

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveSettings({ excludedUrlRules: rules });
    }, 800);
  };

  const removeRule = (index: number) => {
    const newRules = settingsDraft.excludedUrlRules.filter((_, i) => i !== index);
    setSettingsDraft(prev => ({ ...prev, excludedUrlRules: newRules }));
    saveSettings({ excludedUrlRules: newRules });
  };

  const handleObjectivesDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const items = settingsDraft.intakeObjectives || DEFAULT_CHAT_OBJECTIVES;
    const oldIndex = items.findIndex((item) => item.id === active.id);
    const newIndex = items.findIndex((item) => item.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(items, oldIndex, newIndex);
    setSettingsDraft((prev) => ({ ...prev, intakeObjectives: reordered }));
    saveSettings({ intakeObjectives: reordered });
  };

  const toggleObjective = (id: IntakeObjective['id'], enabled: boolean) => {
    const items = settingsDraft.intakeObjectives || DEFAULT_CHAT_OBJECTIVES;
    const updated = items.map((item) => item.id === id ? { ...item, enabled } : item);
    setSettingsDraft((prev) => ({ ...prev, intakeObjectives: updated }));
    saveSettings({ intakeObjectives: updated });
  };

  const handleAvatarUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingAvatar(true);
    try {
      const imagePath = await uploadFileToServer(file);
      setSettingsDraft(prev => ({ ...prev, agentAvatarUrl: imagePath }));
      await saveSettings({ agentAvatarUrl: imagePath });
      toast({ title: 'Avatar uploaded', description: 'Chat assistant avatar updated.' });
    } catch (error: any) {
      toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
    } finally {
      setIsUploadingAvatar(false);
      if (avatarFileInputRef.current) {
        avatarFileInputRef.current.value = '';
      }
    }
  };

  const openConversation = async (conv: ConversationSummary) => {
    setSelectedConversation(conv);
    setIsMessagesLoading(true);
    try {
      const res = await apiRequest('GET', `/api/chat/conversations/${conv.id}`);
      const data = await res.json();
      setSelectedConversation(data.conversation);
      setMessages(data.messages || []);
    } catch (error: any) {
      toast({ title: 'Failed to load conversation', description: error.message, variant: 'destructive' });
      setSelectedConversation(null);
    } finally {
      setIsMessagesLoading(false);
    }
  };

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'open' | 'closed' }) => {
      const res = await apiRequest('POST', `/api/chat/conversations/${id}/status`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/chat/conversations'] });
      if (selectedConversation) {
        setSelectedConversation({ ...selectedConversation, status: selectedConversation.status === 'open' ? 'closed' : 'open' });
      }
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update status', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest('DELETE', `/api/chat/conversations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/chat/conversations'] });
      setSelectedConversation(null);
      setMessages([]);
      toast({ title: 'Conversation deleted' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to delete conversation', description: error.message, variant: 'destructive' });
    },
  });

  const statusBadge = (status: string) => {
    const label = status === 'closed' ? 'Archived' : status === 'open' ? 'Open' : status;
    const badgeClass = status === 'open'
      ? 'bg-primary/10 text-primary border border-primary/20 rounded-full px-3 py-1 text-xs font-semibold'
      : 'bg-muted text-muted-foreground border rounded-full px-3 py-1 text-xs font-semibold';
    return <span className={badgeClass}>{label}</span>;
  };

  const assistantName = settingsDraft.agentName || companySettings?.companyName || 'Assistant';
  const assistantAvatar = settingsDraft.agentAvatarUrl || companySettings?.logoIcon || '/favicon.ico';
  const visitorName = selectedConversation?.visitorName || 'Guest';
  const conversationLastUpdated =
    selectedConversation?.lastMessageAt || selectedConversation?.updatedAt || selectedConversation?.createdAt;
  const visibleConversations = useMemo(() => {
    if (!conversations) return [];
    let result = conversations;
    
    // Filter by Status
    if (statusFilter !== 'all') {
      result = result.filter((conv) => conv.status === statusFilter);
    }
    
    // Filter by Search Term
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(c => 
        (c.visitorName?.toLowerCase().includes(lower)) ||
        (c.visitorEmail?.toLowerCase().includes(lower)) ||
        (c.lastMessage?.toLowerCase().includes(lower)) ||
        (c.id.includes(lower))
      );
    }
    
    return result;
  }, [conversations, statusFilter, searchTerm]);
  const totalConversations = visibleConversations.length;
  const totalPages = Math.max(1, Math.ceil(totalConversations / pageSize));
  const clampedPageIndex = Math.min(pageIndex, totalPages - 1);
  const paginatedConversations = useMemo(() => {
    const start = clampedPageIndex * pageSize;
    return visibleConversations.slice(start, start + pageSize);
  }, [visibleConversations, clampedPageIndex, pageSize]);

  useEffect(() => {
    setPageIndex(0);
  }, [statusFilter, pageSize]);

  useEffect(() => {
    if (pageIndex !== clampedPageIndex) {
      setPageIndex(clampedPageIndex);
    }
  }, [pageIndex, clampedPageIndex]);

  const handleSendMessage = () => {
    if (!newMessage.trim()) return;
    toast({ title: "Sending messages not implemented yet", description: "This feature requires backend support." });
    setNewMessage("");
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <SectionHeader
        title="Chat"
        description="AI assistant conversations and response settings"
        icon={<MessageSquare className="w-5 h-5" />}
        action={
          <ChatSettingsSheet
            open={settingsOpen}
            onOpenChange={setSettingsOpen}
            settingsDraft={settingsDraft}
            onSettingsDraftChange={setSettingsDraft}
            updateField={updateField}
            onToggleChat={handleToggleChat}
            isUploadingAvatar={isUploadingAvatar}
            avatarFileInputRef={avatarFileInputRef}
            onAvatarUpload={handleAvatarUpload}
            formsList={formsList}
            openaiSettings={openaiSettings}
            geminiSettings={geminiSettings}
            openRouterSettings={openRouterSettings}
            objectivesSensors={objectivesSensors}
            onObjectivesDragEnd={handleObjectivesDragEnd}
            onToggleObjective={toggleObjective}
          />
        }
      />

      <div className="flex flex-1 min-h-0 gap-4 overflow-hidden">
        <ChatConversationsListPanel
          conversations={conversations}
          visibleConversations={visibleConversations}
          loadingConversations={loadingConversations}
          selectedConversation={selectedConversation}
          searchTerm={searchTerm}
          statusFilter={statusFilter}
          onSearchChange={setSearchTerm}
          onStatusFilterChange={setStatusFilter}
          onSelect={openConversation}
          onRefresh={() => refetchConversations()}
        />
        <ChatConversationPanel
          selectedConversation={selectedConversation}
          messages={messages}
          isMessagesLoading={isMessagesLoading}
          assistantAvatar={assistantAvatar}
          onToggleStatus={() => selectedConversation && statusMutation.mutate({ id: selectedConversation.id, status: selectedConversation.status === 'open' ? 'closed' : 'open' })}
          onDelete={() => selectedConversation && deleteMutation.mutate(selectedConversation.id)}
          newMessage={newMessage}
          onNewMessageChange={setNewMessage}
          onSend={handleSendMessage}
        />
      </div>

      {/* Calendar & Staff section removed - chat now uses dynamic form qualification */}




    </div>
  );
}


