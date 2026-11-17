import { pgTable, uuid, text, jsonb, boolean, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod";
import { DOWNLOAD_PLATFORMS, DOWNLOAD_ARCHITECTURES } from "../downloads.js";
export { DOWNLOAD_PLATFORMS, DOWNLOAD_ARCHITECTURES, appDownloadPath } from "../downloads.js";
const httpsUrl = z.string().trim().max(2000).url().refine((value) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch { return false; }
}, "Use a public HTTPS URL without credentials");

export const appReleaseSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,79}$/),
  platform: z.enum(DOWNLOAD_PLATFORMS),
  architecture: z.enum(DOWNLOAD_ARCHITECTURES),
  version: z.string().trim().min(1).max(40),
  downloadUrl: httpsUrl,
  requirements: z.string().trim().max(500).default(""),
  notes: z.string().trim().max(5000).default(""),
  sha256: z.string().regex(/^[a-f0-9]{64}$/i).optional(),
  isPublished: z.boolean().default(false),
  autoUpdate: z.boolean().optional(),
}).strict();
export type AppRelease = z.infer<typeof appReleaseSchema>;

export const downloadableAppSchema = z.object({
  slug: z.string().trim().min(1).max(80).regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/),
  name: z.string().trim().min(1).max(120),
  tagline: z.string().trim().min(1).max(240),
  description: z.string().trim().min(1).max(10000),
  features: z.array(z.string().trim().min(1).max(300)).max(20).default([]),
  releases: z.array(appReleaseSchema).max(100).default([]),
  isPublished: z.boolean().default(false),
}).strict().superRefine((app, ctx) => {
  const ids = app.releases.map((release) => release.id);
  if (new Set(ids).size !== ids.length) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["releases"], message: "Release IDs must be unique within an application" });
});
export type DownloadableAppInput = z.infer<typeof downloadableAppSchema>;

// A separate catalog: portfolio_services remains the subscription/SaaS catalog.
export const downloadableApps = pgTable("downloadable_apps", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  tagline: text("tagline").notNull(),
  description: text("description").notNull(),
  features: jsonb("features").$type<string[]>().notNull().default([]),
  releases: jsonb("releases").$type<AppRelease[]>().notNull().default([]),
  isPublished: boolean("is_published").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
export type DownloadableApp = typeof downloadableApps.$inferSelect;
export type PublicDownloadableApp = Omit<DownloadableApp, "isPublished" | "createdAt"> & { pricing: "free" };

export function publicDownloadableApp(app: DownloadableApp): PublicDownloadableApp {
  const { isPublished: _, createdAt: __, ...rest } = app;
  return { ...rest, pricing: "free", releases: app.releases.filter((release) => release.isPublished) };
}
