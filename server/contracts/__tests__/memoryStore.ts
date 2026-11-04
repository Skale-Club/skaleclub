import type { ContractStore, ContractTransaction } from "../store.js";
import type { ContractRow } from "#shared/schema/contracts.js";
import type { ContractEvent } from "#shared/contracts.js";

export class MemoryContractStore implements ContractStore {
  rows = new Map<string, ContractRow>();
  history: ContractEvent[] = [];
  private locks = new Map<string, Promise<unknown>>();
  async list(limit: number, offset: number) {
    const rows = Array.from(this.rows.values()).reverse();
    return {
      data: structuredClone(rows.slice(offset, offset + limit)),
      total: rows.length,
    };
  }
  async get(id: string) {
    return structuredClone(this.rows.get(id));
  }
  async events(id: string) {
    return structuredClone(
      this.history.filter((event) => event.contractId === id),
    );
  }
  async create(row: ContractRow, event: ContractEvent) {
    this.rows.set(row.id, structuredClone(row));
    this.history.push(structuredClone(event));
  }
  async transact<T>(
    id: string,
    work: (tx: ContractTransaction) => Promise<T> | T,
  ): Promise<T | undefined> {
    const previous = this.locks.get(id) ?? Promise.resolve();
    const result = previous
      .catch(() => {})
      .then(async () => {
        const stored = this.rows.get(id);
        if (!stored) return undefined;
        const context = {
          row: structuredClone(stored),
          events: [] as ContractEvent[],
        };
        const result = await work(context);
        this.rows.set(id, structuredClone(context.row));
        this.history.push(...structuredClone(context.events));
        return result;
      });
    this.locks.set(id, result);
    return result;
  }
}
