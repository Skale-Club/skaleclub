-- Phase 31 - Seed notification_templates with default message bodies.
-- ON CONFLICT DO NOTHING makes this idempotent.

INSERT INTO notification_templates (event_key, channel, body, active) VALUES
  ('new_chat',       'sms',      '🔔 Novo chat em {{company}}' || E'\n' || 'Conversa: {{conversationId}}...' || E'\n' || 'Página: {{pageUrl}}', true),
  ('new_chat',       'telegram', '🔔 Novo chat em *{{company}}*' || E'\n' || 'Conversa: {{conversationId}}...' || E'\n' || 'Página: {{pageUrl}}', true),
  ('hot_lead',       'sms',      '🧲 NEW LEAD | {{company}} | {{name}} | {{phone}}', true),
  ('hot_lead',       'telegram', '🧲 NEW LEAD | *{{company}}* | *{{name}}* | {{phone}}', true),
  ('low_perf_alert', 'sms',      '⚠️ {{company}}: alerta de tempo de resposta' || E'\n' || 'Média: {{avgTime}}' || E'\n' || 'Amostras: {{samples}}', true),
  ('low_perf_alert', 'telegram', '⚠️ *{{company}}*: alerta de tempo de resposta' || E'\n' || 'Média: {{avgTime}}' || E'\n' || 'Amostras: {{samples}}', true)
ON CONFLICT (event_key, channel) DO NOTHING;
