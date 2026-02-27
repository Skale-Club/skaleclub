-- Migration: Create portfolio_services table
-- Created automatically for SkaleClub portfolio feature

CREATE TABLE IF NOT EXISTS portfolio_services (
    id SERIAL PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    subtitle TEXT NOT NULL,
    description TEXT NOT NULL,
    price TEXT NOT NULL,
    price_label TEXT NOT NULL DEFAULT 'One-time',
    badge_text TEXT NOT NULL DEFAULT 'One-time Fee',
    features JSONB DEFAULT '[]'::jsonb,
    image_url TEXT,
    icon_name TEXT DEFAULT 'Rocket',
    cta_text TEXT NOT NULL,
    cta_button_color TEXT DEFAULT '#406EF1',
    background_color TEXT DEFAULT 'bg-white',
    text_color TEXT DEFAULT 'text-slate-900',
    accent_color TEXT DEFAULT 'blue',
    layout TEXT NOT NULL DEFAULT 'left',
    "order" INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index on slug for faster lookups
CREATE INDEX IF NOT EXISTS idx_portfolio_services_slug ON portfolio_services(slug);
CREATE INDEX IF NOT EXISTS idx_portfolio_services_order ON portfolio_services("order");
CREATE INDEX IF NOT EXISTS idx_portfolio_services_active ON portfolio_services(is_active);

-- Add comment
COMMENT ON TABLE portfolio_services IS 'Services displayed on the portfolio page';
