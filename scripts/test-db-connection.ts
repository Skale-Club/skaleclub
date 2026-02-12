
import "dotenv/config";
import pg from "pg";

const { Pool } = pg;

async function testConnection() {
    console.log("Testing database connection...");

    const rawDatabaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;

    if (!rawDatabaseUrl) {
        console.error("❌ No connection string found! (DATABASE_URL or POSTGRES_URL)");
        return;
    }

    console.log(`Using connection string (masked): ${rawDatabaseUrl.replace(/:[^:@]*@/, ':****@')}`);

    const isServerless = !!process.env.VERCEL;
    const sslExplicitlyDisabled =
        rawDatabaseUrl.includes('sslmode=disable') ||
        process.env.PGSSLMODE === "disable";
    const isCloudDb =
        rawDatabaseUrl.includes('.supabase.') ||
        rawDatabaseUrl.includes('.neon.') ||
        (rawDatabaseUrl.includes('sslmode=') && !rawDatabaseUrl.includes('sslmode=disable'));

    const shouldUseSsl =
        !sslExplicitlyDisabled &&
        (isCloudDb ||
            process.env.PGSSLMODE === "require" ||
            process.env.POSTGRES_SSL === "true" ||
            Boolean(process.env.VERCEL || process.env.VERCEL_ENV));

    console.log(`SSL Enabled: ${shouldUseSsl}`);

    // Strip sslmode from URL so pg doesn't override our ssl config
    const databaseUrl = shouldUseSsl
        ? rawDatabaseUrl.replace(/[?&]sslmode=[^&]*/g, (match) =>
            match.startsWith('?') ? '?' : '')
            .replace(/\?$/, '')
            .replace(/\?&/, '?')
        : rawDatabaseUrl;

    const pool = new Pool({
        connectionString: databaseUrl,
        ssl: shouldUseSsl
            ? {
                rejectUnauthorized: false,
                checkServerIdentity: () => undefined,
            }
            : false,
        connectionTimeoutMillis: 5000,
    });

    try {
        const client = await pool.connect();
        console.log("✅ Successfully connected to the database!");
        const res = await client.query('SELECT NOW()');
        console.log("Time from DB:", res.rows[0].now);
        client.release();
    } catch (err: any) {
        console.error("❌ Connection failed:", err.message);
        if (err.code) console.error("Error code:", err.code);
        if (err.detail) console.error("Detail:", err.detail);
    } finally {
        await pool.end();
    }
}

testConnection();
