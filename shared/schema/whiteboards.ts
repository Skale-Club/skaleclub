import { pgTable, uuid, text, jsonb, integer, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod";

// The scene is stored exactly as the Excalidraw editor serializes it. Elements
// and files are opaque to the server: only the editor reads them.
export const whiteboardSceneSchema = z.object({
  elements: z.array(z.record(z.unknown())).max(20_000).default([]),
  appState: z
    .object({
      viewBackgroundColor: z.string().max(64).optional(),
      gridSize: z.number().nullable().optional(),
    })
    .passthrough()
    .optional(),
  files: z.record(z.record(z.unknown())).optional(),
});

export type WhiteboardScene = z.infer<typeof whiteboardSceneSchema>;

export const EMPTY_WHITEBOARD_SCENE: WhiteboardScene = { elements: [], appState: {}, files: {} };

// whiteboards: drawings made for YouTube videos. Every saved board is public
// at /w/:slug; only admins can create or change one.
export const whiteboards = pgTable("whiteboards", {
  id:        uuid("id").primaryKey().defaultRandom(),
  slug:      text("slug").notNull().unique(),
  title:     text("title").notNull(),
  scene:     jsonb("scene").$type<WhiteboardScene>().notNull().default(EMPTY_WHITEBOARD_SCENE),
  // 16:9 card preview rendered by the editor on save (data URL); null when empty.
  thumbnailUrl: text("thumbnail_url"),
  // Bumped on every save; a save names the version it started from so one
  // made in another tab or device is not silently overwritten.
  version:   integer("version").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()),
});

export type Whiteboard       = typeof whiteboards.$inferSelect;
export type InsertWhiteboard = typeof whiteboards.$inferInsert;

// List rows leave the scene out (it can carry embedded images).
export type WhiteboardSummary = Omit<Whiteboard, "scene"> & { elementCount: number };

export interface WhiteboardPage {
  data: WhiteboardSummary[];
  total: number;
}

export const insertWhiteboardSchema = z.object({
  title: z.string().trim().min(1).max(200),
  slug:  z.string().min(1).max(120).optional(),
  scene: whiteboardSceneSchema.optional(),
  thumbnailUrl: z
    .string()
    .regex(/^data:image\/(webp|png);base64,[A-Za-z0-9+/=]+$/)
    .max(1_000_000)
    .nullable()
    .optional(),
  // The version the editor loaded. Omitted to overwrite whatever is stored.
  baseVersion: z.number().int().positive().optional(),
});
