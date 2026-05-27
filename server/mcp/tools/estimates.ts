import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { storage } from "../../storage.js";
import type { createAuditLog } from "../../lib/mcp-storage.js";
import { estimateServiceItemSchema } from "#shared/schema.js";
import type { EstimateServiceItem } from "#shared/schema.js";
import { translateServicesToPt } from "../../lib/estimate-translator.js";

type AuditFn = typeof createAuditLog;

// ─────────────────────────────────────────────────────────────────────────────
// Some MCP clients (notably Claude Code's tool harness) serialize array/object
// parameters as JSON strings rather than structured values. Accept either form.
// ─────────────────────────────────────────────────────────────────────────────
const jsonStringOrValue = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess(
    (val) => {
      if (typeof val === "string") {
        try { return JSON.parse(val); } catch { return val; }
      }
      return val;
    },
    schema,
  );

const servicesParam = jsonStringOrValue(z.array(estimateServiceItemSchema)).optional();
const singleServiceParam = jsonStringOrValue(estimateServiceItemSchema);

// Partial patch schema — explicit because Zod discriminated unions don't support .partial().
// Covers all fields from both catalog and custom service items.
const servicePatchShape = z.object({
  type:           z.enum(["catalog", "custom"]).optional(),
  sourceId:       z.number().int().positive().optional(),
  title:          z.string().min(1).optional(),
  titlePt:        z.string().optional(),
  subtitle:       z.string().max(100).optional(),
  subtitlePt:     z.string().max(100).optional(),
  description:    z.string().min(1).optional(),
  descriptionPt:  z.string().optional(),
  price:          z.string().min(1).optional(),
  pricePt:        z.string().optional(),
  features:       z.array(z.string()).optional(),
  featuresPt:     z.array(z.string()).optional(),
  order:          z.number().int().min(0).optional(),
  section:        z.string().max(50).optional(),
  sectionPt:      z.string().max(50).optional(),
});
const servicePatchParam = jsonStringOrValue(servicePatchShape);

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

function reorderArr(arr: EstimateServiceItem[]): EstimateServiceItem[] {
  return arr.map((s, i) => ({ ...s, order: i }));
}

// ─────────────────────────────────────────────────────────────────────────────
// ESTIMATE_TOOL_RULES — prepended to EVERY estimates_* tool description so the
// AI sees the brand rules every time it inspects available tools. Keep tight.
// Full playbook lives in estimate_guidelines_get().
// ─────────────────────────────────────────────────────────────────────────────
const ESTIMATE_TOOL_RULES = `
RULES (read before calling any estimates_* tool):
- NEVER use em-dashes (—) in client-facing copy. Use pipes (|) instead.
- Title is short brand name only. Put secondary content (e.g. "Voice & Text", "Scheduling System") in the subtitle field, never jammed in the title.
- NEVER invent prices. Use values from estimate_guidelines_get or ask the user.
- Standard sections: "Foundation" | "Growth Engine" | "Must Have" (custom only if user asks).
- Write EN first. After deck is final, call estimates_translate_to_pt to populate PT fields. Never write PT manually.
- Use type: "catalog" with sourceId when service exists in portfolio_services_list. Else type: "custom".
- Call estimate_guidelines_get FIRST in any new estimate session to see the full playbook + catalog with confirmed prices.
`.trim();

function withRules(specific: string): string {
  return `${ESTIMATE_TOOL_RULES}\n\n${specific}`;
}

