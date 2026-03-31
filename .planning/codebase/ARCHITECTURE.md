# Architecture

**Analysis Date:** 2026-03-30

## Pattern Overview

**Overall:** Monolithic full-stack TypeScript application with unified server

**Key Characteristics:**
- Single Express server serves both the REST API and the React SPA (client)
- PostgreSQL database accessed via Drizzle ORM with type-safe schemas
- Supabase for authentication (OAuth + session-based server auth)
- Vite for development HMR and production bundling
- Deployable to both Replit (standalone) and Vercel (serverless)

## Layers

**Client Layer:**
- Purpose: React SPA rendered in the browser
- Location: `client/src/`
- Contains: Pages, components, hooks, context providers, lib utilities
- Depends on: Server API (`/api/*`), shared schemas
- Used by: End users (public site + admin dashboard)

**Server Layer:**
- Purpose: Express REST API + static file serving
- Location: `server/`
- Contains: Route handlers, storage abstraction, auth setup, integrations, AI provider logic
- Depends on: Shared schemas, PostgreSQL (Drizzle), Supabase admin client
- Used by: Client (via fetch/React Query), Vercel serverless (`api/index.ts`)

**Shared Layer:**
- Purpose: Type-safe contracts between client and server
- Location: `shared/`
- Contains: Drizzle table definitions, Zod schemas, route type definitions, form logic
- Depends on: Nothing (pure types/logic)
- Used by: Both client and server (via `#shared/*` import alias)

**Database Layer:**
- Purpose: Persistent storage via PostgreSQL
- Location: `server/db.ts`, `shared/schema.ts`
- Contains: Pool configuration, Drizzle ORM instance, all table schemas
- Depends on: `DATABASE_URL` / `POSTGRES_URL` env var
- Used by: Server storage layer

## Data Flow

**API Request Flow:**

1. Client makes request via `fetch` (wrapped by TanStack Query)
2. Express middleware parses JSON body, logs request
3. Route handler validates input with Zod schemas (from `shared/routes.ts`)
4. Storage layer queries PostgreSQL via Drizzle ORM
5. Response returned as JSON to client

**Authentication Flow:**

1. Client initiates Supabase OAuth or email/password login
2. Supabase returns `accessToken` to client
3. Client POSTs `accessToken` to `/api/auth/login`
4. Server validates token with `supabase.auth.getUser(accessToken)`
5. Server creates/finds user in local `users` table
6. Server creates session (stored in PostgreSQL `sessions` table via `connect-pg-simple`)
7. Session cookie returned to client (httpOnly, secure in production)
8. Subsequent requests authenticated via session cookie
9. Admin routes check `requireAdmin` middleware → verifies `users.is_admin` in DB

**Chat/AI Flow:**

1. Client sends message to `POST /api/chat/message`
2. Rate limiting check (IP-based, 8 req/min)
3. Server loads chat settings and company settings from DB
4. Active AI provider determined (OpenAI, Gemini, or OpenRouter)
5. AI receives conversation history + system prompt + tool definitions
6. AI calls tools (`get_form_config`, `save_lead_answer`, `search_faqs`, etc.)
7. Server executes tool functions against storage/DB
8. Tool results sent back to AI for final response
9. Response saved to `conversation_messages` table
10. Response returned to client

**Lead Qualification Flow:**

1. Form answers submitted via `POST /api/form-leads/progress` (or via chat tools)
2. Server validates with `formLeadProgressSchema` (Zod)
3. Scores calculated based on `FormConfig` thresholds
4. Lead classified as QUENTE/MORNO/FRIO (Hot/Warm/Cold)
5. If phone provided: Twilio SMS notification sent
6. If form complete: GoHighLevel contact created/synced
7. Lead persisted in `form_leads` table

## State Management

**Client State:**
- `AuthContext` (`client/src/context/AuthContext.tsx`) — Supabase auth state + session
- `ThemeContext` (`client/src/context/ThemeContext.tsx`) — Dark/light mode (via `next-themes`)
- `LanguageContext` (`client/src/context/LanguageContext.tsx`) — i18n language selection
- `InitialLoadContext` (defined in `client/src/App.tsx`) — Tracks first page load

**Server State:**
- Session store: PostgreSQL table `sessions` via `connect-pg-simple`
- Runtime AI keys: In-memory variables in `server/routes.ts` (persisted to DB on admin save)
- Rate limiting: In-memory `Map` in `server/routes.ts`

**Server State (Client Cache):**
- TanStack React Query (`@tanstack/react-query`) — All API data fetching
- Query client configured in `client/src/lib/queryClient.ts`
- Query keys match API paths (e.g., `['/api/company-settings']`)

## Key Abstractions

