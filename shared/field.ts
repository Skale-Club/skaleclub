import { z } from "zod";
import {
  insertSalesAccountContactSchema,
  insertSalesAccountLocationSchema,
  insertSalesAccountSchema,
  insertSalesOpportunitySchema,
  insertSalesTaskSchema,
  insertSalesVisitNoteSchema,
} from "./schema.js";

export const fieldCheckInSchema = z.object({
  accountId: z.number().int().positive(),
  locationId: z.number().int().positive().optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  gpsAccuracyMeters: z.number().int().nonnegative().optional(),
  manualOverrideReason: z.string().max(500).optional(),
});

export const fieldCheckOutSchema = z.object({
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});

export const fieldVisitNoteUpsertSchema = insertSalesVisitNoteSchema.pick({
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

export const fieldAccountCreateSchema = insertSalesAccountSchema.extend({
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

export const fieldAccountUpdateSchema = fieldAccountCreateSchema.partial();

export const fieldAccountContactCreateSchema = insertSalesAccountContactSchema.pick({
  name: true,
  jobTitle: true,
  email: true,
  phone: true,
  isPrimary: true,
});

export const fieldOpportunityCreateSchema = insertSalesOpportunitySchema.pick({
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

export const fieldOpportunityUpdateSchema = insertSalesOpportunitySchema.pick({
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

export const fieldTaskCreateSchema = insertSalesTaskSchema.pick({
  accountId: true,
  visitId: true,
  opportunityId: true,
  type: true,
  title: true,
  description: true,
  dueAt: true,
});

export const fieldTaskUpdateSchema = insertSalesTaskSchema.pick({
  title: true,
  description: true,
  dueAt: true,
  status: true,
}).partial();

export type FieldCheckInInput = z.infer<typeof fieldCheckInSchema>;
export type FieldCheckOutInput = z.infer<typeof fieldCheckOutSchema>;
export type FieldVisitNoteUpsertInput = z.infer<typeof fieldVisitNoteUpsertSchema>;
export type FieldAccountCreateInput = z.infer<typeof fieldAccountCreateSchema>;
export type FieldAccountUpdateInput = z.infer<typeof fieldAccountUpdateSchema>;
export type FieldAccountContactCreateInput = z.infer<typeof fieldAccountContactCreateSchema>;
export type FieldOpportunityCreateInput = z.infer<typeof fieldOpportunityCreateSchema>;
export type FieldOpportunityUpdateInput = z.infer<typeof fieldOpportunityUpdateSchema>;
export type FieldTaskCreateInput = z.infer<typeof fieldTaskCreateSchema>;
export type FieldTaskUpdateInput = z.infer<typeof fieldTaskUpdateSchema>;
