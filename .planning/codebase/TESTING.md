# Testing Patterns

**Analysis Date:** 2026-03-30

## Test Framework

**Status:** No automated test runner configured

**Current Approach:** Manual testing only

**Package.json Scripts:**
```json
"scripts": {
  "dev": "cross-env NODE_ENV=development tsx server/index.ts",
  "build": "tsx script/build.ts",
  "build:vercel": "tsx script/build-vercel.ts",
  "start": "cross-env NODE_ENV=production node dist/index.cjs",
  "check": "tsc",
  "db:push": "drizzle-kit push",
  "print:db:dev": "cross-env NODE_ENV=development tsx temp_db_url.ts"
}
```

**Type Checking:**
- `npm run check` - Runs TypeScript type checking via `tsc`
- TSConfig has `"strict": true` for full type safety
- No test-related scripts configured

## Test File Organization

**Location:** No test files exist in the codebase

**Search Results:**
- No `.test.ts`, `.test.tsx` files found
- No `.spec.ts`, `.spec.tsx` files found
- No Jest, Vitest, or testing-library configured

**Current State:**
```
No test directories or test files present in project
```

## Test Types

### Unit Tests

**Status:** Not implemented

**Gap:** No unit tests for:
- Utility functions (e.g., `lib/utils.ts`, `lib/auth-utils.ts`)
- Custom hooks (e.g., `useAuth`, `useTranslation`)
- Type utilities or Zod schemas

### Integration Tests

**Status:** Not implemented

**Gap:** No integration tests for:
- API endpoints in `server/routes.ts`
- Database operations in `server/storage.ts`
- Authentication flows in `client/src/context/AuthContext.tsx`

### E2E Tests

**Status:** Not implemented

**Gap:** No E2E test framework installed

**Manual Testing Required (per AGENTS.md):**
- Use `data-testid` attributes for UI elements that need reliable selectors
- Manually verify critical flows (booking, admin CRUD, availability) before PRs

## Data Test Attributes

**Usage Pattern:**
Components use `data-testid` attributes for manual test selectors:

**Home.tsx:**
```typescript
data-testid="text-blog-section-title"
data-testid="link-view-all-blog"
data-testid={`link-blog-card-${post.id}`}
data-testid={`img-blog-home-${post.id}`}
data-testid={`text-blog-home-date-${post.id}`}
data-testid={`text-blog-home-title-${post.id}`}
data-testid={`text-blog-home-excerpt-${post.id}`}
data-testid="button-hero-form"
```

**Best Practices Observed:**
- Prefixed: `text-`, `link-`, `img-`, `button-` for semantic identification
- Dynamic values included in IDs (e.g., `${post.id}`)
- Used consistently for key interactive elements

## Coverage

**Status:** No test coverage enforcement or measurement

**Verification Command:**
```bash
# Not available - no test runner configured
```

## Manual Testing Procedures

### Per AGENTS.md Requirements:

**Required Before PRs:**
- Manual verification of booking flow
- Manual verification of admin CRUD operations
- Manual verification of availability selection
- Screenshot/GIF capture for UI changes

### Development Commands:

**Start Development Server:**
```bash
npm run dev
# Server runs at http://localhost:5000
```

**Type Check:**
```bash
npm run check
# Validates TypeScript types without emitting
```

**Database Schema:**
```bash
npm run db:push
# Applies schema changes via Drizzle Kit
```

## CI/CD Pipeline

### GitHub Actions

**File:** `.github/workflows/supabase-keepalive.yml`

**Workflow:**
- Runs daily at midnight (`0 0 * * *`)
- Manually triggerable via `workflow_dispatch`
- Timeout: 5 minutes

**Purpose:**
- Keeps Supabase database connection alive
- Writes timestamp to `system_heartbeats` table

**Secrets Required:**
- `SUPABASE_KEEPALIVE_URL` - The endpoint URL
- `CRON_SECRET` - Authorization token

### No Test Automation in CI

**Observation:**
- No test step in CI pipeline
- Workflow only performs keep-alive ping
- No build verification or lint checks configured

## Testing Gaps

### Critical Gaps

**1. No Test Runner:**
- No Jest, Vitest, or testing framework configured
- Cannot write automated tests without first adding a test framework

**2. No Test Files:**
- Entire codebase lacks test files
- Utility functions in `lib/` untested
- Custom hooks untested

**3. No E2E Framework:**
- Critical user flows not automated
- Booking flow requires manual verification
- Admin CRUD operations require manual testing

### High Priority Gaps

**1. Utility Functions:**
- `lib/utils.ts` - `cn()` utility for className merging
- `lib/auth-utils.ts` - Authentication helpers
- `lib/queryClient.ts` - React Query client setup

**2. Custom Hooks:**
- `useAuth` - Authentication state management
- `useTranslation` - Internationalization
- `useSEO` - Page SEO handling

**3. API Endpoints:**
- All routes in `server/routes.ts` untested
- Database CRUD operations untested

### Recommended Additions

**Test Framework:**
```bash
# Install Vitest for unit tests
npm install -D vitest @testing-library/react @testing-library/dom jsdom

# Or install Jest
npm install -D jest @testing-library/react @testing-library/dom
```

**E2E Framework:**
```bash
# Install Playwright for E2E tests
npm install -D @playwright/test
```

**Integration:**
- Add test script to `package.json`
- Configure test runner in `vite.config.ts` or separate config
- Add test step to CI pipeline before deployment

---

*Testing analysis: 2026-03-30*