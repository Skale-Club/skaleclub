import { pgTable, uuid, text, jsonb, timestamp } from "drizzle-orm/pg-core";
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
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()),
});

export type Whiteboard       = typeof whiteboards.$inferSelect;
export type InsertWhiteboard = typeof whiteboards.$inferInsert;

// List rows leave the scene out (it can carry embedded images).
export type WhiteboardSummary = Omit<Whiteboard, "scene"> & { elementCount: number };

export const insertWhiteboardSchema = z.object({
  title: z.string().trim().min(1).max(200),
  slug:  z.string().min(1).max(120).optional(),
  scene: whiteboardSceneSchema.optional(),
});
