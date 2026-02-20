import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Archive, BadgeCheck, Check, Clock, FileText, Flame, Globe, Loader2, MessageSquare, Puzzle, Sparkles, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { apiRequest } from '@/lib/queryClient';
import { clsx } from 'clsx';
import { format } from 'date-fns';
import type { BlogPost, Faq, FormLead, LeadStatus } from '@shared/schema';
import { SIDEBAR_MENU_ITEMS } from './shared/constants';
import type { AdminSection, ChatSettingsData, CompanySettingsData, ConversationSummary, GHLSettings, TwilioSettings } from './shared/types';
export function DashboardSection({ onNavigate }: { onNavigate: (section: AdminSection) => void }) {
  const dashboardMenuTitle = SIDEBAR_MENU_ITEMS.find((item) => item.id === 'dashboard')?.title ?? 'Dashboard';
  const { data: companySettings } = useQuery<CompanySettingsData>({ queryKey: ['/api/company-settings'] });
  const { data: leads } = useQuery<FormLead[]>({
    queryKey: ['/api/form-leads'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/form-leads');
      return res.json();
    }
  });
  const { data: conversations } = useQuery<ConversationSummary[]>({
    queryKey: ['/api/chat/conversations'],
  });
  const { data: chatSettings } = useQuery<ChatSettingsData>({
    queryKey: ['/api/chat/settings'],
  });
  const { data: responseTimeData } = useQuery<{ averageSeconds: number; formatted: string; samples: number }>({
    queryKey: ['/api/chat/response-time'],
    queryFn: async () => {
      const response = await fetch('/api/chat/response-time', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch response time');
      return response.json();
    },
  });
  const { data: openaiSettings } = useQuery<{ enabled: boolean; hasKey: boolean }>({
    queryKey: ['/api/integrations/openai'],
  });
  const { data: ghlSettings } = useQuery<GHLSettings>({
    queryKey: ['/api/integrations/ghl'],
  });
  const { data: twilioSettings } = useQuery<TwilioSettings>({
    queryKey: ['/api/integrations/twilio'],
  });
  const { data: publishedPosts } = useQuery<BlogPost[]>({
    queryKey: ['/api/blog', 'published'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/blog?status=published');
      return res.json();
    }
  });
  const { data: faqs } = useQuery<Faq[]>({
    queryKey: ['/api/faqs'],
  });

  const leadsList = leads || [];
  const conversationsList = conversations || [];
  const publishedPostsList = publishedPosts || [];
  const faqList = faqs || [];

  const funnelStages: { label: string; value: LeadStatus }[] = [
    { label: 'New', value: 'novo' },
    { label: 'Contacted', value: 'contatado' },
    { label: 'Qualified', value: 'qualificado' },
    { label: 'Converted', value: 'convertido' },
    { label: 'Discarded', value: 'descartado' },
  ];

  const dashboardData = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const totalLeads = leadsList.length;
    const leadsToday = leadsList.filter((lead) => {
      if (!lead.createdAt) return false;
      const dt = new Date(lead.createdAt);
      return !Number.isNaN(dt.getTime()) && dt >= todayStart;
    }).length;
    const leadsLast7Days = leadsList.filter((lead) => {
      if (!lead.createdAt) return false;
      const dt = new Date(lead.createdAt);
      return !Number.isNaN(dt.getTime()) && dt >= sevenDaysAgo;
    }).length;

    const openChats = conversationsList.filter((conversation) => conversation.status === 'open').length;
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const funnel = {
      novo: 0,
      contatado: 0,
      qualificado: 0,
      convertido: 0,
      descartado: 0,
    };
    for (const lead of leadsList) {
      if (lead.status && lead.status in funnel) {
        funnel[lead.status] += 1;
      }
    }

    const leadSources = {
      form: leadsList.filter((lead) => lead.source !== 'chat').length,
      chat: leadsList.filter((lead) => lead.source === 'chat').length,
    };

    const qualification = {
      hot: leadsList.filter((lead) => lead.classificacao === 'QUENTE').length,
      complete: leadsList.filter((lead) => lead.formCompleto).length,
    };
    const completion = {
      inProgress: leadsList.filter((lead) => {
        if (lead.formCompleto) return false;
        if (!lead.updatedAt) return false;
        const updated = new Date(lead.updatedAt);
        return !Number.isNaN(updated.getTime()) && updated >= oneDayAgo;
      }).length,
      abandoned: leadsList.filter((lead) => {
        if (lead.formCompleto) return false;
        if (!lead.updatedAt) return true;
        const updated = new Date(lead.updatedAt);
        return Number.isNaN(updated.getTime()) || updated < oneDayAgo;
      }).length,
    };

    return {
      totalLeads,
      leadsToday,
      leadsLast7Days,
      openChats,
      funnel,
      leadSources,
      qualification,
      completion,
      completionRate: totalLeads ? (funnel.convertido / totalLeads) * 100 : 0,
      recentLeads: leadsList.slice(0, 6),
    };
  }, [conversationsList, leadsList]);

  const formatDateLabel = (value?: string | Date | null) => {
    if (!value) return 'No date';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'No date';
    return format(date, 'MMM d, yyyy');
  };

  const statusLabel = (status?: LeadStatus | null) => {
    switch (status) {
      case 'novo':
        return 'New';
      case 'contatado':
        return 'Contacted';
      case 'qualificado':
        return 'Qualified';
      case 'convertido':
        return 'Converted';
      case 'descartado':
        return 'Discarded';
      default:
        return 'Unknown';
    }
  };

  const profileChecks = [
    { label: 'Company name', done: !!companySettings?.companyName?.trim() },
    { label: 'Primary email', done: !!companySettings?.companyEmail?.trim() },
    { label: 'Phone', done: !!companySettings?.companyPhone?.trim() },
    { label: 'Address', done: !!companySettings?.companyAddress?.trim() },
    { label: 'Main logo', done: !!(companySettings?.logoMain || companySettings?.logoIcon) },
    { label: 'Hero content', done: !!(companySettings?.heroTitle || companySettings?.heroSubtitle) },
  ];
  const completedProfileChecks = profileChecks.filter((item) => item.done).length;
  const brandProfilePercent = profileChecks.length ? Math.round((completedProfileChecks / profileChecks.length) * 100) : 0;

  const integrationCards = [
    {
      label: 'Chat Widget',
      status: chatSettings?.enabled ? 'Enabled' : 'Disabled',
      active: !!chatSettings?.enabled,
    },
    {
      label: 'OpenAI',
      status: openaiSettings?.enabled ? 'Enabled' : (openaiSettings?.hasKey ? 'Configured' : 'Disabled'),
      active: !!openaiSettings?.enabled,
    },
    {
      label: 'GoHighLevel',
      status: ghlSettings?.isEnabled ? 'Enabled' : (ghlSettings?.locationId ? 'Configured' : 'Disconnected'),
      active: !!ghlSettings?.isEnabled,
    },
    {
      label: 'Twilio',
      status: twilioSettings?.enabled ? 'Enabled' : (twilioSettings?.accountSid ? 'Configured' : 'Disabled'),
      active: !!twilioSettings?.enabled,
    },
  ];

  const topCards = [
    {
      label: 'Total Leads',
      value: dashboardData.totalLeads,
      helper: `${dashboardData.qualification.hot} hot leads`,
      icon: Users,
      iconColor: 'text-blue-600'
    },
    {
      label: 'Leads (7 Days)',
      value: dashboardData.leadsLast7Days,
      helper: `${dashboardData.leadsToday} today`,
      icon: Sparkles,
      iconColor: 'text-violet-600'
    },
    {
      label: 'Hot Leads',
      value: dashboardData.qualification.hot,
      helper: 'High priority contacts',
      icon: Flame,
      iconColor: 'text-emerald-600'
    },
    {
      label: 'Open Chats',
      value: dashboardData.openChats,
      helper: `${conversationsList.length} total threads`,
      icon: MessageSquare,
      iconColor: 'text-amber-600'
    },
    {
      label: 'Complete Forms',
      value: dashboardData.qualification.complete,
      helper: `${dashboardData.qualification.hot} hot leads`,
      icon: BadgeCheck,
      iconColor: 'text-cyan-600'
    },
    {
      label: 'In Progress',
      value: dashboardData.completion.inProgress,
      helper: 'Last 24h activity',
      icon: Loader2,
      iconColor: 'text-green-600'
    },
    {
      label: 'Abandoned',
      value: dashboardData.completion.abandoned,
      helper: 'Needs follow-up',
      icon: Archive,
      iconColor: 'text-red-600'
    },
    {
      label: 'Chat Response',
      value: responseTimeData?.formatted || '--',
      helper: responseTimeData?.samples
        ? `${responseTimeData.samples} samples`
        : 'No responses yet',
      icon: Clock,
      iconColor: 'text-sky-600'
    },
  ];

  const funnelMax = Math.max(
    dashboardData.funnel.novo,
    dashboardData.funnel.contatado,
    dashboardData.funnel.qualificado,
    dashboardData.funnel.convertido,
    dashboardData.funnel.descartado,
    1
  );

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-card p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4 min-w-0">
            {companySettings?.logoIcon ? (
              <img
                src={companySettings.logoIcon}
                alt={companySettings.companyName || 'Logo'}
                className="h-14 w-14 rounded-xl border object-contain bg-muted/40 p-1.5"
              />
            ) : (
              <div className="h-14 w-14 rounded-xl border bg-muted/40 flex items-center justify-center text-lg font-semibold">
                {companySettings?.companyName?.[0] || 'A'}
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-2xl font-bold truncate">{dashboardMenuTitle}</h1>
              <p className="text-sm text-muted-foreground truncate">
                {companySettings?.companyName || 'Your business'} performance snapshot for leads, chat and growth
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" className="border-0 bg-muted/60" onClick={() => onNavigate('leads')}>
              <Users className="w-4 h-4 mr-2" />
              Leads
            </Button>
            <Button variant="outline" className="border-0 bg-muted/60" onClick={() => onNavigate('chat')}>
              <MessageSquare className="w-4 h-4 mr-2" />
              Chat
            </Button>
            <Button variant="outline" className="border-0 bg-muted/60" onClick={() => onNavigate('integrations')}>
              <Puzzle className="w-4 h-4 mr-2" />
              Integrations
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {topCards.map((card) => (
          <div key={card.label} className="rounded-2xl border bg-card p-5 transition-colors hover:bg-muted/30">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{card.label}</p>
                <p className="mt-1 text-3xl font-semibold leading-none">{card.value}</p>
                <p className="mt-2 text-sm text-muted-foreground">{card.helper}</p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-muted/60 flex items-center justify-center shrink-0">
                <card.icon className={clsx('w-5 h-5', card.iconColor)} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <div className="rounded-2xl border bg-card p-5">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h3 className="text-xl font-semibold">Lead Funnel</h3>
            <Badge variant="secondary" className="border-0 bg-muted">
              Completion {dashboardData.completionRate.toFixed(1)}%
            </Badge>
          </div>
          <div className="space-y-4">
            {funnelStages.map((stage) => {
              const count = dashboardData.funnel[stage.value];
              const width = (count / funnelMax) * 100;
              return (
                <div key={stage.value}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{stage.label}</span>
                    <span className="font-semibold">{count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-primary/80" style={{ width: `${width}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-muted/60 p-3">
              <p className="text-xs text-muted-foreground">Lead Sources</p>
              <p className="text-sm font-medium mt-1">Form: {dashboardData.leadSources.form}</p>
              <p className="text-sm font-medium">Chat: {dashboardData.leadSources.chat}</p>
            </div>
            <div className="rounded-xl bg-muted/60 p-3">
              <p className="text-xs text-muted-foreground">Qualification</p>
              <p className="text-sm font-medium mt-1">Hot: {dashboardData.qualification.hot}</p>
              <p className="text-sm font-medium">Complete: {dashboardData.qualification.complete}</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-xl font-semibold">Recent Leads</h3>
            <Button variant="ghost" className="h-auto p-0 hover:bg-transparent hover:underline" onClick={() => onNavigate('leads')}>
              View all
            </Button>
          </div>
          {dashboardData.recentLeads.length ? (
            <div className="space-y-3">
              {dashboardData.recentLeads.map((lead) => (
                <button
                  key={lead.id}
                  type="button"
                  onClick={() => onNavigate('leads')}
                  className="w-full rounded-xl border bg-muted/40 px-3 py-2.5 text-left transition-colors hover:bg-muted/70"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium truncate">{lead.nome || lead.email || `Lead #${lead.id}`}</p>
                    <Badge variant="secondary" className="border-0 bg-card/80">
                      {statusLabel(lead.status)}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {lead.classificacao || 'No classification'} . {formatDateLabel(lead.createdAt)}
                  </p>
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
              No leads yet.
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border bg-card p-5">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h3 className="text-xl font-semibold">Brand Profile</h3>
            <Badge variant="secondary" className="border-0 bg-muted">{brandProfilePercent}%</Badge>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-primary" style={{ width: `${brandProfilePercent}%` }} />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
            {profileChecks.map((item) => (
              <div key={item.label} className="flex items-center gap-2 text-muted-foreground">
                {item.done ? (
                  <Check className="w-4 h-4 text-green-600" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-slate-400" />
                )}
                <span>{item.label}</span>
              </div>
            ))}
          </div>
          <Button className="mt-5 w-full" onClick={() => onNavigate('company')}>
            Complete Company Profile
          </Button>
        </div>

        <div className="rounded-2xl border bg-card p-5">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h3 className="text-xl font-semibold">Integrations</h3>
            <Button variant="ghost" className="h-auto p-0 hover:bg-transparent hover:underline" onClick={() => onNavigate('integrations')}>
              Manage
            </Button>
          </div>
          <div className="space-y-2.5">
            {integrationCards.map((integration) => (
              <div key={integration.label} className="flex items-center justify-between rounded-xl border bg-muted/40 px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium">{integration.label}</p>
                  <p className="text-xs text-muted-foreground">{integration.status}</p>
                </div>
                <span className={clsx(
                  'w-2.5 h-2.5 rounded-full',
                  integration.active ? 'bg-green-500' : 'bg-slate-300 dark:bg-slate-600'
                )} />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-5">
          <h3 className="text-xl font-semibold mb-4">Quick Actions</h3>
          <div className="space-y-2.5">
            <Button variant="outline" className="w-full justify-start border-0 bg-muted/60" onClick={() => onNavigate('website' as any)}>
              <Globe className="w-4 h-4 mr-2" />
              Edit Website
            </Button>
            <Button variant="outline" className="w-full justify-start border-0 bg-muted/60" onClick={() => onNavigate('blog')}>
              <FileText className="w-4 h-4 mr-2" />
              Publish Content
            </Button>
            <Button variant="outline" className="w-full justify-start border-0 bg-muted/60" onClick={() => onNavigate('chat')}>
              <MessageSquare className="w-4 h-4 mr-2" />
              Review Conversations
            </Button>
            <Button variant="outline" className="w-full justify-start border-0 bg-muted/60" onClick={() => onNavigate('leads')}>
              <Sparkles className="w-4 h-4 mr-2" />
              Qualify Leads
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

