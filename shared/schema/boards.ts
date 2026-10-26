import { pgTable, uuid, text, jsonb, integer, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod";

// Boards: one editor and one document for both a mind map (a tree of `mind`
// nodes laid out automatically, linked by `tree` edges) and a free canvas
// (sticky notes, shapes, text, frames, images, connectors, pen strokes).
// See plan/boards-mindmap-canvas-plan.md.

export const BOARD_LIMITS = {
  nodes: 5_000,
  edges: 10_000,
  strokes: 2_000,
  strokePoints: 2_000,
  nodeText: 2_000,
  title: 200,
} as const;

export const BOARD_KINDS = ["mindmap", "canvas"] as const;
export type BoardKind = (typeof BOARD_KINDS)[number];

export const BOARD_VISIBILITIES = ["private", "link"] as const;
export type BoardVisibility = (typeof BOARD_VISIBILITIES)[number];

export const MIND_SIDES = ["left", "right", "auto"] as const;
export const MIND_LAYOUTS = ["balanced", "right", "vertical"] as const;
export const SHAPE_KINDS = ["rect", "rounded", "ellipse", "diamond", "triangle"] as const;
export const EDGE_STYLES = ["curve", "straight", "step"] as const;
export const BOARD_PALETTES = ["brand", "pastel", "mono"] as const;
export const BOARD_BACKGROUNDS = ["dots", "grid", "plain"] as const;

const id = z.string().min(1).max(64);
const color = z.string().max(32);
const point = z.object({ x: z.number().finite(), y: z.number().finite() });
const size = z.object({ w: z.number().finite().positive(), h: z.number().finite().positive() });
// User-facing URLs (links, images) open in other people's browsers: http(s) only,
// so javascript:, data: and vbscript: never reach the document.
export const safeUrl = z
  .string()
  .url()
  .max(2_000)
  .refine((u) => /^https?:\/\//i.test(u), { message: "Only http(s) URLs are allowed" });
const nodeText = z.string().max(BOARD_LIMITS.nodeText);

export const mindNodeDataSchema = z.object({
  type: z.literal("mind"),
  text: nodeText,
  color: color.optional(),
  collapsed: z.boolean().optional(),
  icon: z.string().max(16).optional(),
  note: z.string().max(5_000).optional(),
  link: safeUrl.optional(),
  task: z.object({ done: z.boolean() }).optional(),
  imageUrl: safeUrl.optional(),
  // Which side of the root this first-level branch hangs on; descendants follow.
  side: z.enum(MIND_SIDES).optional(),
  // Only meaningful on a root: how its tree is laid out.
  layout: z.enum(MIND_LAYOUTS).optional(),
});

export const stickyNodeDataSchema = z.object({
  type: z.literal("sticky"),
  text: nodeText,
  color: color.optional(),
});

export const shapeNodeDataSchema = z.object({
  type: z.literal("shape"),
  shape: z.enum(SHAPE_KINDS),
  text: nodeText.optional(),
  fill: color.optional(),
  stroke: color.optional(),
});

export const textNodeDataSchema = z.object({
  type: z.literal("text"),
  text: nodeText,
  fontSize: z.number().int().min(8).max(200).optional(),
  align: z.enum(["left", "center", "right"]).optional(),
  color: color.optional(),
});

export const frameNodeDataSchema = z.object({
  type: z.literal("frame"),
  title: z.string().max(200).optional(),
  color: color.optional(),
});

export const imageNodeDataSchema = z.object({
  type: z.literal("image"),
  url: safeUrl,
  alt: z.string().max(500).optional(),
  naturalW: z.number().int().positive().optional(),
  naturalH: z.number().int().positive().optional(),
});

export const boardNodeDataSchema = z.discriminatedUnion("type", [
  mindNodeDataSchema,
  stickyNodeDataSchema,
  shapeNodeDataSchema,
  textNodeDataSchema,
  frameNodeDataSchema,
  imageNodeDataSchema,
]);

export const boardNodeSchema = z.object({
  id,
  position: point,
  size: size.optional(),
  // A frame that contains this node (position is then relative to the frame).
  parentId: id.optional(),
  zIndex: z.number().int().optional(),
  locked: z.boolean().optional(),
  data: boardNodeDataSchema,
});

export const boardEdgeSchema = z.object({
  id,
  source: id,
  target: id,
  // `tree` edges define the mind-map hierarchy; `connector` edges are free.
  kind: z.enum(["tree", "connector"]),
  data: z
    .object({
      label: z.string().max(500).optional(),
      color: color.optional(),
      style: z.enum(EDGE_STYLES).optional(),
      arrowStart: z.boolean().optional(),
      arrowEnd: z.boolean().optional(),
      dashed: z.boolean().optional(),
    })
    .optional(),
});

export const boardStrokeSchema = z.object({
  id,
  // Flat [x0, y0, p0, x1, y1, p1, ...] with pressure; a third of the length is the point count.
  points: z.array(z.number().finite()).max(BOARD_LIMITS.strokePoints * 3),
  color: color.optional(),
  size: z.number().min(1).max(64).optional(),
});

export const boardThemeSchema = z.object({
  palette: z.enum(BOARD_PALETTES).default("brand"),
  background: z.enum(BOARD_BACKGROUNDS).default("dots"),
  dark: z.boolean().optional(),
});

export const boardDocumentSchema = z.object({
  schemaVersion: z.literal(1).default(1),
  nodes: z.array(boardNodeSchema).max(BOARD_LIMITS.nodes).default([]),
  edges: z.array(boardEdgeSchema).max(BOARD_LIMITS.edges).default([]),
  strokes: z.array(boardStrokeSchema).max(BOARD_LIMITS.strokes).default([]),
  viewport: z.object({ x: z.number().finite(), y: z.number().finite(), zoom: z.number().finite().positive() }).optional(),
  theme: boardThemeSchema.default({ palette: "brand", background: "dots" }),
});

export type MindNodeData = z.infer<typeof mindNodeDataSchema>;
export type StickyNodeData = z.infer<typeof stickyNodeDataSchema>;
export type ShapeNodeData = z.infer<typeof shapeNodeDataSchema>;
export type TextNodeData = z.infer<typeof textNodeDataSchema>;
export type FrameNodeData = z.infer<typeof frameNodeDataSchema>;
export type ImageNodeData = z.infer<typeof imageNodeDataSchema>;
export type BoardNodeData = z.infer<typeof boardNodeDataSchema>;
export type BoardNode = z.infer<typeof boardNodeSchema>;
export type BoardEdge = z.infer<typeof boardEdgeSchema>;
export type BoardStroke = z.infer<typeof boardStrokeSchema>;
export type BoardTheme = z.infer<typeof boardThemeSchema>;
export type BoardDocument = z.infer<typeof boardDocumentSchema>;

export const EMPTY_BOARD_DOCUMENT: BoardDocument = {
  schemaVersion: 1,
  nodes: [],
  edges: [],
  strokes: [],
  theme: { palette: "brand", background: "dots" },
};

export const boards = pgTable("boards", {
  id:           uuid("id").primaryKey().defaultRandom(),
  slug:         text("slug").notNull().unique(),
  title:        text("title").notNull(),
  kind:         text("kind").$type<BoardKind>().notNull().default("mindmap"),
  document:     jsonb("document").$type<BoardDocument>().notNull().default(EMPTY_BOARD_DOCUMENT),
  // 16:9 card preview rendered by the editor on save (data URL); null when empty.
  thumbnailUrl: text("thumbnail_url"),
  // 'link': anyone with /b/:slug can view. 'private': only admins, in the editor.
  visibility:   text("visibility").$type<BoardVisibility>().notNull().default("private"),
  // Bumped on every save; a save names the version it started from so one
  // made in another tab or device is not silently overwritten.
  version:      integer("version").notNull().default(1),
  createdBy:    text("created_by"),
  createdAt:    timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt:    timestamp("updated_at", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()),
});

export type Board       = typeof boards.$inferSelect;
export type InsertBoard = typeof boards.$inferInsert;

// List rows leave the document out.
export type BoardSummary = Omit<Board, "document"> & { nodeCount: number };

export interface BoardPage {
  data: BoardSummary[];
  total: number;
}

// What /api/boards/slug/:slug returns to anyone (visibility 'link' only).
export interface PublicBoard {
  id: string;
  slug: string;
  title: string;
  kind: BoardKind;
  document: BoardDocument;
  updatedAt: string | null;
}

export const createBoardSchema = z.object({
  title: z.string().trim().min(1).max(BOARD_LIMITS.title),
  kind: z.enum(BOARD_KINDS).default("mindmap"),
  // Optional starting content (a template picked in the create dialog).
  document: boardDocumentSchema.optional(),
});

// Card preview data URL. JPEG is the client's fallback when the PNG is too big.
export const BOARD_THUMBNAIL_MAX_CHARS = 1_500_000;
export const boardThumbnailSchema = z
  .string()
  .regex(/^data:image\/(webp|png|jpeg);base64,[A-Za-z0-9+/=]+$/)
  .max(BOARD_THUMBNAIL_MAX_CHARS);

export const updateBoardSchema = z.object({
  title: z.string().trim().min(1).max(BOARD_LIMITS.title).optional(),
  slug: z.string().min(1).max(120).optional(),
  kind: z.enum(BOARD_KINDS).optional(),
  document: boardDocumentSchema.optional(),
  visibility: z.enum(BOARD_VISIBILITIES).optional(),
  thumbnailUrl: boardThumbnailSchema.nullable().optional(),
  // The version the editor loaded. Omitted to overwrite whatever is stored.
  baseVersion: z.number().int().positive().optional(),
});
