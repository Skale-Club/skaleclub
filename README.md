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
CRON_SECRET=your-cron-secret
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

The app will be available at `http://localhost:1000`.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Run production server |
| `npm run check` | TypeScript type checking |
| `npm run db:push` | Apply database schema changes |

## Supabase Keep-Alive (GitHub Actions)

- Cron route: `GET /api/cron/supabase-keepalive`
- Schedule: once per day (`0 0 * * *`) via `.github/workflows/supabase-keepalive.yml`
- Security: set `CRON_SECRET` in app env vars and in GitHub repo secrets
- Required GitHub secrets:
  - `SUPABASE_KEEPALIVE_URL` (example: `https://skale.club/api/cron/supabase-keepalive`)
  - `CRON_SECRET`
- Storage: each run writes a timestamp row into `system_heartbeats`

## Blog Autopost Cron (GitHub Actions)

Runs hourly from an external scheduler (the `skale-cron` service on the Coolify VPS; `.github/workflows/blog-cron.yml` is the manual/emergency trigger), which is the **single** scheduler for the blog.

`server/cron.ts` also has an in-process scheduler (`startCron()`), which would
generate every post twice next to an external scheduler. It is **off by default**
and only starts when `ENABLE_INPROCESS_CRON=true` (`DISABLE_INPROCESS_CRON=true`
still forces it off). The self-applying maintenance tasks run at boot in
production by default and in development only with `ENABLE_BOOTSTRAP_TASKS=true`
(`DISABLE_BOOTSTRAP_TASKS=true` forces them off). Never enable the in-process cron on a
host whose schedule is already owned externally.

Each job run writes a `system_heartbeats` row (`blog-generate`, `rss-sync`,
`xphere-sweep`); `GET /api/health/jobs` reports their age and flags stale jobs
(blog > 26h, xphere > 2h). `GET /api/ready` is a DB-backed readiness probe.

- Cron routes: `GET /api/blog/cron/generate`, `GET /api/blog/cron/fetch-rss`
- Schedule: hourly (`0 * * * *` and `30 * * * *`) via `.github/workflows/blog-cron.yml`
- Security: reuses the same `CRON_SECRET` as the keepalive cron (bearer token)
- No extra GitHub secrets needed — the target URLs are hardcoded to `https://skale.club/...`
- `/api/blog/cron/generate` self-gates on `blogSettings.postsPerDay`/`lastRunAt`, so hourly polling is expected — most invocations skip until the cadence window elapses

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

### Catalog (portfolio, home carousels, print folder)

Apps (`portfolio_services`) and services (Website → Our Services cards) are
normalised into one `CatalogItem` (`shared/catalog.ts`), rendered by
`CatalogCard` and `CatalogDetail` on the site and by `client/src/print/cards.tsx`
in the folder. Each item has an explicit `category`.

A product's cover is its **website home** (`homeImageUrl`): the card shows it in
a browser window on the brand surface. Without it, the card falls back to the
product logo. The dashboard (`dashboardImageUrl`) and the popup slider images
form the popup gallery. The legacy `imageUrl` is not shown anywhere public.

## Brand Guidelines

- **Primary Navy**: `#0A162E` (dark surfaces, headings)
- **Action Blue (CTAs/buttons)**: `#5173D6` (hover `#3B5BBE`, white bold text)
- **Fonts**: Inter (headings and body)

## Contracts

**Admin → Growth & Sales → Contracts** (`/admin/contracts`) manages
plain-text agreements with one recipient. Create and save a draft, review the
saved version, and create a signing link. Issuing freezes the document. Copy the
link into a text message/WhatsApp, or explicitly send an email invitation.
The company is the sender; this version records the recipient's signature only.

Before enabling this feature in production:

- Apply `supabase/migrations/20261103120000_contract_signatures.sql` with the
  existing migration runner. For this migration only:
  `npm run db:migrate -- --only=20261103120000_contract_signatures.sql --apply`.
- Enable **Resend** in Admin → Integrations with a working API key and verified
  sender. Invitations, verification codes and signed copies use that integration.
  Sharing a link by phone does not bypass email verification. There is no SMS
  provider or paid signature-platform dependency in this flow.
- Set a persistent `CONTRACT_SIGNING_SECRET` of at least 32 random characters
  (falls back to `SESSION_SECRET`). Back it up separately from the database.
  Rotating the effective secret invalidates existing links and prevents checking
  existing receipt seals with the new key. Keep the original key to verify old
  records. Set the canonical origin/host to the actual deployed public URL for
  email invitations.
- Keep database backups. Issued documents and final receipts cannot be edited
  through the API; database triggers also protect issued content and append-only
  events. A database owner can deliberately disable those protections.

The recipient opens `/contracts/<id>#<secret>`, requests a 6-digit email code (10-minute
expiry, five guesses, resend cooldown and durable per-document request limits),
reviews the contract, checks the explicit electronic-signature consent and types
the specified full name. Verification establishes access to the configured email
inbox; it is not a government-ID or legal-capacity check. Link secrets stay in the
fragment and authorization header, out of ordinary request URLs. Verification
credentials stay in browser memory and expire after 24 hours; reopening requires
email verification again. Voided/expired unsigned contracts cannot be signed.

The database keeps the frozen contract, exact consent, verified email, typed name,
server timestamps, IP and user agent. Signing uses a database row lock, so repeated
or concurrent submissions produce only one signature. Copies are emailed to both
parties after persistence; delivery failure never discards the signed record.
The admin can resend a signed copy. No real emails are sent by the test harness.

Download the self-contained HTML record, or use **Print / save PDF** to retain a
PDF through the browser. Admins can also download JSON evidence including the
audit trail and integrity-check result. Snapshot SHA-256 uses recursively sorted
JSON object keys (no insignificant whitespace); arrays retain their order. The
receipt HMAC-SHA-256 covers `receipt:v1:` plus that canonical encoding of the
receipt excluding `seal`. This is a server evidence seal, not a certificate-based
PDF signature or an independent timestamp authority. Contract pages bypass
marketing attribution, analytics initialization, client error/replay reporting,
search indexing and service-worker caching.

This flow is designed for ordinary US service/partnership agreements. Electronic
signatures are recognized under the federal E-SIGN Act; enforceability still
depends on the agreement, parties, applicable law and any special requirements.
See [15 USC §7001](https://www.govinfo.gov/content/pkg/USCODE-2024-title15/html/USCODE-2024-title15-chap96-subchapI-sec7001.htm).

Validation: `npm test`; `npm run check`; `npm run build`; and
`npm run test:e2e` (or, after building the client, run only
`node --import tsx --test e2e/contracts.e2e.ts` with the same dummy database URLs
as `test:e2e:run`). The browser tests use real routes with memory storage and a
simulated email outbox, never a live database.

## License

MIT
