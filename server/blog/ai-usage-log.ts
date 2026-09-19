// server/blog/ai-usage-log.ts
//
// SOURCE OF TRUTH: websites/server/integrations/ai-generation-orchestrator.ts
// (logAiGeneration) — sync changes back. Ported here as part of the auto-blog
// parity work (autoblog-parity SC-08, MASTER §3.6).
//
// One row per AI call the blog pipeline makes, so spend is visible before the
// OpenRouter invoice rather than after.
//
// Two rules this module exists to enforce:
//   1. Logging NEVER fails a generation. Every error is swallowed. A post that
//      was written and published must not be undone because the bookkeeping
//      row would not insert.
//   2. The prompt is truncated. This is a cost ledger, not an archive of every
//      prompt the site has ever sent.

import { aiGenerationLogs } from "#shared/schema.js";
import type { BlogAiStep } from "#shared/blog-contract.js";

const MAX_LOGGED_PROMPT_CHARS = 2000;

export interface AiUsageEntry {
  step: BlogAiStep;
  provider: "openrouter";
  model: string;
  prompt?: string | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  costUsd?: number | null;
  status: "success" | "failure" | "skipped";
  error?: string | null;
  durationMs?: number | null;
}

export async function logAiUsage(entry: AiUsageEntry): Promise<void> {
  try {
    const { db } = await import("../db.js");
    await db.insert(aiGenerationLogs).values({
      step: entry.step,
      provider: entry.provider,
      model: entry.model,
      prompt: entry.prompt ? entry.prompt.slice(0, MAX_LOGGED_PROMPT_CHARS) : null,
      inputTokens: entry.inputTokens ?? null,
      outputTokens: entry.outputTokens ?? null,
      // Drizzle maps numeric to string; a JS number silently stores nothing
      // useful on some drivers.
      costUsd: entry.costUsd != null ? String(entry.costUsd) : null,
      status: entry.status,
      error: entry.error ? entry.error.slice(0, 1000) : null,
      durationMs: entry.durationMs ?? null,
    });
  } catch (err) {
    // Deliberately swallowed — see rule 1. Pre-migration this is a missing
    // relation, which must not stop the site publishing.
    console.warn(`[ai-usage-log] insert failed (non-fatal): ${(err as Error).message}`);
  }
}
