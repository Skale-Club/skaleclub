-- Catalog redesign (docs/PORTFOLIO_REDESIGN_BRIEF.md, section 3.1).
-- 1. An explicit category replaces guessing it from the title/slug.
-- 2. badge_text loses its "One-time Fee" default, which leaked onto three
--    monthly plans (XmartMenu $29/mo, Xkedule $89/mo, Xtimator $49/mo).
-- Additive and idempotent; the code before this change ignores the column.

alter table public.portfolio_services
  add column if not exists category text;

alter table public.portfolio_services
  alter column badge_text set default '';

update public.portfolio_services set category = v.category
from (values
  ('xareable', 'ai'),
  ('websites', 'websites'),
  ('scheduling-system', 'systems'),
  ('smart-menu', 'systems'),
  ('xtimator', 'systems'),
  ('company-emails', 'systems'),
  ('crm-setup', 'crm')
) as v(slug, category)
where portfolio_services.slug = v.slug and portfolio_services.category is null;

update public.portfolio_services
  set badge_text = ''
  where badge_text = 'One-time Fee'
    and coalesce(price_label, '') not ilike '%one-time%';
