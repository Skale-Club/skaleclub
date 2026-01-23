# Skale Club - Service Booking Platform

## Overview

This is a full-stack service booking application for a marketing company (Skale Club) built with React, Express, and PostgreSQL. The platform allows customers to browse marketing services by category, add multiple services to a cart, select available time slots based on total service duration, and complete bookings with customer details. It includes an admin dashboard for viewing and managing bookings.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight alternative to React Router)
- **State Management**: 
  - React Query (@tanstack/react-query) for server state and API caching
  - React Context for cart state (CartContext)
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming
- **Forms**: React Hook Form with Zod validation (@hookform/resolvers)
- **Build Tool**: Vite with custom plugins for Replit integration

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **API Design**: RESTful endpoints defined in `shared/routes.ts` with Zod schemas for input/output validation
- **Database ORM**: Drizzle ORM with PostgreSQL dialect
- **Session Management**: express-session with in-memory store (development) 
- **Admin Authentication**: Session-based auth with bcrypt password hashing

### Data Storage
- **Database**: PostgreSQL (required via DATABASE_URL environment variable)
- **Schema Location**: `shared/schema.ts` using Drizzle ORM table definitions
- **Key Tables**:
  - `categories` - Service categories (e.g., Upholstery Cleaning, Carpet Cleaning)
  - `services` - Individual marketing services with pricing and duration
  - `bookings` - Customer booking records with scheduling info
  - `bookingItems` - Line items linking bookings to services (snapshot pricing)

### Shared Code Strategy
- The `shared/` directory contains code used by both frontend and backend
- `shared/schema.ts` - Database schema and Zod validation schemas
- `shared/routes.ts` - API route definitions with type-safe request/response schemas
- Path aliases: `@shared/*` maps to `./shared/*`

### Key Features
1. **Service Browsing**: Categories with hierarchical services, filterable by category
2. **Shopping Cart**: Client-side cart with add/remove, total price and duration calculation
3. **Availability Checking**: Time slot availability based on existing bookings and total service duration
4. **Booking Flow**: Multi-step booking with date selection, time slot selection, and customer info
5. **Admin Dashboard**: View all bookings with customer details and status
6. **GoHighLevel Integration**: Automatic sync of bookings, contacts, and appointments with GHL CRM

### Working Hours Configuration
- **Day-by-day business hours**: Configurable per day of week in Admin > Company Settings
- Stored in `companySettings.businessHours` as JSON (BusinessHours type)
- Each day has: `isOpen` (boolean), `start` (HH:MM), `end` (HH:MM)
- Default: Monday-Friday 8am-6pm open, Saturday-Sunday closed
- When GHL integration is enabled, availability also checks GHL free slots
- Booking calendar defaults to tomorrow (not today) to allow time for scheduling

### Time Display Format
- Configurable in Admin > Company Settings (12-hour AM/PM or 24-hour)
- Stored in `companySettings.timeFormat` ('12h' or '24h')
- Applied throughout booking UI and admin availability section

## External Dependencies

### Database
- **PostgreSQL**: Required, connection via `DATABASE_URL` environment variable
- **Drizzle Kit**: Used for schema migrations (`npm run db:push`)

### Environment Variables (Required)
- **SESSION_SECRET**: Required for session encryption (server will not start without it)
- **ADMIN_EMAIL**: Admin login email
- **ADMIN_PASSWORD_HASH**: bcrypt-hashed admin password (generate with `bcrypt.hash(password, 10)`)

### Third-Party UI Libraries
- **Radix UI**: Headless UI primitives for accessibility (dialogs, dropdowns, forms, etc.)
- **shadcn/ui**: Pre-built component library using Radix primitives
- **Lucide React**: Icon library
- **Embla Carousel**: Carousel component
- **Vaul**: Drawer component
- **cmdk**: Command palette component

### Utility Libraries
- **date-fns**: Date manipulation for booking logic
- **clsx/tailwind-merge**: Conditional class name utilities
- **Zod**: Schema validation for forms and API contracts
- **drizzle-zod**: Generate Zod schemas from Drizzle tables

### Development
- **Vite**: Build tool and dev server
- **TSX**: TypeScript execution for server
- **esbuild**: Production bundling for server code

### GoHighLevel Integration

The platform integrates with GoHighLevel CRM for automatic syncing of bookings, contacts, and appointments.

