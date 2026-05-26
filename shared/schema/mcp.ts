import { pgTable, text, uuid, boolean, timestamp, serial, integer } from "drizzle-orm/pg-core";
import { z } from "zod";

export const apiTokens = pgTable("api_tokens", {
  id:          uuid("id").primaryKey().defaultRandom(),
  name:        text("name").notNull(),
  tokenHash:   text("token_hash").notNull().unique(),
  tokenPrefix: text("token_prefix").notNull(),
  isActive:    boolean("is_active").notNull().default(true),
  createdAt:   timestamp("created_at", { withTimezone: true }).defaultNow(),
  lastUsedAt:  timestamp("last_used_at", { withTimezone: true }),
  rotatedAt:   timestamp("rotated_at",  { withTimezone: true }),
});

export const mcpAuditLogs = pgTable("mcp_audit_logs", {
  id:           serial("id").primaryKey(),
  tokenId:      uuid("token_id").references(() => apiTokens.id, { onDelete: "set null" }),
  tokenPrefix:  text("token_prefix").notNull(),
  toolName:     text("tool_name").notNull(),
  targetType:   text("target_type"),
  targetId:     text("target_id"),
  action:       text("action").notNull(),
  result:       text("result").notNull(),
  errorMessage: text("error_message"),
  ipAddress:    text("ip_address"),
  createdAt:    timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const oauthCodes = pgTable("oauth_codes", {
  id:                  uuid("id").primaryKey().defaultRandom(),
  code:                text("code").notNull().unique(),
  clientId:            text("client_id"),
  redirectUri:         text("redirect_uri").notNull(),
  codeChallenge:       text("code_challenge").notNull(),
  codeChallengeMethod: text("code_challenge_method").notNull().default("S256"),
  scope:               text("scope"),
  tokenId:             uuid("token_id").references(() => apiTokens.id, { onDelete: "cascade" }),
  rawToken:            text("raw_token"),
  expiresAt:           timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt:              timestamp("used_at", { withTimezone: true }),
});

export type ApiToken    = typeof apiTokens.$inferSelect;
export type McpAuditLog = typeof mcpAuditLogs.$inferSelect;
export type OauthCode   = typeof oauthCodes.$inferSelect;

export const insertApiTokenSchema = z.object({
  name: z.string().min(1).max(100),
});
