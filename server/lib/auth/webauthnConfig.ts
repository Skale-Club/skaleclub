export const RP_NAME = "Skale Club";

export interface RelyingParty {
  rpID: string;
  origins: string[];
}

const SKALE_HOSTS = new Set(["skale.club", "www.skale.club", "skaleclub-stage.skale.club"]);
const SKALE_ORIGINS = ["https://skale.club", "https://www.skale.club", "https://skaleclub-stage.skale.club"];

/**
 * Maps the request hostname to the WebAuthn relying party. Unknown hosts get
 * null (the caller answers 400): a credential must never be bound to an
 * attacker-controlled Host header. localhost is only allowed outside production.
 */
export function resolveRelyingParty(
  hostname: string | undefined,
  opts: { production: boolean; port?: string | number } = { production: process.env.NODE_ENV === "production" },
): RelyingParty | null {
  const host = (hostname || "").toLowerCase();
  if (SKALE_HOSTS.has(host)) return { rpID: "skale.club", origins: SKALE_ORIGINS };
  if (!opts.production && host === "localhost") {
    const ports = new Set(["1000"]);
    if (opts.port) ports.add(String(opts.port));
    return { rpID: "localhost", origins: Array.from(ports).map((p) => `http://localhost:${p}`) };
  }
  return null;
}
