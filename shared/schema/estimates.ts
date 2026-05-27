import { pgTable, text, serial, timestamp, jsonb, integer } from "drizzle-orm/pg-core";
import { z } from "zod";

// Service item Zod schemas (defined before the table for reference)

export const catalogServiceItemSchema = z.object({
  type: z.literal("catalog"),
  sourceId: z.number().int().positive(),
  title: z.string().min(1),
  titlePt: z.string().optional(),
  subtitle: z.string().max(100).optional(),
  subtitlePt: z.string().max(100).optional(),
  description: z.string().min(1),
  descriptionPt: z.string().optional(),
  price: z.string().min(1),
  pricePt: z.string().optional(),
  features: z.array(z.string()).default([]),
  featuresPt: z.array(z.string()).optional(),
  order: z.number().int().min(0),
  section: z.string().max(50).optional(),
  sectionPt: z.string().max(50).optional(),
});

export const customServiceItemSchema = z.object({
  type: z.literal("custom"),
  title: z.string().min(1),
  titlePt: z.string().optional(),
  subtitle: z.string().max(100).optional(),
  subtitlePt: z.string().max(100).optional(),
  description: z.string().min(1),
  descriptionPt: z.string().optional(),
  price: z.string().min(1),
  pricePt: z.string().optional(),
  features: z.array(z.string()).default([]),
  featuresPt: z.array(z.string()).optional(),
  order: z.number().int().min(0),
  section: z.string().max(50).optional(),
  sectionPt: z.string().max(50).optional(),
});

export const estimateServiceItemSchema = z.discriminatedUnion("type", [
  catalogServiceItemSchema,
  customServiceItemSchema,
]);

export type EstimateServiceItem = z.infer<typeof estimateServiceItemSchema>;
export type CatalogServiceItem = z.infer<typeof catalogServiceItemSchema>;
export type CustomServiceItem = z.infer<typeof customServiceItemSchema>;

// Estimates table
export const estimates = pgTable("estimates", {
  id: serial("id").primaryKey(),
  clientName: text("client_name").notNull(),
  companyName: text("company_name"),
  contactName: text("contact_name"),
  slug: text("slug").notNull().unique(),
  note: text("note"),
  services: jsonb("services").$type<EstimateServiceItem[]>().notNull().default([]),
  thumbnailUrl: text("thumbnail_url"),
  thumbnailSignature: text("thumbnail_signature"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()),
  accessCode: text("access_code"),
});

export const estimateViews = pgTable("estimate_views", {
  id: serial("id").primaryKey(),
  estimateId: integer("estimate_id").references(() => estimates.id, { onDelete: "cascade" }).notNull(),
  viewedAt: timestamp("viewed_at").defaultNow().notNull(),
  ipAddress: text("ip_address"),
});

export type EstimateView = typeof estimateViews.$inferSelect;

// Insert schema (manual Zod, following cms.ts pattern)
export const insertEstimateSchema = z.object({
  clientName: z.string().min(1),
  companyName: z.string().nullable().optional(),
  contactName: z.string().nullable().optional(),
  slug: z.string().min(1),
  note: z.string().nullable().optional(),
  services: z.array(estimateServiceItemSchema).default([]),
  accessCode: z.string().nullable().optional(),
  thumbnailUrl: z.string().nullable().optional(),
  thumbnailSignature: z.string().nullable().optional(),
});

// estimate_guidelines singleton — mirrors brand_guidelines from presentations.
// Holds the playbook MCP tools fetch BEFORE building or editing any estimate.
export const estimateGuidelines = pgTable("estimate_guidelines", {
  id:        serial("id").primaryKey(),
  content:   text("content").notNull().default(""),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()),
});

export type EstimateGuidelines = typeof estimateGuidelines.$inferSelect;

export const upsertEstimateGuidelinesSchema = z.object({
  content: z.string().max(50000),
});

// TypeScript types
export type Estimate = typeof estimates.$inferSelect;
export type InsertEstimate = typeof estimates.$inferInsert;
export type EstimateWithStats = Estimate & {
  viewCount: number;
  lastViewedAt: Date | null;
};
