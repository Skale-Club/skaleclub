import type { Response } from "express";
import type { LiveSessionRecord } from "#shared/schema/liveSharing.js";
import type { LiveState } from "#shared/liveSharing.js";
import { LiveSharingService } from "./service.js";

interface Client {
  response: Response;
  credential: string;
  presenter: boolean;
  last: string;
}
interface Room {
  clients: Set<Client>;
  timer: ReturnType<typeof setInterval>;
  polling: boolean;
  again: boolean;
}

/** One polling read per active room (not per client) also recovers changes made
 * by a restarted/second process. Local commands fan out immediately after commit.
 * Initial deployment is a single process: audience counts/caps are process-local.
 */
export class LiveStreams {
  private rooms = new Map<string, Room>();
  private total = 0;
  private unsubscribe: () => void;
  constructor(private service: LiveSharingService) {
    this.unsubscribe = service.onChange((id) => { void this.refresh(id); });
  }
  audienceCount(id: string) {
    return Array.from(this.rooms.get(id)?.clients ?? []).filter((c) => !c.presenter).length;
  }
  canConnect(id: string, presenter: boolean) {
    const room = this.rooms.get(id);
    return this.total < 500 && (room?.clients.size ?? 0) < 55 && (presenter || this.audienceCount(id) < 50);
  }
  attach(id: string, response: Response, credential: string, presenter: boolean) {
    let room = this.rooms.get(id);
    if (!room) {
      const timer = setInterval(() => { void this.refresh(id); }, 1000);
      timer.unref();
      room = { clients: new Set(), timer, polling: false, again: false };
      this.rooms.set(id, room);
    }
    const client: Client = { response, credential, presenter, last: "" };
    room.clients.add(client); this.total++;
    response.on("close", () => this.remove(id, client));
    // Subscribe before reading: the first snapshot cannot miss a committed move.
    void this.refresh(id);
  }
  private remove(id: string, client: Client) {
    const room = this.rooms.get(id);
    if (!room?.clients.delete(client)) return;
    this.total--;
    if (!room.clients.size) { clearInterval(room.timer); this.rooms.delete(id); }
  }
  private send(id: string, client: Client, state: LiveState) {
    const encoded = JSON.stringify(state);
    if (client.last === encoded) {
      // Keep the proxy connection open even while the presenter stays on a slide.
      if (client.response.writableLength < 64 * 1024) client.response.write(": heartbeat\n\n");
      else client.response.destroy();
      return;
    }
    if (client.response.writableLength > 64 * 1024) { client.response.destroy(); return; }
    client.last = encoded;
    client.response.write(`id: ${state.revision}\nevent: state\ndata: ${encoded}\n\n`);
    if (state.status === "ended" || state.status === "expired") {
      client.response.end(); this.remove(id, client);
    }
  }
  private broadcast(id: string, row: LiveSessionRecord) {
    const room = this.rooms.get(id);
    if (!room) return;
    const state = this.service.state(row);
    for (const client of Array.from(room.clients)) {
      if (!client.presenter) {
        try { this.service.authorizeViewer(row, client.credential); }
        catch {
          // Existing viewers receive a terminal state on expiry/revocation.
          // No snapshot/document fields are sent after authorization fails.
          this.send(id, client, { ...state, status: state.status === "expired" ? "expired" : "ended" });
          continue;
        }
      }
      this.send(id, client, state);
    }
  }
  private async refresh(id: string) {
    const room = this.rooms.get(id);
    if (!room) return;
    if (room.polling) { room.again = true; return; }
    room.polling = true;
    try {
      const row = await this.service.row(id);
      if (this.rooms.get(id) === room) this.broadcast(id, row);
    } catch {
      // Fail closed on unavailable/deleted state. EventSource can reconnect;
      // stale content is labelled disconnected by the client on stream failure.
      for (const client of Array.from(room.clients)) { client.response.destroy(); this.remove(id, client); }
    } finally {
      room.polling = false;
      if (room.again) { room.again = false; void this.refresh(id); }
    }
  }
  close() {
    this.unsubscribe();
    for (const [id, room] of Array.from(this.rooms)) {
      clearInterval(room.timer);
      for (const client of Array.from(room.clients)) { client.response.end(); this.remove(id, client); }
    }
  }
}
