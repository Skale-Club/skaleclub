import { format } from 'date-fns';
import { DEFAULT_FORM_CONFIG, getSortedQuestions } from '@shared/form';
import type { Form, FormConfig, FormLead, FormQuestion, LeadClassification } from '@shared/schema';

export type CompletionStatus = 'completo' | 'em_progresso' | 'abandonado';

export function formatDate(value?: string | null): string {
  if (!value) return '?';
  return format(new Date(value), 'MMM d, yyyy');
}

export function classificationBadgeClass(classificacao?: LeadClassification | null): string {
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
}

export function ghlBadgeClass(status?: string | null): string {
  if (status === 'synced') return 'bg-green-50 text-green-700 border-green-200';
  if (status === 'failed') return 'bg-red-50 text-red-700 border-red-200';
  return 'bg-amber-50 text-amber-700 border-amber-200';
}

export function getConfigForLead(lead: FormLead, formsById: Map<number, Form>): FormConfig {
  if (lead.formId != null) {
    const config = formsById.get(lead.formId)?.config as FormConfig | null | undefined;
    if (config) return config;
  }
  return DEFAULT_FORM_CONFIG;
}

export function getQuestionsForLead(lead: FormLead, formsById: Map<number, Form>): FormQuestion[] {
  return getSortedQuestions(getConfigForLead(lead, formsById));
}

export function questionLabel(lead: FormLead, formsById: Map<number, Form>): string {
  if (lead.formCompleto) return 'Form complete';
  const step = lead.ultimaPerguntaRespondida || 1;
  const total = getQuestionsForLead(lead, formsById).length || DEFAULT_FORM_CONFIG.questions.length;
  return `Question ${step} of ${total}`;
}

export function getCompletionStatus(lead: FormLead): CompletionStatus {
  if (lead.formCompleto) return 'completo';
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const updatedAt = lead.updatedAt ? new Date(lead.updatedAt) : null;
  if (updatedAt && updatedAt >= oneDayAgo) return 'em_progresso';
  return 'abandonado';
}

export function completionStatusLabel(status: CompletionStatus): string {
  switch (status) {
    case 'completo': return 'Complete';
    case 'em_progresso': return 'In Progress';
    case 'abandonado': return 'Abandoned';
  }
}

export function completionStatusClass(status: CompletionStatus): string {
  switch (status) {
    case 'completo': return 'text-green-600';
    case 'em_progresso': return 'text-amber-600';
    case 'abandonado': return 'text-red-600';
  }
}

export function getLeadFieldValue(lead: FormLead, fieldId: string): string {
  const direct = (lead as any)?.[fieldId];
  if (direct !== undefined && direct !== null && String(direct).trim() !== '') {
    return String(direct);
  }
  return lead.customAnswers?.[fieldId] || '';
}

export function getAnswerForQuestion(lead: FormLead, question: FormQuestion): string {
  const raw = getLeadFieldValue(lead, question.id);
  if (!raw) return '';
  if (question.type === 'select' && question.options) {
    const match = question.options.find(o => o.value === raw || o.label === raw);
    return match?.label || raw;
  }
  return raw;
}

export function getConditionalAnswer(lead: FormLead, question: FormQuestion): string {
  if (!question.conditionalField) return '';
  const trigger = getLeadFieldValue(lead, question.id);
  if (trigger !== question.conditionalField.showWhen) return '';
  return getLeadFieldValue(lead, question.conditionalField.id);
}
