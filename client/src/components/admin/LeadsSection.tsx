import { useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Eye,
  RotateCcw,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { AdminCard, SectionHeader } from './shared';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { getLeadClassificationLabel, getLeadStatusLabel } from '@/lib/leadDisplay';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Loader2 } from '@/components/ui/loader';
import { clsx } from 'clsx';
import { format } from 'date-fns';
import { DEFAULT_FORM_CONFIG, getSortedQuestions } from '@shared/form';
import type { Form, FormConfig, FormLead, FormQuestion, LeadClassification, LeadStatus } from '@shared/schema';

export function LeadsSection() {
  const { toast } = useToast();
  const [selectedLead, setSelectedLead] = useState<FormLead | null>(null);
  const [leadPendingDelete, setLeadPendingDelete] = useState<FormLead | null>(null);
  const [isLeadDialogOpen, setIsLeadDialogOpen] = useState(false);
  const [filters, setFilters] = useState<{
    search: string;
    classification: LeadClassification | 'all';
    status: LeadStatus | 'all';
    completion: 'all' | 'completo' | 'em_progresso' | 'abandonado';
    formId: number | 'all';
  }>({
    search: '',
    classification: 'all',
    status: 'all',
    completion: 'all',
    formId: 'all',
  });

  const { data: formsList } = useQuery<Form[]>({
    queryKey: ['/api/forms'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/forms');
      return res.json();
    }
  });

  const activeForms = useMemo(() => (formsList || []).filter(f => f.isActive), [formsList]);
  const formsById = useMemo(() => {
    const map = new Map<number, Form>();
    for (const f of (formsList || [])) map.set(f.id, f);
    return map;
  }, [formsList]);
  const hasMultipleForms = activeForms.length > 1;

  const { data: leads, isLoading } = useQuery<FormLead[]>({
    queryKey: ['/api/form-leads', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.search) params.set('search', filters.search);
      if (filters.classification !== 'all') params.set('classificacao', filters.classification);
      if (filters.status !== 'all') params.set('status', filters.status);
      if (filters.completion !== 'all') params.set('completionStatus', filters.completion);
      if (filters.formId !== 'all') params.set('formId', String(filters.formId));
      const res = await apiRequest('GET', `/api/form-leads${params.toString() ? `?${params.toString()}` : ''}`);
      return res.json();
    }
  });

  const getConfigForLead = (lead: FormLead): FormConfig => {
    if (lead.formId != null) {
      const config = formsById.get(lead.formId)?.config as FormConfig | null | undefined;
      if (config) return config;
    }
    return DEFAULT_FORM_CONFIG;
  };

  const getQuestionsForLead = (lead: FormLead) => getSortedQuestions(getConfigForLead(lead));

  const selectedLeadQuestions = useMemo(
    () => (selectedLead ? getQuestionsForLead(selectedLead) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedLead, formsById]
  );

  const deleteLead = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('DELETE', `/api/form-leads/${id}`);
      return res.json();
    },
    onSuccess: (_, deletedLeadId) => {
      queryClient.invalidateQueries({ queryKey: ['/api/form-leads'] });
      if (selectedLead?.id === deletedLeadId) {
        setSelectedLead(null);
        setIsLeadDialogOpen(false);
      }
      setLeadPendingDelete(null);
      toast({ title: 'Lead deleted' });
    },
    onError: (error: any) => {
      setLeadPendingDelete(null);
      toast({
        title: 'Failed to delete lead',
        description: error?.message || 'Please try again',
        variant: 'destructive'
      });
    }
  });

  const updateLead = useMutation({
    mutationFn: async ({ id, status, observacoes }: { id: number; status?: LeadStatus; observacoes?: string }) => {
      const res = await apiRequest('PATCH', `/api/form-leads/${id}`, { status, observacoes });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/form-leads'] });
      toast({ title: 'Lead updated' });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to update lead',
        description: error?.message || 'Please try again',
        variant: 'destructive'
      });
    }
  });

  const openLeadDialog = (lead: FormLead) => {
    setSelectedLead(lead);
    setIsLeadDialogOpen(true);
  };

  const stats = useMemo(() => {
    const list = leads || [];
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const incomplete = list.filter(l => !l.formCompleto);
    return {
      total: list.length,
      hot: list.filter(l => l.classificacao === 'QUENTE').length,
      warm: list.filter(l => l.classificacao === 'MORNO').length,
      cold: list.filter(l => l.classificacao === 'FRIO').length,
      complete: list.filter(l => l.formCompleto).length,
      inProgress: incomplete.filter(l => l.updatedAt && new Date(l.updatedAt) >= oneDayAgo).length,
      abandoned: incomplete.filter(l => !l.updatedAt || new Date(l.updatedAt) < oneDayAgo).length,
    };
  }, [leads]);

  const statusOptions: { value: LeadStatus | 'all'; label: string }[] = [
    { value: 'all', label: 'All status' },
    { value: 'novo', label: 'New' },
    { value: 'contatado', label: 'Contacted' },
    { value: 'qualificado', label: 'Qualified' },
    { value: 'convertido', label: 'Converted' },
    { value: 'descartado', label: 'Discarded' },
  ];

  const classificationOptions: { value: LeadClassification | 'all'; label: string }[] = [
    { value: 'all', label: 'All ratings' },
    { value: 'QUENTE', label: 'Hot' },
    { value: 'MORNO', label: 'Warm' },
    { value: 'FRIO', label: 'Cold' },
    { value: 'DESQUALIFICADO', label: 'Disqualified' },
  ];

  const completionOptions: { value: 'all' | 'completo' | 'em_progresso' | 'abandonado'; label: string }[] = [
    { value: 'all', label: 'All forms' },
    { value: 'completo', label: 'Complete' },
    { value: 'em_progresso', label: 'In Progress' },
    { value: 'abandonado', label: 'Abandoned' },
  ];

  const formatDate = (value?: string | null) => {
    if (!value) return '?';
    return format(new Date(value), 'MMM d, yyyy');
  };

  const classificationBadgeClass = (classificacao?: LeadClassification | null) => {
    switch (classificacao) {
      case 'QUENTE':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'MORNO':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'FRIO':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'DESQUALIFICADO':
        return 'bg-muted text-muted-foreground border';
      default:
        return 'bg-muted text-muted-foreground border';
    }
  };

  const questionLabel = (lead: FormLead) => {
    if (lead.formCompleto) return 'Form complete';
    const step = lead.ultimaPerguntaRespondida || 1;
    const total = getQuestionsForLead(lead).length || DEFAULT_FORM_CONFIG.questions.length;
    return `Question ${step} of ${total}`;
  };

  const getCompletionStatus = (lead: FormLead): 'completo' | 'em_progresso' | 'abandonado' => {
    if (lead.formCompleto) return 'completo';
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const updatedAt = lead.updatedAt ? new Date(lead.updatedAt) : null;
    if (updatedAt && updatedAt >= oneDayAgo) return 'em_progresso';
    return 'abandonado';
  };

  const completionStatusLabel = (status: 'completo' | 'em_progresso' | 'abandonado') => {
    switch (status) {
      case 'completo': return 'Complete';
      case 'em_progresso': return 'In Progress';
      case 'abandonado': return 'Abandoned';
    }
  };

  const completionStatusClass = (status: 'completo' | 'em_progresso' | 'abandonado') => {
    switch (status) {
      case 'completo': return 'text-green-600';
      case 'em_progresso': return 'text-amber-600';
      case 'abandonado': return 'text-red-600';
    }
  };

  const ghlBadgeClass = (status?: string | null) => {
    if (status === 'synced') return 'bg-green-50 text-green-700 border-green-200';
    if (status === 'failed') return 'bg-red-50 text-red-700 border-red-200';
    return 'bg-amber-50 text-amber-700 border-amber-200';
  };

  const getLeadFieldValue = (lead: FormLead, fieldId: string) => {
    const direct = (lead as any)?.[fieldId];
    if (direct !== undefined && direct !== null && String(direct).trim() !== '') {
      return String(direct);
    }
    return lead.customAnswers?.[fieldId] || '';
  };

  const getAnswerForQuestion = (lead: FormLead, question: FormQuestion) => {
    const raw = getLeadFieldValue(lead, question.id);
    if (!raw) return '';
    if (question.type === 'select' && question.options) {
      const match = question.options.find(o => o.value === raw || o.label === raw);
      return match?.label || raw;
    }
    return raw;
  };

  const getConditionalAnswer = (lead: FormLead, question: FormQuestion) => {
    if (!question.conditionalField) return '';
    const trigger = getLeadFieldValue(lead, question.id);
    if (trigger !== question.conditionalField.showWhen) return '';
    return getLeadFieldValue(lead, question.conditionalField.id);
  };

  const extraCustomAnswers = useMemo(() => {
    if (!selectedLead) return [];
    const knownIds = new Set(selectedLeadQuestions.map(q => q.id));
    return Object.entries(selectedLead.customAnswers || {}).filter(([id]) => !knownIds.has(id));
  }, [selectedLeadQuestions, selectedLead]);

  const DetailItem = ({ label, value }: { label: string; value: ReactNode }) => (
    <div className="p-3 rounded-lg border bg-muted/40">
      <p className="text-xs uppercase text-muted-foreground">{label}</p>
      <div className="text-sm font-medium text-foreground break-words">{value || '?'}</div>
    </div>
  );

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Leads"
        description="All captured leads with ratings and follow-up status"
        icon={<Sparkles className="w-5 h-5" />}
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/form-leads'] })}>
              <RotateCcw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <AdminCard padding="compact" className="shadow-sm">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-2xl font-bold">{stats.total}</p>
        </AdminCard>
        <AdminCard padding="compact" className="shadow-sm">
          <p className="text-xs text-muted-foreground">Hot</p>
          <p className="text-2xl font-bold text-green-600">{stats.hot}</p>
        </AdminCard>
        <AdminCard padding="compact" className="shadow-sm">
          <p className="text-xs text-muted-foreground">Warm</p>
          <p className="text-2xl font-bold text-amber-600">{stats.warm}</p>
        </AdminCard>
        <AdminCard padding="compact" className="shadow-sm">
          <p className="text-xs text-muted-foreground">Cold</p>
          <p className="text-2xl font-bold text-blue-600">{stats.cold}</p>
        </AdminCard>
        <AdminCard padding="compact" className="shadow-sm">
          <p className="text-xs text-muted-foreground">In Progress</p>
          <p className="text-2xl font-bold text-amber-500">{stats.inProgress}</p>
        </AdminCard>
      </div>

      <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
          <div className="grid grid-cols-2 sm:flex sm:flex-row gap-3 w-full lg:w-auto">
            <Input
              placeholder="Search by name, email or phone"
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              className="col-span-2 sm:w-64"
            />
            {hasMultipleForms && (
              <Select
                value={filters.formId === 'all' ? 'all' : String(filters.formId)}
                onValueChange={(value) => setFilters(prev => ({ ...prev, formId: value === 'all' ? 'all' : Number(value) }))}
              >
                <SelectTrigger className="w-full sm:w-[220px] h-9 rounded-md bg-background px-3 py-2 text-base md:text-sm font-normal focus:outline-none focus:ring-0 focus:ring-offset-0">
                  <SelectValue placeholder="Form" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All forms</SelectItem>
                  {activeForms.map(form => (
                    <SelectItem key={form.id} value={String(form.id)}>{form.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select
              value={filters.classification}
              onValueChange={(value) => setFilters(prev => ({ ...prev, classification: value as LeadClassification | 'all' }))}
            >
            <SelectTrigger className="w-full sm:w-[220px] h-9 rounded-md bg-background px-3 py-2 text-base md:text-sm font-normal focus:outline-none focus:ring-0 focus:ring-offset-0">
                <SelectValue placeholder="Rating" />
              </SelectTrigger>
              <SelectContent>
                {classificationOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filters.status}
              onValueChange={(value) => setFilters(prev => ({ ...prev, status: value as LeadStatus | 'all' }))}
            >
            <SelectTrigger className="w-full sm:w-40 h-9 rounded-md bg-background px-3 py-2 text-base md:text-sm font-normal focus:outline-none focus:ring-0 focus:ring-offset-0">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filters.completion}
              onValueChange={(value) => setFilters(prev => ({ ...prev, completion: value as 'all' | 'completo' | 'em_progresso' | 'abandonado' }))}
            >
            <SelectTrigger className="w-full sm:w-[220px] h-9 rounded-md bg-background px-3 py-2 text-base md:text-sm font-normal focus:outline-none focus:ring-0 focus:ring-offset-0">
                <SelectValue placeholder="Completion" />
              </SelectTrigger>
              <SelectContent>
                {completionOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Lead</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Contact</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Rating</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Last Step</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Updated</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">
                    <Loader2 className="w-5 h-5 animate-spin inline-block mr-2" />
                    Loading leads...
                  </td>
                </tr>
              )}
              {!isLoading && (!leads || leads.length === 0) && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                    No leads found yet.
                  </td>
                </tr>
              )}
              {leads?.map(lead => (
                <tr key={lead.id} className="hover:bg-muted/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-foreground">{lead.nome || 'No name'}</div>
                    <div className="text-sm text-muted-foreground">
                      {lead.cidadeEstado || 'City not provided'}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-foreground">{lead.email || '?'}</div>
                    <div className="text-xs text-muted-foreground">{lead.telefone || 'No phone'}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge className={clsx("border", classificationBadgeClass(lead.classificacao))}>
                        {getLeadClassificationLabel(lead.classificacao, '?')}
                      </Badge>
                      {hasMultipleForms && lead.formId != null && (
                        <Badge variant="outline" className="text-xs">
                          {formsById.get(lead.formId)?.name ?? '—'}
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-foreground">{questionLabel(lead)}</div>
                    <div className={clsx("text-xs", completionStatusClass(getCompletionStatus(lead)))}>
                      {completionStatusLabel(getCompletionStatus(lead))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Select
                      value={lead.status || 'novo'}
                      onValueChange={(value) => updateLead.mutate({ id: lead.id, status: value as LeadStatus })}
                    >
                      <SelectTrigger className="w-40 h-9 rounded-md bg-background px-3 py-2 text-base md:text-sm font-normal focus:outline-none focus:ring-0 focus:ring-offset-0">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        {statusOptions.filter(s => s.value !== 'all').map(option => (
                          <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {formatDate((lead.updatedAt as any) || (lead.createdAt as any))}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openLeadDialog(lead)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setLeadPendingDelete(lead)}
                        disabled={deleteLead.isPending}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AlertDialog open={!!leadPendingDelete} onOpenChange={(open) => !open && setLeadPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete lead?</AlertDialogTitle>
            <AlertDialogDescription>
              {leadPendingDelete
                ? `This will permanently remove ${leadPendingDelete.nome || 'this lead'} from the system. This action cannot be undone.`
                : 'This action cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLead.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={!leadPendingDelete || deleteLead.isPending}
              onClick={() => {
                if (!leadPendingDelete) return;
                deleteLead.mutate(leadPendingDelete.id);
              }}
            >
              {deleteLead.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isLeadDialogOpen} onOpenChange={setIsLeadDialogOpen}>
        <DialogContent className="max-w-4xl w-[95vw] sm:w-full max-h-[90vh] overflow-hidden">
          {selectedLead ? (
            <div className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">
              <DialogHeader>
                <DialogTitle>Lead Details</DialogTitle>
              </DialogHeader>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Lead</p>
                  <h2 className="text-xl font-semibold leading-tight">{selectedLead.nome || 'No name'}</h2>
                  <p className="text-sm text-muted-foreground">{selectedLead.cidadeEstado || 'City not provided'}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge className={clsx("border", classificationBadgeClass(selectedLead.classificacao))}>
                    {getLeadClassificationLabel(selectedLead.classificacao, '?')}
                  </Badge>
                  <Badge variant="outline">{getLeadStatusLabel(selectedLead.status)}</Badge>
                  <Badge variant="secondary">{questionLabel(selectedLead)}</Badge>
                  {hasMultipleForms && selectedLead.formId != null && (
                    <Badge variant="outline">
                      Form: {formsById.get(selectedLead.formId)?.name ?? '—'}
                    </Badge>
                  )}
                  {selectedLead.ghlSyncStatus && (
                    <Badge className={clsx("border", ghlBadgeClass(selectedLead.ghlSyncStatus))}>
                      GHL: {selectedLead.ghlSyncStatus}
                    </Badge>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <DetailItem label="Email" value={selectedLead.email || '?'} />
                <DetailItem label="Phone" value={selectedLead.telefone || '?'} />
                <DetailItem label="City/State" value={selectedLead.cidadeEstado || '?'} />
                <DetailItem label="Business Type" value={selectedLead.tipoNegocio || '?'} />
                <DetailItem label="Marketing Experience" value={selectedLead.experienciaMarketing || '?'} />
                <DetailItem label="Ads Budget" value={selectedLead.orcamentoAnuncios || '?'} />
                <DetailItem label="Main Challenge" value={selectedLead.principalDesafio || '?'} />
                <DetailItem label="Availability" value={selectedLead.disponibilidade || '?'} />
                <DetailItem label="Results Expectation" value={selectedLead.expectativaResultado || '?'} />
                <DetailItem label="Total Score" value={selectedLead.scoreTotal ?? '—'} />
                <DetailItem label="Rating" value={getLeadClassificationLabel(selectedLead.classificacao, '?')} />
                <DetailItem label="Last Update" value={formatDate((selectedLead.updatedAt as any) || (selectedLead.createdAt as any))} />
              </div>

              {selectedLead.observacoes && (
                <div className="p-3 rounded-lg border bg-muted/40">
                  <p className="text-xs uppercase text-muted-foreground">Notes</p>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{selectedLead.observacoes}</p>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-base">Form Responses</h3>
                  <span className="text-xs text-muted-foreground">{selectedLeadQuestions.length} questions</span>
                </div>
                {selectedLeadQuestions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No questions configured.</p>
                ) : (
                  <div className="divide-y divide-border rounded-lg border bg-card">
                    {selectedLeadQuestions.map((question) => {
                      const answer = getAnswerForQuestion(selectedLead, question);
                      const conditionalAnswer = getConditionalAnswer(selectedLead, question);
                      return (
                        <div key={question.id} className="p-3">
                          <p className="text-xs uppercase text-muted-foreground mb-1">{question.id}</p>
                          <p className="font-semibold text-sm text-foreground">{question.title}</p>
                          <p className="text-sm text-muted-foreground mt-1">{answer || '?'}</p>
                          {conditionalAnswer && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {(question.conditionalField?.title || 'Detalhe')}: <span className="text-foreground">{conditionalAnswer}</span>
                            </p>
                          )}
                        </div>
                      );
                    })}
                    {extraCustomAnswers.map(([fieldId, value]) => (
                      <div key={fieldId} className="p-3">
                        <p className="text-xs uppercase text-muted-foreground mb-1">{fieldId}</p>
                        <p className="text-sm text-muted-foreground">{value}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Select a lead to view details.</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}