**Configuration (Admin Panel > Integrations):**
- **API Key**: Your GoHighLevel API key from Settings > Business Profile > API Key
- **Location ID**: Your GHL sub-account/location identifier
- **Calendar ID**: The calendar to sync appointments with (default: 2irhr47AR6K0AQkFqEQl)
- **Enable/Disable Toggle**: Turn integration on/off

**How It Works:**
1. When a booking is created, the system checks if GHL integration is enabled
2. If enabled, creates or finds a contact in GHL with the customer's information
3. Creates an appointment in the configured GHL calendar
4. Stores GHL contact ID and appointment ID in the booking record
5. Tracks sync status (pending, synced, failed) for each booking

**Database Tables:**
- `integrationSettings` - Stores GHL credentials and configuration
- `bookings.ghlContactId` - Reference to GHL contact
- `bookings.ghlAppointmentId` - Reference to GHL appointment
- `bookings.ghlSyncStatus` - Sync status tracking

**API Endpoints:**
- `GET /api/integrations/ghl` - Get GHL settings (admin only)
- `PUT /api/integrations/ghl` - Save GHL settings (admin only)
- `POST /api/integrations/ghl/test` - Test connection (admin only)
- `GET /api/integrations/ghl/status` - Check if GHL is enabled (public)
- `GET /api/integrations/ghl/free-slots` - Get available slots from GHL (public)

**Files:**
- `server/integrations/ghl.ts` - GHL API utility functions
- `client/src/pages/Admin.tsx` - IntegrationsSection component

### SEO Management

The platform includes a comprehensive SEO management system accessible via Admin > SEO section (separate from Company Settings).

**SEO Fields Available:**
- **Basic SEO**: Title, Description, Keywords, Author, Canonical URL, Robots Tag
- **Open Graph**: og:title, og:description, og:image, og:type, og:site_name, og:url
- **Twitter Cards**: twitter:card, twitter:title, twitter:description, twitter:image, twitter:site, twitter:creator
- **Schema.org**: LocalBusiness JSON-LD auto-generated from company settings

**Dynamic Features:**
- All meta tags injected client-side via `useSEO` hook
- Dynamic sitemap.xml includes: homepage, services page, cart page, and all category pages
- robots.txt with sitemap reference auto-generated

**API Endpoints:**
- `GET /sitemap.xml` - Dynamic XML sitemap
- `GET /robots.txt` - Dynamic robots.txt with sitemap reference

**Files:**
- `client/src/hooks/use-seo.ts` - SEO meta tag injection hook
- `client/src/pages/Admin.tsx` - SEOSection component
- `server/routes.ts` - sitemap.xml and robots.txt endpoints

**Design Choices:**
- Hero image preview: 4:3 aspect ratio
- OG image preview: 1.91:1 aspect ratio (matches social media standards)

### Blog System

The platform includes a comprehensive blog system for content marketing and SEO.

**Features:**
- **Admin Management**: Create, edit, delete blog posts via Admin > Blog section
- **Rich Content**: HTML content support with excerpt and feature images
- **SEO Optimization**: Meta descriptions (155 char limit), focus keywords, structured data (Article schema)
- **Related Services**: Link up to 3 services to each post, displayed as purchasable cards
- **Social Sharing**: Facebook, Twitter, LinkedIn, WhatsApp share buttons on posts
- **Related Posts**: Sidebar showing other recent posts
- **Homepage Integration**: "Latest from Our Blog" section showing 3 recent posts
- **Archive Page**: Grid layout with search and pagination (9 posts per page)

**Database Tables:**
- `blogPosts` - Blog post content, SEO fields, status, and metadata
- `blogPostServices` - Junction table linking posts to related services

**Public Pages:**
- `/blog` - Blog archive with grid layout, search, and pagination
- `/blog/:slug` - Single post page with related content and social sharing

**API Endpoints:**
- `GET /api/blog` - List posts (supports ?status=published&limit=9&offset=0)
- `GET /api/blog/count` - Count of published posts for pagination
- `GET /api/blog/:slug` - Get single post by slug
- `POST /api/blog` - Create post (admin only)
- `PUT /api/blog/:id` - Update post (admin only)
- `DELETE /api/blog/:id` - Delete post (admin only)
- `GET /api/blog/:id/services` - Get related services for a post
- `GET /api/blog/:id/related` - Get related posts

**Files:**
- `client/src/pages/Blog.tsx` - Blog archive page
- `client/src/pages/BlogPost.tsx` - Single post page
- `client/src/pages/Admin.tsx` - BlogSection component
- `client/src/pages/Home.tsx` - BlogSection for homepage