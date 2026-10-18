import type { Express, Request } from "express";
import crypto from "crypto";

import { storage } from "../storage.js";
import {
  queueHubAccessEventGhlSync,
  skipHubAccessEventGhlSync,
} from "../lib/skale-hub-ghl-sync.js";
import {
  getHubLivePhase,
  hubAccessRequestSchema,
  hubRegisterRequestSchema,
  hubLiveStatusSchema,
  insertHubLiveSchema,
  normalizeHubPhone,
  normalizeHubEmail,
  type HubLive,
  type HubLivePhase,
  type HubRegistrationState,
} from "#shared/schema.js";
import { requireAdmin, setPublicCache } from "./_shared.js";
import { rateLimitMiddleware } from "../lib/rateLimit.js";
import { isBotSubmission } from "../lib/botTrap.js";

// Public intake and access are unauthenticated; without a limit a loop could
// register thousands of participants or probe integer participant ids.
const hubPublicRateLimit = rateLimitMiddleware({
  limit: 20,
  windowMs: 10 * 60_000,
  message: "Too many requests. Please try again in a few minutes.",
});

// `participantId` alone proves nothing: ids are sequential, so anyone could
// claim any registered participant. /register hands back an HMAC of the id,
// and /access only trusts the id when that token comes with it.
function signParticipant(id: number): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    // Fail closed: an HMAC keyed with "" would be forgeable by anyone.
    throw new Error("SESSION_SECRET is not configured");
  }
  return crypto
    .createHmac("sha256", secret)
    .update(`skale-hub-participant:${id}`)
    .digest("hex");
}
function participantTokenValid(id: number, token: unknown): boolean {
  if (typeof token !== "string") return false;
  const expected = Buffer.from(signParticipant(id));
  const given = Buffer.from(token);
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

function parseLiveId(value: string): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

// Hashed `req.ip`, not the client-supplied header (see server/lib/turnstile.ts).
function getRequestIpHash(req: Request): string | null {
  const rawIp = (req.ip || "").toString();
  return rawIp ? crypto.createHash("sha256").update(rawIp).digest("hex") : null;
}

const MAX_ACCESS_METADATA_CHARS = 4000;

function isUniqueViolation(err: unknown): boolean {
  const code = (err as { code?: string } | null)?.code
    ?? (err as { cause?: { code?: string } } | null)?.cause?.code;
  return code === "23505";
}

// The live shown on the public page: the one in progress, else the latest
// ended one that still has a replay to watch.
async function getPublicHubLive(): Promise<HubLive | undefined> {
  return (await storage.getCurrentHubLive()) ?? (await storage.getLatestReplayHubLive());
}

// An admin-ended live is over even if its scheduled window has not elapsed yet.
function getLivePhase(live: HubLive, now: Date = new Date()): HubLivePhase {
  return live.status === "ended" ? "ended" : getHubLivePhase(live, now);
}

function hasUrl(value?: string | null): boolean {
  return Boolean(value && value.trim());
}

async function getRegistrationState(live: HubLive, phase: HubLivePhase, now: Date = new Date()): Promise<HubRegistrationState> {
  if (phase === "ended") {
    return hasUrl(live.replayUrl) ? "open" : "closed";
  }
  if (live.registrationOpensAt && now < new Date(live.registrationOpensAt)) {
    return "not_yet_open";
  }
  if (live.registrationClosesAt && now >= new Date(live.registrationClosesAt)) {
    return "closed";
  }
  if (live.capacity != null && (await storage.countActiveHubRegistrations(live.id)) >= live.capacity) {
    return "full";
  }
  return "open";
}

const REGISTRATION_BLOCKED_MESSAGES: Record<Exclude<HubRegistrationState, "open">, string> = {
  not_yet_open: "Registration for this live has not opened yet.",
  closed: "Registration for this live is closed.",
  full: "This live is full.",
};

type HubDeniedCode = "live_not_available" | "registration_required" | "registration_not_allowed" | "destination_missing";

function validateLiveWindow(times: {
  startsAt?: Date | null;
  endsAt?: Date | null;
  registrationOpensAt?: Date | null;
  registrationClosesAt?: Date | null;
}): string | null {
  const { startsAt, endsAt, registrationOpensAt, registrationClosesAt } = times;
  if (startsAt && endsAt && endsAt.getTime() <= startsAt.getTime()) {
    return "End time must be after the start time";
  }
  if (registrationOpensAt && registrationClosesAt && registrationClosesAt.getTime() <= registrationOpensAt.getTime()) {
    return "Registration close time must be after the open time";
  }
  return null;
}

export function registerSkaleHubRoutes(app: Express) {
  app.get("/api/skale-hub/active", async (_req, res) => {
    try {
      setPublicCache(res, 30);
      const live = await getPublicHubLive();

      if (!live) {
        return res.json({ live: null, message: "No active live right now." });
      }

      const phase = getLivePhase(live);
      return res.json({
        live: {
          id: live.id,
          slug: live.slug,
          title: live.title,
          description: live.description,
          hostName: live.hostName,
          timezone: live.timezone,
          startsAt: live.startsAt,
          endsAt: live.endsAt,
          registrationOpensAt: live.registrationOpensAt,
          registrationClosesAt: live.registrationClosesAt,
          status: live.status,
          hasStream: hasUrl(live.streamUrl),
          hasReplay: hasUrl(live.replayUrl),
          phase,
          registrationState: await getRegistrationState(live, phase),
        },
      });
    } catch (err) {
      console.error("[skale-hub] GET /api/skale-hub/active failed", err);
      return res.status(500).json({ message: "Failed to load the active live" });
    }
  });

  app.post("/api/skale-hub/register", hubPublicRateLimit, async (req, res) => {
    try {
      // Bot trap: a filled honeypot gets an ordinary "no live" answer — no
      // participant row, no GHL sync, no access token.
      if (isBotSubmission(req.body, { source: "skale-hub/register", checkElapsed: false, ip: req.ip, userAgent: req.get("user-agent") })) {
        return res.status(409).json({ code: "no_live", message: "No active live right now." });
      }
      const parsed = hubRegisterRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0].message });
      }

      const live = await getPublicHubLive();
      if (!live) {
        return res.status(409).json({ code: "no_live", message: "No active live right now." });
      }

      const phase = getLivePhase(live);
      const registrationState = await getRegistrationState(live, phase);

      // Someone already registered for this live may always get back in, even
      // after registration closed or the live filled up. Anyone else is turned
      // away BEFORE a participant row is created.
      if (registrationState !== "open") {
        const known = await storage.findHubParticipantByIdentity({
          phone: parsed.data.phone ?? null,
          email: parsed.data.email ?? null,
          phoneNormalized: normalizeHubPhone(parsed.data.phone),
          emailNormalized: normalizeHubEmail(parsed.data.email),
        });
        const knownRegistration = known ? await storage.getHubRegistration(live.id, known.id) : undefined;
        if (!knownRegistration) {
          return res.status(409).json({
            code: registrationState,
            message: REGISTRATION_BLOCKED_MESSAGES[registrationState],
          });
        }
      }

      const participant = await storage.upsertHubParticipant({
        fullName: parsed.data.name,
        phoneRaw: parsed.data.phone ?? null,
        emailRaw: parsed.data.email ?? null,
        phoneNormalized: normalizeHubPhone(parsed.data.phone),
        emailNormalized: normalizeHubEmail(parsed.data.email),
        source: "hub-form",
      });

      const existing = await storage.getHubRegistration(live.id, participant.id);
      if (existing && (existing.status === "cancelled" || existing.status === "waitlisted")) {
        // Re-submitting the form must not undo an admin's cancellation.
        return res.status(403).json({
          code: "registration_not_allowed",
          message: "Registration is not approved for this live",
        });
      }

      const registration = await storage.upsertHubRegistration({
        liveId: live.id,
        participantId: participant.id,
        status: "approved",
        source: "hub-form",
        registeredAt: existing?.registeredAt ?? new Date(),
        lastAccessAt: existing?.lastAccessAt ?? null,
      });

      const matchedBy = normalizeHubPhone(parsed.data.phone)
        ? "phone"
        : normalizeHubEmail(parsed.data.email)
          ? "email"
          : "none";

      const event = await storage.logHubAccessEvent({
        liveId: live.id,
        participantId: participant.id,
        registrationId: registration.id,
        eventType: "gate_check",
        outcome: "granted",
        matchedBy,
        phoneRaw: parsed.data.phone ?? null,
        emailRaw: parsed.data.email ?? null,
        ipHash: getRequestIpHash(req),
        userAgent: req.headers["user-agent"] ?? null,
        metadata: { source: "register" },
        createdAt: new Date(),
      });

      // Sign before kicking off the GHL sync so a missing SESSION_SECRET fails
      // the request without leaving background work behind.
      const accessToken = signParticipant(participant.id);

      queueHubAccessEventGhlSync({ live, participant, event });

      return res.json({
        unlocked: true,
        liveId: live.id,
        participantId: participant.id,
        registrationId: registration.id,
        accessToken,
        phase,
        hasStream: hasUrl(live.streamUrl),
        hasReplay: hasUrl(live.replayUrl),
      });
    } catch (err) {
      console.error("[skale-hub] POST /api/skale-hub/register failed", err);
      return res.status(500).json({ message: "Registration failed" });
    }
  });

  app.post("/api/skale-hub/:liveId/access", hubPublicRateLimit, async (req, res) => {
    try {
      const liveId = parseLiveId(req.params.liveId);
      if (!liveId) {
        return res.status(400).json({ message: "Invalid live id" });
      }

      const parsed = hubAccessRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0].message });
      }

      // Identity comes ONLY from the signed token issued by /register. There is
      // deliberately no phone/email lookup: it would reveal who is registered.
      const invalidToken = () => res.status(403).json({
        granted: false,
        code: "invalid_token",
        message: "Please register again.",
      });
      if (!participantTokenValid(parsed.data.participantId, parsed.data.accessToken)) {
        return invalidToken();
      }
      const participant = await storage.getHubParticipant(parsed.data.participantId);
      if (!participant) {
        return invalidToken();
      }

      const live = await storage.getHubLive(liveId);
      if (!live) {
        return res.status(409).json({ granted: false, code: "live_not_available", message: "This live is not available." });
      }

      const phase = getLivePhase(live);
      const eventType = phase === "ended" ? "replay" : "join";
      const registration = await storage.getHubRegistration(live.id, participant.id);

      const metadata = JSON.stringify(parsed.data.metadata).length > MAX_ACCESS_METADATA_CHARS
        ? {}
        : parsed.data.metadata;

      const baseEvent = {
        liveId: live.id,
        participantId: participant.id,
        registrationId: registration?.id ?? null,
        eventType,
        matchedBy: "manual",
        phoneRaw: participant.phoneRaw,
        emailRaw: participant.emailRaw,
        ipHash: getRequestIpHash(req),
        userAgent: req.headers["user-agent"] ?? null,
      } as const;

      // Denied attempts are logged for the admin but never sent to GHL.
      const deny = async (status: number, code: HubDeniedCode, message: string) => {
        const event = await storage.logHubAccessEvent({
          ...baseEvent,
          outcome: "denied",
          metadata: { ...metadata, reason: code },
          createdAt: new Date(),
        });
        await skipHubAccessEventGhlSync(event.id, "access denied");
        return res.status(status).json({ granted: false, code, message });
      };

      if (live.status !== "live" && live.status !== "ended") {
        return deny(409, "live_not_available", "This live is not available.");
      }

      if (!registration) {
        return deny(403, "registration_required", "Registration required");
      }

      if (registration.status === "cancelled" || registration.status === "waitlisted") {
        return deny(403, "registration_not_allowed", "Registration is not approved for this live");
      }

      const destinationUrl = phase === "ended"
        ? (hasUrl(live.replayUrl) ? live.replayUrl : null)
        : (hasUrl(live.streamUrl) ? live.streamUrl : hasUrl(live.replayUrl) ? live.replayUrl : null);

      if (!destinationUrl) {
        return deny(409, "destination_missing", "Live link unavailable");
      }

      // Decide "first access" BEFORE logging the granted event: logging stamps
      // registration.lastAccessAt (gate_check events do not).
      const isFirstAccess = registration.lastAccessAt == null;

      const event = await storage.logHubAccessEvent({
        ...baseEvent,
        outcome: "granted",
        metadata,
        createdAt: new Date(),
      });

      if (isFirstAccess) {
        queueHubAccessEventGhlSync({ live, participant, event });
      } else {
        await skipHubAccessEventGhlSync(event.id, "repeat access");
      }

      return res.json({
        granted: true,
        destinationUrl,
        eventType,
        liveId: live.id,
        participantId: participant.id,
        registrationId: registration.id,
      });
    } catch (err) {
      console.error("[skale-hub] POST /api/skale-hub/:liveId/access failed", err);
      return res.status(500).json({ message: "Access check failed" });
    }
  });

  app.get("/api/skale-hub/dashboard", requireAdmin, async (_req, res) => {
    try {
      return res.json(await storage.getHubDashboardSummary());
    } catch (err) {
      console.error("[skale-hub] GET /api/skale-hub/dashboard failed", err);
      return res.status(500).json({ message: "Failed to load dashboard" });
    }
  });

  app.get("/api/skale-hub/participants", requireAdmin, async (req, res) => {
    try {
      const search = typeof req.query.search === "string" ? req.query.search : undefined;
      return res.json(await storage.listHubParticipantHistory(search));
    } catch (err) {
      console.error("[skale-hub] GET /api/skale-hub/participants failed", err);
      return res.status(500).json({ message: "Failed to load participants" });
    }
  });

  app.get("/api/skale-hub/lives", requireAdmin, async (req, res) => {
    try {
      const rawStatus = typeof req.query.status === "string" ? req.query.status : undefined;
      const parsedStatus = hubLiveStatusSchema.optional().safeParse(rawStatus);
      if (!parsedStatus.success) {
        return res.status(400).json({ message: parsedStatus.error.errors[0].message });
      }

      return res.json(await storage.listHubLiveSummaries(parsedStatus.data));
    } catch (err) {
      console.error("[skale-hub] GET /api/skale-hub/lives failed", err);
      return res.status(500).json({ message: "Failed to load lives" });
    }
  });

  app.get("/api/skale-hub/lives/:id", requireAdmin, async (req, res) => {
    try {
      const liveId = parseLiveId(req.params.id);
      if (!liveId) {
        return res.status(400).json({ message: "Invalid live id" });
      }

      const live = await storage.getHubLive(liveId);
      if (!live) {
        return res.status(404).json({ message: "Live not found" });
      }

      return res.json({
        live: await storage.getHubLiveSummary(liveId),
        registrations: await storage.listHubRegistrationSummaries(liveId),
        accessEvents: await storage.listHubAccessEvents(liveId, 100),
      });
    } catch (err) {
      console.error("[skale-hub] GET /api/skale-hub/lives/:id failed", err);
      return res.status(500).json({ message: "Failed to load live" });
    }
  });

  app.post("/api/skale-hub/lives", requireAdmin, async (req, res) => {
    try {
      const parsed = insertHubLiveSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0].message });
      }

      const windowError = validateLiveWindow(parsed.data);
      if (windowError) {
        return res.status(400).json({ message: windowError });
      }

      // A live that should go live is created as "scheduled" first and then
      // activated atomically, so two rows are never "live" at the same time.
      const wantsLive = parsed.data.status === "live";
      const created = await storage.createHubLive(wantsLive ? { ...parsed.data, status: "scheduled" } : parsed.data);
      if (wantsLive) {
        await storage.activateHubLive(created.id, { status: "live" });
      }

      return res.status(201).json(await storage.getHubLiveSummary(created.id));
    } catch (err) {
      if (isUniqueViolation(err)) {
        return res.status(409).json({ message: "A live with this slug already exists" });
      }
      console.error("[skale-hub] POST /api/skale-hub/lives failed", err);
      return res.status(500).json({ message: "Failed to create live" });
    }
  });

  app.put("/api/skale-hub/lives/:id", requireAdmin, async (req, res) => {
    try {
      const liveId = parseLiveId(req.params.id);
      if (!liveId) {
        return res.status(400).json({ message: "Invalid live id" });
      }

      const existing = await storage.getHubLive(liveId);
      if (!existing) {
        return res.status(404).json({ message: "Live not found" });
      }

      const parsed = insertHubLiveSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0].message });
      }

      const windowError = validateLiveWindow({
        startsAt: parsed.data.startsAt !== undefined ? parsed.data.startsAt : existing.startsAt,
        endsAt: parsed.data.endsAt !== undefined ? parsed.data.endsAt : existing.endsAt,
        registrationOpensAt: parsed.data.registrationOpensAt !== undefined ? parsed.data.registrationOpensAt : existing.registrationOpensAt,
        registrationClosesAt: parsed.data.registrationClosesAt !== undefined ? parsed.data.registrationClosesAt : existing.registrationClosesAt,
      });
      if (windowError) {
        return res.status(400).json({ message: windowError });
      }

      if (parsed.data.status === "live") {
        // Field update + demoting the previous live happen in one transaction.
        await storage.activateHubLive(liveId, parsed.data);
      } else {
        await storage.updateHubLive(liveId, parsed.data);
      }

      return res.json(await storage.getHubLiveSummary(liveId));
    } catch (err) {
      if (isUniqueViolation(err)) {
        return res.status(409).json({ message: "A live with this slug already exists" });
      }
      console.error("[skale-hub] PUT /api/skale-hub/lives/:id failed", err);
      return res.status(500).json({ message: "Failed to update live" });
    }
  });

  app.delete("/api/skale-hub/lives/:id", requireAdmin, async (req, res) => {
    try {
      const liveId = parseLiveId(req.params.id);
      if (!liveId) {
        return res.status(400).json({ message: "Invalid live id" });
      }

      const deleted = await storage.deleteHubLive(liveId);
      if (!deleted) {
        return res.status(404).json({ message: "Live not found" });
      }

      return res.status(204).end();
    } catch (err) {
      console.error("[skale-hub] DELETE /api/skale-hub/lives/:id failed", err);
      return res.status(500).json({ message: "Failed to delete live" });
    }
  });
}