export function registerEstimateTools(server: McpServer, audit: AuditFn, tokenId: string, tokenPrefix: string, ip: string) {
  // ── Guidelines ─────────────────────────────────────────────────────────────
  server.tool(
    "estimate_guidelines_get",
    withRules(
      "Returns the full estimate-building playbook (brand rules, section taxonomy, standard service catalog with verified prices, copywriting voice). CALL THIS FIRST when starting any new estimate or before adding services to an existing one.",
    ),
    {},
    async () => {
      const row = await storage.getEstimateGuidelines();
      const content = row?.content ?? "(empty — admin has not set guidelines yet)";
      await audit({ tokenId, tokenPrefix, toolName: "estimate_guidelines_get", action: "read", result: "success", ipAddress: ip });
      return { content: [{ type: "text" as const, text: content }] };
    }
  );

  // ── Read ───────────────────────────────────────────────────────────────────
  server.tool(
    "estimates_list",
    withRules("List all estimates. Returns id, clientName, companyName, slug, createdAt, and view count."),
    { search: z.string().optional(), limit: z.number().int().min(1).max(100).optional() },
    async ({ search, limit = 50 }) => {
      const results = await storage.listEstimates(limit, 0, search);
      await audit({ tokenId, tokenPrefix, toolName: "estimates_list", action: "read", result: "success", ipAddress: ip });
      return { content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }] };
    }
  );

  server.tool(
    "estimates_get",
    withRules("Get a single estimate by id or slug. Returns all fields including the full services array (with PT fields if populated)."),
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

  // ── Create ─────────────────────────────────────────────────────────────────
  server.tool(
    "estimates_create",
    withRules("Create a new BLANK estimate. Use estimates_add_service afterwards to add each service one at a time."),
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

  // ── Bulk update (kept for big restructures) ─────────────────────────────────
  server.tool(
    "estimates_update",
    withRules(
      [
        "BULK update an estimate by id. All fields optional. PREFER the granular tools (add_service / update_service / remove_service / reorder_service) for individual edits — they're safer and don't risk losing other services.",
        "",
        "Use this only when you need to replace many fields at once or restructure the entire services array.",
        "Slug is normalized server-side; uniqueness enforced.",
      ].join("\n"),
    ),
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

  // ── Granular: add_service ──────────────────────────────────────────────────
  server.tool(
    "estimates_add_service",
    withRules(
      "Append a single service to an estimate, OR insert at a specific index. Recalculates `order` on all services. Service shape matches the estimateServiceItemSchema (type, title, description, price, features[], order; optional subtitle, section, sourceId for catalog).",
    ),
    {
      id:       z.number().int(),
      service:  singleServiceParam,
      atIndex:  z.number().int().min(0).optional(),
    },
    async ({ id, service, atIndex }) => {
      const existing = await storage.getEstimate(id);
      if (!existing) {
        await audit({ tokenId, tokenPrefix, toolName: "estimates_add_service", action: "create", result: "error", errorMessage: "Not found", ipAddress: ip });
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: "Estimate not found" }) }] };
      }
      try {
        const current = existing.services ?? [];
        const insertAt = typeof atIndex === "number" ? Math.max(0, Math.min(atIndex, current.length)) : current.length;
        const newServices = reorderArr([...current.slice(0, insertAt), service, ...current.slice(insertAt)]);
        const updated = await storage.updateEstimate(id, { services: newServices });
        await audit({ tokenId, tokenPrefix, toolName: "estimates_add_service", targetType: "estimate", targetId: String(id), action: "create", result: "success", ipAddress: ip });
        return { content: [{ type: "text" as const, text: JSON.stringify({ ok: true, insertedAt: insertAt, totalServices: newServices.length, estimate: updated }, null, 2) }] };
      } catch (err) {
        const msg = (err as Error).message;
        await audit({ tokenId, tokenPrefix, toolName: "estimates_add_service", action: "create", result: "error", errorMessage: msg, ipAddress: ip });
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: msg }) }] };
      }
    }
  );

  // ── Granular: update_service (partial patch by index) ──────────────────────
  server.tool(
    "estimates_update_service",
    withRules(
      "Partially update ONE service by index. Only provided fields change; everything else preserved. Pass `patch` as an object with the fields you want to change (e.g. {title, subtitle, price, features, description, section, ...}). Use this for individual tweaks — much safer than rewriting the whole array.",
    ),
    {
      id:    z.number().int(),
      index: z.number().int().min(0),
      patch: servicePatchParam,
    },
    async ({ id, index, patch }) => {
      const existing = await storage.getEstimate(id);
      if (!existing) {
        await audit({ tokenId, tokenPrefix, toolName: "estimates_update_service", action: "update", result: "error", errorMessage: "Not found", ipAddress: ip });
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: "Estimate not found" }) }] };
      }
      const current = existing.services ?? [];
      if (index >= current.length) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Index ${index} out of range (${current.length} services)` }) }] };
      }
      try {
        const merged = { ...current[index], ...patch } as EstimateServiceItem;
        const newServices = current.map((s, i) => (i === index ? merged : s));
        const updated = await storage.updateEstimate(id, { services: newServices });
        await audit({ tokenId, tokenPrefix, toolName: "estimates_update_service", targetType: "estimate", targetId: String(id), action: "update", result: "success", ipAddress: ip });
        return { content: [{ type: "text" as const, text: JSON.stringify({ ok: true, updatedIndex: index, service: merged, estimate: updated }, null, 2) }] };
      } catch (err) {
        const msg = (err as Error).message;
        await audit({ tokenId, tokenPrefix, toolName: "estimates_update_service", action: "update", result: "error", errorMessage: msg, ipAddress: ip });
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: msg }) }] };
      }
    }
  );

  // ── Granular: remove_service ───────────────────────────────────────────────
  server.tool(
    "estimates_remove_service",
    withRules("Delete ONE service by index. Recalculates `order` on remaining services."),
    {
      id:    z.number().int(),
      index: z.number().int().min(0),
    },
    async ({ id, index }) => {
      const existing = await storage.getEstimate(id);
      if (!existing) {
        await audit({ tokenId, tokenPrefix, toolName: "estimates_remove_service", action: "delete", result: "error", errorMessage: "Not found", ipAddress: ip });
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: "Estimate not found" }) }] };
      }
      const current = existing.services ?? [];
      if (index >= current.length) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Index ${index} out of range (${current.length} services)` }) }] };
      }
      try {
        const newServices = reorderArr(current.filter((_, i) => i !== index));
        const updated = await storage.updateEstimate(id, { services: newServices });
        await audit({ tokenId, tokenPrefix, toolName: "estimates_remove_service", targetType: "estimate", targetId: String(id), action: "delete", result: "success", ipAddress: ip });
        return { content: [{ type: "text" as const, text: JSON.stringify({ ok: true, removedIndex: index, totalServices: newServices.length, estimate: updated }, null, 2) }] };
      } catch (err) {
        const msg = (err as Error).message;
        await audit({ tokenId, tokenPrefix, toolName: "estimates_remove_service", action: "delete", result: "error", errorMessage: msg, ipAddress: ip });
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: msg }) }] };
      }
    }
  );

  // ── Granular: reorder_service ──────────────────────────────────────────────
  server.tool(
    "estimates_reorder_service",
    withRules("Move ONE service from one position to another. Recalculates `order` on all services."),
    {
      id:        z.number().int(),
      fromIndex: z.number().int().min(0),
      toIndex:   z.number().int().min(0),
    },
    async ({ id, fromIndex, toIndex }) => {
      const existing = await storage.getEstimate(id);
      if (!existing) {
        await audit({ tokenId, tokenPrefix, toolName: "estimates_reorder_service", action: "update", result: "error", errorMessage: "Not found", ipAddress: ip });
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: "Estimate not found" }) }] };
      }
      const current = existing.services ?? [];
      if (fromIndex >= current.length || toIndex >= current.length) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Index out of range (${current.length} services)` }) }] };
      }
      try {
        const arr = [...current];
        const [moved] = arr.splice(fromIndex, 1);
        arr.splice(toIndex, 0, moved);
        const newServices = reorderArr(arr);
        const updated = await storage.updateEstimate(id, { services: newServices });
        await audit({ tokenId, tokenPrefix, toolName: "estimates_reorder_service", targetType: "estimate", targetId: String(id), action: "update", result: "success", ipAddress: ip });
        return { content: [{ type: "text" as const, text: JSON.stringify({ ok: true, fromIndex, toIndex, estimate: updated }, null, 2) }] };
      } catch (err) {
        const msg = (err as Error).message;
        await audit({ tokenId, tokenPrefix, toolName: "estimates_reorder_service", action: "update", result: "error", errorMessage: msg, ipAddress: ip });
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: msg }) }] };
      }
    }
  );

  // ── Auto-translate (idempotent) ────────────────────────────────────────────
  server.tool(
    "estimates_translate_to_pt",
    withRules(
      "Populate Brazilian Portuguese fields (titlePt, subtitlePt, descriptionPt, pricePt, featuresPt, sectionPt) on services using Gemini. Idempotent — services already fully translated are skipped. Pass `indexes` to translate only specific services; omit to process all.",
    ),
    {
      id:      z.number().int(),
      indexes: jsonStringOrValue(z.array(z.number().int().min(0))).optional(),
    },
    async ({ id, indexes }) => {
      const existing = await storage.getEstimate(id);
      if (!existing) {
        await audit({ tokenId, tokenPrefix, toolName: "estimates_translate_to_pt", action: "update", result: "error", errorMessage: "Not found", ipAddress: ip });
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: "Estimate not found" }) }] };
      }
      try {
        const result = await translateServicesToPt(existing.services ?? [], indexes);
        if (result.translatedCount === 0) {
          await audit({ tokenId, tokenPrefix, toolName: "estimates_translate_to_pt", targetType: "estimate", targetId: String(id), action: "update", result: "success", ipAddress: ip });
          return { content: [{ type: "text" as const, text: JSON.stringify({ ok: true, translatedCount: 0, skippedCount: result.skippedCount, message: "All requested services already have PT fields populated." }) }] };
        }
        const updated = await storage.updateEstimate(id, { services: result.services });
        await audit({ tokenId, tokenPrefix, toolName: "estimates_translate_to_pt", targetType: "estimate", targetId: String(id), action: "update", result: "success", ipAddress: ip });
        return { content: [{ type: "text" as const, text: JSON.stringify({ ok: true, translatedCount: result.translatedCount, skippedCount: result.skippedCount, estimate: updated }, null, 2) }] };
      } catch (err) {
        const msg = (err as Error).message;
        await audit({ tokenId, tokenPrefix, toolName: "estimates_translate_to_pt", action: "update", result: "error", errorMessage: msg, ipAddress: ip });
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: msg }) }] };
      }
    }
  );

  // ── Portfolio catalog (read-only helper) ──────────────────────────────────
  server.tool(
    "portfolio_services_list",
    withRules(
      "List the portfolio services catalog (active services only). When the client requests a service that matches one of these by title/description, create the estimate service with type: \"catalog\" and use the returned id as sourceId. For one-off services not in this list, use type: \"custom\".",
    ),
    {},
    async () => {
      const items = await storage.getPortfolioServices();
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
