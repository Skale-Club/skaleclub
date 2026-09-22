-- Portfolio redesign v4 (.planning/plans/portfolio-redesign-v4.md, step 2).
-- 1. `headline`: benefit title for the portfolio app blocks; **double
--    asterisks** mark the highlighted part. Nullable, so the code before this
--    change (which never selects it) keeps working.
-- 2. Xcraper and Xpot join the catalog. Xpot has no price on purpose: an
--    empty price renders "Start here".
-- 3. Catalog order by importance, as set by Vanildo on 2026-09-22.
-- Additive and idempotent.

alter table public.portfolio_services
  add column if not exists headline text;

insert into public.portfolio_services
  (slug, title, subtitle, description, price, price_label, badge_text, category,
   features, logo_icon_url, home_image_url, tool_url, cta_text, "order", is_active)
values
  ('xcraper', 'Xcraper', 'Google Maps Lead Finder',
   'Search any business type in any city and get phones, emails, addresses and social links, ready to export. Start with 10 free credits.',
   '$9.90', '/month', '', 'crm',
   '["Google Maps data", "AI email discovery", "Export"]'::jsonb,
   '/product-assets/catalog-2026-09/xcraper-logo.webp',
   '/product-assets/catalog-2026-09/xcraper-home.webp',
   'https://xcraper.skale.club', 'Start', 6, true),
  ('xpot', 'Xpot', 'Field Sales Companion',
   'Reps check in by GPS, record a voice note after each visit, and AI turns it into notes and follow-ups synced to your CRM.',
   '', '', '', 'crm',
   '["GPS check-in", "AI voice notes", "CRM sync"]'::jsonb,
   '/product-assets/catalog-2026-09/xpot-logo.webp',
   '/product-assets/catalog-2026-09/xpot-home.webp',
   'https://xpot.skale.club', 'Start', 7, true)
on conflict (slug) do nothing;

update public.portfolio_services set headline = v.headline
from (values
  ('xareable', 'Your social media **on autopilot**'),
  ('websites', 'A professional website **live in 3 days**'),
  ('scheduling-system', '**Never miss** a booking'),
  ('smart-menu', 'Your menu **on the customer''s phone**'),
  ('crm-setup', 'Every lead **followed up automatically**'),
  ('xtimator', 'Send the estimate **before you leave the site**'),
  ('xcraper', 'Thousands of leads **from Google Maps**'),
  ('xpot', 'Every field visit **logged and synced**')
) as v(slug, headline)
where portfolio_services.slug = v.slug and portfolio_services.headline is null;

update public.portfolio_services set "order" = v.ord
from (values
  ('scheduling-system', 1),
  ('xtimator', 2),
  ('crm-setup', 3),
  ('xareable', 4),
  ('websites', 5),
  ('xcraper', 6),
  ('xpot', 7),
  ('smart-menu', 8),
  ('company-emails', 9)
) as v(slug, ord)
where portfolio_services.slug = v.slug;
