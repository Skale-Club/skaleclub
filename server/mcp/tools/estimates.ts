import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { storage } from "../../storage.js";
import type { createAuditLog } from "../../lib/mcp-storage.js";
import { estimateServiceItemSchema } from "#shared/schema.js";

// Some MCP clients (notably Claude Code's tool harness) serialize array/object
// parameters as JSON strings rather than structured values. Accept either form.
const servicesParam = z.preprocess(
  (val) => {
    if (typeof val === "string") {
      try {
        return JSON.parse(val);
      } catch {
        return val;
      }
    }
    return val;
  },
  z.array(estimateServiceItemSchema),
).optional();

type AuditFn = typeof createAuditLog;

// Local slug normalizer — mirrors normalizeCustomSlug() in server/routes/estimates.ts.
function normalizeSlug(slug: string): string {
  return (
    slug
      .toLowerCase()
      .trim()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "estimate"
  );
}

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
    "Get a single estimate by id or slug. Returns all fields including the full services array.",
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
    "Create a new blank estimate. Use estimates_update afterwards to add services.",
    {
      clientName:  z.string().min(1),
      companyName: z.string().optional(),
      contactName: z.string().optional(),
      slug:        z.string().optional(),
      note:        z.string().optional(),
      accessCode:  z.string().optional(),
    },
    async (args) => {
      const slug = args.slug ? normalizeSlug(args.slug) : normalizeSlug(args.clientName) + "-" + Date.now();
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
    [
      "Update an existing estimate by id. All fields are optional — only provided fields are updated.",
      "",
      "SERVICES: pass the FULL replacement array (not a delta). Each service item must include all required fields:",
      '  - type: "catalog" — use this ONLY when the service exists in our portfolio catalog. Call portfolio_services_list first to find the correct sourceId.',
      '  - type: "custom" — use this for one-off services the client requested that are not in the catalog (the COMMON case).',
      "Required on every item: type, title, description, price (string), features (string[]), order (0-based).",
      'Optional: section (string, max 50 chars) — groups services visually in the viewer (e.g. "Main Services", "Must Have").',
      'For catalog: also sourceId (number). For custom: no sourceId.',
      "",
      "SLUG: normalized server-side (lowercase, dashes, no accents). Must be unique across all estimates.",
    ].join("\n"),
    {
      id:                  z.number().int(),
      clientName:          z.string().optional(),
      companyName:         z.string().optional(),
      contactName:         z.string().optional(),
      slug:                z.string().optional(),
      note:                z.string().optional(),
      accessCode:          z.string().optional(),
      services:            servicesParam,
      thumbnailUrl:        z.string().optional(),
      thumbnailSignature:  z.string().optional(),
    },
    async ({ id, ...fields }) => {
      const existing = await storage.getEstimate(id);
      if (!existing) {
        await audit({ tokenId, tokenPrefix, toolName: "estimates_update", action: "update", result: "error", errorMessage: "Not found", ipAddress: ip });
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: "Estimate not found" }) }] };
      }

      // Normalize and validate slug uniqueness if provided
      if (typeof fields.slug === "string") {
        const normalized = normalizeSlug(fields.slug);
        const slugOwner = await storage.getEstimateBySlug(normalized);
        if (slugOwner && slugOwner.id !== existing.id) {
          await audit({ tokenId, tokenPrefix, toolName: "estimates_update", action: "update", result: "error", errorMessage: "Slug already in use", ipAddress: ip });
          return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Slug "${normalized}" is already used by estimate id ${slugOwner.id}` }) }] };
        }
        fields.slug = normalized;
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

  server.tool(
    "portfolio_services_list",
    [
      "List the portfolio services catalog (active services only).",
      "When the client requests a service that matches one of these by title/description, create the estimate service with type: \"catalog\" and use the returned id as sourceId.",
      "When the client requests a one-off service not in this list, create the estimate service with type: \"custom\" instead.",
      "Returns id, title, subtitle, description, price, priceLabel, features, slug.",
    ].join("\n"),
    {},
    async () => {
      const items = await storage.getPortfolioServices();
      // Trim to only the fields the AI needs to decide and to compose a service item
      const trimmed = items.map((s) => ({
        id: s.id,
        slug: s.slug,
        title: s.title,
        subtitle: s.subtitle,
        description: s.description,
        price: s.price,
        priceLabel: s.priceLabel,
        features: s.features,
      }));
      await audit({ tokenId, tokenPrefix, toolName: "portfolio_services_list", action: "read", result: "success", ipAddress: ip });
      return { content: [{ type: "text" as const, text: JSON.stringify(trimmed, null, 2) }] };
    }
  );
}
