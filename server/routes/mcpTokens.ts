import type { Express } from "express";
import { requireAdmin } from "./_shared.js";
import {
  createApiToken,
  listApiTokens,
  rotateApiToken,
  deleteApiToken,
  listAuditLogs,
} from "../lib/mcp-storage.js";
import { insertApiTokenSchema } from "#shared/schema.js";
import { handleMcpRequest } from "../mcp/server.js";

export function registerMcpRoutes(app: Express) {
  // ── Token management (admin-only) ──────────────────────────────────────────

  // List tokens (prefix + metadata, never the raw token or hash)
  app.get("/api/mcp/tokens", requireAdmin, async (_req, res) => {
    const tokens = await listApiTokens();
    res.json(tokens.map(({ tokenHash: _h, ...safe }) => safe));
  });

  // Create token — raw token returned once, never again
  app.post("/api/mcp/tokens", requireAdmin, async (req, res) => {
    const parsed = insertApiTokenSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid body", errors: parsed.error.errors });

    const { token, rawToken } = await createApiToken(parsed.data.name);
    const { tokenHash: _h, ...safe } = token;
    return res.status(201).json({ ...safe, rawToken });
  });

  // Rotate token — new raw token returned once
  app.post("/api/mcp/tokens/:id/rotate", requireAdmin, async (req, res) => {
    try {
      const { token, rawToken } = await rotateApiToken(req.params.id);
      const { tokenHash: _h, ...safe } = token;
      return res.json({ ...safe, rawToken });
    } catch {
      return res.status(404).json({ message: "Token not found" });
    }
  });

  // Delete token
  app.delete("/api/mcp/tokens/:id", requireAdmin, async (req, res) => {
    await deleteApiToken(req.params.id);
    res.status(204).end();
  });

  // Audit log (admin-only)
  app.get("/api/mcp/audit", requireAdmin, async (_req, res) => {
    const logs = await listAuditLogs(200);
    res.json(logs);
  });

  // ── MCP endpoint ───────────────────────────────────────────────────────────
  // Handles GET and POST for StreamableHTTPServerTransport.
  // Auth: Bearer token validated before handing off to MCP server.
  app.all("/mcp", async (req, res) => {
    const authHeader = req.headers.authorization ?? "";
    const raw = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!raw) {
      res.status(401).json({ message: "Authorization: Bearer <token> required" });
      return;
    }

    // Lazy import to avoid loading mcp-storage at module init
    const { getApiTokenByRaw, touchApiToken } = await import("../lib/mcp-storage.js");
    const token = await getApiTokenByRaw(raw);

    if (!token || !token.isActive) {
      res.status(401).json({ message: "Invalid or inactive MCP token" });
      return;
    }

    // Fire-and-forget update of last_used_at
    touchApiToken(token.id).catch(() => {});

    await handleMcpRequest(req, res, token.id, token.tokenPrefix);
  });
}
