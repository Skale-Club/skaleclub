import type { Express, Request, Response } from "express";

/**
 * The QR/NFC tag system (phone app, tag links, analytics) moved to Xpot.
 * These redirects keep every old Skale Club URL for it working.
 *
 * - The phone app (/nfc, /smart-tags and anything under them) → 302 to the Xpot
 *   tags app. Temporary on purpose: the app's address is ours to change.
 * - Public tag links (/n/:code, /q/:code) → 301 to the same path on Xpot, with
 *   the query string kept. No piece was printed with a skale.club URL, but if
 *   one ever is, it still lands in the right place.
 *
 * Env is read per request so a config change needs no code change.
 */

export const DEFAULT_XPOT_URL = "https://xpot.place";

function baseUrl(value: string | undefined): string {
  const trimmed = value?.trim().replace(/\/+$/, "");
  return trimmed || DEFAULT_XPOT_URL;
}

export function xpotAppUrl(env: NodeJS.ProcessEnv = process.env): string {
  return `${baseUrl(env.XPOT_APP_URL)}/tags`;
}

export function xpotTagUrl(
  kind: "n" | "q",
  code: string,
  query = "",
  env: NodeJS.ProcessEnv = process.env,
): string {
  return `${baseUrl(env.XPOT_TAGS_BASE_URL)}/${kind}/${encodeURIComponent(code)}${query}`;
}

/** "?a=1&b=2" (or "") exactly as the client sent it. */
function rawQuery(req: Request): string {
  const index = req.originalUrl.indexOf("?");
  return index === -1 ? "" : req.originalUrl.slice(index);
}

export function registerXpotRedirects(app: Express) {
  app.get(["/nfc", "/nfc/*", "/smart-tags", "/smart-tags/*"], (_req: Request, res: Response) => {
    res.redirect(302, xpotAppUrl());
  });

  for (const kind of ["n", "q"] as const) {
    app.get(`/${kind}/:code`, (req: Request, res: Response) => {
      res.redirect(301, xpotTagUrl(kind, req.params.code, rawQuery(req)));
    });
  }
}
