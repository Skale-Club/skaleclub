import { pgTable, uuid, text, serial, integer, jsonb, timestamp } from "drizzle-orm/pg-core";
// slug column changed from uuid → text so human-readable slugs (e.g. "acme-corp") can be stored
import { z } from "zod";

// SlideBlock: flat schema with .optional() fields — all 8 layout variants share the same bilingual field names.
// A discriminated union on "layout" is valid but unnecessary at this stage; Phase 18 can refine.
export const slideBlockSchema = z.object({
  layout: z.enum([
    "cover",
    "section-break",
    "title-body",
    "bullets",
    "stats",
    "two-column",
    "image-focus",
    "closing",
  ]),
  heading:    z.string().optional(),
  headingPt:  z.string().optional(),
  body:       z.string().optional(),
  bodyPt:     z.string().optional(),
  bullets:    z.array(z.string()).optional(),
  bulletsPt:  z.array(z.string()).optional(),
  stats: z.array(
    z.object({
      label:    z.string(),
      value:    z.string(),
      labelPt:  z.string().optional(),
    })
  ).optional(),
});

export type SlideBlock = z.infer<typeof slideBlockSchema>;
export type SlideLayout = SlideBlock["layout"];

// presentations table (PRES-01)
// UUID PK, text slug (generated from title in route layer)
// guidelinesSnapshot is TEXT not JSONB — content is markdown, not structured JSON
export const presentations = pgTable("presentations", {
  id:                  uuid("id").primaryKey().defaultRandom(),
  slug:                text("slug").notNull().unique(),
  title:               text("title").notNull(),
  slides:              jsonb("slides").$type<SlideBlock[]>().notNull().default([]),
  guidelinesSnapshot:  text("guidelines_snapshot"),
  thumbnailUrl:        text("thumbnail_url"),
  thumbnailSignature:  text("thumbnail_signature"),
  version:             integer("version").notNull().default(1),
  createdAt:           timestamp("created_at").defaultNow(),
  updatedAt:           timestamp("updated_at").defaultNow().$onUpdate(() => new Date()),
});

// presentation_views event-log table (PRES-02)
// presentationId is uuid() FK — matches UUID PK on presentations (NOT integer like estimate_views)
export const presentationViews = pgTable("presentation_views", {
  id:              serial("id").primaryKey(),
  presentationId:  uuid("presentation_id")
                     .references(() => presentations.id, { onDelete: "cascade" })
                     .notNull(),
  viewedAt:        timestamp("viewed_at").defaultNow().notNull(),
  ipHash:          text("ip_hash"),
});

// brand_guidelines singleton table (PRES-03)
// Serial PK — one row per tenant; upsert pattern used in Phase 17
export const brandGuidelines = pgTable("brand_guidelines", {
  id:        serial("id").primaryKey(),
  content:   text("content").notNull().default(""),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()),
});

// TypeScript types derived from Drizzle table definitions
export type Presentation        = typeof presentations.$inferSelect;
export type InsertPresentation  = typeof presentations.$inferInsert;
export type PresentationView    = typeof presentationViews.$inferSelect;
export type BrandGuidelines     = typeof brandGuidelines.$inferSelect;

// PresentationWithStats — list endpoint includes derived counts (Phase 16 uses these)
export type PresentationWithStats = Presentation & {
  slideCount: number;
  viewCount:  number;
};

// Manual Zod insert schema (drizzle-zod generates unknown for JSONB — use manual per project convention)
export const insertPresentationSchema = z.object({
  title:  z.string().min(1),
  slug:   z.string().min(1).max(120).optional(),
  slides: z.array(slideBlockSchema).default([]),
  thumbnailUrl: z.string().nullable().optional(),
  thumbnailSignature: z.string().nullable().optional(),
});

// Select schema — used for API response validation and Phase 18 DB write gate
export const selectPresentationSchema = z.object({
  id:                 z.string().uuid(),
  slug:               z.string(),
  title:              z.string(),
  slides:             z.array(slideBlockSchema),
  guidelinesSnapshot: z.string().nullable(),
  thumbnailUrl:       z.string().nullable(),
  thumbnailSignature: z.string().nullable(),
  version:            z.number().int(),
  createdAt:          z.date().nullable(),
  updatedAt:          z.date().nullable(),
});
