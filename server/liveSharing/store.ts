import type { LiveSessionRecord } from "#shared/schema/liveSharing.js";

export interface LiveSessionStore {
  get(id: string): Promise<LiveSessionRecord | undefined>;
  create(row: LiveSessionRecord): Promise<void>;
  // Implementations must serialize mutations for a session across processes.
  mutate<T>(id: string, work: (row: LiveSessionRecord) => T): Promise<T | undefined>;
}
