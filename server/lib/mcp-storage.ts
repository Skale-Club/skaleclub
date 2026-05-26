import crypto from "crypto";
import { db } from "../db.js";
import { apiTokens, mcpAuditLogs } from "#shared/schema.js";
import { eq, desc } from "drizzle-orm";

const TOKEN_PREFIX_LEN = 12; // chars shown in UI (e.g. "mcp_sk_a1b2c3")

function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export function generateRawToken(): string {
  return "mcp_sk_" + crypto.randomBytes(24).toString("hex");
}

export async function createApiToken(name: string): Promise<{ token: ApiToken; rawToken: string }> {
  const raw = generateRawToken();
  const hash = hashToken(raw);
  const prefix = raw.slice(0, TOKEN_PREFIX_LEN);

  const [token] = await db
    .insert(apiTokens)
    .values({ name, tokenHash: hash, tokenPrefix: prefix })
    .returning();

  return { token, rawToken: raw };
}

export async function listApiTokens() {
  return db.select().from(apiTokens).orderBy(desc(apiTokens.createdAt));
}

export async function getApiTokenByRaw(raw: string) {
  const hash = hashToken(raw);
  const [token] = await db
    .select()
    .from(apiTokens)
    .where(eq(apiTokens.tokenHash, hash));
  return token ?? null;
}

export async function rotateApiToken(id: string): Promise<{ token: ApiToken; rawToken: string }> {
  const raw = generateRawToken();
  const hash = hashToken(raw);
  const prefix = raw.slice(0, TOKEN_PREFIX_LEN);

  const [token] = await db
    .update(apiTokens)
    .set({ tokenHash: hash, tokenPrefix: prefix, rotatedAt: new Date(), lastUsedAt: null })
    .where(eq(apiTokens.id, id))
    .returning();

  return { token, rawToken: raw };
}

export async function deactivateApiToken(id: string) {
  await db.update(apiTokens).set({ isActive: false }).where(eq(apiTokens.id, id));
}

export async function deleteApiToken(id: string) {
  await db.delete(apiTokens).where(eq(apiTokens.id, id));
}

export async function touchApiToken(id: string) {
  await db.update(apiTokens).set({ lastUsedAt: new Date() }).where(eq(apiTokens.id, id));
}

export async function createAuditLog(entry: {
  tokenId:     string;
  tokenPrefix: string;
  toolName:    string;
  targetType?: string;
  targetId?:   string;
  action:      string;
  result:      "success" | "error";
  errorMessage?: string;
  ipAddress?:  string;
}) {
  await db.insert(mcpAuditLogs).values(entry);
}

export async function listAuditLogs(limit = 100) {
  return db
    .select()
    .from(mcpAuditLogs)
    .orderBy(desc(mcpAuditLogs.createdAt))
    .limit(limit);
}

// Re-export type for consumers
import type { ApiToken } from "#shared/schema.js";
export type { ApiToken };
