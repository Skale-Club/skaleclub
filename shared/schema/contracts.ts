import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import type { ContractSnapshot, ContractReceipt } from "../contracts.js";

export interface SigningChallenge {
  tokenHash: string;
  codeHash: string;
  expiresAt: string;
  sentAt: string;
  attempts: number;
  windowStart: string;
  requests: number;
}

export const contracts = pgTable(
  "contracts",
  {
    id: uuid("id").primaryKey(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    companyName: text("company_name").notNull(),
    companyEmail: text("company_email").notNull(),
    signerName: text("signer_name").notNull(),
    signerEmail: text("signer_email").notNull(),
    language: text("language").$type<"en" | "pt">().notNull().default("en"),
    expiresInDays: integer("expires_in_days").notNull().default(30),
    status: text("status")
      .$type<"draft" | "sent" | "signed" | "voided">()
      .notNull()
      .default("draft"),
    version: integer("version").notNull().default(1),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    sentAt: timestamp("sent_at", { withTimezone: true, mode: "string" }),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "string" }),
    signedAt: timestamp("signed_at", { withTimezone: true, mode: "string" }),
    snapshot: jsonb("snapshot").$type<ContractSnapshot>(),
    documentHash: text("document_hash"),
    receipt: jsonb("receipt").$type<ContractReceipt>(),
    challenge: jsonb("challenge").$type<SigningChallenge>(),
    accessTokenHash: text("access_token_hash"),
    accessExpiresAt: timestamp("access_expires_at", {
      withTimezone: true,
      mode: "string",
    }),
    emailVerifiedAt: timestamp("email_verified_at", {
      withTimezone: true,
      mode: "string",
    }),
  },
  (t) => [index("contracts_created_at_idx").on(t.createdAt)],
);

export const contractEvents = pgTable(
  "contract_events",
  {
    id: uuid("id").primaryKey(),
    contractId: uuid("contract_id")
      .notNull()
      .references(() => contracts.id),
    type: text("type").notNull(),
    occurredAt: timestamp("occurred_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    actor: text("actor").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
  },
  (t) => [index("contract_events_contract_idx").on(t.contractId)],
);

export type ContractRow = typeof contracts.$inferSelect;
