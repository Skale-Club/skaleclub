import { sql } from "drizzle-orm";
import { db } from "../db.js";
import { bootstrapTasks } from "#shared/schema.js";
import { applyContentFixes, ensure3dPrintingService, syncProductArtwork, type TaskResult } from "./contentFixes.js";

/**
 * Maintenance that used to be "run this script against production" now runs
 * itself: once after every boot (a few seconds after listen, off the request
 * path), on demand from POST /api/admin/bootstrap/run and from the MCP
 * `bootstrap_tasks_run` tool. Nothing in the deploy pipeline applies
 * migrations or scripts, so anything that must reach production has to be
 * able to apply itself.
 *
 * A task returns `done: true` when nothing is left to do and is then skipped
 * on later runs; `done: false` (a site unreachable, no API key yet) keeps it
 * queued for the next boot, with the reason stored for the admin to read.
 */
interface Task {
  name: string;
  description: string;
  run: () => Promise<TaskResult>;
}

const TASKS: Task[] = [
  { name: "content-fixes-2026-09", description: "SEO title/keywords, portfolio hero, links-page placeholders, portfolio order", run: applyContentFixes },
  { name: "service-3d-printing", description: "3D Printing card in Our Services, with a generated image", run: ensure3dPrintingService },
  { name: "product-artwork", description: "Product icons and photos copied from each X app's own site", run: syncProductArtwork },
];

let tableReady: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  if (!tableReady) {
    tableReady = db
      .execute(
        sql`CREATE TABLE IF NOT EXISTS "bootstrap_tasks" (
          "name" text PRIMARY KEY,
          "completed_at" timestamptz,
          "last_error" text,
          "notes" text,
          "updated_at" timestamptz NOT NULL DEFAULT now()
        )`,
      )
      .then(() => undefined)
      .catch((err) => {
        tableReady = null;
        throw err;
      });
  }
  return tableReady;
}

export interface BootstrapRunEntry {
  name: string;
  description: string;
  status: "completed" | "pending" | "failed" | "skipped";
  notes: string[];
  error?: string;
}

let running: Promise<BootstrapRunEntry[]> | null = null;

/** Runs every task that is not yet complete (all of them with `force`). Serialised per process. */
export function runBootstrapTasks(opts: { force?: boolean } = {}): Promise<BootstrapRunEntry[]> {
  if (running) return running;
  running = (async () => {
    await ensureTable();
    const rows = await db.select().from(bootstrapTasks);
    const out: BootstrapRunEntry[] = [];
    for (const task of TASKS) {
      const row = rows.find((r) => r.name === task.name);
      if (row?.completedAt && !opts.force) {
        out.push({ name: task.name, description: task.description, status: "skipped", notes: [] });
        continue;
      }
      try {
        const result = await task.run();
        await db
          .insert(bootstrapTasks)
          .values({ name: task.name, completedAt: result.done ? new Date() : null, lastError: null, notes: result.notes.join("\n"), updatedAt: new Date() })
          .onConflictDoUpdate({
            target: bootstrapTasks.name,
            set: { completedAt: result.done ? new Date() : null, lastError: null, notes: result.notes.join("\n"), updatedAt: new Date() },
          });
        out.push({ name: task.name, description: task.description, status: result.done ? "completed" : "pending", notes: result.notes });
        console.log(`[bootstrap] ${task.name}: ${result.done ? "completed" : "pending"}${result.notes.length ? " — " + result.notes.join(" | ") : ""}`);
      } catch (err) {
        const message = (err as Error).message || String(err);
        await db
          .insert(bootstrapTasks)
          .values({ name: task.name, lastError: message, updatedAt: new Date() })
          .onConflictDoUpdate({ target: bootstrapTasks.name, set: { lastError: message, updatedAt: new Date() } })
          .catch(() => undefined);
        out.push({ name: task.name, description: task.description, status: "failed", notes: [], error: message });
        console.error(`[bootstrap] ${task.name} failed:`, err);
      }
    }
    return out;
  })().finally(() => {
    running = null;
  });
  return running;
}

/** Current state of every task, for the admin route and the MCP status tool. */
export async function listBootstrapTasks() {
  await ensureTable();
  const rows = await db.select().from(bootstrapTasks);
  return TASKS.map((task) => {
    const row = rows.find((r) => r.name === task.name);
    return {
      name: task.name,
      description: task.description,
      completedAt: row?.completedAt ?? null,
      lastError: row?.lastError ?? null,
      notes: row?.notes ?? null,
      updatedAt: row?.updatedAt ?? null,
    };
  });
}

/** Called once from server/index.ts after listen; never blocks startup. */
export function scheduleBootstrapTasks(): void {
  if (process.env.VERCEL || process.env.DISABLE_BOOTSTRAP_TASKS === "true") return;
  setTimeout(() => {
    runBootstrapTasks().catch((err) => console.error("[bootstrap] run failed:", err));
  }, 5_000).unref();
}
