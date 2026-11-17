import { eq } from "drizzle-orm";
import { db } from "../db.js";
import { liveSessions } from "#shared/schema/liveSharing.js";
import type { LiveSessionStore } from "./store.js";

export const postgresLiveSessionStore: LiveSessionStore = {
  async get(id) {
    return (await db.select().from(liveSessions).where(eq(liveSessions.id, id)))[0];
  },
  async create(row) {
    await db.insert(liveSessions).values(row);
  },
  async mutate(id, work) {
    return db.transaction(async (tx) => {
      const [row] = await tx.select().from(liveSessions).where(eq(liveSessions.id, id)).for("update");
      if (!row) return undefined;
      const result = work(row);
      // Only mutable state is written: never resend the pinned JSON snapshot.
      await tx.update(liveSessions).set({
        controllerHash: row.controllerHash, audienceHash: row.audienceHash,
        slideIndex: row.slideIndex, language: row.language, revision: row.revision,
        status: row.status, lastCommandId: row.lastCommandId, lastSeenAt: row.lastSeenAt,
      }).where(eq(liveSessions.id, id));
      return result;
    });
  },
};
