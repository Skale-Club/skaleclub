import type { Express } from "express";
import { storage } from "../storage.js";
import { randomSlugSuffix, slugifyTitle } from "../lib/slug.js";
import { createBoardSchema, updateBoardSchema, boardThumbnailSchema, EMPTY_BOARD_DOCUMENT, type PublicBoard } from "#shared/schema.js";
import { requireAdmin, sendError } from "./_shared.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// A missing or non-numeric value falls back to the default; the cap bounds a page.
function parseListParam(raw: unknown, fallback: number, min: number, max: number): number {
  const value = Number(raw);
  if (raw === undefined || !Number.isInteger(value)) return fallback;
  return Math.min(Math.max(value, min), max);
}

function slugify(value: string): string {
  return slugifyTitle(value, { fallback: "board", maxLength: 80 });
}

async function buildUniqueBoardSlug(title: string): Promise<string> {
  const base = slugify(title);
  for (let i = 0; i < 5; i++) {
    const candidate = `${base}-${randomSlugSuffix()}`;
    if (!await storage.getBoardBySlug(candidate)) return candidate;
  }
  return `${base}-${Date.now()}`;
}

export function registerBoardsRoutes(app: Express) {
  // Public read of a shared board at /b/:slug. Only boards set to 'link' are
  // visible; a private one is indistinguishable from a missing one. Registered
  // before /:id so "slug" is never taken for an id.
  app.get("/api/boards/slug/:slug", async (req, res) => {
    try {
      const board = await storage.getBoardBySlug(req.params.slug);
      if (!board || board.visibility !== "link") return res.status(404).json({ message: "Board not found" });
      const body: PublicBoard = {
        id: board.id,
        slug: board.slug,
        title: board.title,
        kind: board.kind,
        document: board.document,
        updatedAt: board.updatedAt ? new Date(board.updatedAt).toISOString() : null,
      };
      res.json(body);
    } catch (err) {
      sendError(res, err, "Failed to load board");
    }
  });

  app.get("/api/boards", requireAdmin, async (req, res) => {
    try {
      const search = typeof req.query.search === "string" ? req.query.search : undefined;
      const limit = parseListParam(req.query.limit, 24, 1, 100);
      const offset = parseListParam(req.query.offset, 0, 0, Number.MAX_SAFE_INTEGER);
      res.json(await storage.listBoards({ search, limit, offset }));
    } catch (err) {
      sendError(res, err, "Failed to load boards");
    }
  });

  app.get("/api/boards/:id", requireAdmin, async (req, res) => {
    if (!UUID_RE.test(req.params.id)) return res.status(400).json({ message: "Invalid board id" });
    try {
      const board = await storage.getBoard(req.params.id);
      if (!board) return res.status(404).json({ message: "Board not found" });
      res.json(board);
    } catch (err) {
      sendError(res, err, "Failed to load board");
    }
  });

  app.post("/api/boards", requireAdmin, async (req, res) => {
    try {
      const parsed = createBoardSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation error", errors: parsed.error.errors });
      }
      const slug = await buildUniqueBoardSlug(parsed.data.title);
      const userId = (req.session as { userId?: unknown } | undefined)?.userId;
      const board = await storage.createBoard({
        title: parsed.data.title,
        kind: parsed.data.kind,
        slug,
        document: parsed.data.document ?? EMPTY_BOARD_DOCUMENT,
        createdBy: typeof userId === "string" ? userId : null,
      });
      res.status(201).json(board);
    } catch (err) {
      sendError(res, err, "Failed to create board");
    }
  });

  // Saves title, slug, kind, visibility, thumbnail and/or document. A document
  // can carry a lot of nodes, so this path gets the large JSON limit
  // (LARGE_BODY_RE in server/lib/bodyLimits.ts).
  app.put("/api/boards/:id", requireAdmin, async (req, res) => {
    if (!UUID_RE.test(req.params.id)) return res.status(400).json({ message: "Invalid board id" });
    try {
      // A bad thumbnail alone must not lose the save: it is only a card
      // preview, so it is dropped and everything else is stored.
      const parsed = updateBoardSchema.omit({ thumbnailUrl: true }).safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation error", errors: parsed.error.errors });
      }
      const rawThumbnail = (req.body as { thumbnailUrl?: unknown } | null)?.thumbnailUrl;
      const thumbnail = rawThumbnail === null ? ({ success: true, data: null } as const) : boardThumbnailSchema.safeParse(rawThumbnail);
      const existing = await storage.getBoard(req.params.id);
      if (!existing) return res.status(404).json({ message: "Board not found" });
      const { baseVersion, ...updateData }: Omit<typeof parsed.data, "baseVersion"> & { baseVersion?: number; thumbnailUrl?: string | null } = parsed.data;
      if (rawThumbnail !== undefined && thumbnail.success) updateData.thumbnailUrl = thumbnail.data;
      if (typeof updateData.slug === "string") {
        const slug = slugify(updateData.slug);
        const owner = await storage.getBoardBySlug(slug);
        if (owner && owner.id !== existing.id) {
          return res.status(409).json({ message: "Slug already in use", code: "slug_taken" });
        }
        updateData.slug = slug;
      }
      const updated = await storage.updateBoard(existing.id, updateData, baseVersion);
      if (!updated) {
        // Saved from another tab or device since this editor loaded the board.
        const current = await storage.getBoard(existing.id);
        if (!current) return res.status(404).json({ message: "Board not found" });
        return res.status(409).json({
          message: "This board was saved somewhere else since you opened it",
          code: "version_conflict",
          version: current.version,
          updatedAt: current.updatedAt,
        });
      }
      res.json(updated);
    } catch (err) {
      sendError(res, err, "Failed to save board");
    }
  });

  app.delete("/api/boards/:id", requireAdmin, async (req, res) => {
    if (!UUID_RE.test(req.params.id)) return res.status(400).json({ message: "Invalid board id" });
    try {
      const existing = await storage.getBoard(req.params.id);
      if (!existing) return res.status(404).json({ message: "Board not found" });
      await storage.deleteBoard(existing.id);
      res.json({ success: true });
    } catch (err) {
      sendError(res, err, "Failed to delete board");
    }
  });
}
