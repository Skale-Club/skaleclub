# External Integrations

**Analysis Date:** 2026-03-30

## APIs & External Services

### Supabase (Auth + Storage)

**Auth:**
- User authentication via Supabase Auth
  - SDK: `@supabase/supabase-js` 2.89.0
  - Server admin client: `server/lib/supabase.ts` (uses service role key)
  - Auth flow: `server/auth/supabaseAuth.ts` (login/logout/session endpoints)
  - Client config endpoint: `GET /api/supabase-config` (returns URL + anon key)
  - Auth method: Email/password via Supabase, then server creates session cookie

**Storage:**
- File uploads via Supabase Storage
  - Implementation: `server/storage/supabaseStorage.ts`
  - Bucket: `uploads` (public, auto-created)
  - Upload methods: presigned URLs and direct buffer upload
  - Adapter: `server/storage/storageAdapter.ts`

**Env vars:** `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

### OpenAI (AI Chat)

**Purpose:** AI-powered chat assistant for lead qualification
- SDK: `openai` 4.104.0
- Default model: `gpt-4o-mini`
- Implementation: `server/routes.ts` (chat endpoints + tool-calling for lead qualification)
- Tools defined: `get_form_config`, `save_lead_answer`, `get_lead_state`, `complete_lead`, `search_faqs`
- Key resolution: runtime cache → env var → database (`chat_integrations` table)

**Env var:** `OPENAI_API_KEY`

### Google Gemini (AI Chat - Alternative)

**Purpose:** Alternative AI provider for chat (OpenAI-compatible endpoint)
- Implementation: `server/lib/gemini.ts`
- Base URL: `https://generativelanguage.googleapis.com/v1beta/openai/`
- Uses OpenAI SDK with Gemini-compatible base URL
- Default model: `gemini-2.0-flash`

**Env var:** `GEMINI_API_KEY`

### OpenRouter (AI Chat - Alternative)

**Purpose:** Multi-model AI router (access to Claude, Llama, etc.)
- Implementation: `server/lib/openrouter.ts`
- Base URL: `https://openrouter.ai/api/v1`
- Uses OpenAI SDK with OpenRouter-compatible base URL
- Default model: `openai/gpt-4o-mini`
- Model list endpoint: `GET https://openrouter.ai/api/v1/models` (cached 5 min)
- Custom headers: `HTTP-Referer`, `X-Title`

**Env vars:** `OPENROUTER_API_KEY`, `OPENROUTER_HTTP_REFERER`, `OPENROUTER_APP_NAME`

### Groq (Audio Transcription)

**Purpose:** Audio transcription for visit notes via Whisper
- SDK: `groq-sdk` 1.1.2
- Implementation: `server/routes/xpot.ts` (transcribe visit audio notes)
- Also: `server/routes.ts` (integration test/settings endpoints)
- Integration stored in `chat_integrations` table with `provider: 'groq'`

**Env var:** `GROQ_API_KEY`

### GoHighLevel (CRM)

**Purpose:** CRM integration for lead sync, appointments, contacts, opportunities
- Implementation: `server/integrations/ghl.ts`
- API: REST via native `fetch` (no SDK)
- Base URL: `https://services.leadconnectorhq.com`
- API version: `2021-07-28`
- Auth: Bearer token

**Operations:**
- Contact create/find/update (by email or phone)
- Appointment creation
- Custom field mapping from form config
- Pipeline/opportunity management
- Task creation

**Storage:** `integration_settings` table (`provider: 'gohighlevel'`)
- Fields: `apiKey`, `locationId`, `calendarId`, `isEnabled`

**Key files:**
- `server/integrations/ghl.ts` - All GHL API calls
- `server/routes.ts` - Integration settings endpoints and lead completion sync

### Twilio (SMS Notifications)

**Purpose:** SMS notifications for hot leads, new chats, and performance alerts
- SDK: `twilio` 5.11.2
- Implementation: `server/integrations/twilio.ts`

**Notification types:**
- `sendHotLeadNotification` - When a lead provides a phone number
- `sendNewChatNotification` - When a new chat conversation starts
- `sendLowPerformanceAlert` - When chat response time exceeds threshold

**Storage:** `twilio_settings` table
- Fields: `enabled`, `accountSid`, `authToken`, `fromPhoneNumber`, `toPhoneNumber`, `toPhoneNumbers`, `notifyOnNewChat`

**Env vars:** None (all stored in database)

### Google Places API

