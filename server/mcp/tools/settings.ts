import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { storage } from "../../storage.js";
import type { createAuditLog } from "../../lib/mcp-storage.js";
import {
  insertCompanySettingsSchema,
  insertPortfolioServiceSchema,
  normalizeSocialLinks,
} from "#shared/schema.js";
import { getPageSlugsValidationError, resolvePageSlugs } from "#shared/pageSlugs.js";

type AuditFn = typeof createAuditLog;

// Some MCP clients serialize object parameters as JSON strings. Accept either.
const objectParam = z.preprocess((v) => {
  if (typeof v === "string") {
    try {
      return JSON.parse(v);
    } catch {
      return v;
    }
  }
  return v;
}, z.record(z.unknown()));

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Deep-merge for the jsonb columns (homepageContent, linksPageConfig, ...):
 * a patch of `{ homepageContent: { portfolioHero: { title } } }` must change
 * one title, not replace every other section. Arrays replace whole.
 */
export function deepMerge<T>(base: T, patch: unknown): T {
  if (!isPlainObject(base) || !isPlainObject(patch)) return patch as T;
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    out[k] = isPlainObject(v) && isPlainObject(out[k]) ? deepMerge(out[k], v) : v;
  }
  return out as T;
}

const text = (value: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] });

/**
 * Site content tools: the same company_settings and portfolio_services the
 * admin panel edits, so SEO copy, homepage sections, links and product cards
 * can be maintained from an MCP client without touching the database by hand.
 */
export function registerSettingsTools(server: McpServer, audit: AuditFn, tokenId: string, tokenPrefix: string, ip: string) {
  server.tool(
    "company_settings_get",
    "Read company_settings: SEO fields (seoTitle, seoDescription, seoKeywords, seoCanonicalUrl, og*), contact details, homepageContent (hero, ourServicesSection, portfolioHero, trustBadges, ...), linksPageConfig, pageSlugs, socialLinks. Pass `fields` to return only some top-level keys.",
    { fields: z.array(z.string()).optional() },
    async ({ fields }) => {
      const settings = await storage.getCompanySettings();
      const out = fields?.length
        ? Object.fromEntries(fields.map((f) => [f, (settings as Record<string, unknown>)[f]]))
        : settings;
      await audit({ tokenId, tokenPrefix, toolName: "company_settings_get", action: "read", result: "success", ipAddress: ip });
      return text(out);
    },
  );

  server.tool(
    "company_settings_update",
    "Patch company_settings. `patch` is an object (or JSON string) of top-level fields; jsonb fields such as homepageContent and linksPageConfig are deep-merged, so `{\"homepageContent\":{\"portfolioHero\":{\"title\":\"...\"}}}` changes only that title. Arrays replace the stored array. Validated with the same schema as the admin panel. Read first with company_settings_get.",
    { patch: objectParam },
    async ({ patch }) => {
      const current = await storage.getCompanySettings();
      const merged: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(patch)) {
        merged[key] = deepMerge((current as Record<string, unknown>)[key], value);
      }
      const parsed = insertCompanySettingsSchema.partial().safeParse(merged);
      if (!parsed.success) {
        await audit({ tokenId, tokenPrefix, toolName: "company_settings_update", action: "update", result: "error", errorMessage: "Validation error", ipAddress: ip });
        return text({ error: "Validation error", issues: parsed.error.errors });
      }
      const data = parsed.data;
      if (data.socialLinks) data.socialLinks = normalizeSocialLinks(data.socialLinks);
      if (data.pageSlugs) {
        const slugs = resolvePageSlugs({ ...(current.pageSlugs || {}), ...data.pageSlugs });
        const slugError = getPageSlugsValidationError(slugs);
        if (slugError) {
          await audit({ tokenId, tokenPrefix, toolName: "company_settings_update", action: "update", result: "error", errorMessage: slugError, ipAddress: ip });
          return text({ error: slugError });
        }
        data.pageSlugs = slugs;
      }
      const updated = await storage.updateCompanySettings(data);
      await audit({ tokenId, tokenPrefix, toolName: "company_settings_update", targetType: "company_settings", targetId: String(updated.id), action: "update", result: "success", ipAddress: ip });
      return text({ ok: true, updatedFields: Object.keys(data) });
    },
  );

  server.tool(
    "portfolio_services_update",
    "Patch one portfolio service (the X-branded apps) by id: title, subtitle, description, price, priceLabel, features, imageUrl, logoIconUrl, order, isActive, badgeText, toolUrl, ... Validated like the admin panel. List ids with portfolio_services_list.",
    { id: z.number().int().positive(), patch: objectParam },
    async ({ id, patch }) => {
      const parsed = insertPortfolioServiceSchema.partial().safeParse(patch);
      if (!parsed.success) {
        await audit({ tokenId, tokenPrefix, toolName: "portfolio_services_update", action: "update", result: "error", errorMessage: "Validation error", ipAddress: ip });
        return text({ error: "Validation error", issues: parsed.error.errors });
      }
      const existing = await storage.getPortfolioService(id);
      if (!existing) {
        await audit({ tokenId, tokenPrefix, toolName: "portfolio_services_update", action: "update", result: "error", errorMessage: "Not found", ipAddress: ip });
        return text({ error: "Service not found" });
      }
      const updated = await storage.updatePortfolioService(id, parsed.data);
      await audit({ tokenId, tokenPrefix, toolName: "portfolio_services_update", targetType: "portfolio_service", targetId: String(id), action: "update", result: "success", ipAddress: ip });
      return text(updated);
    },
  );
}
