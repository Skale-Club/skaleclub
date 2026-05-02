import { index, integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod";

const nullableDateInputSchema = z.union([z.string(), z.date(), z.null()]).optional().transform((value) => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (value instanceof Date) {
    return value;
  }

  return new Date(value);
});

const dateInputSchema = z.union([z.string(), z.date()]).optional().transform((value) => {
  if (value === undefined) {
    return undefined;
  }

  if (value instanceof Date) {
    return value;
  }

  return new Date(value);
});

export function normalizeHubPhone(value?: string | null): string | null {
  const digits = (value ?? "").replace(/\D+/g, "");
  return digits.length > 0 ? digits : null;
}

export function normalizeHubEmail(value?: string | null): string | null {
  const normalized = (value ?? "").trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

export const hubLiveStatusSchema = z.enum(["draft", "scheduled", "live", "ended", "cancelled"]);
export const hubRegistrationStatusSchema = z.enum(["registered", "approved", "waitlisted", "cancelled"]);
export const hubAccessEventTypeSchema = z.enum(["gate_check", "join", "replay"]);
export const hubAccessOutcomeSchema = z.enum(["granted", "denied"]);
export const hubIdentityMatchSchema = z.enum(["phone", "email", "manual", "none"]);

export const hubLives = pgTable("hub_lives", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  description: text("description"),
  hostName: text("host_name").notNull().default("Skale Club"),
  timezone: text("timezone").notNull().default("America/New_York"),
  startsAt: timestamp("starts_at").notNull(),
  endsAt: timestamp("ends_at"),
  registrationOpensAt: timestamp("registration_opens_at"),
  registrationClosesAt: timestamp("registration_closes_at"),
  streamUrl: text("stream_url"),
  replayUrl: text("replay_url"),
  status: text("status").notNull().default("draft"),
  capacity: integer("capacity"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
  slugIdx: index("hub_lives_slug_idx").on(table.slug),
  statusStartsAtIdx: index("hub_lives_status_starts_at_idx").on(table.status, table.startsAt),
}));

export const hubParticipants = pgTable("hub_participants", {
  id: serial("id").primaryKey(),
  fullName: text("full_name").notNull(),
  phoneRaw: text("phone_raw"),
  phoneNormalized: text("phone_normalized"),
  emailRaw: text("email_raw"),
  emailNormalized: text("email_normalized"),
  source: text("source").notNull().default("hub"),
  notes: text("notes"),
  ghlContactId: text("ghl_contact_id"),
  ghlSyncStatus: text("ghl_sync_status").notNull().default("pending"),
  ghlLastSyncedAt: timestamp("ghl_last_synced_at"),
  ghlSyncError: text("ghl_sync_error"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
  phoneNormalizedIdx: index("hub_participants_phone_normalized_idx").on(table.phoneNormalized),
  emailNormalizedIdx: index("hub_participants_email_normalized_idx").on(table.emailNormalized),
  ghlContactIdIdx: index("hub_participants_ghl_contact_id_idx").on(table.ghlContactId),
}));

export const hubRegistrations = pgTable("hub_registrations", {
  id: serial("id").primaryKey(),
  liveId: integer("live_id").references(() => hubLives.id, { onDelete: "cascade" }).notNull(),
  participantId: integer("participant_id").references(() => hubParticipants.id, { onDelete: "cascade" }).notNull(),
  status: text("status").notNull().default("registered"),
  source: text("source").notNull().default("hub-form"),
  notes: text("notes"),
  registeredAt: timestamp("registered_at").notNull().defaultNow(),
  cancelledAt: timestamp("cancelled_at"),
  attendedAt: timestamp("attended_at"),
  lastAccessAt: timestamp("last_access_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
  liveIdIdx: index("hub_registrations_live_id_idx").on(table.liveId),
  participantIdIdx: index("hub_registrations_participant_id_idx").on(table.participantId),
}));

