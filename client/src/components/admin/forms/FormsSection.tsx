import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import {
  ArrowLeft,
  Archive,
  ClipboardList,
  Copy,
  Loader2,
  MoreHorizontal,
  Star,
  StarOff,
  Trash2,
  Undo2,
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
        <div className="flex items-center justify-center py-12">
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
                    <td className="px-4 py-3 text-right tabular-nums">{form._leadCount}</td>
                    <td className="px-4 py-3 text-right">
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
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

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
      <div className="flex items-center justify-center py-12">
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
      <SectionHeader
        title={form.name}
        description={form.description || `Editing /f/${form.slug}`}
        icon={<ClipboardList className="w-5 h-5" />}
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
