import { desc, eq, lt, and } from "drizzle-orm";
import { db } from "../db.js";
import { systemHeartbeats } from "#shared/schema.js";

/**
 * Scheduled jobs write one `system_heartbeats` row per run so an operator (or an
 * uptime monitor hitting GET /api/health/jobs) can tell a silent cron from a
 * healthy one. `source` is the job name; `note` carries the outcome.
 */
export const JOB_SOURCES = ["blog-generate", "rss-sync", "xphere-sweep"] as const;
export type JobSource = (typeof JOB_SOURCES)[number];

/** A job is reported stale once its last heartbeat is older than this. */
export const JOB_STALE_AFTER_SECONDS: Record<JobSource, number | null> = {
  "blog-generate": 26 * 60 * 60,
  "rss-sync": null,
  "xphere-sweep": 2 * 60 * 60,
};

const RETENTION_DAYS = 14;

/** Never throws: a failed heartbeat must not fail (or mask) the job itself. */
export async function recordJobHeartbeat(source: JobSource, note = "ok"): Promise<void> {
  try {
    await db.insert(systemHeartbeats).values({ source, note: note.slice(0, 500) });
    // Housekeeping on ~2% of writes keeps the table from growing without bound.
    if (Math.random() < 0.02) {
      const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
      await db
        .delete(systemHeartbeats)
        .where(and(eq(systemHeartbeats.source, source), lt(systemHeartbeats.createdAt, cutoff)));
    }
  } catch (err) {
    console.warn(`[heartbeat] failed to record ${source}:`, (err as Error).message);
  }
}

export interface JobHealth {
  source: JobSource;
  lastRunAt: string | null;
  ageSeconds: number | null;
  lastNote: string | null;
  stale: boolean;
}

export async function getJobsHealth(now = Date.now()): Promise<JobHealth[]> {
  const out: JobHealth[] = [];
  for (const source of JOB_SOURCES) {
    const [row] = await db
      .select({ createdAt: systemHeartbeats.createdAt, note: systemHeartbeats.note })
      .from(systemHeartbeats)
      .where(eq(systemHeartbeats.source, source))
      .orderBy(desc(systemHeartbeats.createdAt))
      .limit(1);
    const last = row?.createdAt ?? null;
    const ageSeconds = last ? Math.max(0, Math.round((now - last.getTime()) / 1000)) : null;
    const limit = JOB_STALE_AFTER_SECONDS[source];
    out.push({
      source,
      lastRunAt: last ? last.toISOString() : null,
      ageSeconds,
      lastNote: row?.note ?? null,
      // A job that never ran only counts as stale where a limit is defined.
      stale: limit !== null && (ageSeconds === null || ageSeconds > limit),
    });
  }
  return out;
}