**Storage Abstraction:**
- Purpose: Unified database access layer
- Location: `server/storage.ts` (983 lines)
- Pattern: Class-based with methods for each entity (CompanySettings, ChatSettings, Faqs, BlogPosts, FormLeads, Sales, etc.)
- All DB queries go through this single abstraction

**AI Provider Abstraction:**
- Purpose: Unified interface for multiple AI backends
- Location: `server/lib/ai-provider.ts`
- Supports: OpenAI, Gemini (via OpenAI-compatible proxy), OpenRouter
- `getActiveAIClient()` returns `{ client, model, provider }` based on admin config

**Storage Adapter:**
- Purpose: File upload abstraction (environment-aware)
- Location: `server/storage/storageAdapter.ts`
- Uses: Supabase Storage for file uploads
- Routes: `/api/upload`, `/api/upload-local`, `/api/update-favicon`

**Shared Schemas:**
- Purpose: Single source of truth for types and validation
- Location: `shared/schema.ts` (Drizzle tables + Zod schemas), `shared/form.ts`, `shared/xpot.ts`
- Pattern: Define once, use in both client and server

## Entry Points

**Development Server:**
- Location: `server/index.ts`
- Triggers: `npm run dev` → `tsx server/index.ts`
- Creates Express app, sets up Vite dev middleware, listens on PORT (default 5000)

**Production Server:**
- Location: `server/index.ts` (same file)
- Triggers: `npm run start` → `node dist/index.cjs`
- Creates Express app, serves static files from `dist/public/`, listens on PORT

**Vercel Serverless:**
- Location: `api/index.ts`
- Triggers: Vercel deployment
- Wraps `createApp()` as Vercel handler (lazy initialization)

**Client Entry:**
- Location: `client/src/main.tsx`
- Triggers: Browser loads `client/index.html`
- Renders React app, registers service worker (PWA)

## API Design

**Style:** RESTful JSON API

**Base Path:** `/api/`

**Authentication:** Session-based (httpOnly cookie) — no JWT in client

**Key Endpoints:**
- `GET/PUT /api/company-settings` — Public read, admin write
- `GET/PUT /api/form-config` — Lead qualification form configuration
- `POST /api/form-leads/progress` — Submit lead form progress
- `GET /api/form-leads` — List leads (admin)
- `POST /api/chat/message` — Send chat message (public, rate-limited)
- `GET/PUT /api/chat/settings` — Chat configuration (admin)
- `GET /api/blog` — List blog posts (public, with status filter)
- `GET/PUT /api/integrations/ghl` — GoHighLevel settings (admin)
- `GET/PUT /api/integrations/twilio` — Twilio SMS settings (admin)
- `GET/PUT /api/integrations/openai` — OpenAI chat settings (admin)
- `POST /api/auth/login` — Session creation from Supabase token

**Shared Route Contracts:** `shared/routes.ts` defines Zod schemas for input/output validation used by both server and (optionally) client.

## Error Handling

**Strategy:** Try-catch with Zod validation at route level

**Patterns:**
- Zod parse errors → 400 with `{ message, errors }`
- Business logic errors → 400/404/503 with `{ message }`
- Unhandled errors → 500 with `{ message }` + thrown (logged)
- Express error middleware at `server/app.ts:62-67`

## Routing (Client-Side)

**Router:** `wouter` (lightweight alternative to React Router)

**Route Groups:**
- Public site: `/`, `/contact`, `/faq`, `/blog`, `/portfolio`, `/privacy-policy`, `/terms-of-service`, `/links`, `/vcard` (slugs configurable via `pageSlugs`)
- Admin: `/admin/login`, `/admin/signup`, `/admin` (wrapped in `AuthProvider`)
- Xpot (field sales): `/xpot/login`, `/xpot`, `/xpot/*`

**Page Slugs:** Configurable via `companySettings.pageSlugs` in DB. `shared/pageSlugs.ts` defines defaults and resolution logic.

## Cross-Cutting Concerns

**Logging:** Custom `log()` function in `server/app.ts` — formatted timestamps + source tag
**Validation:** Zod schemas throughout (shared + server routes)
**Caching:** `Cache-Control` headers set via `setPublicCache()` for public endpoints (s-maxage + stale-while-revalidate)
**Analytics:** GTM, GA4, Facebook Pixel (configurable in admin, initialized in `AnalyticsProvider`)
**SEO:** Dynamic meta tags via `useSEO()` hook, server-rendered robots.txt and sitemap.xml
**PWA:** Service worker registration, manifest at `client/public/manifest.webmanifest`
**i18n:** Dynamic AI-powered translations via `/api/translate` endpoint + `translations` table

---

*Architecture analysis: 2026-03-30*
