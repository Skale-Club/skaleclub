// Response shapes of the Smart Tags admin API (server/routes/smartTags.ts),
// shared with the admin UI. Dates travel as ISO strings.

export interface SmartTagMetrics {
  interactions: number;
  qr: number;
  nfc: number;
  approxUnique: number;
  lastInteractionAt: string | null;
}

export interface SmartTagListItem {
  id: string;
  publicCode: string;
  serialNumber: number | null;
  productType: string;
  status: string;
  nfcStatus: string;
  label: string | null;
  destinationType: string | null;
  destinationUrl: string | null;
  customerId: string | null;
  customerName: string | null;
  batchId: string | null;
  batchCode: string | null;
  qrInteractions: number;
  nfcInteractions: number;
  lastInteractionAt: string | null;
  activatedAt: string | null;
  createdAt: string;
}

export interface SmartTagHistoryEntry {
  id: string;
  previousUrl: string | null;
  newUrl: string | null;
  previousDestinationType: string | null;
  newDestinationType: string | null;
  changedByUserId: string | null;
  changedByEmail: string | null;
  reason: string | null;
  createdAt: string;
}

export interface SmartTagDetail extends SmartTagListItem {
  utmEnabled: boolean;
  utmCampaign: string | null;
  metadata: Record<string, unknown> | null;
  assignedAt: string | null;
  disabledAt: string | null;
  updatedAt: string;
  qrUrl: string;
  nfcUrl: string;
  history: SmartTagHistoryEntry[];
}

export interface SmartTagDailyPoint {
  day: string; // YYYY-MM-DD (UTC)
  qr: number;
  nfc: number;
  approxUnique: number;
}

export interface SmartTagAnalytics {
  from: string;
  to: string;
  totals: SmartTagMetrics & { botHits: number; inactiveScans: number };
  daily: SmartTagDailyPoint[];
  devices: Array<{ deviceType: string; count: number }>;
  topTags: Array<{ id: string; publicCode: string; customerName: string | null; qr: number; nfc: number }>;
}

export interface SmartTagRecentEvent {
  id: number;
  tagId: string;
  publicCode: string;
  customerName: string | null;
  accessMethod: string;
  eventType: string;
  deviceType: string | null;
  occurredAt: string;
}

export interface SmartTagOverview {
  counts: Record<"total" | "inventory" | "assigned" | "active" | "disabled" | "retired", number>;
  interactions: { today: number; last7: number; last30: number };
  split30: { qr: number; nfc: number };
  approxUnique30: number;
  recentEvents: SmartTagRecentEvent[];
  recentActivations: Array<{ id: string; publicCode: string; customerName: string | null; activatedAt: string }>;
  recentChanges: Array<SmartTagHistoryEntry & { tagId: string; publicCode: string }>;
}

export interface SmartTagCustomerItem {
  id: string;
  businessName: string;
  slug: string | null;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  externalCrmId: string | null;
  notes: string | null;
  tagCount: number;
  activeTags: number;
  interactions: number;
  lastInteractionAt: string | null;
  createdAt: string;
}

export interface SmartTagBatchItem {
  id: string;
  batchCode: string;
  name: string;
  productType: string;
  vendor: string | null;
  quantity: number;
  status: string;
  notes: string | null;
  createdAt: string;
  tagCount: number;
  inventoryCount: number;
  assignedCount: number;
  activeCount: number;
  nfcVerifiedCount: number;
}

// ─── NFC provisioning (desktop provisioner) ──────────────────────────────────

export interface ProvisionerDeviceItem {
  id: string;
  deviceName: string;
  platform: string | null;
  appVersion: string | null;
  status: string; // pairing | active | revoked
  tokenPrefix: string | null;
  pairingExpiresAt: string | null;
  lastSeenAt: string | null;
  pairedAt: string | null;
  createdAt: string;
  revokedAt: string | null;
}

export interface ProvisioningJobItem {
  id: string;
  status: string;
  expectedUrl: string;
  readbackUrl: string | null;
  tagType: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  deviceName: string | null;
  createdAt: string;
  claimedAt: string | null;
  completedAt: string | null;
  expiresAt: string;
  events: Array<{ id: number; type: string; detail: Record<string, unknown> | null; createdAt: string }>;
}

export interface TagProvisioningState {
  status: string; // not_programmed | programmed | verified | locked | failed
  programmedAt: string | null;
  verifiedAt: string | null;
  lockedAt: string | null;
  deviceName: string | null;
  /** First real NFC tap / QR scan on this tag after the chip was verified (final QA). */
  tapTestAt: string | null;
  qrTestAt: string | null;
  jobs: ProvisioningJobItem[];
}

// ─── Journey (server/routes/smartTagJourney.ts) ──────────────────────────────

export interface SmartTagJourneyEntryItem {
  id: string;
  kind: string;
  action: string | null;
  title: string;
  content: string | null;
  batchId: string | null;
  batchCode: string | null;
  tagId: string | null;
  publicCode: string | null;
  serialNumber: number | null;
  customerId: string | null;
  customerName: string | null;
  planId: string | null;
  planTitle: string | null;
  beforeValue: string | null;
  afterValue: string | null;
  source: string;
  actor: string;
  actorUserId: string | null;
  actorEmail: string | null;
  status: string;
  metadata: Record<string, unknown>;
  occurredAt: string;
  createdAt: string;
}

export interface SmartTagPlanItem {
  id: string;
  kind: string;
  title: string;
  description: string | null;
  batchId: string | null;
  batchCode: string | null;
  tagId: string | null;
  publicCode: string | null;
  customerId: string | null;
  customerName: string | null;
  status: string;
  outcome: string | null;
  dueDate: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
}

/** One scope's story: its timeline (newest first) and its plans. */
export interface SmartTagJourney {
  entries: SmartTagJourneyEntryItem[];
  plans: SmartTagPlanItem[];
}
