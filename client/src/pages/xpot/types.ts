export type XpotUser = {
  userId: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  isAdmin: boolean;
};

export type SalesRep = {
  id: number;
  displayName: string;
  role: string;
  team?: string | null;
};

export type SalesVisitNote = {
  summary?: string | null;
  outcome?: string | null;
  nextStep?: string | null;
  followUpRequired?: boolean | null;
  audioUrl?: string | null;
  audioDurationSeconds?: number | null;
  audioTranscription?: string | null;
};

export type SalesAccountLocation = {
  id: number;
  label: string;
  addressLine1: string;
  city?: string | null;
  state?: string | null;
};

export type SalesAccount = {
  id: number;
  name: string;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  industry?: string | null;
  source?: string | null;
  status: string;
  ghlContactId?: string | null;
  locations?: SalesAccountLocation[];
  openOpportunities?: number;
};

export type SalesVisit = {
  id: number;
  accountId: number;
  repId: number;
  status: string;
  validationStatus: string;
  checkedInAt?: string | null;
  checkedOutAt?: string | null;
  durationSeconds?: number | null;
  distanceFromTargetMeters?: number | null;
  account?: SalesAccount | null;
  note?: SalesVisitNote | null;
};

export type SalesOpportunity = {
  id: number;
  accountId: number;
  title: string;
  value: number;
  currency: string;
  status: string;
  syncStatus: string;
  account?: SalesAccount | null;
};

export type SalesTask = {
  id: number;
  title: string;
  dueAt?: string | null;
  status: string;
};

export type DashboardResponse = {
  metrics: {
    visitsToday: number;
    completedVisits: number;
    activeVisit: SalesVisit | null;
    openOpportunities: number;
    pipelineValue: number;
    pendingTasks: number;
    assignedAccounts: number;
  };
  recentVisits: SalesVisit[];
  openOpportunities: SalesOpportunity[];
  pendingTasks: SalesTask[];
};

export type XpotMeResponse = {
  user: XpotUser;
  rep: SalesRep;
  activeVisit: SalesVisit | null;
};

export type GooglePlaceResult = {
  placeId: string;
  name: string;
  address: string;
  phone?: string;
  website?: string;
  primaryType?: string;
  lat?: number;
  lng?: number;
};

export type PlaceSearchResponse = {
  results: GooglePlaceResult[];
};

export type SalesAccountPayload = {
  name: string;
  phone?: string;
  email?: string;
  website?: string;
  industry?: string;
  source?: string;
  status?: string;
  notes?: string;
  primaryLocation?: {
    label?: string;
    addressLine1: string;
    city?: string;
    state?: string;
    country?: string;
    lat?: number;
    lng?: number;
    geofenceRadiusMeters?: number;
    isPrimary?: boolean;
  };
};
