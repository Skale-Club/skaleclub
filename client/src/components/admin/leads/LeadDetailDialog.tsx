import { useMemo, type ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { clsx } from 'clsx';
import { getLeadClassificationLabel, getLeadStatusLabel } from '@/lib/leadDisplay';
import type { Form, FormLead } from '@shared/schema';
import {
  classificationBadgeClass,
  formatDate,
  getAnswerForQuestion,
  getConditionalAnswer,
  getQuestionsForLead,
  ghlBadgeClass,
  questionLabel,
} from './leadDisplayHelpers';

type LeadDetailDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: FormLead | null;
  formsById: Map<number, Form>;
  hasMultipleForms: boolean;
};

function DetailItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="p-3 rounded-lg border bg-muted/40">
      <p className="text-xs uppercase text-muted-foreground">{label}</p>
      <div className="text-sm font-medium text-foreground break-words">{value || '?'}</div>
    </div>
  );
}

export function LeadDetailDialog({ open, onOpenChange, lead, formsById, hasMultipleForms }: LeadDetailDialogProps) {
  const selectedLeadQuestions = useMemo(
    () => (lead ? getQuestionsForLead(lead, formsById) : []),
    [lead, formsById]
  );

  const extraCustomAnswers = useMemo(() => {
    if (!lead) return [] as [string, string][];
    const knownIds = new Set(selectedLeadQuestions.map(q => q.id));
    return Object.entries(lead.customAnswers || {}).filter(([id]) => !knownIds.has(id)) as [string, string][];
  }, [selectedLeadQuestions, lead]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[95vw] sm:w-full max-h-[90vh] flex flex-col overflow-hidden">
        {lead ? (
          <>
            <DialogHeader className="shrink-0 pr-6">
              <DialogTitle>Lead Details</DialogTitle>
            </DialogHeader>
          <div className="space-y-4 flex-1 overflow-y-auto pr-2 -mr-1">

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="text-xs uppercase text-muted-foreground">Lead</p>
                <h2 className="text-xl font-semibold leading-tight">{lead.nome || 'No name'}</h2>
                <p className="text-sm text-muted-foreground">{lead.cidadeEstado || 'City not provided'}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge className={clsx("border", classificationBadgeClass(lead.classificacao))}>
                  {getLeadClassificationLabel(lead.classificacao, '?')}
                </Badge>
                <Badge variant="outline">{getLeadStatusLabel(lead.status)}</Badge>
                <Badge variant="secondary">{questionLabel(lead, formsById)}</Badge>
                {hasMultipleForms && lead.formId != null && (
                  <Badge variant="outline">
                    Form: {formsById.get(lead.formId)?.name ?? '—'}
                  </Badge>
                )}
                {lead.ghlSyncStatus && (
                  <Badge className={clsx("border", ghlBadgeClass(lead.ghlSyncStatus))}>
                    GHL: {lead.ghlSyncStatus}
                  </Badge>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <DetailItem label="Email" value={lead.email || '?'} />
              <DetailItem label="Phone" value={lead.telefone || '?'} />
              <DetailItem label="City/State" value={lead.cidadeEstado || '?'} />
              <DetailItem label="Business Type" value={lead.tipoNegocio || '?'} />
              <DetailItem label="Marketing Experience" value={lead.experienciaMarketing || '?'} />
              <DetailItem label="Ads Budget" value={lead.orcamentoAnuncios || '?'} />
              <DetailItem label="Main Challenge" value={lead.principalDesafio || '?'} />
              <DetailItem label="Availability" value={lead.disponibilidade || '?'} />
              <DetailItem label="Results Expectation" value={lead.expectativaResultado || '?'} />
              <DetailItem label="Total Score" value={lead.scoreTotal ?? '—'} />
              <DetailItem label="Rating" value={getLeadClassificationLabel(lead.classificacao, '?')} />
              <DetailItem label="Last Update" value={formatDate((lead.updatedAt as any) || (lead.createdAt as any))} />
            </div>

            {lead.observacoes && (
              <div className="p-3 rounded-lg border bg-muted/40">
                <p className="text-xs uppercase text-muted-foreground">Notes</p>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{lead.observacoes}</p>
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
                    const answer = getAnswerForQuestion(lead, question);
                    const conditionalAnswer = getConditionalAnswer(lead, question);
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
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Select a lead to view details.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
