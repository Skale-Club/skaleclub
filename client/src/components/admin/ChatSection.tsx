import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Archive, GripVertical, Loader2, MessageSquare, RotateCcw, Search, Send, Settings, Trash2, User } from 'lucide-react';
import { SiGoogle, SiOpenai } from 'react-icons/si';
import { Link } from 'wouter';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { renderMarkdown } from '@/lib/markdown';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { clsx } from 'clsx';
import { format } from 'date-fns';
import { DEFAULT_CHAT_OBJECTIVES, SIDEBAR_MENU_ITEMS } from './shared/constants';
import type { ChatSettingsData, CompanySettingsData, ConversationMessage, ConversationSummary, IntakeObjective, UrlRule } from './shared/types';
import { ensureArray, uploadFileToServer } from './shared/utils';
function ChatBubble({ message, assistantAvatar }: { message: ConversationMessage; assistantAvatar?: string }) {
  const isAssistant = message.role === "assistant";

  return (
    <div className={`flex w-full ${isAssistant ? "justify-start" : "justify-end"}`}>
      <div className={`flex max-w-[80%] gap-2 ${isAssistant ? "flex-row" : "flex-row-reverse"}`}>
        
        {/* Avatar Pequeno (Apenas para o assistente) */}
        {isAssistant && (
          <div className="h-8 w-8 rounded-full bg-slate-200 shrink-0 overflow-hidden mt-1 border border-slate-200 flex items-center justify-center">
            {assistantAvatar ? (
              <img src={assistantAvatar} alt="Assistant" className="h-full w-full object-cover" />
            ) : (
              <MessageSquare className="w-4 h-4 text-slate-500" />
            )}
          </div>
        )}

        {/* O Balão de Texto */}
        <div
          className={`p-3 text-sm shadow-sm relative ${
            isAssistant
              ? "bg-white text-slate-800 rounded-tr-xl rounded-br-xl rounded-bl-xl border border-slate-100" // Formato bolha esquerda
              : "bg-blue-600 text-white rounded-tl-xl rounded-bl-xl rounded-br-xl" // Formato bolha direita
          }`}
        >
          {/* Conteúdo da Mensagem */}
          <div className="leading-relaxed whitespace-pre-wrap">
            {renderMarkdown(message.content)}
          </div>
          
          {/* Hora da mensagem */}
          <span className={`text-[10px] block mt-1 ${
            isAssistant ? "text-slate-400" : "text-blue-100"
          }`}>
            {format(new Date(message.createdAt), 'HH:mm')}
          </span>
        </div>
      </div>
    </div>
  );
}

function SortableObjectiveItem({ objective, onToggle }: { objective: IntakeObjective; onToggle: (enabled: boolean) => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: objective.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-3 p-2 bg-card border rounded-md mb-2">
      <div {...attributes} {...listeners} className="cursor-grab text-muted-foreground hover:text-foreground">
        <GripVertical className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{objective.label}</p>
        <p className="text-xs text-muted-foreground truncate">{objective.description}</p>
      </div>
      <Switch 
        checked={objective.enabled}
        onCheckedChange={onToggle}
      />
    </div>
  );
}

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
  });
  const [selectedConversation, setSelectedConversation] = useState<ConversationSummary | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
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
    staleTime: 0,
    refetchOnWindowFocus: true,
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
- QUENTE (Hot): "Excelente! Um especialista entrará em contato em até 24 horas para discutir como podemos ajudar seu negócio a crescer!"
- MORNO (Warm): "Obrigado pelas informações! Vamos analisar seu perfil e entrar em contato em breve."
- FRIO (Cold): "Obrigado pelo interesse! Vamos enviar alguns conteúdos úteis para você."

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

