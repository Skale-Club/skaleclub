# Codebase Structure

**Analysis Date:** 2026-03-30

## Directory Layout

```
skaleclub/
├── api/                    # Vercel serverless entry point
│   ├── index.ts            # Vercel handler wrapping Express app
│   └── xpot.ts             # Vercel xpot handler (legacy)
├── client/                 # React SPA (Vite)
│   ├── index.html          # HTML entry point
│   ├── public/             # Static assets (favicons, PWA manifest, service worker)
│   └── src/
│       ├── main.tsx        # React bootstrap entry
│       ├── App.tsx         # Root component with routing
│       ├── index.css       # Global styles (Tailwind)
│       ├── assets/         # Bundled assets (logos, Lottie animations)
│       ├── components/     # Reusable UI components
│       │   ├── admin/      # Admin dashboard sections
│       │   ├── chat/       # Chat widget
│       │   ├── layout/     # Navbar, Footer
│       │   └── ui/         # shadcn/ui primitives (40+ components)
│       ├── context/        # React Context providers
│       ├── hooks/          # Custom hooks
│       ├── lib/            # Utilities, config, helpers
│       └── pages/          # Route-level page components
│           └── xpot/       # Xpot field sales app pages
├── docs/                   # Feature documentation
├── migrations/             # SQL migration files (manual)
├── plan/                   # Implementation plans
├── script/                 # Build scripts
├── scripts/                # Utility/migration scripts (seed, fix, test)
├── server/                 # Express API server
│   ├── index.ts            # Server entry point (dev + prod)
│   ├── app.ts              # Express app factory (middleware, static assets)
│   ├── routes.ts           # Main API route registration (3489 lines)
│   ├── routes/             # Modular route files
│   │   └── xpot.ts         # Xpot sales API routes
│   ├── auth/               # Authentication setup
│   │   └── supabaseAuth.ts # Supabase OAuth + session management
│   ├── db.ts               # PostgreSQL pool + Drizzle instance
│   ├── storage.ts          # Data access layer (983 lines)
│   ├── storage/            # File storage adapters
│   │   ├── storageAdapter.ts
│   │   └── supabaseStorage.ts
│   ├── integrations/       # External service integrations
│   │   ├── ghl.ts          # GoHighLevel CRM
│   │   └── twilio.ts       # SMS notifications
│   ├── lib/                # Server utilities
│   │   ├── ai-provider.ts  # AI provider abstraction (OpenAI/Gemini/OpenRouter)
│   │   ├── gemini.ts       # Gemini client wrapper
│   │   ├── openrouter.ts   # OpenRouter client wrapper
│   │   └── supabase.ts     # Supabase admin client
│   ├── static.ts           # Production static file serving
│   └── vite.ts             # Vite dev middleware setup
├── shared/                 # Shared code (client + server)
│   ├── schema.ts           # Drizzle tables + Zod schemas (1004 lines)
│   ├── routes.ts           # API route type contracts
│   ├── form.ts             # Lead qualification form logic
│   ├── xpot.ts             # Xpot sales schemas
│   ├── pageSlugs.ts        # Configurable page URL slugs
│   └── models/             # Additional model definitions
├── supabase/               # Supabase config + migrations
├── drizzle.config.ts       # Drizzle Kit configuration
├── package.json            # Dependencies and scripts
├── tsconfig.json           # TypeScript configuration
├── vite.config.ts          # Vite bundler configuration
├── tailwind.config.ts      # Tailwind CSS configuration
├── postcss.config.js       # PostCSS configuration
├── vercel.json             # Vercel deployment config
├── components.json         # shadcn/ui configuration
├── AGENTS.md               # AI agent instructions
├── README.md               # Project overview
├── SETUP.md                # Setup instructions
└── DESIGN_SYSTEM.md        # Design system documentation
```

## Directory Purposes

**`api/`:**
- Purpose: Vercel serverless deployment entry points
- Contains: Handler wrappers that import and reuse the Express app
- Key files: `api/index.ts` (main Vercel handler)

**`client/`:**
- Purpose: React SPA source code and assets
- Contains: All frontend code — pages, components, hooks, context, utilities
- Key files: `client/src/main.tsx`, `client/src/App.tsx`

