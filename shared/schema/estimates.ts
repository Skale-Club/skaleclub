import { pgTable, text, serial, timestamp, jsonb } from "drizzle-orm/pg-core";
import { z } from "zod";

// Service item Zod schemas (defined before the table for reference)

export const catalogServiceItemSchema = z.object({
  type: z.literal("catalog"),
  sourceId: z.number().int().positive(),
  title: z.string().min(1),
  description: z.string().min(1),
  price: z.string().min(1),
  features: z.array(z.string()).default([]),
  order: z.number().int().min(0),
});

export const customServiceItemSchema = z.object({
  type: z.literal("custom"),
  title: z.string().min(1),
  description: z.string().min(1),
  price: z.string().min(1),
  features: z.array(z.string()).default([]),
  order: z.number().int().min(0),
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
  slug: text("slug").notNull().unique(),
  note: text("note"),
  services: jsonb("services").$type<EstimateServiceItem[]>().notNull().default([]),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()),
});

// Insert schema (manual Zod, following cms.ts pattern)
export const insertEstimateSchema = z.object({
  clientName: z.string().min(1),
  slug: z.string().min(1),
  note: z.string().nullable().optional(),
  services: z.array(estimateServiceItemSchema).default([]),
});

// TypeScript types
export type Estimate = typeof estimates.$inferSelect;
export type InsertEstimate = typeof estimates.$inferInsert;
