// Script to create portfolio_services table
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL
});

const createTableSQL = `
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

CREATE INDEX IF NOT EXISTS idx_portfolio_services_slug ON portfolio_services(slug);
CREATE INDEX IF NOT EXISTS idx_portfolio_services_order ON portfolio_services("order");
CREATE INDEX IF NOT EXISTS idx_portfolio_services_active ON portfolio_services(is_active);
`;

async function createTable() {
    try {
        console.log('Creating portfolio_services table...');
        await pool.query(createTableSQL);
        console.log('✅ Table created successfully!');
        await pool.end();
        process.exit(0);
    } catch (error) {
        console.error('❌ Error creating table:', error.message);
        await pool.end();
        process.exit(1);
    }
}

createTable();
