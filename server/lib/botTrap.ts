// Honeypot + minimum fill time for public lead forms. The client sends a hidden
// `hp_extra` field (must stay empty) and `elapsedMs`, measured on the client
// (Date.now() minus form open), so browser and server clocks are never compared.
// A missing `elapsedMs` skips the timing check entirely.
const MIN_FILL_MS = 3000;
let trippedCount = 0;

export function isBotSubmission(
  body: unknown,
  opts: { checkElapsed?: boolean; source: string },
): boolean {
  const b = (body ?? {}) as { hp_extra?: unknown; elapsedMs?: unknown };
  const honeypotFilled = typeof b.hp_extra === "string" && b.hp_extra.trim() !== "";
  const tooFast =
    (opts.checkElapsed ?? true) &&
    typeof b.elapsedMs === "number" &&
    Number.isFinite(b.elapsedMs) &&
    b.elapsedMs >= 0 &&
    b.elapsedMs < MIN_FILL_MS;
  if (!honeypotFilled && !tooFast) return false;
  trippedCount += 1;
  console.warn(`[bot-trap] ${opts.source} dropped (${honeypotFilled ? "honeypot" : "too fast"}), total=${trippedCount}`);
  return true;
}