**`client/src/pages/`:**
- Purpose: Route-level page components (one per route)
- Contains: `Home.tsx`, `Admin.tsx`, `Blog.tsx`, `Contact.tsx`, `Faq.tsx`, `Portfolio.tsx`, `Links.tsx`, `VCard.tsx`, `AdminLogin.tsx`, `AdminSignup.tsx`, `XpotApp.tsx`, `XpotLogin.tsx`, etc.
- Pattern: Lazy-loaded via `React.lazy()` in `App.tsx`

**`client/src/components/`:**
- Purpose: Reusable UI components
- Contains: Layout (`Navbar`, `Footer`), admin sections (`AdminSidebar`, `DashboardSection`, `LeadsSection`, `ChatSection`, etc.), chat widget, feature components
- Key files: `client/src/components/admin/*.tsx` (admin dashboard sections)

**`client/src/components/ui/`:**
- Purpose: shadcn/ui design system primitives (40+ components)
- Contains: `button.tsx`, `dialog.tsx`, `input.tsx`, `select.tsx`, `toast.tsx`, `tabs.tsx`, etc.
- Pattern: Radix UI primitives wrapped with Tailwind styling

**`client/src/context/`:**
- Purpose: React Context providers for global state
- Contains: `AuthContext.tsx`, `ThemeContext.tsx`, `LanguageContext.tsx`

**`client/src/hooks/`:**
- Purpose: Custom React hooks
- Contains: `use-auth.ts`, `use-seo.ts`, `use-toast.ts`, `use-upload.ts`, `useTranslation.ts`, `use-mobile.tsx`

**`client/src/lib/`:**
- Purpose: Client-side utilities and configuration
- Contains: `queryClient.ts` (TanStack Query config), `supabase.ts` (client), `analytics.ts`, `translations.ts`, `utils.ts`, `pwa.ts`, `vcard.ts`, `markdown.tsx`, `pagePaths.ts`

**`server/`:**
- Purpose: Express API server
- Contains: Entry point, app factory, routes, auth, database, storage, integrations
- Key files: `server/index.ts`, `server/app.ts`, `server/routes.ts`, `server/storage.ts`

**`server/auth/`:**
- Purpose: Authentication setup
- Contains: `supabaseAuth.ts` — Session middleware, login/logout/current-user endpoints

**`server/integrations/`:**
- Purpose: External service integration logic
- Contains: `ghl.ts` (GoHighLevel API), `twilio.ts` (SMS)

**`server/lib/`:**
- Purpose: Server utility modules
- Contains: `ai-provider.ts`, `gemini.ts`, `openrouter.ts`, `supabase.ts`

**`server/storage/`:**
- Purpose: File storage abstraction
- Contains: `storageAdapter.ts` (route registration), `supabaseStorage.ts` (Supabase Storage implementation)

**`server/routes/`:**
- Purpose: Modular route files (extracted from main routes.ts)
- Contains: `xpot.ts` (1042 lines — Xpot field sales CRM routes)

**`shared/`:**
- Purpose: Code shared between client and server
- Contains: Database schemas, Zod validators, type definitions, form logic, route contracts
- Key files: `shared/schema.ts` (1004 lines — all Drizzle table definitions), `shared/form.ts`, `shared/xpot.ts`

**`migrations/`:**
- Purpose: Manual SQL migration files
- Contains: `0001_chat.sql` through `0023_add_audio_transcription.sql` + `create_portfolio_services.sql`
- Applied via: `npm run db:push` (Drizzle Kit push, not migrate)

**`scripts/`:**
- Purpose: Utility scripts for maintenance, seeding, fixes
- Contains: `seed-faqs.ts`, `seed-portfolio.js`, `test-db-connection.ts`, various fix scripts

**`script/`:**
- Purpose: Build tooling
- Contains: `build.ts` (esbuild + Vite), `build-vercel.ts`

## Key File Locations

**Entry Points:**
- `server/index.ts`: Main server entry (dev + prod)
- `api/index.ts`: Vercel serverless entry
- `client/src/main.tsx`: Client-side React entry

