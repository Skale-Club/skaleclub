# Skale Club

A full-stack service booking platform for a marketing company. Customers can browse services by category, add items to cart, select available time slots, and complete bookings. Includes an admin dashboard and GoHighLevel CRM integration.

## Features

- **Service Catalog** - Browse marketing services organized by categories and subcategories
- **Shopping Cart** - Add multiple services, view totals, and manage selections
- **Booking System** - Select available time slots based on business hours and existing bookings
- **Admin Dashboard** - Manage services, categories, bookings, and business settings
- **GoHighLevel Integration** - Sync bookings and contacts with GHL CRM
- **Responsive Design** - Mobile-friendly interface built with Tailwind CSS

## Tech Stack

### Frontend
- React 18 with TypeScript
- Vite for build tooling
- Wouter for routing
- TanStack React Query for server state
- shadcn/ui + Radix UI components
- Tailwind CSS for styling
- Framer Motion for animations

### Backend
- Express.js with TypeScript
- Drizzle ORM with PostgreSQL
- Session-based authentication with bcrypt
- Zod for validation

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database

### Environment Variables

Create a `.env` file with the following:

```env
DATABASE_URL=postgresql://user:password@host:port/database
SESSION_SECRET=your-session-secret
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD_HASH=bcrypt-hashed-password
CRON_SECRET=your-vercel-cron-secret
```

### Installation

```bash
# Install dependencies
npm install

# Push database schema
npm run db:push

# Start development server
npm run dev
```

The app will be available at `http://localhost:5000`.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Run production server |
| `npm run check` | TypeScript type checking |
| `npm run db:push` | Apply database schema changes |

## Supabase Keep-Alive (Vercel Cron)

- Cron route: `GET /api/cron/supabase-keepalive`
- Schedule: every 6 hours (`0 */6 * * *`) via `vercel.json`
- Security: set `CRON_SECRET` in Vercel env vars
- Storage: each run writes a timestamp row into `system_heartbeats`

## Project Structure

```
client/src/
├── pages/           # Route components (Home, Services, Admin, Booking)
├── components/      # UI components (ui/ contains shadcn components)
├── hooks/           # Custom hooks (useAuth, useBooking, useSEO)
├── context/         # CartContext, AuthContext
└── lib/             # Utilities

server/
├── index.ts         # Express setup and middleware
├── routes.ts        # API endpoints
├── storage.ts       # Database queries via IStorage interface
├── db.ts            # Database connection
└── integrations/    # GoHighLevel API integration

shared/
├── schema.ts        # Drizzle tables + Zod schemas
└── routes.ts        # Type-safe API route definitions
```

## Database Schema

- `categories` - Service categories
- `subcategories` - Service subcategories
- `services` - Individual marketing services with pricing
- `serviceAddons` - Cross-sell relationships between services
- `bookings` - Customer booking records
- `bookingItems` - Services included in each booking
- `companySettings` - Business hours, SEO, analytics config
- `integrationSettings` - GoHighLevel credentials
- `faqs` - FAQ entries

## Brand Guidelines

- **Primary Blue**: `#1C53A3`
- **Brand Yellow**: `#FFFF01` (for CTAs)
- **Fonts**: Outfit (headings), Inter (body)

## License

MIT
