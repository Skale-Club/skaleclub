import { Eye, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from '@/components/ui/loader';
import { clsx } from 'clsx';
import { getLeadClassificationLabel } from '@/lib/leadDisplay';
import type { Form, FormLead, LeadStatus } from '@shared/schema';
import {
  classificationBadgeClass,
  completionStatusClass,
  completionStatusLabel,
  formatDate,
  getCompletionStatus,
  questionLabel,
} from './leadDisplayHelpers';

type LeadsTableProps = {
  leads: FormLead[] | undefined;
  isLoading: boolean;
  formsById: Map<number, Form>;
  hasMultipleForms: boolean;
  statusOptions: { value: LeadStatus | 'all'; label: string }[];
  onOpenLead: (lead: FormLead) => void;
  onRequestDelete: (lead: FormLead) => void;
  onStatusChange: (id: number, status: LeadStatus) => void;
  isDeletePending: boolean;
};

export function LeadsTable({
  leads,
  isLoading,
  formsById,
  hasMultipleForms,
  statusOptions,
  onOpenLead,
  onRequestDelete,
  onStatusChange,
  isDeletePending,
}: LeadsTableProps) {
  return (
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
                <div className="text-sm font-medium text-foreground">{questionLabel(lead, formsById)}</div>
                <div className={clsx("text-xs", completionStatusClass(getCompletionStatus(lead)))}>
                  {completionStatusLabel(getCompletionStatus(lead))}
                </div>
              </td>
              <td className="px-4 py-3">
                <Select
                  value={lead.status || 'novo'}
                  onValueChange={(value) => onStatusChange(lead.id, value as LeadStatus)}
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
                    onClick={() => onOpenLead(lead)}
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="destructive"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => onRequestDelete(lead)}
                    disabled={isDeletePending}
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
  );
}