**Configuration:**
- `package.json`: Dependencies, scripts, `#shared/*` import alias
- `vite.config.ts`: Vite config — path aliases (`@/` → `client/src/`, `@shared` → `shared/`, `@assets` → `attached_assets/`)
- `tsconfig.json`: TypeScript config
- `drizzle.config.ts`: Drizzle Kit config (points to `shared/schema.ts`, outputs to `migrations/`)
- `vercel.json`: Vercel deployment config
- `.env`: Environment variables (DATABASE_URL, SESSION_SECRET, ADMIN_EMAIL, etc.)

**Core Logic:**
- `server/routes.ts`: All API routes (3489 lines — primary route file)
- `server/storage.ts`: Database access layer (983 lines)
- `shared/schema.ts`: All database table definitions (1004 lines)
- `shared/form.ts`: Lead qualification scoring logic

**Testing:**
- No test runner configured. Manual testing only.

## Naming Conventions

**Files:**
- React components: `PascalCase.tsx` (e.g., `Admin.tsx`, `ChatWidget.tsx`)
- Hooks: `camelCase.ts` with `use` prefix (e.g., `use-auth.ts`, `useTranslation.ts`)
- Utilities: `camelCase.ts` (e.g., `queryClient.ts`, `utils.ts`)
- Schemas: `camelCase.ts` (e.g., `schema.ts`, `form.ts`, `xpot.ts`)

**Directories:**
- lowercase with hyphens for feature groups (e.g., `client/src/components/admin/`)
- lowercase single words for layers (e.g., `pages/`, `hooks/`, `lib/`, `context/`)

**Import Aliases:**
- `@/` → `client/src/` (Vite alias for client imports)
- `@shared/` → `shared/` (Vite alias)
- `#shared/` → `shared/` (Node.js package.json import for server imports)

## Where to Add New Code

**New Public Page:**
1. Create component in `client/src/pages/YourPage.tsx`
2. Add lazy import + route in `client/src/App.tsx`
3. If slug is configurable, add to `shared/pageSlugs.ts` and `DEFAULT_PAGE_SLUGS`

**New Admin Section:**
1. Create section component in `client/src/components/admin/YourSection.tsx`
2. Add tab/entry in `client/src/components/admin/AdminSidebar.tsx`
3. Add API routes in `server/routes.ts` (with `requireAdmin` middleware)

**New API Endpoint:**
1. Add route handler in `server/routes.ts` (inside `registerRoutes()`)
2. If input/output needs validation, define Zod schema in `shared/routes.ts`
3. Add storage method in `server/storage.ts` if DB access is needed

**New Database Table:**
1. Define table + schema in `shared/schema.ts`
2. Run `npm run db:push` to apply schema changes
3. Add storage methods in `server/storage.ts`

**New Integration:**
1. Create client in `server/integrations/your-service.ts`
2. Add settings table or use `integration_settings` table
3. Add admin routes in `server/routes.ts`
4. Add admin UI section in `client/src/components/admin/`

**New Shared Utility:**
- Client-only: `client/src/lib/`
- Server-only: `server/lib/`
- Shared: `shared/`

## Special Directories

**`client/public/`:**
- Purpose: Static assets served at root
- Contains: Favicons, PWA icons, manifest, service worker
- Generated: No
- Committed: Yes

**`migrations/`:**
- Purpose: Historical SQL migration files
- Contains: Individual `.sql` migration files
- Generated: Partially (Drizzle Kit can generate, but manual migrations also exist)
- Committed: Yes

**`attached_assets/`:**
- Purpose: User-uploaded assets served as static files
- Contains: Uploaded images, documents
- Generated: No (runtime)
- Committed: Depends on `.gitignore`

**`dist/`:**
- Purpose: Production build output
- Contains: `dist/public/` (client bundle), `dist/index.cjs` (server bundle)
- Generated: Yes (via `npm run build`)
- Committed: No (in `.gitignore`)

**`supabase/`:**
- Purpose: Supabase project configuration
- Contains: `config.toml`, `migrations/`
- Generated: Partially
- Committed: Yes

---

*Structure analysis: 2026-03-30*
