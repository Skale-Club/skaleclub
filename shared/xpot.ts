import { z } from "zod";
import {
  insertSalesAccountContactSchema,
  insertSalesAccountLocationSchema,
  insertSalesAccountSchema,
  insertSalesOpportunitySchema,
  insertSalesTaskSchema,
  insertSalesVisitNoteSchema,
} from "./schema.js";

export const xpotCheckInSchema = z.object({
  accountId: z.number().int().positive(),
  locationId: z.number().int().positive().optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  gpsAccuracyMeters: z.number().int().nonnegative().nullable().optional(),
  manualOverrideReason: z.string().max(500).optional(),
});

export const xpotCheckOutSchema = z.object({
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});

export const xpotVisitNoteUpsertSchema = insertSalesVisitNoteSchema.pick({
  summary: true,
  outcome: true,
  sentiment: true,
  objections: true,
  competitorMentioned: true,
  nextStep: true,
  followUpRequired: true,
  audioUrl: true,
  audioDurationSeconds: true,
}).partial();

export const xpotAccountCreateSchema = insertSalesAccountSchema.extend({
  primaryLocation: insertSalesAccountLocationSchema.pick({
    label: true,
    addressLine1: true,
    addressLine2: true,
    city: true,
    state: true,
    postalCode: true,
    country: true,
    lat: true,
    lng: true,
    geofenceRadiusMeters: true,
    isPrimary: true,
  }).optional(),
});

export const xpotAccountUpdateSchema = xpotAccountCreateSchema.partial();

export const xpotAccountContactCreateSchema = insertSalesAccountContactSchema.pick({
  name: true,
  jobTitle: true,
  email: true,
  phone: true,
  isPrimary: true,
});

export const xpotOpportunityCreateSchema = insertSalesOpportunitySchema.pick({
  accountId: true,
  visitId: true,
  title: true,
  pipelineKey: true,
  stageKey: true,
  value: true,
  currency: true,
  closeDate: true,
  notes: true,
});

export const xpotOpportunityUpdateSchema = insertSalesOpportunitySchema.pick({
  title: true,
  pipelineKey: true,
  stageKey: true,
  value: true,
  currency: true,
  status: true,
  closeDate: true,
  lossReason: true,
  notes: true,
}).partial();

export const xpotTaskCreateSchema = insertSalesTaskSchema.pick({
  accountId: true,
  visitId: true,
  opportunityId: true,
  type: true,
  title: true,
  description: true,
  dueAt: true,
});

export const xpotTaskUpdateSchema = insertSalesTaskSchema.pick({
  title: true,
  description: true,
  dueAt: true,
  status: true,
}).partial();

export type XpotCheckInInput = z.infer<typeof xpotCheckInSchema>;
export type XpotCheckOutInput = z.infer<typeof xpotCheckOutSchema>;
export type XpotVisitNoteUpsertInput = z.infer<typeof xpotVisitNoteUpsertSchema>;
export type XpotAccountCreateInput = z.infer<typeof xpotAccountCreateSchema>;
export type XpotAccountUpdateInput = z.infer<typeof xpotAccountUpdateSchema>;
export type XpotAccountContactCreateInput = z.infer<typeof xpotAccountContactCreateSchema>;
export type XpotOpportunityCreateInput = z.infer<typeof xpotOpportunityCreateSchema>;
export type XpotOpportunityUpdateInput = z.infer<typeof xpotOpportunityUpdateSchema>;
export type XpotTaskCreateInput = z.infer<typeof xpotTaskCreateSchema>;
export type XpotTaskUpdateInput = z.infer<typeof xpotTaskUpdateSchema>;
