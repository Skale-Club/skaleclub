import express, { type Express } from "express";
import type { Server } from "http";
import type { AddressInfo } from "net";
import { randomUUID } from "crypto";
import { db } from "../../../db.js";
import { storage } from "../../../storage.js";
import { LARGE_BODY_LIMIT, LARGE_BODY_RE } from "../../../lib/bodyLimits.js";
import { requireAdmin } from "../../_shared.js";
import { registerWhiteboardsRoutes } from "../../whiteboards.js";
import type { InsertWhiteboard, Whiteboard, WhiteboardSummary } from "#shared/schema.js";

// The whiteboard routes against an in-memory table, with production's body
// limits. A request is an admin when it carries the `x-test-admin: 1` header
// (or always, with `alwaysAdmin`, for a browser driving the real client).

export function installMemoryWhiteboards(): Map<string, Whiteboard> {
  const rows = new Map<string, Whiteboard>();
  const summary = ({ scene, ...rest }: Whiteboard): WhiteboardSummary => ({
    ...rest,
    elementCount: scene.elements.length,
  });
  Object.assign(storage, {
    async listWhiteboards({ search, limit = 24, offset = 0 }: { search?: string; limit?: number; offset?: number } = {}) {
      const term = search?.trim().toLowerCase();
      const matches = Array.from(rows.values())
        .filter((row) => !term || row.title.toLowerCase().includes(term) || row.slug.includes(term))
        .sort((a, b) => (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0));
      return { data: matches.slice(offset, offset + limit).map(summary), total: matches.length };
    },
    async getWhiteboard(id: string) {
      return rows.get(id);
    },
    async getWhiteboardBySlug(slug: string) {
      return Array.from(rows.values()).find((row) => row.slug === slug);
    },
    async createWhiteboard(data: InsertWhiteboard) {
      const now = new Date();
      const row: Whiteboard = {
        id: randomUUID(),
        slug: data.slug,
        title: data.title,
        scene: data.scene ?? { elements: [], appState: {}, files: {} },
        thumbnailUrl: data.thumbnailUrl ?? null,
        version: 1,
        createdAt: now,
        updatedAt: now,
      };
      rows.set(row.id, row);
      return row;
    },
    async updateWhiteboard(id: string, data: Partial<InsertWhiteboard>, expectedVersion?: number) {
      const row = rows.get(id);
      if (!row || (expectedVersion !== undefined && row.version !== expectedVersion)) return undefined;
      // Undefined fields are left untouched, as drizzle's .set() does.
      const defined = Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
      const updated = { ...row, ...defined, version: row.version + 1, updatedAt: new Date() } as Whiteboard;
      rows.set(id, updated);
      return updated;
    },
    async deleteWhiteboard(id: string) {
      rows.delete(id);
    },
  });
  return rows;
}

// requireAdmin looks the session user up in `users`; answer as an admin.
function stubAdminLookup() {
  (db as unknown as { select: () => unknown }).select = () => ({
    from: () => ({ where: async () => [{ isAdmin: true }] }),
  });
}

export function createWhiteboardsApp(
  opts: { alwaysAdmin?: boolean; beforeRoutes?: (app: Express) => void } = {},
): Express {
  stubAdminLookup();
  const app = express();
  opts.beforeRoutes?.(app);
  app.use((req, _res, next) => {
    const isAdmin = opts.alwaysAdmin || req.get("x-test-admin") === "1";
    (req as unknown as { session: object }).session = isAdmin ? { userId: "admin" } : {};
    next();
  });
  // Same split as server/app.ts: 1 MB by default, 25 MB only after requireAdmin.
  const jsonDefault = express.json({ limit: "1mb" });
  const jsonLarge = express.json({ limit: LARGE_BODY_LIMIT });
  app.use((req, res, next) => (LARGE_BODY_RE.test(req.path) ? next() : jsonDefault(req, res, next)));
  app.use((req, res, next) =>
    LARGE_BODY_RE.test(req.path) ? requireAdmin(req, res, () => jsonLarge(req, res, next)) : next(),
  );
  registerWhiteboardsRoutes(app);
  return app;
}

export async function listen(app: Express): Promise<{ server: Server; baseUrl: string }> {
  const server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const { port } = server.address() as AddressInfo;
  return { server, baseUrl: `http://127.0.0.1:${port}` };
}
