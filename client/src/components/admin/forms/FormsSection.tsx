import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import {
  ArrowLeft,
  Archive,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Copy,
  MoreHorizontal,
  Pencil,
  Star,
  StarOff,
  Trash2,
  Undo2,
  Users,
} from 'lucide-react';
import { AdminCard, EmptyState, SectionHeader } from '../shared';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Loader2 } from '@/components/ui/loader';
import { FormEditorContent } from '../leads/FormEditorContent';
import { NewFormDialog } from './NewFormDialog';
import type { Form } from '@shared/schema';

type FormRow = Form & { _leadCount: number };

export function FormsSection() {
  const [location, setLocation] = useLocation();

  // Sub-route detection: /admin/forms/:id
  const editingIdMatch = location.match(/^\/admin\/forms\/(\d+)/);
  const editingId = editingIdMatch ? Number(editingIdMatch[1]) : null;

  if (editingId != null) {
    return <FormEditorView formId={editingId} onBack={() => setLocation('/admin/forms')} />;
  }
  return <FormsList onOpen={(id) => setLocation(`/admin/forms/${id}`)} />;
}

// ──────────────────────────────────────────────────────────
// Forms list
// ──────────────────────────────────────────────────────────

function FormsList({ onOpen }: { onOpen: (id: number) => void }) {
  const { toast } = useToast();
  const [showArchived, setShowArchived] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<FormRow | null>(null);
  const [leadsForm, setLeadsForm] = useState<FormRow | null>(null);

  const listQueryKey = ['/api/forms', { includeInactive: showArchived }] as const;

  const { data: forms, isLoading } = useQuery<FormRow[]>({
    queryKey: listQueryKey,
    queryFn: async () => {
      const suffix = showArchived ? '?includeInactive=true' : '';
      const res = await apiRequest('GET', `/api/forms${suffix}`);
      return res.json();
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['/api/forms'] });

  const duplicateMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('POST', `/api/forms/${id}/duplicate`, {});
      return res.json();
    },
    onSuccess: (created: Form) => {
      invalidate();
      toast({ title: 'Form duplicated', description: `"${created.name}" is ready.` });
    },
    onError: (err: Error) => {
      toast({ title: 'Failed to duplicate', description: err.message, variant: 'destructive' });
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('POST', `/api/forms/${id}/set-default`, {});
      return res.json();
    },
    onSuccess: (form: Form) => {
      invalidate();
      toast({ title: 'Default form updated', description: `"${form.name}" is now the default.` });
    },
    onError: (err: Error) => {
      toast({ title: 'Failed to set default', description: err.message, variant: 'destructive' });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async ({ id, archive }: { id: number; archive: boolean }) => {
      if (archive) {
        await apiRequest('DELETE', `/api/forms/${id}`);
      } else {
        await apiRequest('PUT', `/api/forms/${id}`, { isActive: true });
      }
    },
    onSuccess: (_data, vars) => {
      invalidate();
      toast({ title: vars.archive ? 'Form archived' : 'Form restored' });
    },
    onError: (err: Error) => {
      toast({ title: 'Action failed', description: err.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/forms/${id}?force=true`);
    },
    onSuccess: () => {
      invalidate();
      toast({ title: 'Form deleted' });
      setDeleteTarget(null);
    },
    onError: (err: Error) => {
      toast({ title: 'Delete failed', description: err.message, variant: 'destructive' });
    },
  });

  // Sort: default first, then active, then name
  const sorted = useMemo(() => {
    if (!forms) return [];
    return [...forms].sort((a, b) => {
      if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [forms]);

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Forms"
        description="Manage lead capture forms — questions, scoring, and thresholds."
        icon={<ClipboardList className="w-5 h-5" />}
        action={
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
              <Switch checked={showArchived} onCheckedChange={setShowArchived} />
              Show archived
            </label>
            <NewFormDialog onCreated={(created) => onOpen(created.id)} />
          </div>
        }
      />

      {isLoading ? (
        <div className="flex w-full items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : sorted.length === 0 ? (
        <AdminCard>
          <EmptyState
            icon={<ClipboardList />}
            title="No forms yet"
            description="Create your first form to start capturing qualified leads."
          />
        </AdminCard>
      ) : (
        <div className="rounded-2xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="text-left font-medium px-4 py-3">Name</th>
                <th className="text-left font-medium px-4 py-3">Slug</th>
                <th className="text-left font-medium px-4 py-3">Status</th>
                <th className="text-right font-medium px-4 py-3">Questions</th>
                <th className="text-right font-medium px-4 py-3">Leads</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {sorted.map((form) => {
                const questionCount = Array.isArray((form.config as any)?.questions)
                  ? (form.config as any).questions.length
                  : 0;
                const canDelete = !form.isDefault && form._leadCount === 0;
                const canArchive = !form.isDefault;

                return (
                  <tr key={form.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => onOpen(form.id)}
                        className="font-medium hover:text-primary transition-colors text-left"
                      >
                        {form.name}
                      </button>
                      {form.description ? (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{form.description}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">/f/{form.slug}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {form.isDefault ? (
                          <Badge className="bg-primary/10 text-primary border border-primary/20 hover:bg-primary/15">
                            <Star className="w-3 h-3 mr-1 fill-current" />
                            Default
                          </Badge>
                        ) : null}
                        {form.isActive ? (
                          <Badge variant="secondary">Active</Badge>
                        ) : (
                          <Badge variant="outline">Archived</Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{questionCount}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {form._leadCount > 0 ? (
                        <button
                          type="button"
                          onClick={() => setLeadsForm(form)}
                          className="tabular-nums font-medium text-primary underline-offset-2 hover:underline"
                        >
                          {form._leadCount}
                        </button>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        aria-label={`Edit ${form.name}`}
                        onClick={() => onOpen(form.id)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onOpen(form.id)}>
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => duplicateMutation.mutate(form.id)}
                            disabled={duplicateMutation.isPending}
                          >
                            <Copy className="w-4 h-4 mr-2" /> Duplicate
                          </DropdownMenuItem>
                          {!form.isDefault && form.isActive ? (
                            <DropdownMenuItem
                              onClick={() => setDefaultMutation.mutate(form.id)}
                              disabled={setDefaultMutation.isPending}
                            >
                              <Star className="w-4 h-4 mr-2" /> Set as default
                            </DropdownMenuItem>
                          ) : null}
                          <DropdownMenuSeparator />
                          {canArchive && form.isActive ? (
                            <DropdownMenuItem onClick={() => archiveMutation.mutate({ id: form.id, archive: true })}>
                              <Archive className="w-4 h-4 mr-2" /> Archive
                            </DropdownMenuItem>
                          ) : null}
                          {canArchive && !form.isActive ? (
                            <DropdownMenuItem onClick={() => archiveMutation.mutate({ id: form.id, archive: false })}>
                              <Undo2 className="w-4 h-4 mr-2" /> Restore
                            </DropdownMenuItem>
                          ) : null}
                          <DropdownMenuItem
                            onClick={() => setDeleteTarget(form)}
                            disabled={!canDelete}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="w-4 h-4 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <FormLeadsDialog form={leadsForm} onClose={() => setLeadsForm(null)} />

      {deleteTarget ? (
        <AlertDialog open={true} onOpenChange={(o) => !o && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete form &quot;{deleteTarget.name}&quot;?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently remove the form. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteMutation.mutate(deleteTarget.id)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// Leads dialog (paginated)
// ──────────────────────────────────────────────────────────

type LeadRow = {
  id: number;
  nome: string;
  email: string | null;
  telefone: string | null;
  createdAt: string | null;
  status: string | null;
  classificacao: string | null;
  source: string | null;
  urlOrigem: string | null;
  formCompleto: boolean;
};

const PAGE_SIZE = 20;

function FormLeadsDialog({ form, onClose }: { form: FormRow | null; onClose: () => void }) {
  const [page, setPage] = useState(1);

  // Reset page when form changes
  useEffect(() => { setPage(1); }, [form?.id]);

  const offset = (page - 1) * PAGE_SIZE;

  const { data, isLoading } = useQuery<{ data: LeadRow[]; total: number }>({
    queryKey: ['/api/forms', form?.id, 'leads', page],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/forms/${form!.id}/leads?limit=${PAGE_SIZE}&offset=${offset}`);
      return res.json();
    },
    enabled: !!form,
  });

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 1;

  const classColor: Record<string, string> = {
    QUENTE: 'text-red-500',
    MORNO: 'text-amber-500',
    FRIO: 'text-blue-500',
    DESQUALIFICADO: 'text-muted-foreground',
  };

  return (
    <Dialog open={!!form} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Users className="w-4 h-4 text-muted-foreground" />
            {form?.name} — Leads
            {data ? (
              <span className="text-xs font-normal text-muted-foreground ml-1">({data.total} total)</span>
            ) : null}
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto flex-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : !data || data.data.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
              <Users className="w-8 h-8" />
              <p className="text-sm">No leads yet.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground sticky top-0">
                <tr>
                  <th className="text-left font-medium px-4 py-2.5">Name</th>
                  <th className="text-left font-medium px-4 py-2.5">Contact</th>
                  <th className="text-left font-medium px-4 py-2.5">Status</th>
                  <th className="text-left font-medium px-4 py-2.5">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.data.map((lead) => (
                  <tr key={lead.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium truncate max-w-[180px]">{lead.nome || '—'}</p>
                      {lead.classificacao ? (
                        <span className={`text-xs font-semibold ${classColor[lead.classificacao] ?? 'text-muted-foreground'}`}>
                          {lead.classificacao}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <p className="truncate max-w-[180px] text-muted-foreground">{lead.email || lead.telefone || '—'}</p>
                      {lead.email && lead.telefone ? (
                        <p className="text-xs text-muted-foreground truncate max-w-[180px]">{lead.telefone}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                        lead.formCompleto
                          ? 'bg-green-500/10 text-green-600'
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {lead.formCompleto ? 'Complete' : 'Partial'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {lead.createdAt
                        ? new Date(lead.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination footer */}
        {totalPages > 1 ? (
          <div className="flex items-center justify-between px-6 py-3 border-t shrink-0 text-sm">
            <span className="text-muted-foreground text-xs">
              Page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" disabled={page >= totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

// ──────────────────────────────────────────────────────────
// Editor (sub-route)
// ──────────────────────────────────────────────────────────

function FormEditorView({ formId, onBack }: { formId: number; onBack: () => void }) {
  const { toast } = useToast();

  const { data: form, isLoading } = useQuery<FormRow>({
    queryKey: [`/api/forms/${formId}`],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/forms/${formId}`);
      return res.json();
    },
  });

  const updateMetaMutation = useMutation({
    mutationFn: async (updates: { name?: string; description?: string | null }) => {
      const res = await apiRequest('PUT', `/api/forms/${formId}`, updates);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/forms/${formId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/forms'] });
    },
    onError: (err: Error) => {
      toast({ title: 'Failed to save', description: err.message, variant: 'destructive' });
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/forms/${formId}/set-default`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/forms/${formId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/forms'] });
      toast({ title: 'This form is now the default.' });
    },
    onError: (err: Error) => {
      toast({ title: 'Failed to set default', description: err.message, variant: 'destructive' });
    },
  });

  if (isLoading) {
    return (
      <div className="flex w-full items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!form) {
    return (
      <div className="space-y-6">
        <SectionHeader title="Form not found" icon={<ClipboardList className="w-5 h-5" />} />
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to forms
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <EditableFormHeader
        form={form}
        onSave={(updates) => updateMetaMutation.mutate(updates)}
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onBack}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              All forms
            </Button>
            {form.isDefault ? (
              <Button size="sm" variant="ghost" disabled>
                <Star className="w-4 h-4 mr-2 fill-current" />
                Default
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setDefaultMutation.mutate()}
                disabled={setDefaultMutation.isPending}
              >
                <StarOff className="w-4 h-4 mr-2" />
                Set as default
              </Button>
            )}
          </div>
        }
      />

      <FormEditorContent formId={formId} />
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// Inline-editable form header
// ──────────────────────────────────────────────────────────

function EditableFormHeader({
  form,
  onSave,
  action,
}: {
  form: FormRow;
  onSave: (updates: { name?: string; description?: string | null }) => void;
  action?: React.ReactNode;
}) {
  const [editingField, setEditingField] = useState<'name' | 'description' | null>(null);
  const [nameDraft, setNameDraft] = useState(form.name);
  const [descDraft, setDescDraft] = useState(form.description ?? '');

  useEffect(() => {
    setNameDraft(form.name);
    setDescDraft(form.description ?? '');
  }, [form.name, form.description]);

  const commitName = () => {
    const next = nameDraft.trim();
    if (!next) {
      setNameDraft(form.name);
    } else if (next !== form.name) {
      onSave({ name: next });
    }
    setEditingField(null);
  };

  const commitDesc = () => {
    const next = descDraft.trim();
    const current = form.description ?? '';
    if (next !== current) onSave({ description: next || null });
    setEditingField(null);
  };

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 mb-6 border-b">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground shrink-0">
          <ClipboardList className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          {editingField === 'name' ? (
            <input
              autoFocus
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); commitName(); }
                if (e.key === 'Escape') { setNameDraft(form.name); setEditingField(null); }
              }}
              className="text-2xl font-bold tracking-tight bg-transparent border-0 outline-none w-full px-1 -mx-1 rounded focus:ring-1 focus:ring-ring"
              maxLength={120}
            />
          ) : (
            <h1
              className="text-2xl font-bold tracking-tight truncate cursor-text rounded px-1 -mx-1 hover:bg-muted/60"
              title="Click to edit name"
              onClick={() => setEditingField('name')}
            >
              {form.name}
            </h1>
          )}
          {editingField === 'description' ? (
            <input
              autoFocus
              value={descDraft}
              onChange={(e) => setDescDraft(e.target.value)}
              onBlur={commitDesc}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); commitDesc(); }
                if (e.key === 'Escape') { setDescDraft(form.description ?? ''); setEditingField(null); }
              }}
              placeholder={`Editing /f/${form.slug}`}
              className="text-sm text-muted-foreground bg-transparent border-0 outline-none w-full px-1 -mx-1 rounded focus:ring-1 focus:ring-ring"
              maxLength={500}
            />
          ) : (
            <p
              className="text-sm text-muted-foreground cursor-text rounded px-1 -mx-1 hover:bg-muted/60"
              title="Click to edit description"
              onClick={() => setEditingField('description')}
            >
              {form.description || `Editing /f/${form.slug}`}
            </p>
          )}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

