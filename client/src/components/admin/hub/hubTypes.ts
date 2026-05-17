import type { HubAccessEvent, HubLiveSummary, HubRegistrationSummary } from '@shared/schema';

export type HubStatus = 'draft' | 'scheduled' | 'live' | 'ended' | 'cancelled';

export type HubLiveDetail = {
  live: HubLiveSummary;
  registrations: HubRegistrationSummary[];
  accessEvents: HubAccessEvent[];
};
