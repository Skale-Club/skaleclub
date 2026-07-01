ALTER TABLE portfolio_services
  ADD COLUMN IF NOT EXISTS popup_bg_image_url TEXT,
  ADD COLUMN IF NOT EXISTS popup_slider_images JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS popup_urls JSONB NOT NULL DEFAULT '[]';
