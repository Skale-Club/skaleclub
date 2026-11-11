-- Xpeed belongs in Platforms. Existing catalog records are preserved.
INSERT INTO portfolio_services (slug, title, subtitle, description, price, price_label,
  badge_text, category, features, tool_url, cta_text, "order", is_active)
VALUES ('xpeed', 'Xpeed', 'Understand your vehicle',
  'Keep vehicle profiles, record OBD trips and review diagnostics and maintenance in one place.',
  '', '', '', 'systems', '["Vehicle profiles","OBD trip recording","Diagnostics and history"]'::jsonb,
  'https://xpeed.skale.club', 'Open Xpeed', 100, true)
ON CONFLICT (slug) DO NOTHING;
