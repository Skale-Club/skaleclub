-- Auto-blog parity SC-07 — Telegram delivery into groups.
-- MASTER §6: every product stores destinations as an array and supports
-- supergroups and forum topics.
--
-- Step 1 of the usual two-step (D-12): chat_ids is added and backfilled from the
-- single chat_id, which stays in place, no longer read, until a follow-up
-- migration drops it.
--
-- Why an array at all: this repo could notify exactly one destination. Adding a
-- second person meant either creating a group (fine) or giving up the first
-- one (not fine), and there was no way to send to a group AND an owner's
-- private chat. The other products have had the array for a while; this closes
-- the gap rather than inventing anything.

alter table public.telegram_settings
  add column if not exists chat_ids text[] not null default array[]::text[];

update public.telegram_settings
  set chat_ids = array[chat_id]
  where cardinality(chat_ids) = 0
    and chat_id is not null
    and length(trim(chat_id)) > 0;

-- ── Blog approval cards (the switch itself lands with the approvals port) ───
--
-- A SEPARATE bot for approvals, so the bot carrying a public webhook is not the
-- one sending notifications: it can be revoked on its own, and a leaked webhook
-- secret buys nothing on the notification channel. NULL falls back to bot_token.
alter table public.telegram_settings
  add column if not exists approvals_enabled boolean not null default false;

alter table public.telegram_settings
  add column if not exists approvals_bot_token text;

-- Kept separate from chat_ids because that list is shared with the notification
-- bot: putting an editor's private chat there to receive drafts would also send
-- them every other alert. EMPTY falls back to chat_ids.
alter table public.telegram_settings
  add column if not exists approvals_chat_ids text[] not null default array[]::text[];

-- Echoed by Telegram in X-Telegram-Bot-Api-Secret-Token on every webhook call.
-- The webhook is a PUBLIC endpoint, so this is what proves a request actually
-- came from Telegram: a chat_id in the body is attacker-controlled and proves
-- nothing on its own.
alter table public.telegram_settings
  add column if not exists webhook_secret text;
