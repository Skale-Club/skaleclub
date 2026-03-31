# Technology Stack

**Analysis Date:** 2026-03-30

## Languages

**Primary:**
- TypeScript 5.6.3 - All source code (client, server, shared)

**Secondary:**
- CSS - Tailwind utility classes + CSS variables for theming

## Runtime

**Environment:**
- Node.js (ESM modules, `"type": "module"` in `package.json`)

**Package Manager:**
- npm (lockfile: `package-lock.json` present)

## Frameworks

**Core (Server):**
- Express 4.21.2 - HTTP server and API routing
  - `server/app.ts` - Express app factory
  - `server/routes.ts` - Main API route registration
  - `server/routes/xpot.ts` - Xpot (field sales) API routes

**Core (Client):**
- React 18.3.1 - UI framework
  - `client/src/main.tsx` - Entry point
  - `client/src/App.tsx` - Root component
- Wouter 3.3.5 - Client-side routing (lightweight alternative to React Router)

**UI Component Library:**
- shadcn/ui (new-york style) - Radix UI primitives + Tailwind CSS
  - Config: `components.json`
  - 20+ Radix UI packages (`@radix-ui/react-*`)

**State Management:**
- TanStack React Query 5.60.5 - Server state / data fetching
- React Context - Auth state (`client/src/context/AuthContext.tsx`)

**Styling:**
- Tailwind CSS 3.4.17 - Utility-first CSS
  - Config: `tailwind.config.ts`
  - PostCSS: `postcss.config.js` (with autoprefixer)
  - Plugins: `tailwindcss-animate`, `@tailwindcss/typography`
- class-variance-authority 0.7.1 - Component variant management
- tailwind-merge 2.6.0 - Tailwind class deduplication
- framer-motion 11.18.2 - Animations

**Forms:**
- React Hook Form 7.55.0 + @hookform/resolvers 3.10.0
- Zod 3.24.2 - Schema validation (also used server-side)
- drizzle-zod 0.7.0 - Drizzle schema to Zod conversion

## Build Tools

**Dev Server:**
- tsx 4.20.5 - TypeScript execution (runs `server/index.ts` directly)
- cross-env 10.1.0 - Cross-platform env vars in scripts
- Vite 7.3.0 - Client dev server and HMR
  - Config: `vite.config.ts`
  - Plugin: `@vitejs/plugin-react`
  - Path aliases: `@/` → `client/src/`, `@shared/` → `shared/`, `@assets/` → `attached_assets/`

**Production Build:**
- esbuild 0.25.0 - Server bundle (CJS output to `dist/index.cjs`)
- Vite - Client bundle (output to `dist/public/`)
- Build script: `script/build.ts` (combined client + server build)
- Vercel build: `script/build-vercel.ts` (client only, serverless functions)

**Type Checking:**
- TypeScript compiler (`tsc`) - via `npm run check`
- Config: `tsconfig.json` (strict mode, bundler moduleResolution, `noEmit: true`)

## Database

**Database:**
- PostgreSQL (via connection string: `DATABASE_URL` or `POSTGRES_URL`)
  - Supabase-hosted PostgreSQL supported (auto-detected SSL)
  - Neon PostgreSQL supported
  - `pg` 8.16.3 - Node.js PostgreSQL driver

**ORM:**
- Drizzle ORM 0.39.3 - Type-safe SQL query builder
  - Schema: `shared/schema.ts` (single source of truth)
  - Migrations: `migrations/` directory
  - Config: `drizzle.config.ts` (PostgreSQL dialect)
- drizzle-kit 0.31.8 - Schema migration tool (`npm run db:push`)

**Session Store:**
- connect-pg-simple 10.0.0 - PostgreSQL-backed session storage
- memorystore 1.6.7 - In-memory session fallback

## Key Dependencies

**AI/LLM (Chat Bot):**
- openai 4.104.0 - OpenAI API client (also used for Gemini via OpenAI-compatible endpoint)
- groq-sdk 1.1.2 - Groq API client (audio transcription via Whisper)
- `server/lib/gemini.ts` - Gemini via OpenAI-compatible base URL
- `server/lib/openrouter.ts` - OpenRouter via OpenAI-compatible base URL
- `server/lib/ai-provider.ts` - Unified AI provider abstraction

**Authentication:**
- @supabase/supabase-js 2.89.0 - Supabase Auth client
- express-session 1.18.2 - Server-side sessions
- bcrypt 6.0.0 / bcryptjs 3.0.3 - Password hashing

**CRM Integration:**
- GoHighLevel REST API (via native `fetch`, no SDK)

**SMS/Notifications:**
- twilio 5.11.2 - SMS notifications

**File Upload:**
- @uppy/core 5.2.0, @uppy/react 5.1.1, @uppy/dashboard 5.1.0, @uppy/aws-s3 5.1.0 - File upload UI
- @google-cloud/storage 7.18.0 - Google Cloud Storage (Replit Object Storage)

**Drag & Drop:**
- @dnd-kit/core 6.3.1, @dnd-kit/sortable 10.0.0

**Charts/Data Visualization:**
- recharts 2.15.2

**3D/Visual Effects:**
- three 0.183.1 + vanta 0.5.24 - Animated backgrounds

**Other Notable:**
- date-fns 3.6.0 - Date utilities
- react-qr-code 2.0.18 - QR code generation
- react-resizable-panels 2.1.7 - Resizable panel layouts
- embla-carousel-react 8.6.0 - Carousel component
- lottie-react 2.4.1 - Lottie animations
- lucide-react 0.453.0 - Icon library
- react-icons 5.4.0 - Icon library (additional)
- cmdk 1.1.1 - Command palette
- input-otp 1.4.2 - OTP input component
- vaul 1.1.2 - Drawer component
- ws 8.18.0 - WebSocket library

## Deployment

**Primary Hosting:**
- Vercel (serverless)
  - Config: `vercel.json`
  - Serverless functions: `api/index.ts` (main app), `api/xpot.ts` (field sales)
  - Custom domain: `skale.club` (redirects from vercel.app and www.skale.club)
  - Max function duration: 60s (main), 30s (xpot)

**Alternative Hosting:**
- Replit (development environment)
  - Replit-specific Vite plugins: `@replit/vite-plugin-cartographer`, `@replit/vite-plugin-runtime-error-modal`, `@replit/vite-plugin-dev-banner`
  - Replit Object Storage: `server/replit_integrations/object_storage/`

## Configuration Files

| File | Purpose |
|------|---------|
| `package.json` | Dependencies, scripts, module config |
| `tsconfig.json` | TypeScript compiler options, path aliases |
| `vite.config.ts` | Client build config, dev server |
| `drizzle.config.ts` | Database migration config |
| `tailwind.config.ts` | Tailwind CSS theme and plugins |
| `postcss.config.js` | PostCSS plugin chain |
| `components.json` | shadcn/ui component generation config |
| `vercel.json` | Vercel deployment, rewrites, headers |
| `.env.example` | Environment variable template |

---

*Stack analysis: 2026-03-30*
