import type { Express, Request } from "express";
import crypto from "crypto";

import { storage } from "../storage.js";
import { syncHubAccessEventToGhl } from "../lib/skale-hub-ghl-sync.js";
import {
  hubAccessRequestSchema,
  hubRegisterRequestSchema,
  hubLiveStatusSchema,
  insertHubLiveSchema,
  normalizeHubPhone,
  normalizeHubEmail,
} from "#shared/schema.js";
import { requireAdmin, setPublicCache } from "./_shared.js";

function parseLiveId(value: string): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function getRequestIpHash(req: Request): string | null {
  const rawIp = ((req.headers["x-forwarded-for"] as string) || req.ip || "").toString();
  return rawIp ? crypto.createHash("sha256").update(rawIp).digest("hex") : null;
}

function getMatchedBy(params: { participantId?: number | null; phone?: string | null; email?: string | null }): "manual" | "phone" | "email" | "none" {
  if (params.participantId) {
    return "manual";
  }
  if (normalizeHubPhone(params.phone)) {
    return "phone";
  }
  if (normalizeHubEmail(params.email)) {
    return "email";
  }
  return "none";
}

export function registerSkaleHubRoutes(app: Express) {
  app.get("/api/skale-hub/active", async (_req, res) => {
    try {
      setPublicCache(res, 30);
      const live = await storage.getCurrentHubLive();

      if (!live) {
        return res.json({ live: null, message: "No active live right now." });
      }

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
          hasReplay: Boolean(live.replayUrl),
        },
      });
    } catch (err) {
      return res.status(500).json({ message: (err as Error).message });
    }
  });

  app.post("/api/skale-hub/register", async (req, res) => {
    try {
      const parsed = hubRegisterRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0].message });
      }

      const live = await storage.getCurrentHubLive();
      if (!live) {
        return res.status(409).json({ message: "No active live right now." });
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

      await syncHubAccessEventToGhl({ live, participant, event });

      return res.json({
        unlocked: true,
        liveId: live.id,
        participantId: participant.id,
        registrationId: registration.id,
        access: {
          streamUrl: live.streamUrl ?? null,
          replayUrl: live.replayUrl ?? null,
        },
      });
    } catch (err) {
      return res.status(500).json({ message: (err as Error).message });
    }
  });

  app.post("/api/skale-hub/:liveId/access", async (req, res) => {
    try {
      const liveId = parseLiveId(req.params.liveId);
      if (!liveId) {
        return res.status(400).json({ message: "Invalid live id" });
      }

      const parsed = hubAccessRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0].message });
      }

      const live = await storage.getHubLive(liveId);
      if (!live) {
        return res.status(404).json({ message: "Live not found" });
      }

      let participant = parsed.data.participantId
        ? await storage.getHubParticipant(parsed.data.participantId)
        : undefined;
      let matchedBy = getMatchedBy({ participantId: participant?.id ?? parsed.data.participantId ?? null });

      if (!participant) {
        const lookup = {
          phone: parsed.data.phone ?? null,
          email: parsed.data.email ?? null,
        };
        participant = await storage.findHubParticipantByIdentity({
          ...lookup,
          phoneNormalized: normalizeHubPhone(lookup.phone),
          emailNormalized: normalizeHubEmail(lookup.email),
        });
        matchedBy = getMatchedBy(lookup);
      }

      const registration = participant
        ? await storage.getHubRegistration(live.id, participant.id)
        : undefined;

      const destinationUrl = parsed.data.eventType === "join"
        ? live.streamUrl
        : live.replayUrl ?? live.streamUrl;

      const baseEvent = {
        liveId: live.id,
        participantId: participant?.id ?? null,
        registrationId: registration?.id ?? null,
        eventType: parsed.data.eventType,
        matchedBy,
        phoneRaw: parsed.data.phone ?? null,
        emailRaw: parsed.data.email ?? null,
        ipHash: getRequestIpHash(req),
        userAgent: req.headers["user-agent"] ?? null,
      } as const;

      if (!participant || !registration) {
        const event = await storage.logHubAccessEvent({
          ...baseEvent,
          outcome: "denied",
          metadata: {
            ...parsed.data.metadata,
            reason: !participant ? "participant_not_found" : "registration_not_found",
          },
          createdAt: new Date(),
        });
        await syncHubAccessEventToGhl({ live, participant, event });
        return res.status(403).json({ granted: false, message: "Registration required" });
      }

      if (registration.status === "cancelled" || registration.status === "waitlisted") {
        const event = await storage.logHubAccessEvent({
          ...baseEvent,
          outcome: "denied",
          metadata: { ...parsed.data.metadata, reason: "registration_not_allowed" },
          createdAt: new Date(),
        });
        await syncHubAccessEventToGhl({ live, participant, event });
        return res.status(403).json({ granted: false, message: "Registration is not approved for this live" });
      }

      if (!destinationUrl) {
        const event = await storage.logHubAccessEvent({
          ...baseEvent,
          outcome: "denied",
          metadata: { ...parsed.data.metadata, reason: "destination_missing" },
          createdAt: new Date(),
        });
        await syncHubAccessEventToGhl({ live, participant, event });
        return res.status(409).json({ granted: false, message: "Live link unavailable" });
      }

      const event = await storage.logHubAccessEvent({
        ...baseEvent,
        participantId: participant.id,
        registrationId: registration.id,
        outcome: "granted",
        metadata: parsed.data.metadata,
        createdAt: new Date(),
      });

      await syncHubAccessEventToGhl({ live, participant, event });

      return res.json({
        granted: true,
        destinationUrl,
        liveId: live.id,
        participantId: participant.id,
        registrationId: registration.id,
        eventType: parsed.data.eventType,
      });
    } catch (err) {
      return res.status(500).json({ message: (err as Error).message });
    }
  });

  app.get("/api/skale-hub/dashboard", requireAdmin, async (_req, res) => {
    try {
      return res.json(await storage.getHubDashboardSummary());
    } catch (err) {
      return res.status(500).json({ message: (err as Error).message });
    }
  });

  app.get("/api/skale-hub/participants", requireAdmin, async (req, res) => {
    try {
      const search = typeof req.query.search === "string" ? req.query.search : undefined;
      return res.json(await storage.listHubParticipantHistory(search));
    } catch (err) {
      return res.status(500).json({ message: (err as Error).message });
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
      return res.status(500).json({ message: (err as Error).message });
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
      return res.status(500).json({ message: (err as Error).message });
    }
  });

  app.post("/api/skale-hub/lives", requireAdmin, async (req, res) => {
    try {
      const parsed = insertHubLiveSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0].message });
      }

      const created = await storage.createHubLive(parsed.data);
      if (parsed.data.status === "live") {
        await storage.activateHubLive(created.id);
      }

      return res.status(201).json(await storage.getHubLiveSummary(created.id));
    } catch (err) {
      return res.status(500).json({ message: (err as Error).message });
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

      await storage.updateHubLive(liveId, parsed.data);
      if (parsed.data.status === "live") {
        await storage.activateHubLive(liveId);
      }

      return res.json(await storage.getHubLiveSummary(liveId));
    } catch (err) {
      return res.status(500).json({ message: (err as Error).message });
    }
  });
}
