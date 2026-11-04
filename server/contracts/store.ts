import { desc, eq, sql } from "drizzle-orm";
import { db } from "../db.js";
import {
  contracts,
  contractEvents,
  type ContractRow,
} from "#shared/schema/contracts.js";
import type { ContractEvent } from "#shared/contracts.js";

export interface ContractTransaction {
  row: ContractRow;
  events: ContractEvent[];
}

export interface ContractStore {
  list(
    limit: number,
    offset: number,
  ): Promise<{ data: ContractRow[]; total: number }>;
  get(id: string): Promise<ContractRow | undefined>;
  events(id: string): Promise<ContractEvent[]>;
  create(row: ContractRow, event: ContractEvent): Promise<void>;
  transact<T>(
    id: string,
    work: (tx: ContractTransaction) => Promise<T> | T,
  ): Promise<T | undefined>;
}

export const postgresContractStore: ContractStore = {
  async list(limit, offset) {
    const [data, counts] = await Promise.all([
      db
        .select()
        .from(contracts)
        .orderBy(desc(contracts.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ total: sql<number>`count(*)::int` }).from(contracts),
    ]);
    return { data, total: counts[0].total };
  },
  async get(id) {
    return (await db.select().from(contracts).where(eq(contracts.id, id)))[0];
  },
  async events(id) {
    return db
      .select()
      .from(contractEvents)
      .where(eq(contractEvents.contractId, id))
      .orderBy(contractEvents.occurredAt);
  },
  async create(row, event) {
    await db.transaction(async (tx) => {
      await tx.insert(contracts).values(row);
      await tx.insert(contractEvents).values(event);
    });
  },
  async transact(id, work) {
    return db.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(contracts)
        .where(eq(contracts.id, id))
        .for("update");
      if (!row) return undefined;
      const before = JSON.stringify(row);
      const context: ContractTransaction = { row, events: [] };
      const result = await work(context);
      if (JSON.stringify(row) !== before) {
        row.updatedAt = new Date().toISOString();
        await tx.update(contracts).set(row).where(eq(contracts.id, id));
      }
      if (context.events.length)
        await tx.insert(contractEvents).values(context.events);
      return result;
    });
  },
};
