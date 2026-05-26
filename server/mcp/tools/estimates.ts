import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { storage } from "../../storage.js";
import type { createAuditLog } from "../../lib/mcp-storage.js";

type AuditFn = typeof createAuditLog;

export function registerEstimateTools(server: McpServer, audit: AuditFn, tokenId: string, tokenPrefix: string, ip: string) {
  server.tool(
    "estimates_list",
    "List all estimates. Returns id, clientName, companyName, slug, createdAt, and view count.",
    { search: z.string().optional(), limit: z.number().int().min(1).max(100).optional() },
    async ({ search, limit = 50 }) => {
      const results = await storage.listEstimates(limit, 0, search);
      await audit({ tokenId, tokenPrefix, toolName: "estimates_list", action: "read", result: "success", ipAddress: ip });
      return { content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }] };
    }
  );

  server.tool(
    "estimates_get",
    "Get a single estimate by id or slug.",
    { id: z.number().int().optional(), slug: z.string().optional() },
    async ({ id, slug }) => {
      if (!id && !slug) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: "Provide id or slug" }) }] };
      }
      const estimate = id
        ? await storage.getEstimate(id)
        : await storage.getEstimateBySlug(slug!);
      if (!estimate) {
        await audit({ tokenId, tokenPrefix, toolName: "estimates_get", action: "read", result: "error", errorMessage: "Not found", ipAddress: ip });
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: "Estimate not found" }) }] };
      }
      await audit({ tokenId, tokenPrefix, toolName: "estimates_get", targetType: "estimate", targetId: String(estimate.id), action: "read", result: "success", ipAddress: ip });
      return { content: [{ type: "text" as const, text: JSON.stringify(estimate, null, 2) }] };
    }
  );

  server.tool(
    "estimates_create",
    "Create a new estimate.",
    {
      clientName:  z.string().min(1),
      companyName: z.string().optional(),
      contactName: z.string().optional(),
      slug:        z.string().optional(),
      note:        z.string().optional(),
      accessCode:  z.string().optional(),
    },
    async (args) => {
      const slug = args.slug || args.clientName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") + "-" + Date.now();
      try {
        const estimate = await storage.createEstimate({ ...args, slug, services: [] });
        await audit({ tokenId, tokenPrefix, toolName: "estimates_create", targetType: "estimate", targetId: String(estimate.id), action: "create", result: "success", ipAddress: ip });
        return { content: [{ type: "text" as const, text: JSON.stringify(estimate, null, 2) }] };
      } catch (err) {
        const msg = (err as Error).message;
        await audit({ tokenId, tokenPrefix, toolName: "estimates_create", action: "create", result: "error", errorMessage: msg, ipAddress: ip });
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: msg }) }] };
      }
    }
  );

  server.tool(
    "estimates_update",
    "Update an existing estimate by id.",
    {
      id:          z.number().int(),
      clientName:  z.string().optional(),
      companyName: z.string().optional(),
      contactName: z.string().optional(),
      note:        z.string().optional(),
      accessCode:  z.string().optional(),
    },
    async ({ id, ...fields }) => {
      const existing = await storage.getEstimate(id);
      if (!existing) {
        await audit({ tokenId, tokenPrefix, toolName: "estimates_update", action: "update", result: "error", errorMessage: "Not found", ipAddress: ip });
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: "Estimate not found" }) }] };
      }
      try {
        const updated = await storage.updateEstimate(id, fields);
        await audit({ tokenId, tokenPrefix, toolName: "estimates_update", targetType: "estimate", targetId: String(id), action: "update", result: "success", ipAddress: ip });
        return { content: [{ type: "text" as const, text: JSON.stringify(updated, null, 2) }] };
      } catch (err) {
        const msg = (err as Error).message;
        await audit({ tokenId, tokenPrefix, toolName: "estimates_update", action: "update", result: "error", errorMessage: msg, ipAddress: ip });
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: msg }) }] };
      }
    }
  );
}
