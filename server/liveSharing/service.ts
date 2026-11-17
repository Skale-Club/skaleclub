import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { liveSlideCount, type LiveCommand, type LiveKind, type LiveLanguage, type LiveSessionView, type LiveSnapshot, type LiveState } from "#shared/liveSharing.js";
import type { LiveSessionRecord } from "#shared/schema/liveSharing.js";
import type { LiveSessionStore } from "./store.js";

const SESSION_MS = 4 * 60 * 60_000;
const DISCONNECTED_MS = 45_000;
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const token = () => randomBytes(32).toString("base64url");
function equal(a: string, b: string): boolean {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
export class LiveSharingError extends Error {
  constructor(public status: number, message: string, public code?: string, public state?: LiveState) { super(message); }
}
export type LiveSourceLoader = (kind: LiveKind, id: string) => Promise<{ snapshot: LiveSnapshot; accessCode?: string | null } | undefined>;

export class LiveSharingService {
  private listeners = new Set<(id: string) => void>();
  constructor(public store: LiveSessionStore, private options: {
    secret: () => string;
    loadSource: LiveSourceLoader;
    now?: () => Date;
  }) {}
  private now() { return this.options.now?.() ?? new Date(); }
  private mac(value: string): string {
    const secret = this.options.secret();
    if (!secret || secret.length < 32) throw new LiveSharingError(503, "Live sharing requires a persistent session secret of at least 32 characters.");
    return createHmac("sha256", secret).update(value).digest("hex");
  }
  onChange(listener: (id: string) => void) {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }
  private changed(id: string) { for (const fn of Array.from(this.listeners)) fn(id); }
  state(row: LiveSessionRecord): LiveState {
    return {
      id: row.id, slideIndex: row.slideIndex, language: row.language, revision: row.revision,
      status: row.status === "ended" ? "ended" : Date.parse(row.expiresAt) <= this.now().getTime() ? "expired" :
        this.now().getTime() - Date.parse(row.lastSeenAt) > DISCONNECTED_MS ? "disconnected" : "live",
      // Drizzle's string timestamp mode may return PostgreSQL's space/+00 form;
      // always send ISO 8601 so Safari can parse the cookie expiry/recovery state.
      expiresAt: new Date(row.expiresAt).toISOString(),
    };
  }
  private view(row: LiveSessionRecord): LiveSessionView {
    return { state: this.state(row), snapshot: row.snapshot, requiresAccessCode: !!row.accessCodeHash };
  }
  private active(row: LiveSessionRecord) {
    const state = this.state(row);
    if (state.status === "ended" || state.status === "expired") throw new LiveSharingError(410, "This live session has ended.", state.status, state);
  }
  private owner(row: LiveSessionRecord, user: string) {
    if (row.createdBy !== user) throw new LiveSharingError(403, "This session belongs to another presenter.");
  }
  private controller(row: LiveSessionRecord, user: string, provided: string) {
    this.owner(row, user);
    if (!provided || !equal(row.controllerHash, hash(provided))) throw new LiveSharingError(403, "Another tab controls this session. Take over to continue.", "controller_lost");
  }
  async row(id: string): Promise<LiveSessionRecord> {
    const row = await this.store.get(id);
    if (!row) throw new LiveSharingError(404, "Live session not found.");
    return row;
  }
  private async mutate<T>(id: string, work: (row: LiveSessionRecord) => T): Promise<T> {
    const result = await this.store.mutate(id, work);
    if (result === undefined) throw new LiveSharingError(404, "Live session not found.");
    this.changed(id);
    return result;
  }
  async create(user: string, kind: LiveKind, sourceId: string, language: LiveLanguage) {
    this.mac("configuration-check");
    const source = await this.options.loadSource(kind, sourceId);
    if (!source) throw new LiveSharingError(404, "Document not found.");
    if (source.snapshot.kind !== kind || !liveSlideCount(source.snapshot)) throw new LiveSharingError(400, "Add slides before starting a live presentation.");
    if (Buffer.byteLength(JSON.stringify(source.snapshot)) > 2_000_000) throw new LiveSharingError(400, "This document is too large for live sharing.");
    const id = randomUUID(), controllerToken = token(), now = this.now();
    const row: LiveSessionRecord = {
      id, sourceKind: kind, sourceId, createdBy: user, snapshot: structuredClone(source.snapshot),
      controllerHash: hash(controllerToken), audienceHash: null,
      accessCodeHash: source.accessCode ? this.mac(`gate:${id}:${source.accessCode}`) : null,
      slideIndex: 0, language, revision: 0, status: "live", lastCommandId: null,
      lastSeenAt: now.toISOString(), createdAt: now.toISOString(), expiresAt: new Date(now.getTime() + SESSION_MS).toISOString(),
    };
    await this.store.create(row);
    return { ...this.view(row), controllerToken };
  }
  async presenter(id: string, user: string) {
    const row = await this.row(id); this.owner(row, user);
    return this.view(row);
  }
  async takeover(id: string, user: string) {
    const controllerToken = token();
    return this.mutate(id, (row) => {
      this.owner(row, user); this.active(row);
      row.controllerHash = hash(controllerToken); row.revision++; row.lastCommandId = null;
      row.lastSeenAt = this.now().toISOString();
      return { ...this.view(row), controllerToken };
    });
  }
  async command(id: string, user: string, input: LiveCommand) {
    return this.mutate(id, (row) => {
      this.controller(row, user, input.controllerToken);
      if (row.lastCommandId === input.commandId) return { state: this.state(row) };
      this.active(row);
      if (row.revision !== input.expectedRevision) throw new LiveSharingError(409, "The session changed. Try again.", "revision_conflict", this.state(row));
      if (input.command.type === "navigate") {
        if (input.command.slideIndex >= liveSlideCount(row.snapshot)) throw new LiveSharingError(400, "Slide does not exist.");
        row.slideIndex = input.command.slideIndex;
      } else if (input.command.type === "language") row.language = input.command.language;
      else { row.status = "ended"; row.audienceHash = null; }
      row.revision++; row.lastCommandId = input.commandId; row.lastSeenAt = this.now().toISOString();
      return { state: this.state(row) };
    });
  }
  async heartbeat(id: string, user: string, controllerToken: string) {
    return this.mutate(id, (row) => {
      this.controller(row, user, controllerToken); this.active(row);
      row.lastSeenAt = this.now().toISOString();
      return { state: this.state(row) };
    });
  }
  async share(id: string, user: string, controllerToken: string) {
    const audienceToken = token();
    return this.mutate(id, (row) => {
      this.controller(row, user, controllerToken); this.active(row);
      row.audienceHash = hash(audienceToken);
      return { audienceToken };
    });
  }
  async revoke(id: string, user: string, controllerToken: string) {
    return this.mutate(id, (row) => {
      this.controller(row, user, controllerToken); this.active(row); row.audienceHash = null;
      return { state: this.state(row) };
    });
  }
  private viewerCredential(row: LiveSessionRecord) {
    // A share token alone cannot forge the code-verified HttpOnly credential.
    return this.mac(`viewer:${row.id}:${row.audienceHash}:${row.accessCodeHash}:${new Date(row.expiresAt).toISOString()}`);
  }
  async join(id: string, provided: string, code?: string) {
    const row = await this.row(id); this.active(row);
    if (!row.audienceHash || !equal(row.audienceHash, hash(provided))) throw new LiveSharingError(401, "This sharing link is invalid or has been revoked.");
    if (row.accessCodeHash && !equal(row.accessCodeHash, this.mac(`gate:${id}:${code ?? ""}`))) {
      throw new LiveSharingError(401, code ? "Incorrect access code." : "Enter the estimate access code.", code ? "incorrect_code" : "access_code_required");
    }
    return { view: this.view(row), credential: this.viewerCredential(row) };
  }
  authorizeViewer(row: LiveSessionRecord, credential: string) {
    this.active(row);
    if (!row.audienceHash || !credential || !equal(this.viewerCredential(row), credential)) throw new LiveSharingError(401, "This sharing link is invalid or has been revoked.");
  }
  async audience(id: string, credential: string) {
    const row = await this.row(id); this.authorizeViewer(row, credential);
    return this.view(row);
  }
}
