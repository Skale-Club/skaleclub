import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { and, eq, ne } from "drizzle-orm";
import { db } from "../../db.js";
import { storage } from "../../storage.js";
import type { createAuditLog } from "../../lib/mcp-storage.js";
import { vcards, insertVCardSchema } from "#shared/schema.js";
import { buildPagePaths } from "#shared/pageSlugs.js";

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

const text = (value: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] });

/** Public card URL: canonical site URL + the configurable vcard page slug. */
async function publicUrlBuilder(): Promise<(username: string) => string> {
  const settings = await storage.getCompanySettings();
  let base = "https://skale.club";
  if (settings?.seoCanonicalUrl) {
    try {
      base = new URL(settings.seoCanonicalUrl).origin;
    } catch {
      // Malformed value in settings: keep the default origin.
    }
  }
  const paths = buildPagePaths(settings?.pageSlugs);
  return (username) => `${base}${paths.vcardUser(encodeURIComponent(username))}`;
}

/**
 * Digital business card tools: the same vcards table the admin panel edits,
 * reachable with an MCP token. There is no delete tool on purpose; archive a
 * card with isActive=false (the public page then returns 404).
 */
export function registerVCardTools(server: McpServer, audit: AuditFn, tokenId: string, tokenPrefix: string, ip: string) {
  server.tool(
    "vcards_list",
    "List digital business cards (id, username, name, title, email, cellPhone, isActive, viewCount, downloadCount, publicUrl). Includes archived cards by default; pass includeInactive=false to hide them.",
    { includeInactive: z.boolean().optional() },
    async ({ includeInactive }) => {
      const rows = await db.select().from(vcards).orderBy(vcards.createdAt);
      const publicUrl = await publicUrlBuilder();
      const out = rows
        .filter((v) => includeInactive !== false || v.isActive)
        .map((v) => ({
          id: v.id,
          username: v.username,
          firstName: v.firstName,
          lastName: v.lastName,
          title: v.title,
          email: v.email,
          cellPhone: v.cellPhone,
          isActive: v.isActive,
          viewCount: v.viewCount,
          downloadCount: v.downloadCount,
          publicUrl: publicUrl(v.username),
        }));
      await audit({ tokenId, tokenPrefix, toolName: "vcards_list", action: "read", result: "success", ipAddress: ip });
      return text(out);
    },
  );

  server.tool(
    "vcards_get",
    "Read one business card by username, including archived (isActive=false) cards and all fields.",
    { username: z.string().min(1) },
    async ({ username }) => {
      const [vcard] = await db.select().from(vcards).where(eq(vcards.username, username));
      if (!vcard) {
        await audit({ tokenId, tokenPrefix, toolName: "vcards_get", action: "read", result: "error", errorMessage: "Not found", ipAddress: ip });
        return text({ error: "Not found" });
      }
      const publicUrl = await publicUrlBuilder();
      await audit({ tokenId, tokenPrefix, toolName: "vcards_get", targetType: "vcard", targetId: String(vcard.id), action: "read", result: "success", ipAddress: ip });
      return text({ ...vcard, publicUrl: publicUrl(vcard.username) });
    },
  );

  server.tool(
    "vcards_create",
    "Create a business card. `vcard` is an object (or JSON string): username and firstName and lastName are required; optional title, organization, cellPhone, email, url, bio, couponCode, couponAmount, avatarUrl, socialLinks [{platform,url}], isActive (default true). Fails if the username is taken. Validated like the admin panel.",
    { vcard: objectParam },
    async ({ vcard }) => {
      const parsed = insertVCardSchema.safeParse(vcard);
      if (!parsed.success) {
        await audit({ tokenId, tokenPrefix, toolName: "vcards_create", action: "create", result: "error", errorMessage: "Validation error", ipAddress: ip });
        return text({ error: "Validation error", issues: parsed.error.errors });
      }
      const data = parsed.data;
      const existing = await db.select().from(vcards).where(eq(vcards.username, data.username));
      if (existing.length > 0) {
        await audit({ tokenId, tokenPrefix, toolName: "vcards_create", action: "create", result: "error", errorMessage: "Username already exists", ipAddress: ip });
        return text({ error: "Username já existe." });
      }
      let created;
      try {
        [created] = await db.insert(vcards).values(data).returning();
      } catch (err) {
        console.error(err);
        await audit({ tokenId, tokenPrefix, toolName: "vcards_create", action: "create", result: "error", errorMessage: "Failed to create VCard", ipAddress: ip });
        return text({ error: "Failed to create VCard" });
      }
      const publicUrl = await publicUrlBuilder();
      await audit({ tokenId, tokenPrefix, toolName: "vcards_create", targetType: "vcard", targetId: String(created.id), action: "create", result: "success", ipAddress: ip });
      return text({ ...created, publicUrl: publicUrl(created.username) });
    },
  );

  server.tool(
    "vcards_update",
    "Patch one business card by numeric id (see vcards_list); only the fields in `patch` change. A new username must not belong to another card. No delete: archive with patch {\"isActive\":false}, restore with {\"isActive\":true}. socialLinks replaces the whole array.",
    { id: z.number().int().positive(), patch: objectParam },
    async ({ id, patch }) => {
      const parsed = insertVCardSchema.partial().safeParse(patch);
      if (!parsed.success) {
        await audit({ tokenId, tokenPrefix, toolName: "vcards_update", action: "update", result: "error", errorMessage: "Validation error", ipAddress: ip });
        return text({ error: "Validation error", issues: parsed.error.errors });
      }
      const data = parsed.data;
      const [current] = await db.select().from(vcards).where(eq(vcards.id, id));
      if (!current) {
        await audit({ tokenId, tokenPrefix, toolName: "vcards_update", action: "update", result: "error", errorMessage: "Not found", ipAddress: ip });
        return text({ error: "Not found" });
      }
      if (data.username !== undefined) {
        const taken = await db.select().from(vcards).where(and(eq(vcards.username, data.username), ne(vcards.id, id)));
        if (taken.length > 0) {
          await audit({ tokenId, tokenPrefix, toolName: "vcards_update", targetType: "vcard", targetId: String(id), action: "update", result: "error", errorMessage: "Username already exists", ipAddress: ip });
          return text({ error: "Username já existe." });
        }
      }
      let updated;
      try {
        [updated] = await db.update(vcards).set({ ...data, updatedAt: new Date() }).where(eq(vcards.id, id)).returning();
      } catch (err) {
        console.error(err);
        await audit({ tokenId, tokenPrefix, toolName: "vcards_update", targetType: "vcard", targetId: String(id), action: "update", result: "error", errorMessage: "Failed to update VCard", ipAddress: ip });
        return text({ error: "Failed to update VCard" });
      }
      const publicUrl = await publicUrlBuilder();
      await audit({ tokenId, tokenPrefix, toolName: "vcards_update", targetType: "vcard", targetId: String(id), action: "update", result: "success", ipAddress: ip });
      return text({ ...updated, publicUrl: publicUrl(updated.username) });
    },
  );
}