export const hubAccessEvents = pgTable("hub_access_events", {
  id: serial("id").primaryKey(),
  liveId: integer("live_id").references(() => hubLives.id, { onDelete: "cascade" }).notNull(),
  participantId: integer("participant_id").references(() => hubParticipants.id, { onDelete: "set null" }),
  registrationId: integer("registration_id").references(() => hubRegistrations.id, { onDelete: "set null" }),
  eventType: text("event_type").notNull(),
  outcome: text("outcome").notNull(),
  matchedBy: text("matched_by").notNull().default("none"),
  phoneRaw: text("phone_raw"),
  phoneNormalized: text("phone_normalized"),
  emailRaw: text("email_raw"),
  emailNormalized: text("email_normalized"),
  ipHash: text("ip_hash"),
  userAgent: text("user_agent"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  ghlNoteId: text("ghl_note_id"),
  ghlSyncStatus: text("ghl_sync_status").notNull().default("pending"),
  ghlSyncedAt: timestamp("ghl_synced_at"),
  ghlSyncError: text("ghl_sync_error"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  liveCreatedAtIdx: index("hub_access_events_live_id_created_at_idx").on(table.liveId, table.createdAt),
  registrationIdIdx: index("hub_access_events_registration_id_idx").on(table.registrationId),
  participantIdIdx: index("hub_access_events_participant_id_idx").on(table.participantId),
}));

export type HubLive = typeof hubLives.$inferSelect;
export type InsertHubLive = typeof hubLives.$inferInsert;
export type HubParticipant = typeof hubParticipants.$inferSelect;
export type InsertHubParticipant = typeof hubParticipants.$inferInsert;
export type HubRegistration = typeof hubRegistrations.$inferSelect;
export type InsertHubRegistration = typeof hubRegistrations.$inferInsert;
export type HubAccessEvent = typeof hubAccessEvents.$inferSelect;
export type InsertHubAccessEvent = typeof hubAccessEvents.$inferInsert;

export type HubLiveStatus = z.infer<typeof hubLiveStatusSchema>;
export type HubRegistrationStatus = z.infer<typeof hubRegistrationStatusSchema>;
export type HubAccessEventType = z.infer<typeof hubAccessEventTypeSchema>;
export type HubAccessOutcome = z.infer<typeof hubAccessOutcomeSchema>;
export type HubIdentityMatch = z.infer<typeof hubIdentityMatchSchema>;

export const insertHubLiveSchema = z.object({
  slug: z.string().min(1).max(120),
  title: z.string().min(1).max(200),
  description: z.string().nullable().optional(),
  hostName: z.string().default("Skale Club"),
  timezone: z.string().default("America/New_York"),
  startsAt: z.union([z.string(), z.date()]).transform((value) => value instanceof Date ? value : new Date(value)),
  endsAt: nullableDateInputSchema,
  registrationOpensAt: nullableDateInputSchema,
  registrationClosesAt: nullableDateInputSchema,
  streamUrl: z.string().nullable().optional(),
  replayUrl: z.string().nullable().optional(),
  status: hubLiveStatusSchema.default("draft"),
  capacity: z.number().int().nullable().optional(),
});

export const selectHubLiveSchema = z.object({
  id: z.number().int(),
  slug: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  hostName: z.string(),
  timezone: z.string(),
  startsAt: z.date(),
  endsAt: z.date().nullable(),
  registrationOpensAt: z.date().nullable(),
  registrationClosesAt: z.date().nullable(),
  streamUrl: z.string().nullable(),
  replayUrl: z.string().nullable(),
  status: hubLiveStatusSchema,
  capacity: z.number().int().nullable(),
  createdAt: z.date().nullable(),
  updatedAt: z.date().nullable(),
});

const upsertHubParticipantBaseSchema = z.object({
  fullName: z.string().min(1).max(200),
  phoneRaw: z.string().nullable().optional(),
  emailRaw: z.string().nullable().optional(),
  source: z.string().default("hub"),
  notes: z.string().nullable().optional(),
});

export const upsertHubParticipantSchema = upsertHubParticipantBaseSchema.transform((value, ctx) => {
  const phoneNormalized = normalizeHubPhone(value.phoneRaw);
  const emailNormalized = normalizeHubEmail(value.emailRaw);

  if (!phoneNormalized && !emailNormalized) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Either phone or email is required",
    });
    return z.NEVER;
  }

  return {
    ...value,
    phoneNormalized,
    emailNormalized,
  };
});

export const selectHubParticipantSchema = z.object({
  id: z.number().int(),
  fullName: z.string(),
  phoneRaw: z.string().nullable(),
  phoneNormalized: z.string().nullable(),
  emailRaw: z.string().nullable(),
  emailNormalized: z.string().nullable(),
  source: z.string(),
  notes: z.string().nullable(),
  ghlContactId: z.string().nullable(),
  ghlSyncStatus: z.string(),
  ghlLastSyncedAt: z.date().nullable(),
  ghlSyncError: z.string().nullable(),
  createdAt: z.date().nullable(),
  updatedAt: z.date().nullable(),
});

const hubParticipantIdentityLookupBaseSchema = z.object({
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
});

export const hubParticipantIdentityLookupSchema = hubParticipantIdentityLookupBaseSchema.transform((value, ctx) => {
  const phoneNormalized = normalizeHubPhone(value.phone);
  const emailNormalized = normalizeHubEmail(value.email);

  if (!phoneNormalized && !emailNormalized) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Phone or email is required",
    });
    return z.NEVER;
  }

  return {
    phone: value.phone ?? null,
    email: value.email ?? null,
    phoneNormalized,
    emailNormalized,
  };
});

export const upsertHubRegistrationSchema = z.object({
  liveId: z.number().int(),
  participantId: z.number().int(),
  status: hubRegistrationStatusSchema.default("registered"),
  source: z.string().default("hub-form"),
  notes: z.string().nullable().optional(),
  registeredAt: dateInputSchema,
  cancelledAt: nullableDateInputSchema,
  attendedAt: nullableDateInputSchema,
  lastAccessAt: nullableDateInputSchema,
});

