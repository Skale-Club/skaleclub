import type { LiveSessionRecord } from "#shared/schema/liveSharing.js";
import type { LiveSessionStore } from "../store.js";

export class MemoryLiveStore implements LiveSessionStore {
  rows = new Map<string, LiveSessionRecord>();
  private pending = Promise.resolve();
  async get(id: string) { const row = this.rows.get(id); return row ? structuredClone(row) : undefined; }
  async create(row: LiveSessionRecord) { this.rows.set(row.id, structuredClone(row)); }
  async mutate<T>(id: string, work: (row: LiveSessionRecord) => T): Promise<T | undefined> {
    const before = this.pending;
    let unlock!: () => void;
    this.pending = new Promise<void>((resolve) => { unlock = resolve; });
    await before;
    try {
      const row = await this.get(id);
      if (!row) return undefined;
      const result = work(row);
      this.rows.set(id, row);
      return result;
    } finally { unlock(); }
  }
}
