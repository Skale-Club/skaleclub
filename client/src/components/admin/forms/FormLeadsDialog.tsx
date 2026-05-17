import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { apiRequest } from '@/lib/queryClient';
import { Loader2 } from '@/components/ui/loader';
import type { FormRow, LeadRow } from './formsTypes';
import { PAGE_SIZE } from './formsTypes';

export function FormLeadsDialog({ form, onClose }: { form: FormRow | null; onClose: () => void }) {
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
