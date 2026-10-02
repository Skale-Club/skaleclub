import type { Request, RequestHandler, Response } from "express";
import {
  normalizeTagCode,
  resolveRedirectTarget,
  validateDestinationUrl,
  type SmartTagAccessMethod,
  type SmartTagEventType,
} from "#shared/smartTags.js";
import type { InsertSmartTagEvent } from "#shared/schema.js";
import { normalizeIpKey, rateLimit } from "../rateLimit.js";
import {
  browserFamilyFromUserAgent,
  deviceTypeFromUserAgent,
  isBotUserAgent,
  osFamilyFromUserAgent,
  referrerHost,
  trustedCountryCode,
  visitorDayKey,
} from "./requestInfo.js";
import { renderTagPage } from "./publicPages.js";

/** The slice of a tag the public routes need — never customer data. */
export interface PublicSmartTag {
  id: string;
  publicCode: string;
  customerId: string | null;
  status: string;
  destinationUrl: string | null;
  utmEnabled: boolean;
  utmCampaign: string | null;
}

export interface PublicSmartTagDeps {
  findByCode(code: string): Promise<PublicSmartTag | null>;
  recordEvent(event: InsertSmartTagEvent): Promise<void>;
  /** Whether the request carries an admin session (for the "configure" shortcut). */
  isAdminRequest(req: Request): Promise<boolean>;
}

// Event writes per client IP per minute. Over the limit the redirect still
// happens; only the analytics row is skipped.
const EVENT_LIMIT = { limit: 60, windowMs: 60_000 };

function setPublicHeaders(res: Response) {
  // Destination changes must take effect on the very next scan.
  res.set("Cache-Control", "no-store");
  res.set("X-Robots-Tag", "noindex, nofollow");
}

export function buildEvent(
  req: Request,
  tag: Pick<PublicSmartTag, "id" | "customerId">,
  method: SmartTagAccessMethod,
  eventType: SmartTagEventType,
  now: Date = new Date(),
): InsertSmartTagEvent {
  const ua = req.get("user-agent") ?? "";
  return {
    tagId: tag.id,
    customerId: tag.customerId,
    accessMethod: method,
    eventType,
    occurredAt: now,
    visitorDayKey: visitorDayKey(req.ip, ua, now),
    deviceType: ua ? deviceTypeFromUserAgent(ua) : null,
    osFamily: ua ? osFamilyFromUserAgent(ua) : null,
    browserFamily: ua ? browserFamilyFromUserAgent(ua) : null,
    countryCode: trustedCountryCode(req.headers),
    referrer: referrerHost(req.get("referer")),
    isBot: isBotUserAgent(ua),
    requestId: req.get("x-request-id")?.slice(0, 100) ?? null,
  };
}

async function record(
  deps: PublicSmartTagDeps,
  req: Request,
  tag: PublicSmartTag,
  method: SmartTagAccessMethod,
  eventType: SmartTagEventType,
) {
  // HEAD (link checkers, prefetchers) is not an interaction.
  if (req.method !== "GET") return;
  if (rateLimit(`smart-tag-event:${normalizeIpKey(req.ip)}`, EVENT_LIMIT)) return;
  try {
    await deps.recordEvent(buildEvent(req, tag, method, eventType));
  } catch (err) {
    console.error(`[smart-tags] failed to record ${eventType} for ${tag.publicCode}:`, err);
  }
}

/**
 * GET /q/:code and GET /n/:code. Server-side 302 to the tag's current
 * destination; the analytics write happens after the response is sent and can
 * never block or break the redirect.
 */
export function createSmartTagHandler(method: SmartTagAccessMethod, deps: PublicSmartTagDeps): RequestHandler {
  return async (req, res) => {
    setPublicHeaders(res);

    const code = normalizeTagCode(req.params.code);
    if (!code) {
      res.status(404).type("html").send(renderTagPage("not_found"));
      return;
    }

    let tag: PublicSmartTag | null;
    try {
      tag = await deps.findByCode(code);
    } catch (err) {
      console.error(`[smart-tags] lookup failed for ${code}:`, err);
      res.status(503).type("html").send(renderTagPage("unavailable"));
      return;
    }

    if (!tag) {
      res.status(404).type("html").send(renderTagPage("not_found"));
      return;
    }

    if (tag.status === "active") {
      const target = resolveRedirectTarget(tag, method);
      // Stored URLs were validated on write; re-check so a bad row can never
      // turn into an open javascript:/data: redirect.
      const valid = target ? validateDestinationUrl(target, { allowHttp: true }) : null;
      if (!valid?.ok) {
        console.error(`[smart-tags] active tag ${tag.publicCode} has no valid destination`);
        res.status(503).type("html").send(renderTagPage("unavailable"));
        await record(deps, req, tag, method, "misconfigured_scan");
        return;
      }
      res.redirect(302, valid.url);
      await record(deps, req, tag, method, "redirect");
      return;
    }

    if (tag.status === "inventory" || tag.status === "assigned") {
      let isAdmin = false;
      try {
        isAdmin = await deps.isAdminRequest(req);
      } catch {
        isAdmin = false;
      }
      res.status(200).type("html").send(renderTagPage("inactive", {
        code: tag.publicCode,
        configureUrl: isAdmin ? `/admin/smart-tags/tags/${encodeURIComponent(tag.id)}` : undefined,
      }));
      await record(deps, req, tag, method, "inventory_scan");
      return;
    }

    // disabled / retired (or any unknown status): generic, no reason exposed.
    res.status(410).type("html").send(renderTagPage("unavailable"));
    await record(deps, req, tag, method, "disabled_scan");
  };
}
