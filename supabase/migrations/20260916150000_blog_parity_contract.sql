-- Auto-blog parity SC-03 — align this repo with the shared contract
-- (.planning/initiatives/autoblog-parity/MASTER.md §3).
--
-- Step 1 of a two-step rename (MASTER D-12). Every new column is ADDED and
-- backfilled here; the old ones are left in place, made nullable where they
-- were NOT NULL, and stop being read by the application. A follow-up migration
-- drops them once this has been running in production.
--
-- Doing it in one step instead would mean that during a rolling deploy either
-- the old code reads a column that no longer exists, or the new code writes one
-- that does not yet. Neither is worth the tidiness.

-- ── blog_settings ───────────────────────────────────────────────────────────

-- auto_approve -> auto_publish. Same meaning, and "publish" is what it actually
-- controls: whether the generated post goes live or waits in the queue.
alter table public.blog_settings
  add column if not exists auto_publish boolean not null default false;

update public.blog_settings
  set auto_publish = auto_approve
  where auto_publish is distinct from auto_approve;

-- openrouter_text_model / openrouter_image_model -> text_model / image_model.
-- The provider name in the column was never load-bearing, and the other four
-- products already spell these without it.
alter table public.blog_settings
  add column if not exists text_model text not null default '';

alter table public.blog_settings
  add column if not exists image_model text not null default '';

update public.blog_settings
  set text_model = openrouter_text_model
  where text_model = '' and openrouter_text_model <> '';

update public.blog_settings
  set image_model = openrouter_image_model
  where image_model = '' and openrouter_image_model <> '';

-- New in the contract. rss_enabled defaults TRUE here, unlike the other
-- products: RSS is not a new feature in this repo, it is the ONLY topic source
-- the generator has ever had, so defaulting it off would stop generation.
alter table public.blog_settings
  add column if not exists rss_enabled boolean not null default true;

-- An anchor hour 0-23 in the site's timezone. NULL keeps the existing drifting
-- cadence, so nothing changes until someone picks an hour.
alter table public.blog_settings
  add column if not exists posting_hour integer;

alter table public.blog_settings
  drop constraint if exists blog_settings_posting_hour_range;

alter table public.blog_settings
  add constraint blog_settings_posting_hour_range
  check (posting_hour is null or (posting_hour >= 0 and posting_hour <= 23));

-- ── blog_generation_jobs ────────────────────────────────────────────────────

-- error -> error_message, matching the other four products.
alter table public.blog_generation_jobs
  add column if not exists error_message text;

update public.blog_generation_jobs
  set error_message = error
  where error_message is null and error is not null;

alter table public.blog_generation_jobs
  add column if not exists trigger text;

alter table public.blog_generation_jobs
  add column if not exists source text;

alter table public.blog_generation_jobs
  add column if not exists rss_item_id integer;

alter table public.blog_generation_jobs
  add column if not exists pillar_id text;

alter table public.blog_generation_jobs
  drop constraint if exists blog_generation_jobs_source_check;

alter table public.blog_generation_jobs
  add constraint blog_generation_jobs_source_check
  check (source is null or source in ('pillar', 'rss', 'manual'));

alter table public.blog_generation_jobs
  drop constraint if exists blog_generation_jobs_trigger_check;

alter table public.blog_generation_jobs
  add constraint blog_generation_jobs_trigger_check
  check (trigger is null or trigger in ('cron', 'manual', 'telegram'));

-- Every job row already in the table came from the RSS pipeline, which is the
-- one case where backfilling a source is not inventing history.
update public.blog_generation_jobs
  set source = 'rss'
  where source is null and post_id is not null;

-- ── blog_post_feedback ──────────────────────────────────────────────────────

-- signal (positive|negative) -> verdict (approved|rejected). The words matter:
-- the editor approved or rejected a draft, which is a decision. "Positive"
-- reads like a sentiment score, and that ambiguity is how three products ended
-- up with three spellings of the same column.
alter table public.blog_post_feedback
  add column if not exists verdict text;

update public.blog_post_feedback
  set verdict = case signal
                  when 'positive' then 'approved'
                  when 'negative' then 'rejected'
                  else signal
                end
  where verdict is null;

alter table public.blog_post_feedback
  drop constraint if exists blog_post_feedback_verdict_check;

alter table public.blog_post_feedback
  add constraint blog_post_feedback_verdict_check
  check (verdict is null or verdict in ('approved', 'rejected'));

-- The old column must become nullable or inserts from the new code, which no
-- longer writes it, would fail.
alter table public.blog_post_feedback
  alter column signal drop not null;

-- rss_item_title -> source_title: the origin of a topic is no longer always an
-- RSS item now that the pillar rotation is arriving.
alter table public.blog_post_feedback
  add column if not exists source_title text;

update public.blog_post_feedback
  set source_title = rss_item_title
  where source_title is null and rss_item_title is not null;

alter table public.blog_post_feedback
  add column if not exists post_excerpt text;

-- Which surface the decision came from. Every existing row predates Telegram
-- approvals, so 'admin' is the honest backfill.
alter table public.blog_post_feedback
  add column if not exists decided_by text not null default 'admin';

alter table public.blog_post_feedback
  drop constraint if exists blog_post_feedback_decided_by_check;

alter table public.blog_post_feedback
  add constraint blog_post_feedback_decided_by_check
  check (decided_by in ('admin', 'telegram'));
