// Honeypot + minimum fill time for public lead forms. The client sends a hidden
// `hp_extra` field (must stay empty) and `elapsedMs`, measured on the client
// (Date.now() minus form open), so browser and server clocks are never compared.
// A missing `elapsedMs` skips the timing check entirely.
//
// Thin wrapper over the shared bot-defense core (./botDefense.ts), so a trip
// from one IP also counts toward a temporary ban when it keeps happening.
import { isBotSubmission as coreIsBotSubmission } from "./botDefense.js";

export function isBotSubmission(
  body: unknown,
  opts: { checkElapsed?: boolean; source: string; ip?: string | null; userAgent?: string | null },
): boolean {
  return coreIsBotSubmission(body, {
    source: opts.source,
    fields: ["hp_extra"],
    elapsedField: "elapsedMs",
    checkElapsed: opts.checkElapsed,
    ip: opts.ip,
    userAgent: opts.userAgent,
  });
}
