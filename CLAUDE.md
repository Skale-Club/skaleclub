# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Skleanings is a full-stack service booking platform for a cleaning company. Customers browse services by category, add to cart, select available time slots, and complete bookings. Includes admin dashboard and GoHighLevel CRM integration.

## Commands

```bash
npm run dev          # Start development server (port 5000)
npm run build        # Build client (Vite) and server (esbuild) to /dist
npm run start        # Run production server
npm run check        # TypeScript type checking
npm run db:push      # Apply database schema changes via Drizzle Kit
```

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Wouter (routing), React Query, shadcn/ui, Tailwind CSS
- **Backend**: Express.js, TypeScript, Drizzle ORM, PostgreSQL
- **Auth**: Session-based with bcrypt, Replit Auth integration for admin

## Architecture

```
client/src/
├── pages/          # Route components (Home, Services, Admin, Booking flow)
├── components/     # UI components (ui/ has shadcn components)
├── hooks/          # Custom hooks (useAuth, useBooking, useSEO, useUpload)
├── context/        # CartContext, AuthContext
└── lib/            # Utilities (queryClient, analytics)

server/
├── index.ts        # Express setup, middleware, port config
├── routes.ts       # All API endpoints (~2800 lines)
├── storage.ts      # Database queries via IStorage interface
├── db.ts           # Database connection
└── integrations/   # GoHighLevel API (ghl.ts)

shared/
├── schema.ts       # Drizzle tables + Zod schemas (source of truth for types)
└── routes.ts       # Type-safe API route definitions
```

## Key Patterns

**Type-Safe API**: `shared/routes.ts` defines endpoints with Zod schemas. Both client and server import these for type safety.

**Shared Schema**: Database tables in `shared/schema.ts` generate both TypeScript types and Zod validators via `drizzle-zod`. Use `insertXSchema` for inserts, `typeof table.$inferSelect` for selects.

**Storage Layer**: All database operations go through `server/storage.ts` implementing `IStorage` interface. Routes call storage methods, not raw SQL.

**State Management**: React Query for server state, Context API for cart/auth. No Redux.

## Database Tables

- `categories`, `subcategories`, `services` - Service catalog
- `serviceAddons` - Cross-sell relationships between services
- `bookings`, `bookingItems` - Customer bookings with snapshot pricing
- `companySettings` - Singleton for business hours, SEO, analytics config
- `integrationSettings` - GoHighLevel credentials
- `faqs` - FAQ entries

## Environment Variables

Required:
- `DATABASE_URL` - PostgreSQL connection string
- `SESSION_SECRET` - Express session encryption
- `ADMIN_EMAIL` - Admin login email
- `ADMIN_PASSWORD_HASH` - bcrypt hash of admin password

## Brand Guidelines

- **Colors**: Primary Blue `#1C53A3`, Brand Yellow `#FFFF01` (for CTAs)
- **Fonts**: Outfit (headings), Inter (body)
- **CTA Buttons**: Brand Yellow with black bold text, pill-shaped (`rounded-full`)
