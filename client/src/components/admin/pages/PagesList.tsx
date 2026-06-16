import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ExternalLink, LayoutPanelLeft, Pencil, Trash2 } from 'lucide-react';
import { AdminCard, EmptyState } from '@/components/admin/shared';
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
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Loader2 } from '@/components/ui/loader';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import type { Page } from '@shared/schema';

interface PagesListProps {
  onEdit: (id: string) => void;
}

const LIST_QUERY_KEY = ['/api/pages'] as const;

function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  try {
    const date = typeof value === 'string' ? new Date(value) : value;
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

export function PagesList({ onEdit }: PagesListProps) {
  const { toast } = useToast();
  const [deleteTarget, setDeleteTarget] = useState<Page | null>(null);

  const { data: pageList, isLoading } = useQuery<Page[]>({
    queryKey: LIST_QUERY_KEY,
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/pages');
      return res.json();
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: LIST_QUERY_KEY });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await apiRequest('PUT', `/api/pages/${id}`, { isActive });
      return res.json();
    },
    onSuccess: (_data, vars) => {
      invalidate();
      toast({ title: vars.isActive ? 'Page activated' : 'Page deactivated' });
    },
    onError: (err: Error) => {
      toast({ title: 'Failed to update', description: err.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest('DELETE', `/api/pages/${id}`);
    },
    onSuccess: () => {
      invalidate();
      toast({ title: 'Page deleted' });
      setDeleteTarget(null);
    },
    onError: (err: Error) => {
      toast({ title: 'Delete failed', description: err.message, variant: 'destructive' });
    },
  });

  const sorted = useMemo(() => {
    if (!pageList) return [];
    return [...pageList].sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      return a.slug.localeCompare(b.slug);
    });
  }, [pageList]);

  if (isLoading) {
    return (
      <div className="flex w-full items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (sorted.length === 0) {
    return (
      <AdminCard>
        <EmptyState
          icon={<LayoutPanelLeft />}
          title="No pages yet"
          description='Click "New page" to create your first managed page.'
        />
      </AdminCard>
    );
  }

  return (
    <>
      <div className="rounded-2xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="text-left font-medium px-4 py-3">Slug</th>
              <th className="text-left font-medium px-4 py-3">Name</th>
              <th className="text-left font-medium px-4 py-3">Active</th>
              <th className="text-left font-medium px-4 py-3">Updated</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {sorted.map((page) => (
              <tr
                key={page.id}
                className="hover:bg-muted/30 transition-colors"
                data-testid={`pages-list-row-${page.id}`}
              >
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                  /{page.slug}
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => onEdit(page.id)}
                    className="font-medium hover:text-primary transition-colors text-left"
                  >
                    {page.name}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <Switch
                    checked={page.isActive}
                    disabled={toggleActiveMutation.isPending}
                    onCheckedChange={(checked) =>
                      toggleActiveMutation.mutate({ id: page.id, isActive: checked })
                    }
                    data-testid={`switch-page-active-${page.slug}`}
                  />
                </td>
                <td className="px-4 py-3 text-muted-foreground tabular-nums text-xs">
                  {formatDate(page.updatedAt)}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex items-center gap-1">
                    <Button
                      asChild
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      aria-label={`Open ${page.name} in a new tab`}
                      data-testid={`button-open-page-${page.slug}`}
                      disabled={!page.isActive}
                      title={page.isActive ? `Open /${page.slug} in a new tab` : 'Activate the page to preview it'}
                    >
                      <a
                        href={page.isActive ? `/${page.slug}` : undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-disabled={!page.isActive}
                        onClick={(e) => {
                          if (!page.isActive) e.preventDefault();
                        }}
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      aria-label={`Edit ${page.name}`}
                      data-testid={`button-edit-page-${page.slug}`}
                      onClick={() => onEdit(page.id)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      aria-label={`Delete ${page.name}`}
                      data-testid={`button-delete-page-${page.slug}`}
                      onClick={() => setDeleteTarget(page)}
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

      {deleteTarget ? (
        <AlertDialog open={true} onOpenChange={(o) => !o && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete page &quot;{deleteTarget.name}&quot;?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently removes the page at <span className="font-mono">/{deleteTarget.slug}</span>.
                This action cannot be undone.
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
    </>
  );
}
