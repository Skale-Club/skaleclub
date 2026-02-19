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
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Eye, ExternalLink, GripVertical, HelpCircle, Loader2, Pencil, Plus, RotateCcw, Star, Trash2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { clsx } from 'clsx';
import { format } from 'date-fns';
import { DEFAULT_FORM_CONFIG, calculateMaxScore, getSortedQuestions } from '@shared/form';
import type { FormConfig, FormLead, FormOption, FormQuestion, LeadClassification, LeadStatus } from '@shared/schema';
export function LeadsSection() {
  const { toast } = useToast();
  const [isFormEditorOpen, setIsFormEditorOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<FormLead | null>(null);
  const [isLeadDialogOpen, setIsLeadDialogOpen] = useState(false);
  const [filters, setFilters] = useState<{
    search: string;
    classification: LeadClassification | 'all';
    status: LeadStatus | 'all';
    completion: 'all' | 'completo' | 'em_progresso' | 'abandonado';
  }>({
    search: '',
    classification: 'all',
    status: 'all',
    completion: 'all',
  });

  const { data: formConfig } = useQuery<FormConfig>({
    queryKey: ['/api/form-config'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/form-config');
      return res.json();
    }
  });

  const { data: leads, isLoading } = useQuery<FormLead[]>({
    queryKey: ['/api/form-leads', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.search) params.set('search', filters.search);
      if (filters.classification !== 'all') params.set('classificacao', filters.classification);
      if (filters.status !== 'all') params.set('status', filters.status);
      if (filters.completion !== 'all') params.set('completionStatus', filters.completion);
      const res = await apiRequest('GET', `/api/form-leads${params.toString() ? `?${params.toString()}` : ''}`);
      return res.json();
    }
  });

  const questionsForDisplay = useMemo(() => getSortedQuestions(formConfig || DEFAULT_FORM_CONFIG), [formConfig]);
  const totalQuestions = questionsForDisplay.length || DEFAULT_FORM_CONFIG.questions.length;

  const deleteLead = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('DELETE', `/api/form-leads/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/form-leads'] });
      toast({ title: 'Lead deleted' });
    },
    onError: (error: any) => {
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
    { value: 'QUENTE', label: 'Lead Quente' },
    { value: 'MORNO', label: 'Lead Morno' },
    { value: 'FRIO', label: 'Lead Frio' },
    { value: 'DESQUALIFICADO', label: 'Desqualificado' },
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

  const classificationBadge = (classificacao?: LeadClassification | null) => {
    switch (classificacao) {
      case 'QUENTE':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'MORNO':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'FRIO':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'DESQUALIFICADO':
        return 'bg-slate-100 text-slate-600 border-slate-200';
      default:
        return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  const questionLabel = (lead: FormLead) => {
    if (lead.formCompleto) return 'Form complete';
    const step = lead.ultimaPerguntaRespondida || 1;
    return `Question ${step} of ${totalQuestions}`;
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
    const knownIds = new Set(questionsForDisplay.map(q => q.id));
    return Object.entries(selectedLead.customAnswers || {}).filter(([id]) => !knownIds.has(id));
  }, [questionsForDisplay, selectedLead]);

  const DetailItem = ({ label, value }: { label: string; value: ReactNode }) => (
    <div className="p-3 rounded-lg border bg-muted/40">
      <p className="text-xs uppercase text-muted-foreground">{label}</p>
      <div className="text-sm font-medium text-foreground break-words">{value || '?'}</div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground uppercase tracking-wide">Form Leads</p>
          <h1 className="text-2xl font-bold">Lead Qualification Tracking</h1>
          <p className="text-muted-foreground">See who started the form, where they stopped, and update status quickly.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/form-leads'] })}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Sheet open={isFormEditorOpen} onOpenChange={setIsFormEditorOpen}>
            <SheetTrigger asChild>
              <Button variant="outline">
                <Pencil className="w-4 h-4 mr-2" />
                Edit Form
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
              <SheetHeader>
                <SheetTitle>Form Editor</SheetTitle>
              </SheetHeader>
              <div className="mt-6">
                <FormEditorContent />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="p-4 rounded-xl border bg-card shadow-sm">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-2xl font-bold">{stats.total}</p>
        </div>
        <div className="p-4 rounded-xl border bg-card shadow-sm">
          <p className="text-xs text-muted-foreground">Hot</p>
          <p className="text-2xl font-bold text-green-600">{stats.hot}</p>
        </div>
        <div className="p-4 rounded-xl border bg-card shadow-sm">
          <p className="text-xs text-muted-foreground">Warm</p>
          <p className="text-2xl font-bold text-amber-600">{stats.warm}</p>
        </div>
        <div className="p-4 rounded-xl border bg-card shadow-sm">
          <p className="text-xs text-muted-foreground">Cold</p>
          <p className="text-2xl font-bold text-blue-600">{stats.cold}</p>
        </div>
        <div className="p-4 rounded-xl border bg-card shadow-sm">
          <p className="text-xs text-muted-foreground">In Progress</p>
          <p className="text-2xl font-bold text-amber-500">{stats.inProgress}</p>
        </div>
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
            <Select
              value={filters.classification}
              onValueChange={(value) => setFilters(prev => ({ ...prev, classification: value as LeadClassification | 'all' }))}
            >
            <SelectTrigger className="w-full sm:w-[220px] h-9 rounded-md bg-background px-3 py-2 text-base md:text-sm font-normal focus:outline-none focus:ring-0 focus:ring-offset-0">
                <SelectValue placeholder="Classificação" />
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
                <SelectValue placeholder="Conclusão" />
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
                    <Badge className={clsx("border", classificationBadge(lead.classificacao))}>
                      {lead.classificacao || '?'}
                    </Badge>
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
                        onClick={() => {
                          if (window.confirm('Delete this lead?')) {
                            deleteLead.mutate(lead.id);
                          }
                        }}
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

      <Dialog open={isLeadDialogOpen} onOpenChange={setIsLeadDialogOpen}>
        <DialogContent className="max-w-4xl w-[95vw] sm:w-full max-h-[90vh] overflow-hidden">
          {selectedLead ? (
            <div className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">
              <DialogHeader>
                <DialogTitle>Detalhes do lead</DialogTitle>
              </DialogHeader>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Lead</p>
                  <h2 className="text-xl font-semibold leading-tight">{selectedLead.nome || 'No name'}</h2>
                  <p className="text-sm text-muted-foreground">{selectedLead.cidadeEstado || 'City not provided'}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge className={clsx("border", classificationBadge(selectedLead.classificacao))}>
                    {selectedLead.classificacao || '?'}
                  </Badge>
                  <Badge variant="outline">{selectedLead.status || 'novo'}</Badge>
                  <Badge variant="secondary">{questionLabel(selectedLead)}</Badge>
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
                <DetailItem label="Rating" value={selectedLead.classificacao || '?'} />
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
                  <span className="text-xs text-muted-foreground">{questionsForDisplay.length} questions</span>
                </div>
                {questionsForDisplay.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No questions configured.</p>
                ) : (
                  <div className="divide-y divide-border rounded-lg border bg-card">
                    {questionsForDisplay.map((question) => {
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

// ============================================
// FORM EDITOR CONTENT (used in Sheet)
// ============================================

function FormEditorContent() {
  const { toast } = useToast();
  const [editingQuestion, setEditingQuestion] = useState<FormQuestion | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isThresholdsOpen, setIsThresholdsOpen] = useState(false);

  const { data: formConfig, isLoading } = useQuery<FormConfig>({
    queryKey: ['/api/form-config'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/form-config');
      return res.json();
    }
  });

  const [config, setConfig] = useState<FormConfig>(formConfig || DEFAULT_FORM_CONFIG);

  useEffect(() => {
    setConfig(formConfig || DEFAULT_FORM_CONFIG);
  }, [formConfig]);

  const sortedQuestions = getSortedQuestions(config);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const saveConfig = useMutation({
    mutationFn: async (newConfig: FormConfig) => {
      const res = await apiRequest('PUT', '/api/form-config', newConfig);
      return res.json();
    },
    onSuccess: (data: FormConfig) => {
      setConfig(data);
      queryClient.invalidateQueries({ queryKey: ['/api/form-config'] });
      toast({ title: 'Configuration saved successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to save configuration', description: error.message, variant: 'destructive' });
    }
  });

  const handleSaveQuestion = (question: FormQuestion) => {
    const existingIndex = config.questions.findIndex(q => q.id === question.id);
    let newQuestions: FormQuestion[];

    if (existingIndex >= 0) {
      newQuestions = config.questions.map(q => q.id === question.id ? question : q);
    } else {
      newQuestions = [...config.questions, question];
    }

    // Recalculate order
    newQuestions = newQuestions
      .sort((a, b) => a.order - b.order)
      .map((q, i) => ({ ...q, order: i + 1 }));

    const newConfig: FormConfig = {
      ...config,
      questions: newQuestions,
      maxScore: calculateMaxScore({ ...config, questions: newQuestions }),
    };

    setConfig(newConfig);
    saveConfig.mutate(newConfig);
    setIsDialogOpen(false);
    setEditingQuestion(null);
  };

  const handleDeleteQuestion = (questionId: string) => {
    const newQuestions = config.questions
      .filter(q => q.id !== questionId)
      .sort((a, b) => a.order - b.order)
      .map((q, i) => ({ ...q, order: i + 1 }));

    const newConfig: FormConfig = {
      ...config,
      questions: newQuestions,
      maxScore: calculateMaxScore({ ...config, questions: newQuestions }),
    };

    setConfig(newConfig);
    saveConfig.mutate(newConfig);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = sortedQuestions.findIndex(q => q.id === active.id);
      const newIndex = sortedQuestions.findIndex(q => q.id === over.id);

      const reordered = arrayMove(sortedQuestions, oldIndex, newIndex);
      const newQuestions = reordered.map((q, i) => ({ ...q, order: i + 1 }));

      const newConfig: FormConfig = {
        ...config,
        questions: newQuestions,
        maxScore: calculateMaxScore({ ...config, questions: newQuestions }),
      };

      setConfig(newConfig);
      saveConfig.mutate(newConfig);
    }
  };

  const handleSaveThresholds = (thresholds: FormConfig['thresholds']) => {
    const newConfig: FormConfig = {
      ...config,
      thresholds,
    };
    setConfig(newConfig);
    saveConfig.mutate(newConfig);
    setIsThresholdsOpen(false);
  };

  const getQuestionTypeBadge = (type: FormQuestion['type']) => {
    const labels = { text: 'Texto', email: 'Email', tel: 'Telefone', select: 'Múltipla escolha' };
    return labels[type] || type;
  };

  const getQuestionMaxPoints = (question: FormQuestion) => {
    if (question.type !== 'select' || !question.options) return 0;
    return Math.max(...question.options.map(o => o.points));
  };

  if (isLoading && !formConfig) {
    return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Action buttons */}
      <div className="flex flex-wrap items-center gap-2">
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) setEditingQuestion(null); }}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Nova Pergunta
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <QuestionForm
              question={editingQuestion}
              onSave={handleSaveQuestion}
              isLoading={saveConfig.isPending}
              nextOrder={sortedQuestions.length + 1}
              existingIds={config.questions.map(q => q.id)}
            />
          </DialogContent>
        </Dialog>
        <Dialog open={isThresholdsOpen} onOpenChange={setIsThresholdsOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Star className="w-4 h-4 mr-2" />
              Limites
            </Button>
          </DialogTrigger>
          <DialogContent>
            <ThresholdsForm
              thresholds={config.thresholds}
              onSave={handleSaveThresholds}
              isLoading={saveConfig.isPending}
            />
          </DialogContent>
        </Dialog>
        <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded ml-auto">
          Score máx: {config.maxScore}
        </span>
      </div>

      {/* Thresholds info */}
      <div className="grid grid-cols-2 gap-2">
        <div className="p-3 rounded-xl border bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
          <p className="text-xs text-green-600 dark:text-green-400 font-semibold">QUENTE</p>
          <p className="text-lg font-bold text-green-700 dark:text-green-300">? {config.thresholds.hot} pts</p>
        </div>
        <div className="p-3 rounded-xl border bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
          <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold">MORNO</p>
          <p className="text-lg font-bold text-amber-700 dark:text-amber-300">? {config.thresholds.warm} pts</p>
        </div>
        <div className="p-3 rounded-xl border bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
          <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold">FRIO</p>
          <p className="text-lg font-bold text-blue-700 dark:text-blue-300">? {config.thresholds.cold} pts</p>
        </div>
        <div className="p-3 rounded-xl border bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">DESQUALIFICADO</p>
          <p className="text-lg font-bold text-slate-600 dark:text-slate-300">&lt; {config.thresholds.cold} pts</p>
        </div>
      </div>

      {/* Questions list */}
      <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border bg-muted/50">
          <p className="text-sm font-semibold text-muted-foreground">{sortedQuestions.length} perguntas</p>
        </div>

        {sortedQuestions.length === 0 ? (
          <div className="p-12 text-center">
            <HelpCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold text-lg mb-2">Nenhuma pergunta</h3>
            <p className="text-muted-foreground mb-4">Adicione perguntas ao formulário de qualificação</p>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={sortedQuestions.map(q => q.id)} strategy={verticalListSortingStrategy}>
              <div className="divide-y divide-border">
                {sortedQuestions.map((question) => (
                  <SortableQuestionItem
                    key={question.id}
                    question={question}
                    onEdit={(q) => { setEditingQuestion(q); setIsDialogOpen(true); }}
                    onDelete={(id) => {
                      if (window.confirm('Are you sure you want to delete this question?')) {
                        handleDeleteQuestion(id);
                      }
                    }}
                    typeBadge={getQuestionTypeBadge(question.type)}
                    maxPoints={getQuestionMaxPoints(question)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  );
}

function SortableQuestionItem({
  question,
  onEdit,
  onDelete,
  typeBadge,
  maxPoints
}: {
  question: FormQuestion;
  onEdit: (q: FormQuestion) => void;
  onDelete: (id: string) => void;
  typeBadge: string;
  maxPoints: number;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: question.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="p-4 hover:bg-muted/50 transition-colors">
      <div className="flex items-start gap-3">
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing mt-1 text-muted-foreground hover:text-foreground">
          <GripVertical className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{question.order}</span>
            <Badge variant="outline" className="text-xs">{typeBadge}</Badge>
            {maxPoints > 0 && (
              <Badge variant="secondary" className="text-xs">{maxPoints} pts max</Badge>
            )}
            {question.required && (
              <Badge variant="default" className="text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">Obrigatória</Badge>
            )}
          </div>
          <h3 className="font-semibold text-foreground truncate">{question.title}</h3>
          {question.type === 'select' && question.options && (
            <p className="text-xs text-muted-foreground mt-1">
              {question.options.length} opções: {question.options.slice(0, 3).map(o => o.label).join(', ')}{question.options.length > 3 ? '...' : ''}
            </p>
          )}
          {question.placeholder && question.type !== 'select' && (
            <p className="text-xs text-muted-foreground mt-1">Placeholder: {question.placeholder}</p>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(question)}>
            <Pencil className="w-4 h-4" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600">
                <Trash2 className="w-4 h-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete question?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. The question will be removed from the form.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => onDelete(question.id)} className="bg-red-600 hover:bg-red-700">
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}

function ThresholdsForm({
  thresholds,
  onSave,
  isLoading
}: {
  thresholds: FormConfig['thresholds'];
  onSave: (t: FormConfig['thresholds']) => void;
  isLoading: boolean;
}) {
  const [hot, setHot] = useState(thresholds.hot);
  const [warm, setWarm] = useState(thresholds.warm);
  const [cold, setCold] = useState(thresholds.cold);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ hot, warm, cold });
  };

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>Rating Thresholds</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 py-4">
        <p className="text-sm text-muted-foreground">
          Set minimum points for each lead rating.
        </p>
        <div className="space-y-3">
          <div className="flex items-center gap-4">
            <Label className="w-32 text-green-600">QUENTE (?)</Label>
            <Input type="number" value={hot} onChange={(e) => setHot(Number(e.target.value))} min={0} className="w-24" />
            <span className="text-sm text-muted-foreground">pontos</span>
          </div>
          <div className="flex items-center gap-4">
            <Label className="w-32 text-amber-600">MORNO (?)</Label>
            <Input type="number" value={warm} onChange={(e) => setWarm(Number(e.target.value))} min={0} className="w-24" />
            <span className="text-sm text-muted-foreground">pontos</span>
          </div>
          <div className="flex items-center gap-4">
            <Label className="w-32 text-blue-600">FRIO (?)</Label>
            <Input type="number" value={cold} onChange={(e) => setCold(Number(e.target.value))} min={0} className="w-24" />
            <span className="text-sm text-muted-foreground">pontos</span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Leads com score abaixo de {cold} são classificados como DESQUALIFICADO.
        </p>
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline" type="button">Cancel</Button>
        </DialogClose>
        <Button type="submit" disabled={isLoading}>
          {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Save
        </Button>
      </DialogFooter>
    </form>
  );
}

function QuestionForm({
  question,
  onSave,
  isLoading,
  nextOrder,
  existingIds,
}: {
  question: FormQuestion | null;
  onSave: (q: FormQuestion) => void;
  isLoading: boolean;
  nextOrder: number;
  existingIds: string[];
}) {
  const [id, setId] = useState(question?.id || '');
  const [title, setTitle] = useState(question?.title || '');
  const [type, setType] = useState<FormQuestion['type']>(question?.type || 'text');
  const [required, setRequired] = useState(question?.required ?? true);
  const [placeholder, setPlaceholder] = useState(question?.placeholder || '');
  const [order, setOrder] = useState(question?.order ?? nextOrder);
  const [options, setOptions] = useState<FormOption[]>(question?.options || []);
  const [hasConditional, setHasConditional] = useState(!!question?.conditionalField);
  const [conditionalShowWhen, setConditionalShowWhen] = useState(question?.conditionalField?.showWhen || '');
  const [conditionalTitle, setConditionalTitle] = useState(question?.conditionalField?.title || '');
  const [conditionalPlaceholder, setConditionalPlaceholder] = useState(question?.conditionalField?.placeholder || '');
  const [ghlFieldId, setGhlFieldId] = useState(question?.ghlFieldId || '');

  // Fetch GHL custom fields
  const { data: ghlStatus } = useQuery<{ enabled: boolean }>({
    queryKey: ['/api/integrations/ghl/status'],
  });
  const { data: ghlFieldsData, isLoading: isLoadingGhlFields } = useQuery<{ 
    success: boolean; 
    standardFields?: Array<{ id: string; name: string; fieldKey: string; dataType: string }>;
    customFields?: Array<{ id: string; name: string; fieldKey: string; dataType: string }> 
  }>({
    queryKey: ['/api/integrations/ghl/custom-fields'],
    enabled: ghlStatus?.enabled === true,
  });

  useEffect(() => {
    setId(question?.id || '');
    setTitle(question?.title || '');
    setType(question?.type || 'text');
    setRequired(question?.required ?? true);
    setPlaceholder(question?.placeholder || '');
    setOrder(question?.order ?? nextOrder);
    setOptions(question?.options || []);
    setHasConditional(!!question?.conditionalField);
    setConditionalShowWhen(question?.conditionalField?.showWhen || '');
    setConditionalTitle(question?.conditionalField?.title || '');
    setConditionalPlaceholder(question?.conditionalField?.placeholder || '');
    setGhlFieldId(question?.ghlFieldId || '');
  }, [question, nextOrder]);

  const isEditing = !!question;

  const handleAddOption = () => {
    setOptions([...options, { value: '', label: '', points: 0 }]);
  };

  const handleRemoveOption = (index: number) => {
    setOptions(options.filter((_, i) => i !== index));
  };

  const handleOptionChange = (index: number, field: keyof FormOption, value: string | number) => {
    const newOptions = [...options];
    if (field === 'points') {
      newOptions[index] = { ...newOptions[index], [field]: Number(value) };
    } else {
      newOptions[index] = { ...newOptions[index], [field]: value };
      // Auto-fill value if label is being set and value is empty
      if (field === 'label' && !newOptions[index].value) {
        newOptions[index].value = value as string;
      }
    }
    setOptions(newOptions);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return;

    // Auto-generate ID from title if creating new question
    let finalId = id;
    if (!isEditing) {
      finalId = title
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '') // Remove special chars
        .trim()
        .split(/\s+/)
        .slice(0, 3) // Take first 3 words
        .join('_');

      // If ID already exists, append number
      let counter = 1;
      let testId = finalId;
      while (existingIds.includes(testId)) {
        testId = `${finalId}${counter}`;
        counter++;
      }
      finalId = testId;
    }

    // Generate conditional field ID automatically: {questionId}_{optionName}
    let generatedConditionalId = '';
    if (hasConditional && conditionalShowWhen) {
      generatedConditionalId = `${finalId}_${conditionalShowWhen.replace(/\s+/g, '').toLowerCase()}`;
    }

    const questionData: FormQuestion = {
      id: finalId,
      order: isEditing ? order : nextOrder,
      title,
      type,
      required,
      placeholder: placeholder || undefined,
      options: type === 'select' ? options.filter(o => o.label && o.value) : undefined,
      conditionalField: hasConditional && conditionalShowWhen ? {
        showWhen: conditionalShowWhen,
        id: generatedConditionalId,
        title: conditionalTitle,
        placeholder: conditionalPlaceholder,
      } : undefined,
      ghlFieldId: ghlFieldId || undefined,
    };

    onSave(questionData);
  };

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>{isEditing ? 'Edit Question' : 'New Question'}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <Label htmlFor="question-title">Texto da Pergunta</Label>
          <Textarea
            id="question-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: Qual é o seu nome completo?"
            required
            rows={2}
          />
          {!isEditing && title && (
            <p className="text-xs text-muted-foreground">
              ID será: <code className="bg-muted px-1.5 py-0.5 rounded font-mono">
                {title
                  .toLowerCase()
                  .replace(/[^a-z0-9\s]/g, '')
                  .trim()
                  .split(/\s+/)
                  .slice(0, 3)
                  .join('_') || 'seu_id_aqui'}
              </code>
            </p>
          )}
          {isEditing && (
            <p className="text-xs text-muted-foreground">
              ID: <code className="bg-muted px-1.5 py-0.5 rounded font-mono">{id}</code> ? Ordem: <strong>{order}</strong>
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Tipo de Resposta</Label>
            <Select value={type} onValueChange={(v) => setType(v as FormQuestion['type'])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Texto livre</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="tel">Telefone</SelectItem>
                <SelectItem value="select">Múltipla escolha</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="question-placeholder">Placeholder</Label>
            <Input
              id="question-placeholder"
              value={placeholder}
              onChange={(e) => setPlaceholder(e.target.value)}
              placeholder="Texto de ajuda"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox id="question-required" checked={required} onCheckedChange={(c) => setRequired(!!c)} />
          <Label htmlFor="question-required" className="text-sm">Pergunta obrigatória</Label>
        </div>

        {/* GHL Custom Field Mapping */}
        {ghlStatus?.enabled && (
          <div className="space-y-2 p-3 bg-purple-50/50 dark:bg-purple-950/30 rounded-lg border border-purple-200/50 dark:border-purple-900/50">
            <Label className="text-sm font-semibold flex items-center gap-2">
              <ExternalLink className="w-4 h-4" />
              Vincular ao GoHighLevel
            </Label>
            <Select value={ghlFieldId || "none"} onValueChange={(val) => setGhlFieldId(val === "none" ? "" : val)}>
              <SelectTrigger>
                <SelectValue placeholder="Don't link" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Don't link</SelectItem>
                {isLoadingGhlFields && (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground flex items-center gap-2">
                    <Loader2 className="w-3 h-3 animate-spin" /> Loading fields...
                  </div>
                )}
                {/* Standard GHL Fields */}
                {ghlFieldsData?.standardFields && ghlFieldsData.standardFields.length > 0 && (
                  <>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-t mt-1">
                      Campos Padrão
                    </div>
                    {ghlFieldsData.standardFields.map((field) => (
                      <SelectItem key={field.id} value={field.id}>
                        {field.name}
                      </SelectItem>
                    ))}
                  </>
                )}
                {/* Custom GHL Fields */}
                {ghlFieldsData?.customFields && ghlFieldsData.customFields.length > 0 && (
                  <>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-t mt-1">
                      Campos Personalizados
                    </div>
                    {ghlFieldsData.customFields.map((field) => (
                      <SelectItem key={field.id} value={field.id}>
                        {field.name}
                      </SelectItem>
                    ))}
                  </>
                )}
                {ghlFieldsData?.success && (!ghlFieldsData.customFields || ghlFieldsData.customFields.length === 0) && (!ghlFieldsData.standardFields || ghlFieldsData.standardFields.length === 0) && (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">
                    Nenhum campo encontrado no GHL
                  </div>
                )}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              O valor desta pergunta será enviado para o campo selecionado no GHL
            </p>
          </div>
        )}

        {type === 'select' && (
          <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Opções de Resposta</Label>
              <Button type="button" variant="outline" size="sm" onClick={handleAddOption}>
                <Plus className="w-3 h-3 mr-1" /> Adicionar
              </Button>
            </div>
            {options.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma opção. Clique em "Adicionar" para criar.</p>
            )}
            <div className="space-y-2">
              {options.map((option, index) => (
                <div key={index} className="flex items-center gap-2 p-2 bg-background rounded border">
                  <Input
                    value={option.label}
                    onChange={(e) => handleOptionChange(index, 'label', e.target.value)}
                    placeholder="Label (texto visível)"
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    value={option.points}
                    onChange={(e) => handleOptionChange(index, 'points', e.target.value)}
                    placeholder="Pts"
                    className="w-20"
                    min={0}
                  />
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => handleRemoveOption(index)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Conditional field */}
            <div className="pt-3 border-t space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox id="has-conditional" checked={hasConditional} onCheckedChange={(c) => setHasConditional(!!c)} />
                <Label htmlFor="has-conditional" className="text-sm font-semibold">Adicionar campo condicional</Label>
                <span className="text-xs text-muted-foreground">(aparece somente quando uma opção é selecionada)</span>
              </div>
              {hasConditional && (
                <div className="space-y-3 p-3 bg-blue-50/50 dark:bg-blue-950/30 rounded-lg border border-blue-200/50 dark:border-blue-900/50">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Ativar este campo quando:</Label>
                    <p className="text-xs text-muted-foreground mb-2">Selecione qual opção acima irá ativar o campo adicional</p>
                    <Select value={conditionalShowWhen} onValueChange={setConditionalShowWhen}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma opção..." />
                      </SelectTrigger>
                      <SelectContent>
                        {options.length === 0 && <div className="px-2 py-1.5 text-xs text-muted-foreground">Adicione opções acima primeiro</div>}
                        {options.filter(o => o.value).map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label || opt.value}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="conditional-title" className="text-sm font-semibold">Pergunta do campo adicional</Label>
                    <Input
                      id="conditional-title"
                      value={conditionalTitle}
                      onChange={(e) => setConditionalTitle(e.target.value)}
                      placeholder="e.g., Please describe your business"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="conditional-placeholder" className="text-sm font-semibold">Texto de ajuda (Placeholder)</Label>
                    <Input
                      id="conditional-placeholder"
                      value={conditionalPlaceholder}
                      onChange={(e) => setConditionalPlaceholder(e.target.value)}
                      placeholder="Ex: Digite seu tipo de negócio..."
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline" type="button">Cancel</Button>
        </DialogClose>
        <Button type="submit" disabled={isLoading}>
          {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {isEditing ? 'Update' : 'Create'}
        </Button>
      </DialogFooter>
    </form>
  );
}

