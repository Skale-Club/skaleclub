import "dotenv/config";
import { pool } from "../server/db.js";

const SMS_NEW_CHAT = "🔔 Novo chat em {{company}}\nConversa: {{conversationId}}...\nPágina: {{pageUrl}}";
const TG_NEW_CHAT  = "🔔 Novo chat em *{{company}}*\nConversa: {{conversationId}}...\nPágina: {{pageUrl}}";

const SMS_HOT_LEAD = "🧲 NEW LEAD | {{company}} | {{name}} | {{phone}}";
const TG_HOT_LEAD  = "🧲 NEW LEAD | *{{company}}* | *{{name}}* | {{phone}}";

const SMS_PERF_ALERT = "⚠️ {{company}}: alerta de tempo de resposta\nMédia: {{avgTime}}\nAmostras: {{samples}}";
const TG_PERF_ALERT  = "⚠️ *{{company}}*: alerta de tempo de resposta\nMédia: {{avgTime}}\nAmostras: {{samples}}";

async function seed() {
  const client = await pool.connect();
  try {
    console.log("Seeding notification_templates...");
    const result = await client.query(`
      INSERT INTO notification_templates (event_key, channel, body, active)
      VALUES
        ('new_chat',       'sms',      $1, true),
        ('new_chat',       'telegram', $2, true),
        ('hot_lead',       'sms',      $3, true),
        ('hot_lead',       'telegram', $4, true),
        ('low_perf_alert', 'sms',      $5, true),
        ('low_perf_alert', 'telegram', $6, true)
      ON CONFLICT (event_key, channel) DO NOTHING
    `, [SMS_NEW_CHAT, TG_NEW_CHAT, SMS_HOT_LEAD, TG_HOT_LEAD, SMS_PERF_ALERT, TG_PERF_ALERT]);

    console.log(`Rows inserted: ${result.rowCount ?? 0} (0 = already seeded, idempotent).`);
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(err => {
  console.error("Seed failed:", err);
  process.exit(1);
});
