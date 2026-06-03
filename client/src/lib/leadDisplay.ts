import type { LeadClassification, LeadStatus } from '@shared/schema';

const leadClassificationLabels: Record<LeadClassification, string> = {
  HOT: 'Hot',
  WARM: 'Warm',
  COLD: 'Cold',
  DISQUALIFIED: 'Disqualified',
};

const leadStatusLabels: Record<LeadStatus, string> = {
  novo: 'New',
  contatado: 'Contacted',
  qualificado: 'Qualified',
  convertido: 'Converted',
  descartado: 'Discarded',
};

export function getLeadClassificationLabel(
  classification?: LeadClassification | null,
  fallback = 'No classification'
) {
  return classification ? leadClassificationLabels[classification] ?? fallback : fallback;
}

export function getLeadStatusLabel(status?: LeadStatus | null, fallback = 'Unknown') {
  return status ? leadStatusLabels[status] ?? fallback : fallback;
}
