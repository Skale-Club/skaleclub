import type { HubAccessEvent, HubLiveSummary, HubRegistrationSummary } from '@shared/schema';

export type HubStatus = 'draft' | 'scheduled' | 'live' | 'ended' | 'cancelled';

export type HubLiveDetail = {
  live: HubLiveSummary;
  registrations: HubRegistrationSummary[];
  accessEvents: HubAccessEvent[];
};

export const HUB_STATUS_LABELS: Record<HubStatus, string> = {
  draft: 'Draft',
  scheduled: 'Inactive',
  live: 'Active',
  ended: 'Ended',
  cancelled: 'Cancelled',
};

export function hubStatusLabel(status: string): string {
  return HUB_STATUS_LABELS[status as HubStatus] ?? status;
}
