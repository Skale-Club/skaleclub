import express, { type Express, type Request, type Response } from "express";

// Sentry tunnel. Browsers block requests to *.sentry.io whenever an ad blocker
// or strict privacy setting is on; the client instead POSTs its envelopes here
// (Sentry `tunnel: "/api/monitoring"`) and the server relays them.
//
// Locked down so it cannot become an open relay: the target is built only from
// the configured DSN, the envelope header must name that same DSN, and the body
// is capped at 1 MB.

const MAX_BODY_BYTES = 1024 * 1024;
const UPSTREAM_TIMEOUT_MS = 5000;

interface ParsedDsn {
  publicKey: string;
  host: string;
  projectId: string;
}

function parseDsn(value: string | undefined): ParsedDsn | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    const projectId = url.pathname.split("/").filter(Boolean).pop();
    if (!url.username || !projectId) return null;
    return { publicKey: url.username, host: url.host, projectId };
  } catch {
    return null;
  }
}

function configuredDsn(): ParsedDsn | null {
  return parseDsn(process.env.SENTRY_DSN) ?? parseDsn(process.env.VITE_SENTRY_DSN);
}

export function registerMonitoringRoute(app: Express) {
  // Raw body of any content type: a Sentry envelope is newline-delimited JSON
  // sent as text/plain, which the JSON parser would ignore anyway.
  app.post(
    "/api/monitoring",
    express.raw({ type: () => true, limit: MAX_BODY_BYTES }),
    async (req: Request, res: Response) => {
      const dsn = configuredDsn();
      if (!dsn) return res.status(404).end();

      const body = req.body;
      if (!Buffer.isBuffer(body) || body.length === 0) return res.status(400).end();

      // The first line of an envelope is its JSON header.
      const headerLine = body.subarray(0, Math.max(0, body.indexOf(0x0a))).toString("utf8");
      let envelopeDsn: ParsedDsn | null = null;
      try {
        envelopeDsn = parseDsn((JSON.parse(headerLine) as { dsn?: string }).dsn);
      } catch {
        return res.status(400).end();
      }
      if (
        !envelopeDsn ||
        envelopeDsn.host !== dsn.host ||
        envelopeDsn.projectId !== dsn.projectId ||
        envelopeDsn.publicKey !== dsn.publicKey
      ) {
        return res.status(400).end();
      }

      try {
        const upstream = await fetch(`https://${dsn.host}/api/${dsn.projectId}/envelope/`, {
          method: "POST",
          headers: { "Content-Type": "application/x-sentry-envelope" },
          body,
          signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
        });
        return res.status(upstream.status).end();
      } catch (err) {
        console.warn("[monitoring] Sentry relay failed:", (err as Error).message);
        return res.status(502).end();
      }
    },
  );
}
