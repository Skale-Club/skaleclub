import { asc, eq } from "drizzle-orm";
import { db } from "../db.js";
import { downloadableApps, type DownloadableAppInput } from "#shared/schema/downloads.js";

export const downloadableAppStore = {
  list: async (includeDrafts = false) => db.select().from(downloadableApps)
    .where(includeDrafts ? undefined : eq(downloadableApps.isPublished, true)).orderBy(asc(downloadableApps.name)),
  async get(slug: string) {
    const [app] = await db.select().from(downloadableApps).where(eq(downloadableApps.slug, slug));
    return app;
  },
  async create(input: DownloadableAppInput) {
    const [app] = await db.insert(downloadableApps).values(input).returning();
    return app;
  },
  async update(id: string, input: DownloadableAppInput) {
    const [app] = await db.update(downloadableApps).set({ ...input, updatedAt: new Date() })
      .where(eq(downloadableApps.id, id)).returning();
    return app;
  },
};
