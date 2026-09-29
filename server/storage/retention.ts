// Data retention: anonymise / delete personal and telemetry data past its
// useful life. Runs daily (in-process cron or POST /api/cron/retention).
//
// Windows: estimate_views.ip_address hashed after 30d; hub_access_events raw
// phone/email nulled after 90d; incomplete form_leads deleted after 90d;
// visitor_sessions deleted after 180d; conversations + messages deleted after
// 365d. translations has no last_used_at column, so it is intentionally skipped.

import { sql } from "drizzle-orm";
import { db } from "../db.js";
import { systemHeartbeats } from "#shared/schema.js";

export type RetentionResult = {
  estimateViewsHashed: number;
  hubEventsScrubbed: number;
  incompleteLeadsDeleted: number;
  visitorSessionsDeleted: number;
  conversationMessagesDeleted: number;
  conversationsDeleted: number;
  translationsSkipped: string;
};

function rowCount(res: unknown): number {
  return Number((res as { rowCount?: number | null })?.rowCount ?? 0);
}

/** Secret used to salt hashed IPs. No fallback: an unsalted or hardcoded-salt hash is reversible. */
export function getRetentionSalt(): string {
  const salt = process.env.RETENTION_HASH_SECRET || process.env.SESSION_SECRET || process.env.CRON_SECRET;
  if (!salt) throw new Error("Retention needs RETENTION_HASH_SECRET, SESSION_SECRET or CRON_SECRET to hash IP addresses");
  return salt;
}

export async function runRetention(): Promise<RetentionResult> {
  // Salt so a hashed IPv4 cannot be reversed by brute force without the secret.
  const salt = getRetentionSalt();

  const views = await db.execute(sql`
    UPDATE estimate_views
       SET ip_address = encode(sha256(convert_to(${salt} || ip_address, 'UTF8')), 'hex')
     WHERE viewed_at < now() - interval '30 days'
       AND ip_address IS NOT NULL
       AND ip_address !~ '^[0-9a-f]{64}$'
  `);

  const hub = await db.execute(sql`
    UPDATE hub_access_events
       SET phone_raw = NULL, email_raw = NULL
     WHERE created_at < now() - interval '90 days'
       AND (phone_raw IS NOT NULL OR email_raw IS NOT NULL)
  `);

  // status enum has no 'abandoned'; an incomplete lead is form_completo = false
  // that nobody has worked (status still 'novo'). Rows that carry any contact
  // detail or a CRM contact are real leads and are never deleted here.
  const leads = await db.execute(sql`
    DELETE FROM form_leads
     WHERE form_completo = false
       AND status = 'novo'
       AND coalesce(telefone, '') = ''
       AND coalesce(email, '') = ''
       AND ghl_contact_id IS NULL
       AND created_at < now() - interval '90 days'
  `);

  const visitors = await db.execute(sql`
    DELETE FROM visitor_sessions
     WHERE last_seen_at < now() - interval '180 days'
  `);

  const msgs = await db.execute(sql`
    DELETE FROM conversation_messages
     WHERE conversation_id IN (
       SELECT id FROM conversations
        WHERE coalesce(last_message_at, updated_at, created_at) < now() - interval '365 days'
     )
  `);
  const convs = await db.execute(sql`
    DELETE FROM conversations c
     WHERE coalesce(c.last_message_at, c.updated_at, c.created_at) < now() - interval '365 days'
       AND NOT EXISTS (SELECT 1 FROM conversation_messages m WHERE m.conversation_id = c.id)
  `);

  const result: RetentionResult = {
    estimateViewsHashed: rowCount(views),
    hubEventsScrubbed: rowCount(hub),
    incompleteLeadsDeleted: rowCount(leads),
    visitorSessionsDeleted: rowCount(visitors),
    conversationMessagesDeleted: rowCount(msgs),
    conversationsDeleted: rowCount(convs),
    translationsSkipped: "translations has no last_used_at column",
  };

  try {
    await db.insert(systemHeartbeats).values({ source: "retention", note: JSON.stringify(result) });
  } catch (err) {
    console.warn("[retention] heartbeat logging failed:", (err as Error).message);
  }
  return result;
}