You: "Olá! Sou o assistente da ${companyName}. Estamos aqui para ajudar seu negócio a crescer! Para começar, qual é o seu nome completo?"
User: "João Silva"
[Call save_lead_answer with question_id="nome", answer="João Silva"]
You: "Prazer, João! Qual é o seu email?"
User: "joao@email.com"
[Call save_lead_answer with question_id="email", answer="joao@email.com"]
[Continue through all questions...]
[When complete, call complete_lead]
You: "Excelente, João! Um especialista entrará em contato em até 24 horas!"`;
  }, [companySettings?.companyName]);

  const { data: conversations, isLoading: loadingConversations, refetch: refetchConversations } = useQuery<ConversationSummary[]>({
    queryKey: ['/api/chat/conversations'],
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: true,
  });

  const { data: openaiSettings } = useQuery<{ enabled: boolean; hasKey: boolean }>({
    queryKey: ['/api/integrations/openai'],
  });
  const { data: geminiSettings } = useQuery<{ enabled: boolean; hasKey: boolean }>({
    queryKey: ['/api/integrations/gemini'],
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
      ? 'bg-blue-500/10 text-blue-200 border border-blue-400/50 rounded-full px-3 py-1 text-xs font-semibold'
      : 'bg-slate-700/40 text-slate-300 border border-slate-500/50 rounded-full px-3 py-1 text-xs font-semibold';
    return <span className={badgeClass}>{label}</span>;
  };

  const assistantName = settingsDraft.agentName || companySettings?.companyName || 'Assistant';
  const assistantAvatar = settingsDraft.agentAvatarUrl || companySettings?.logoIcon || '/favicon.ico';
  const visitorName = selectedConversation?.visitorName || 'Guest';
  const conversationLastUpdated =
    selectedConversation?.lastMessageAt || selectedConversation?.updatedAt || selectedConversation?.createdAt;
  const openConversations = conversations?.filter((conv) => conv.status === 'open').length || 0;
  const closedConversations = conversations?.filter((conv) => conv.status === 'closed').length || 0;
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

  useEffect(() => {
    if (messages.length > 0 && !isMessagesLoading) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    }
  }, [messages, isMessagesLoading]);

  const handleSendMessage = () => {
    if (!newMessage.trim()) return;
    toast({ title: "Sending messages not implemented yet", description: "This feature requires backend support." });
    setNewMessage("");
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] gap-4">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold">Inbox</h1>
          <p className="text-muted-foreground">Manage your conversations.</p>
        </div>
        <div className="flex items-center gap-2">
           <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
             <SheetTrigger asChild>
               <Button variant="outline" size="sm" className="gap-2">
                 <Settings className="w-4 h-4" />
                 Settings
               </Button>
             </SheetTrigger>
             <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
               <SheetHeader>
                 <SheetTitle>Chat Settings</SheetTitle>
                 <SheetDescription>Configure your AI assistant and widget.</SheetDescription>
               </SheetHeader>
               
               <div className="mt-6 space-y-6 pb-10">
                  {/* General Settings */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">General</h3>
                    
                    <div className="flex items-center justify-between p-3 border rounded-lg bg-card">
                      <div className="space-y-0.5">
                        <Label className="text-base">Enable Chat Widget</Label>
                        <p className="text-xs text-muted-foreground">Show the chat bubble on your website</p>
                      </div>
                      <Switch 
                        checked={settingsDraft.enabled}
                        onCheckedChange={handleToggleChat}
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label>Agent Name</Label>
                      <Input 
                        value={settingsDraft.agentName || ''} 
                        onChange={(e) => updateField('agentName', e.target.value)}
                        placeholder="e.g. Sarah"
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label>Avatar</Label>
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-full overflow-hidden border bg-muted flex items-center justify-center relative group">
                           {settingsDraft.agentAvatarUrl ? (
                             <img src={settingsDraft.agentAvatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                           ) : (
                             <User className="h-6 w-6 text-muted-foreground" />
                           )}
                           {isUploadingAvatar && <div className="absolute inset-0 bg-black/50 flex items-center justify-center"><Loader2 className="w-4 h-4 animate-spin text-white" /></div>}
                        </div>
                        <div className="flex-1">
                           <Input 
                             ref={avatarFileInputRef}
                             type="file" 
                             accept="image/*" 
                             onChange={handleAvatarUpload}
                             className="text-xs"
                           />
                           <p className="text-[10px] text-muted-foreground mt-1">Recommended: 100x100px PNG or JPG</p>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-2">
                      <Label>Welcome Message</Label>
                      <Textarea 
                        value={settingsDraft.welcomeMessage || ''} 
                        onChange={(e) => updateField('welcomeMessage', e.target.value)}
                        placeholder="Hi! How can I help you?"
                        rows={2}
                      />
                    </div>
                  </div>

                  <div className="h-px bg-border" />

                  {/* AI Configuration */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">AI Configuration</h3>
                    
                    <div className="grid gap-2">
                      <Label>System Prompt</Label>
                      <Textarea
                        value={settingsDraft.systemPrompt || ''}
                        onChange={(e) => updateField('systemPrompt', e.target.value)}
                        placeholder="Define the behavior of your assistant..."
                        className="min-h-[150px] font-mono text-xs"
                      />
                      <p className="text-[10px] text-muted-foreground">
                        Instructions for the AI model on how to behave and qualify leads.
                      </p>
                    </div>

                    <div className="grid gap-2">
                      <Label>Active AI Provider</Label>
                      <Select
                        value={settingsDraft.activeAiProvider || 'openai'}
                        onValueChange={(val) => updateField('activeAiProvider', val)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select AI provider" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="openai">
                            <div className="flex items-center gap-2">
                              <SiOpenai className="w-4 h-4" />
                              <span>OpenAI (GPT)</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="gemini">
                            <div className="flex items-center gap-2">
                              <SiGoogle className="w-4 h-4" />
                              <span>Google Gemini</span>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-[10px] text-muted-foreground">
                        Select which AI will respond to chat messages. Make sure the selected provider is enabled in Integrations.
                      </p>
                    </div>

                    <div className="flex items-center justify-between p-3 border rounded-lg bg-card">
                      <div className="flex items-center gap-2">
                        <SiOpenai className={clsx("w-5 h-5", openaiSettings?.enabled ? "text-green-600" : "text-slate-400")} />
                        <div className="space-y-0.5">
                          <span className="text-sm font-medium">OpenAI Integration</span>
                          <p className="text-xs text-muted-foreground">{openaiSettings?.enabled ? 'Active and connected' : 'Not configured'}</p>
                        </div>
                      </div>
                      {!openaiSettings?.enabled && (
                         <Button variant="outline" size="sm" asChild>
                           <Link href="/admin/integrations">Configure</Link>
                         </Button>
                      )}
                    </div>

                    <div className="flex items-center justify-between p-3 border rounded-lg bg-card">
                      <div className="flex items-center gap-2">
                        <SiGoogle className={clsx("w-5 h-5", geminiSettings?.enabled ? "text-green-600" : "text-slate-400")} />
                        <div className="space-y-0.5">
                          <span className="text-sm font-medium">Gemini Integration</span>
                          <p className="text-xs text-muted-foreground">{geminiSettings?.enabled ? 'Active and connected' : 'Not configured'}</p>
                        </div>
                      </div>
                      {!geminiSettings?.enabled && (
                         <Button variant="outline" size="sm" asChild>
                           <Link href="/admin/integrations">Configure</Link>
                         </Button>
                      )}
                    </div>
                  </div>

                  <div className="h-px bg-border" />

                  {/* Lead Qualification */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                       <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Lead Qualification</h3>
                       <Button variant="ghost" size="sm" onClick={() => setSettingsDraft(prev => ({ ...prev, intakeObjectives: DEFAULT_CHAT_OBJECTIVES }))}>
                         Reset Defaults
                       </Button>
                    </div>
                    
                    <div className="space-y-2">
                      <DndContext 
                        sensors={objectivesSensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleObjectivesDragEnd}
                      >
                        <SortableContext 
                          items={(settingsDraft.intakeObjectives || DEFAULT_CHAT_OBJECTIVES).map(o => o.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          {(settingsDraft.intakeObjectives || DEFAULT_CHAT_OBJECTIVES).map((objective) => (
                            <SortableObjectiveItem 
                              key={objective.id} 
                              objective={objective} 
                              onToggle={(enabled) => toggleObjective(objective.id, enabled)}
                            />
                          ))}
                        </SortableContext>
                      </DndContext>
                    </div>
                  </div>
               </div>
             </SheetContent>
           </Sheet>
        </div>
      </div>

      <div className="flex flex-1 gap-4 overflow-hidden">
        {/* Left Sidebar - Conversation List */}
        <Card className="w-80 md:w-96 flex flex-col border-0 shadow-sm bg-muted/50 dark:bg-slate-900/50 shrink-0">
          <div className="p-3 border-b border-border/50 space-y-3">
             <div className="flex items-center gap-2">
                <div className="relative flex-1">
                   <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                   <Input 
                     placeholder="Search..." 
                     className="pl-9 h-9 bg-background" 
                     value={searchTerm}
                     onChange={(e) => setSearchTerm(e.target.value)}
                   />
                </div>
                <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => refetchConversations()}>
                   <RotateCcw className={clsx("w-4 h-4", loadingConversations && "animate-spin")} />
                </Button>
             </div>
             
             <div className="flex gap-1 bg-muted p-1 rounded-md">
                <button 
                  onClick={() => setStatusFilter('open')}
                  className={clsx("flex-1 text-xs font-medium py-1.5 rounded-sm transition-all", statusFilter === 'open' ? "bg-white dark:bg-slate-800 shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
                >
                  Open ({openConversations})
                </button>
                <button 
                  onClick={() => setStatusFilter('closed')}
                  className={clsx("flex-1 text-xs font-medium py-1.5 rounded-sm transition-all", statusFilter === 'closed' ? "bg-white dark:bg-slate-800 shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
                >
                  Archived ({closedConversations})
                </button>
             </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
             {loadingConversations ? (
                <div className="flex justify-center py-8">
                   <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
             ) : visibleConversations.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                   No conversations found.
                </div>
             ) : (
                visibleConversations.map(conv => (
                   <div 
                      key={conv.id}
                      onClick={() => openConversation(conv)}
                      className={clsx(
                        "p-3 rounded-lg cursor-pointer transition-colors border",
                        selectedConversation?.id === conv.id 
                          ? "bg-white dark:bg-slate-800 border-primary/20 shadow-sm ring-1 ring-primary/20" 
                          : "bg-transparent border-transparent hover:bg-white/50 dark:hover:bg-slate-800/50"
                      )}
                   >
                      <div className="flex justify-between items-start mb-1">
                         <span className={clsx("font-semibold text-sm", selectedConversation?.id === conv.id ? "text-primary" : "text-foreground")}>
                            {conv.visitorName || 'Guest'}
                         </span>
                         <span className="text-[10px] text-muted-foreground">
                            {conv.lastMessageAt ? format(new Date(conv.lastMessageAt), 'MMM d, HH:mm') : ''}
                         </span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                         {conv.lastMessage || 'No messages'}
                      </p>
                   </div>
                ))
             )}
          </div>
        </Card>

        {/* Right Area - Chat Interface */}
        <Card className="flex-1 flex flex-col border-0 shadow-sm overflow-hidden bg-background">
          {selectedConversation ? (
             <>
               {/* Chat Header */}
               <div className="h-16 border-b border-border/50 flex items-center justify-between px-6 bg-muted/30 shrink-0">
                  <div className="flex items-center gap-3">
                     <div className="h-9 w-9 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                        {(selectedConversation.visitorName?.[0] || 'G').toUpperCase()}
                     </div>
                     <div>
                        <h3 className="font-semibold text-sm">{selectedConversation.visitorName || 'Guest'}</h3>
                        <p className="text-xs text-muted-foreground">{selectedConversation.visitorEmail || selectedConversation.visitorPhone || 'No contact info'}</p>
                     </div>
                  </div>
                  <div className="flex items-center gap-1">
                     <Button 
                       variant="ghost" 
                       size="icon" 
                       onClick={() => statusMutation.mutate({ id: selectedConversation.id, status: selectedConversation.status === 'open' ? 'closed' : 'open' })}
                       title={selectedConversation.status === 'open' ? "Archive" : "Reopen"}
                     >
                        {selectedConversation.status === 'open' ? <Archive className="w-4 h-4" /> : <RotateCcw className="w-4 h-4" />}
                     </Button>
                     
                     <AlertDialog>
                       <AlertDialogTrigger asChild>
                         <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600 hover:bg-red-50">
                            <Trash2 className="w-4 h-4" />
                         </Button>
                       </AlertDialogTrigger>
                       <AlertDialogContent>
                         <AlertDialogHeader>
                           <AlertDialogTitle>Delete conversation?</AlertDialogTitle>
                           <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                         </AlertDialogHeader>
                         <AlertDialogFooter>
                           <AlertDialogCancel>Cancel</AlertDialogCancel>
                           <AlertDialogAction onClick={() => deleteMutation.mutate(selectedConversation.id)} className="bg-destructive">Delete</AlertDialogAction>
                         </AlertDialogFooter>
                       </AlertDialogContent>
                     </AlertDialog>
                  </div>
               </div>

               {/* Messages Area */}
               <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50 dark:bg-slate-950/50">
                  {isMessagesLoading ? (
                     <div className="flex justify-center py-10">
                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                     </div>
                  ) : messages.length === 0 ? (
                     <div className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-50">
                        <MessageSquare className="w-10 h-10 mb-2" />
                        <p>No messages yet</p>
                     </div>
                  ) : (
                     messages.map(msg => (
                        <ChatBubble 
                           key={msg.id} 
                           message={msg} 
                           assistantAvatar={assistantAvatar} 
                        />
                     ))
                  )}
                  <div ref={messagesEndRef} />
               </div>

               {/* Input Area */}
               <div className="p-4 bg-background border-t border-border/50 shrink-0">
                  <div className="relative">
                     <Textarea
                       value={newMessage}
                       onChange={(e) => setNewMessage(e.target.value)}
                       placeholder="Type your message..."
                       className="min-h-[60px] resize-none pr-12"
                       onKeyDown={(e) => {
                         if (e.key === 'Enter' && !e.shiftKey) {
                           e.preventDefault();
                           handleSendMessage();
                         }
                       }}
                     />
                     <Button 
                       size="icon" 
                       className="absolute right-2 bottom-2 h-8 w-8"
                       onClick={handleSendMessage}
                       disabled={!newMessage.trim()}
                     >
                       <Send className="w-4 h-4" />
                     </Button>
                  </div>
               </div>
             </>
          ) : (
             <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
               <MessageSquare className="h-12 w-12 mb-4 opacity-20" />
               <p>Select a conversation to start chatting</p>
             </div>
          )}
        </Card>
      </div>

      {/* Calendar & Staff section removed - chat now uses dynamic form qualification */}




    </div>
  );
}

function ObjectiveRow({ objective, onToggle }: { objective: IntakeObjective; onToggle: (id: IntakeObjective['id'], enabled: boolean) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: objective.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 rounded-lg border bg-white px-3 py-2 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:bg-slate-800 dark:border-slate-700"
    >
      <button
        type="button"
        className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-slate-200 hover:bg-slate-50 text-slate-500 dark:border-slate-600 dark:hover:bg-slate-700 dark:text-slate-400"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="flex-1">
        <p className="text-sm font-medium dark:text-slate-200">{objective.label}</p>
        <p className="text-xs text-muted-foreground">{objective.description}</p>
      </div>
      <Switch checked={objective.enabled} onCheckedChange={(checked) => onToggle(objective.id, checked)} />
    </div>
  );
}