**Purpose:** Address/location search for field sales app
- Implementation: `server/routes/xpot.ts` (line 299) and `server/routes.ts` (line 2525)
- Endpoint: `https://places.googleapis.com/v1/places:searchText`
- Auth: API key (passed in request)

### Google Cloud Storage (Replit Object Storage)

**Purpose:** File storage when running on Replit platform
- SDK: `@google-cloud/storage` 7.18.0
- Implementation: `server/replit_integrations/object_storage/objectStorage.ts`
- Conditionally loaded based on Replit environment

### Vercel Analytics

**Purpose:** Web analytics tracking
- SDK: `@vercel/analytics` 1.6.1
- Implementation: `client/src/main.tsx` (renders `<Analytics />` component)

## Data Storage

**Databases:**
- PostgreSQL (primary data store)
  - Connection: `DATABASE_URL` or `POSTGRES_URL` env var
  - Client: `pg` 8.16.3 with `drizzle-orm` 0.39.3
  - Connection config: `server/db.ts` (SSL auto-detection, pool sizing for serverless)
  - Session store: `connect-pg-simple` (PostgreSQL-backed sessions table)

**File Storage:**
- Supabase Storage (primary) - `server/storage/supabaseStorage.ts`
- Google Cloud Storage (Replit only) - `server/replit_integrations/object_storage/`
- Local filesystem fallback - `attached_assets/` directory (static serving via Express)

**Caching:**
- In-memory cache (Map-based) - OpenRouter model list (5 min TTL)
- HTTP cache headers - `Cache-Control` on public endpoints (300s-3600s)

## Authentication & Identity

**Auth Provider:**
- Supabase Auth (primary)
  - Implementation: `server/auth/supabaseAuth.ts`
  - Flow: Client authenticates with Supabase → sends access token to server → server validates with Supabase Admin API → creates server-side session cookie
  - Session: PostgreSQL-backed (connect-pg-simple), 7-day TTL
  - Admin check: `users.is_admin` field in PostgreSQL, compared against `ADMIN_EMAIL` env var

**Env vars:** `SESSION_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`

## Monitoring & Observability

**Error Tracking:**
- Console logging (no external error tracking service detected)

**Logs:**
- Express request logging middleware in `server/app.ts` (method, path, status, duration)
- Server-side console.log/error throughout integrations

**Heartbeat/Cron:**
- `GET /api/cron/supabase-keepalive` - Keeps Supabase database alive (prevents free-tier suspension)
- Auth via `CRON_SECRET` Bearer token or Vercel `x-vercel-cron` header
- Heartbeats stored in `system_heartbeats` table

## CI/CD & Deployment

**Hosting:**
- Vercel (primary production)
  - `vercel.json` - Build config, rewrites, function settings
  - Serverless functions: `api/index.ts`, `api/xpot.ts`
  - PWA support: service worker and web manifest headers
  - Domain redirects: vercel.app → skale.club, www → non-www

**Build Pipeline:**
- `npm run build` → Vite client build + esbuild server bundle + SEO injection
- `npm run build:vercel` → Vite client build + SEO injection (server compiled by Vercel)
- `scripts/inject-seo-build.ts` - Injects dynamic SEO data at build time

## Webhooks & Callbacks

**Incoming:**
- Not detected

**Outgoing:**
- Twilio SMS (on hot lead, new chat, low performance)
- GoHighLevel contact/opportunity sync (on form completion)

## Environment Configuration

**Required env vars (from `.env.example`):**
- `POSTGRES_URL` or `DATABASE_URL` - PostgreSQL connection string
- `SESSION_SECRET` - Session encryption key
- `ADMIN_EMAIL` - Initial admin email
- `ADMIN_PASSWORD_HASH` - Bcrypt hash for admin password
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anonymous key (client-side)
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (server-side)

**Optional env vars:**
- `OPENAI_API_KEY` - OpenAI API key (also configurable via admin panel)
- `GEMINI_API_KEY` - Google Gemini API key
- `OPENROUTER_API_KEY` - OpenRouter API key
- `GROQ_API_KEY` - Groq API key (audio transcription)
- `CRON_SECRET` - Cron endpoint authentication
- `NODE_ENV` - Environment mode (`development` / `production`)
- `PGSSLMODE` - PostgreSQL SSL mode override
- `OPENROUTER_HTTP_REFERER` - OpenRouter referrer header
- `OPENROUTER_APP_NAME` - OpenRouter app name header
- `APP_URL` - Application base URL

**Secrets location:**
- `.env` file (local development, git-ignored)
- Vercel environment variables (production)

---

*Integration audit: 2026-03-30*
