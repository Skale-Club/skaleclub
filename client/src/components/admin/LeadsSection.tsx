import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { RotateCcw, Sparkles } from 'lucide-react';
import { AdminCard, SectionHeader } from './shared';
import { useTranslation } from '@/hooks/useTranslation';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Loader2 } from '@/components/ui/loader';
import type { Form, FormLead, LeadClassification, LeadStatus } from '@shared/schema';
import { LeadsTable } from './leads/LeadsTable';
import { LeadDetailDialog } from './leads/LeadDetailDialog';

export function LeadsSection() {
  const { toast } = useToast();
  const { t } = useTranslation();
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

  return (
    <div className="space-y-6">
      <SectionHeader
        title={t('Leads')}
        description={t('All captured leads with ratings and follow-up status')}
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

        <LeadsTable
          leads={leads}
          isLoading={isLoading}
          formsById={formsById}
          hasMultipleForms={hasMultipleForms}
          statusOptions={statusOptions}
          onOpenLead={openLeadDialog}
          onRequestDelete={setLeadPendingDelete}
          onStatusChange={(id, status) => updateLead.mutate({ id, status })}
          isDeletePending={deleteLead.isPending}
        />
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

      <LeadDetailDialog
        open={isLeadDialogOpen}
        onOpenChange={setIsLeadDialogOpen}
        lead={selectedLead}
        formsById={formsById}
        hasMultipleForms={hasMultipleForms}
      />
    </div>
  );
}
