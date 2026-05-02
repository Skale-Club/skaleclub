import { storage } from "../storage.js";
import { createGHLNote, getOrCreateGHLContact } from "../integrations/ghl.js";
import type { HubAccessEvent, HubLive, HubParticipant } from "#shared/schema.js";

type SyncResult = {
  synced: boolean;
  skipped?: boolean;
  contactId?: string;
  message?: string;
};

function trimError(value: unknown): string {
  const message = value instanceof Error ? value.message : String(value || "Unknown GHL sync error");
  return message.slice(0, 500);
}

function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const firstName = parts.shift() || fullName || "Skale Hub";
  const lastName = parts.join(" ") || "Visitor";
  return { firstName, lastName };
}

function formatDate(value?: Date | string | null, timezone = "America/New_York"): string {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString();
  }

  try {
    return date.toLocaleString("en-US", { timeZone: timezone });
  } catch {
    return date.toISOString();
  }
}

function eventLabel(event: HubAccessEvent): string {
  if (event.eventType === "gate_check" && event.outcome === "granted") {
    return "Registration approved";
  }
  if (event.outcome === "denied") {
    return "Access denied";
  }
  if (event.eventType === "replay") {
    return "Replay access granted";
  }
  return "Live access granted";
}

function buildEventNote(live: HubLive, event: HubAccessEvent): string {
  const metadata = event.metadata || {};
  const reason = typeof metadata.reason === "string" ? metadata.reason : undefined;
  const lines = [
    `Skale Hub: ${eventLabel(event)}`,
    `Live: ${live.title}`,
    `Action: ${event.eventType}`,
    `Outcome: ${event.outcome}`,
    `Matched by: ${event.matchedBy}`,
    reason ? `Reason: ${reason}` : null,
    `Date: ${formatDate(event.createdAt, live.timezone)}`,
  ];

  return lines.filter((line): line is string => Boolean(line)).join("\n");
}

export async function syncHubParticipantToGhl(participant: HubParticipant): Promise<SyncResult> {
  if (participant.ghlContactId) {
    return { synced: true, contactId: participant.ghlContactId };
  }

  const integration = await storage.getIntegrationSettings("gohighlevel");
  if (!integration?.isEnabled || !integration.apiKey || !integration.locationId) {
    return { synced: false, skipped: true, message: "GHL not configured" };
  }

  if (!participant.phoneRaw && !participant.emailRaw) {
    await storage.updateHubParticipantGhlSync(participant.id, {
      ghlSyncStatus: "failed",
      ghlSyncError: "Missing phone and email for GHL sync",
    });
    return { synced: false, message: "Missing phone and email for GHL sync" };
  }

  try {
    const { firstName, lastName } = splitName(participant.fullName);
    const contactResult = await getOrCreateGHLContact(integration.apiKey, integration.locationId, {
      email: participant.emailRaw || participant.emailNormalized || undefined,
      firstName,
      lastName,
      phone: participant.phoneRaw || participant.phoneNormalized || undefined,
    });

    if (!contactResult.success || !contactResult.contactId) {
      const message = contactResult.message || "Failed to sync Skale Hub participant to GHL";
      await storage.updateHubParticipantGhlSync(participant.id, {
        ghlSyncStatus: "failed",
        ghlSyncError: message,
      });
      return { synced: false, message };
    }

    await storage.updateHubParticipantGhlSync(participant.id, {
      ghlContactId: contactResult.contactId,
      ghlSyncStatus: "synced",
      ghlLastSyncedAt: new Date(),
      ghlSyncError: null,
    });

    return { synced: true, contactId: contactResult.contactId };
  } catch (err) {
    const message = trimError(err);
    await storage.updateHubParticipantGhlSync(participant.id, {
      ghlSyncStatus: "failed",
      ghlSyncError: message,
    });
    return { synced: false, message };
  }
}

export async function syncHubAccessEventToGhl(params: {
  live: HubLive;
  participant?: HubParticipant | null;
  event: HubAccessEvent;
}): Promise<SyncResult> {
  const { live, participant, event } = params;

  if (event.ghlNoteId || event.ghlSyncStatus === "synced") {
    return { synced: true, contactId: participant?.ghlContactId ?? undefined };
  }

  if (!participant) {
    await storage.updateHubAccessEventGhlSync(event.id, {
      ghlSyncStatus: "skipped",
      ghlSyncError: "No participant available for GHL note sync",
    });
    return { synced: false, skipped: true, message: "No participant available for GHL note sync" };
  }

  try {
    const participantSync = await syncHubParticipantToGhl(participant);
    if (!participantSync.synced || !participantSync.contactId) {
      await storage.updateHubAccessEventGhlSync(event.id, {
        ghlSyncStatus: participantSync.skipped ? "skipped" : "failed",
        ghlSyncError: participantSync.message || "Participant is not synced to GHL",
      });
      return participantSync;
    }

    const integration = await storage.getIntegrationSettings("gohighlevel");
    if (!integration?.isEnabled || !integration.apiKey) {
      await storage.updateHubAccessEventGhlSync(event.id, {
        ghlSyncStatus: "skipped",
        ghlSyncError: "GHL not configured",
      });
      return { synced: false, skipped: true, message: "GHL not configured" };
    }

    const noteResult = await createGHLNote(
      integration.apiKey,
      participantSync.contactId,
      buildEventNote(live, event),
    );

    if (!noteResult.success) {
      const message = noteResult.message || "Failed to create Skale Hub GHL note";
      await storage.updateHubAccessEventGhlSync(event.id, {
        ghlSyncStatus: "failed",
        ghlSyncError: message,
      });
      return { synced: false, message };
    }

    await storage.updateHubAccessEventGhlSync(event.id, {
      ghlNoteId: noteResult.noteId ?? null,
      ghlSyncStatus: "synced",
      ghlSyncedAt: new Date(),
      ghlSyncError: null,
    });

    return { synced: true, contactId: participantSync.contactId };
  } catch (err) {
    const message = trimError(err);
    await storage.updateHubAccessEventGhlSync(event.id, {
      ghlSyncStatus: "failed",
      ghlSyncError: message,
    });
    return { synced: false, message };
  }
}
