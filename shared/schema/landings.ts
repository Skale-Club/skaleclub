// Phase 43 — Landing Page System
// A managed landing page addressable at a root slug (e.g. /grupo, /websites).
// Sections live as a JSONB array on the row — no separate join table.
// Per-type props validation is enforced at render time (sectionRegistry);
// at the route layer v1 accepts any object as `props`.

import {
  pgTable,
  uuid,
  text,
  jsonb,
  boolean,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { z } from "zod";

// Permissive section schema — per-type validation runs in the client renderer.
// The shape is fixed: a string `type` (component key) + an unstructured `props` bag.
export const landingSectionSchema = z.object({
  type: z.string().min(1).max(80),
  props: z.record(z.unknown()).default({}),
});
export type LandingSection = z.infer<typeof landingSectionSchema>;

// Slug pattern mirrors forms.ts:231 — lowercase, alphanumeric, single hyphens between segments.
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// landing_pages table
export const landingPages = pgTable("landing_pages", {
  id:        uuid("id").primaryKey().defaultRandom(),
  slug:      text("slug").notNull().unique(),
  name:      text("name").notNull(),
  sections:  jsonb("sections").$type<LandingSection[]>().notNull().default([]),
  isActive:  boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
  slugIdx:     uniqueIndex("landing_pages_slug_idx").on(table.slug),
  isActiveIdx: index("landing_pages_is_active_idx").on(table.isActive),
}));

// Insert/update Zod schemas — manual (not via drizzle-zod) per project convention
// (matches hub.ts:150-164 and presentations.ts:101-107).
export const insertLandingPageSchema = z.object({
  slug:     z.string().min(1).max(80).regex(slugPattern, {
    message: "Slug must be lowercase alphanumeric with single hyphens between segments",
  }),
  name:     z.string().min(1).max(200),
  sections: z.array(landingSectionSchema).default([]),
  isActive: z.boolean().default(true),
});

export const updateLandingPageSchema = insertLandingPageSchema.partial();

// TypeScript types derived from Drizzle table + Zod
export type LandingPage              = typeof landingPages.$inferSelect;
export type InsertLandingPage        = typeof landingPages.$inferInsert;
export type InsertLandingPageInput   = z.infer<typeof insertLandingPageSchema>;
export type UpdateLandingPageInput   = z.infer<typeof updateLandingPageSchema>;
