// Phase 43 — Page System
// A managed page addressable at a root slug (e.g. /grupo, /websites).
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
export const pageSectionSchema = z.object({
  type: z.string().min(1).max(80),
  props: z.record(z.unknown()).default({}),
});
export type PageSection = z.infer<typeof pageSectionSchema>;

// Slug pattern mirrors forms.ts:231 — lowercase, alphanumeric, single hyphens between segments.
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// Language of a page. 'en' is the source language (t() keys); 'pt' is
// the translation. Drives the chrome language (DynamicPage calls setLanguage).
export const pageLanguages = ["en", "pt"] as const;
export type PageLanguage = (typeof pageLanguages)[number];

// pages table
export const pages = pgTable("pages", {
  id:        uuid("id").primaryKey().defaultRandom(),
  slug:      text("slug").notNull().unique(),
  name:      text("name").notNull(),
  sections:  jsonb("sections").$type<PageSection[]>().notNull().default([]),
  isActive:  boolean("is_active").notNull().default(true),
  // Per-page language ('en' | 'pt'). Default 'pt' keeps existing rows unchanged.
  language:  text("language").$type<PageLanguage>().notNull().default("pt"),
  // Slug of the same page in the other language — powers hreflang alternates.
  alternateSlug: text("alternate_slug"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
  slugIdx:     uniqueIndex("pages_slug_idx").on(table.slug),
  isActiveIdx: index("pages_is_active_idx").on(table.isActive),
}));

// Insert/update Zod schemas — manual (not via drizzle-zod) per project convention
// (matches hub.ts:150-164 and presentations.ts:101-107).
export const insertPageSchema = z.object({
  slug:     z.string().min(1).max(80).regex(slugPattern, {
    message: "Slug must be lowercase alphanumeric with single hyphens between segments",
  }),
  name:     z.string().min(1).max(200),
  sections: z.array(pageSectionSchema).default([]),
  isActive: z.boolean().default(true),
  language: z.enum(pageLanguages).default("pt"),
  alternateSlug: z.string().max(80).regex(slugPattern, {
    message: "Alternate slug must be lowercase alphanumeric with single hyphens between segments",
  }).nullable().optional(),
});

export const updatePageSchema = insertPageSchema.partial();

// TypeScript types derived from Drizzle table + Zod
export type Page              = typeof pages.$inferSelect;
export type InsertPage        = typeof pages.$inferInsert;
export type InsertPageInput   = z.infer<typeof insertPageSchema>;
export type UpdatePageInput   = z.infer<typeof updatePageSchema>;
