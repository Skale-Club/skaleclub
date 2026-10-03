import "dotenv/config";
import { pool } from "../server/db.js";

const SMS_NEW_CHAT = "🔔 Novo chat em {{company}}\nConversa: {{conversationId}}...\nPágina: {{pageUrl}}";
const TG_NEW_CHAT  = "🔔 Novo chat em *{{company}}*\nConversa: {{conversationId}}...\nPágina: {{pageUrl}}";

const SMS_HOT_LEAD = "🧲 NEW LEAD | {{company}} | {{name}} | {{phone}}";
const TG_HOT_LEAD  = "🧲 NEW LEAD | *{{company}}* | *{{name}}* | {{phone}}";

const SMS_PERF_ALERT = "⚠️ {{company}}: alerta de tempo de resposta\nMédia: {{avgTime}}\nAmostras: {{samples}}";
const TG_PERF_ALERT  = "⚠️ *{{company}}*: alerta de tempo de resposta\nMédia: {{avgTime}}\nAmostras: {{samples}}";

// Pedido de chaveiro NFC (formulário nfc-keychain-order). Disparado só quando o
// pedido é finalizado; substitui o hot_lead nesse formulário para o time não
// receber dois avisos com histórias diferentes do mesmo pedido.
const TG_NFC_ORDER =
  "🔑 *NOVO PEDIDO DE CHAVEIRO* — {{company}}\n" +
  "{{name}} · {{phone}}\n" +
  "Empresa: {{business}}\n" +
  "Quantidade: *{{quantity}}* ({{keychainType}})\n" +
  "Total estimado: *{{total}}* · arte: {{artFee}}\n" +
  "Cliente: {{customerStatus}}\n" +
  "Logo: {{logo}}\n" +
  "Envio: {{address}}\n\n" +
  "☎️ Ligar agora para confirmar antes de produzir.";

// Pedido de plaquinha NFC (formulário nfc-plaque-order). Mesmo papel do aviso
// acima; sem taxa de arte, e com o link que o toque/QR deve abrir.
const TG_NFC_PLAQUE_ORDER =
  "⭐ *NOVO PEDIDO DE PLAQUINHA* | {{company}}\n" +
  "{{name}} · {{phone}}\n" +
  "Empresa: {{business}}\n" +
  "Quantidade: *{{quantity}}* ({{plaqueType}})\n" +
  "Total estimado: *{{total}}*\n" +
  "Cliente: {{customerStatus}}\n" +
  "Link: {{link}}\n" +
  "Logo: {{logo}}\n" +
  "Envio: {{address}}\n\n" +
  "☎️ Ligar agora para confirmar antes de produzir.";

async function seed() {
  const client = await pool.connect();
  try {
    console.log("Seeding notification_templates...");
    // The table has no unique (event_key, channel) constraint in production, so
    // ON CONFLICT cannot be used: each row is inserted only if missing.
    const rows: Array<[string, string, string]> = [
      ["new_chat", "sms", SMS_NEW_CHAT],
      ["new_chat", "telegram", TG_NEW_CHAT],
      ["hot_lead", "sms", SMS_HOT_LEAD],
      ["hot_lead", "telegram", TG_HOT_LEAD],
      ["low_perf_alert", "sms", SMS_PERF_ALERT],
      ["low_perf_alert", "telegram", TG_PERF_ALERT],
      ["nfc_order", "telegram", TG_NFC_ORDER],
      ["nfc_plaque_order", "telegram", TG_NFC_PLAQUE_ORDER],
    ];
    let inserted = 0;
    for (const [eventKey, channel, body] of rows) {
      const result = await client.query(
        `INSERT INTO notification_templates (event_key, channel, body, active)
         SELECT $1, $2, $3, true
         WHERE NOT EXISTS (SELECT 1 FROM notification_templates WHERE event_key = $1 AND channel = $2)`,
        [eventKey, channel, body],
      );
      inserted += result.rowCount ?? 0;
    }

    console.log(`Rows inserted: ${inserted} (0 = already seeded, idempotent).`);
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(err => {
  console.error("Seed failed:", err);
  process.exit(1);
});
