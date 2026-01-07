# BlueSpring Cleaning - Service Booking Platform

## Overview

This is a full-stack service booking application for a cleaning company (BlueSpring Cleaning) built with React, Express, and PostgreSQL. The platform allows customers to browse cleaning services by category, add multiple services to a cart, select available time slots based on total service duration, and complete bookings with customer details. It includes an admin dashboard for viewing and managing bookings.

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
  - `services` - Individual cleaning services with pricing and duration
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

### Working Hours Configuration
- Defined in `shared/schema.ts` as `WORKING_HOURS` constant
- Used for calculating available time slots

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