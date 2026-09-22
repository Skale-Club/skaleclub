-- Portfolio redesign v4, step 3: two-sentence descriptions for the app blocks
-- (.planning/plans/portfolio-redesign-v4.md). Only rows still holding the
-- previous text are touched, so an admin edit made since is never overwritten.
--
-- Previous text, for rollback:
--   scheduling-system: Launch a simple booking webpage with AI assistants for messages and phone calls. Share the essential business information, answer leads automatically, and let AI schedule appointments, meetings, or visits when customers are ready to book.
--   xtimator: Create fast estimates in seconds while you are still on site. Build your own price book manually or use AI to organize pricing, then generate professional estimates quickly without going back to the office or delaying the customer.
--   crm-setup: Complete CRM setup with Go High Level. Manage leads, automate follow-ups via email and SMS, and track your sales pipeline in one powerful platform.
--   xareable: Create and publish social media posts with AI from one simple tool. Write and post manually when needed, or automate content creation and posting on a recurring schedule so the business stays active online.
--   websites: Launch a clean, professional website for a service business in as little as 3 days, starting at $299 for the essential version. Add more features and functionality when the project needs to become more complete.
--   smart-menu: Offer a smarter digital menu customers can access by QR code or iPad. Show food and drink images, detailed item cards, basket options, and an AI assistant that can answer questions before customers order.

update public.portfolio_services set description = v.description
from (values
  ('scheduling-system', 'A booking page with AI that answers messages and calls. It books the appointment when the customer is ready.', 'Launch a simple booking webpage%'),
  ('xtimator', 'Build your price book once, then create a professional estimate in seconds, right in front of the customer.', 'Create fast estimates in seconds%'),
  ('crm-setup', 'Your CRM on GoHighLevel with pipelines, email and SMS follow-ups and reports. Every lead in one place.', 'Complete CRM setup with Go High Level%'),
  ('xareable', 'Create and publish posts with AI from one place. Post by hand or put it on a schedule and stay active every week.', 'Create and publish social media posts%'),
  ('websites', 'A clean site built for service businesses. Start with the essentials and add pages and features as you grow.', 'Launch a clean, professional website%'),
  ('smart-menu', 'A QR code or iPad menu with photos and a basket. An AI assistant answers questions before the order.', 'Offer a smarter digital menu%')
) as v(slug, description, previous)
where portfolio_services.slug = v.slug and portfolio_services.description like v.previous;