export const selectHubRegistrationSchema = z.object({
  id: z.number().int(),
  liveId: z.number().int(),
  participantId: z.number().int(),
  status: hubRegistrationStatusSchema,
  source: z.string(),
  notes: z.string().nullable(),
  registeredAt: z.date().nullable(),
  cancelledAt: z.date().nullable(),
  attendedAt: z.date().nullable(),
  lastAccessAt: z.date().nullable(),
  createdAt: z.date().nullable(),
  updatedAt: z.date().nullable(),
});

export const insertHubAccessEventSchema = z.object({
  liveId: z.number().int(),
  participantId: z.number().int().nullable().optional(),
  registrationId: z.number().int().nullable().optional(),
  eventType: hubAccessEventTypeSchema,
  outcome: hubAccessOutcomeSchema,
  matchedBy: hubIdentityMatchSchema.default("none"),
  phoneRaw: z.string().nullable().optional(),
  phoneNormalized: z.string().nullable().optional(),
  emailRaw: z.string().nullable().optional(),
  emailNormalized: z.string().nullable().optional(),
  ipHash: z.string().nullable().optional(),
  userAgent: z.string().nullable().optional(),
  metadata: z.record(z.unknown()).default({}),
  createdAt: dateInputSchema,
});

export const selectHubAccessEventSchema = z.object({
  id: z.number().int(),
  liveId: z.number().int(),
  participantId: z.number().int().nullable(),
  registrationId: z.number().int().nullable(),
  eventType: hubAccessEventTypeSchema,
  outcome: hubAccessOutcomeSchema,
  matchedBy: hubIdentityMatchSchema,
  phoneRaw: z.string().nullable(),
  phoneNormalized: z.string().nullable(),
  emailRaw: z.string().nullable(),
  emailNormalized: z.string().nullable(),
  ipHash: z.string().nullable(),
  userAgent: z.string().nullable(),
  metadata: z.record(z.unknown()),
  ghlNoteId: z.string().nullable(),
  ghlSyncStatus: z.string(),
  ghlSyncedAt: z.date().nullable(),
  ghlSyncError: z.string().nullable(),
  createdAt: z.date(),
});

const optionalTrimmedNullableString = z.string().optional().nullable().transform((value) => {
  if (value == null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
});

export const hubRegisterRequestSchema = z.object({
  name: z.string().trim().min(1).max(200),
  phone: optionalTrimmedNullableString,
  email: optionalTrimmedNullableString,
}).superRefine((value, ctx) => {
  if (!normalizeHubPhone(value.phone) && !normalizeHubEmail(value.email)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Either phone or email is required",
      path: ["phone"],
    });
  }
});

export const hubAccessRequestSchema = z.object({
  participantId: z.number().int().positive().nullable().optional(),
  phone: optionalTrimmedNullableString,
  email: optionalTrimmedNullableString,
  eventType: z.enum(["join", "replay"]).default("join"),
  metadata: z.record(z.unknown()).default({}),
}).superRefine((value, ctx) => {
  if (!value.participantId && !normalizeHubPhone(value.phone) && !normalizeHubEmail(value.email)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "participantId, phone, or email is required",
      path: ["participantId"],
    });
  }
});

export type UpsertHubParticipantInput = z.infer<typeof upsertHubParticipantSchema>;
export type HubParticipantIdentityLookup = z.infer<typeof hubParticipantIdentityLookupSchema>;
export type UpsertHubRegistrationInput = z.infer<typeof upsertHubRegistrationSchema>;

export type HubDashboardSummary = {
  totalLives: number;
  totalParticipants: number;
  totalRegistrations: number;
  grantedAccessCount: number;
  deniedAccessCount: number;
  lastAccessAt: Date | null;
  activeLiveId: number | null;
  liveSummaries: HubLiveSummary[];
};

export type HubParticipantHistory = Pick<
  HubParticipant,
  | "id"
  | "fullName"
  | "phoneRaw"
  | "phoneNormalized"
  | "emailRaw"
  | "emailNormalized"
  | "source"
  | "ghlContactId"
  | "ghlSyncStatus"
  | "ghlLastSyncedAt"
  | "ghlSyncError"
  | "createdAt"
  | "updatedAt"
> & {
  registrationCount: number;
  livesAccessedCount: number;
  grantedAccessCount: number;
  deniedAccessCount: number;
  lastRegisteredAt: Date | null;
  lastAccessAt: Date | null;
  lastLive: Pick<HubLive, "id" | "slug" | "title" | "startsAt" | "status"> | null;
};

export type HubLiveSummary = HubLive & {
  registrationCount: number;
  grantedAccessCount: number;
  deniedAccessCount: number;
  uniqueParticipantCount: number;
  lastAccessAt: Date | null;
};

export type HubRegistrationSummary = HubRegistration & {
  participant: Pick<
    HubParticipant,
    "id" | "fullName" | "phoneRaw" | "phoneNormalized" | "emailRaw" | "emailNormalized"
  >;
  grantedAccessCount: number;
  deniedAccessCount: number;
  lastAccessAt: Date | null;
};
