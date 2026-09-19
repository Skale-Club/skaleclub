-- Auto-blog parity SC-08 — per-call AI usage and cost log.
-- Ported from Websites (.planning/initiatives/autoblog-parity/MASTER.md §3.6).
--
-- This repo could say whether a post was generated but never what it cost, so
-- OpenRouter spend was invisible until the invoice arrived. Every column but
-- step/provider/model/status is nullable on purpose: an image model that
-- reports no token counts is normal, not an error, and a row that cannot be
-- written must never fail a generation (the writer swallows its own errors).

create table if not exists public.ai_generation_logs (
  id            serial primary key,
  -- 'blog_post' | 'blog_image' today. Left open so other AI features can share
  -- this table rather than growing ledgers of their own.
  step          text not null,
  provider      text not null,
  model         text not null,
  -- Truncated at write time: a cost ledger, not an archive of every prompt.
  prompt        text,
  input_tokens  integer,
  output_tokens integer,
  cost_usd      numeric(10, 4),
  status        text not null,
  error         text,
  duration_ms   integer,
  created_at    timestamp default now()
);

create index if not exists ai_generation_logs_created_idx
  on public.ai_generation_logs (created_at);

alter table public.ai_generation_logs
  drop constraint if exists ai_generation_logs_status_check;

-- 'skipped' is not 'failure': a model that charges for the call and returns no
-- image succeeded at the API level. Conflating the two makes the failure rate
-- in this table meaningless.
alter table public.ai_generation_logs
  add constraint ai_generation_logs_status_check
  check (status in ('success', 'failure', 'skipped'));

alter table public.ai_generation_logs enable row level security;
