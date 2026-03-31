# Codebase Concerns

**Analysis Date:** 2026-03-30

---

## Security Concerns

### 1. XSS via `dangerouslySetInnerHTML` (HIGH)

Blog post content is rendered directly as raw HTML without sanitization:

- **File:** `client/src/pages/BlogPost.tsx:169`
  ```tsx
  dangerouslySetInnerHTML={{ __html: post.content }}
  ```

- **File:** `client/src/components/admin/BlogSection.tsx:172`
  ```tsx
  contentRef.current.innerHTML = formData.content;
  ```

**Risk:** If an admin account is compromised, or if any input path allows HTML injection into blog content, arbitrary JavaScript will execute on every visitor's browser.

**Fix approach:** Use a sanitization library like `DOMPurify` before rendering:
```tsx
import DOMPurify from 'dompurify';
dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(post.content) }}
```

---

### 2. No CSRF Protection (MEDIUM)

Express session is configured with `sameSite: "lax"` which provides partial CSRF mitigation, but no explicit CSRF token middleware (e.g., `csurf` or custom token) is used.

- **File:** `server/auth/supabaseAuth.ts:22-35` — Session config
- **File:** `server/app.ts` — No CSRF middleware

**Risk:** State-changing POST/PUT/DELETE endpoints could be vulnerable to cross-site request forgery attacks if a user is authenticated.

---

### 3. Large Request Body Limit (MEDIUM)

The JSON and URL-encoded body parser is configured with a 50MB limit:

- **File:** `server/app.ts:31`
  ```ts
  limit: '50mb'
  ```
- **File:** `api/xpot.ts:17-18` — Same 50mb limit

**Risk:** Allows extremely large payloads that could cause memory exhaustion or slow processing. Only a few endpoints (e.g., audio upload) actually need large payloads.

**Fix approach:** Set a lower default (e.g., 1mb) and override only for specific upload routes.

---

### 4. In-Memory Rate Limiting (MEDIUM)

Rate limiting uses an in-memory `Map` that grows unboundedly and is not shared across instances:

- **File:** `server/routes.ts:94-106`
  ```ts
  const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
  ```

**Risk:**
- Memory leak: entries are never cleaned up (only overwritten on next request).
- Does not work across multiple server instances or serverless invocations.
- Rate limit is per-IP with 8 requests/60s for chat only; many other endpoints have no rate limiting.

---

### 5. Supabase Anon Key Exposed to Client (LOW-MEDIUM)

- **File:** `server/auth/supabaseAuth.ts:154-159`
  ```ts
  app.get("/api/supabase-config", (_req, res) => {
    res.json({
      url: process.env.SUPABASE_URL || "",
      anonKey: process.env.SUPABASE_ANON_KEY || "",
    });
  });
  ```

**Risk:** The anon key is designed to be public, but this endpoint has no rate limiting and returns the key on every request. Supabase Row Level Security (RLS) must be properly configured to prevent unauthorized data access.

---

### 6. SSL Certificate Validation Disabled for DB (MEDIUM)

- **File:** `server/db.ts:42-44`
  ```ts
  ssl: shouldUseSsl
    ? { rejectUnauthorized: false, checkServerIdentity: () => undefined }
    : false,
  ```

**Risk:** Disables server certificate validation, making the connection vulnerable to man-in-the-middle attacks. This is a common workaround for self-signed certificates but should be addressed with proper CA certificates.

---

### 7. SQL `sql.raw()` in Migration Script (LOW)

- **File:** `scripts/apply-translations-table.ts:21`
  ```ts
  await db.execute(sql.raw(migrationSQL));
  ```

**Risk:** Reads a `.sql` file and executes it raw. Acceptable for a migration script that only admins run, but the file content is trusted implicitly.

---

### 8. Admin Determined by Email Match (LOW)

- **File:** `server/auth/supabaseAuth.ts:71`
  ```ts
  isAdmin: email === process.env.ADMIN_EMAIL,
  ```

**Risk:** Admin status is set once on user creation based on a single env var. If `ADMIN_EMAIL` changes, existing users retain old admin status until manually updated in the DB.

---

### 9. `cors` Listed as External Dependency (LOW)

- **File:** `script/build.ts:12` — `cors` is in the external list for esbuild
- No `cors` package found in `package.json` dependencies

**Risk:** This suggests CORS may have been removed or is handled implicitly. Express does not set CORS headers by default, so cross-origin API requests from the frontend will fail unless same-origin.

---

## Technical Debt

### 1. Monolithic `routes.ts` File — 3,489 Lines (HIGH)

- **File:** `server/routes.ts` — 3,489 lines

This single file contains ALL API route definitions including:
- Chat/AI endpoints
- Company settings CRUD
- FAQ CRUD
- Integration settings (OpenAI, Gemini, OpenRouter, Groq, GHL, Twilio)
- User management
- Blog post CRUD
- Portfolio CRUD
- Lead management
- Form config
- Translation
- VCard tracking
- Cron jobs

**Impact:** Extremely difficult to navigate, test, or modify safely. Merge conflicts are likely with multiple developers. The file should be split into domain-specific route modules (e.g., `routes/chat.ts`, `routes/admin.ts`, `routes/integrations.ts`).

Already some extraction has begun:
- `server/routes/xpot.ts` (1,042 lines) — extracted Xpot/field sales routes

---

### 2. Runtime API Key Variables in Routes (MEDIUM)

- **File:** `server/routes.ts:213-222`
  ```ts
  let runtimeOpenAiKey = process.env.OPENAI_API_KEY || "";
  let runtimeGeminiKey = process.env.GEMINI_API_KEY || "";
  let runtimeOpenRouterKey = process.env.OPENROUTER_API_KEY || "";
  ```

These module-level mutable variables store API keys in memory. They are:
- Not persisted across restarts
- Shared across all requests (global mutable state)
- Duplicated in `server/lib/ai-provider.ts` with getter/setter functions

**Impact:** In serverless environments, these keys are lost on cold starts. The pattern of having both route-level variables AND `ai-provider.ts` getter/setters creates confusion.

---

### 3. No Automated Test Suite (HIGH)

- No test framework configured (no Jest, Vitest, Mocha, or any test runner)
- No `*.test.*` or `*.spec.*` files found
- `AGENTS.md` confirms: "No automated test runner is configured currently"

**Impact:** Any code change risks breaking existing functionality with no safety net. Critical flows (booking, admin CRUD, AI chat, payment integration) are entirely manually tested.

---

### 4. Schema Patches Applied at Runtime (MEDIUM)

- **File:** `server/storage.ts:75-97`

Raw SQL `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` statements are executed on every server startup via `ensureCompanySettingsSchema()` and `ensureChatSettingsSchema()`:

```ts
const companySettingsSchemaPatches = [
  sql`ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "seo_keywords" text DEFAULT ''`,
  sql`ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "seo_author" text DEFAULT ''`,
  // ... 13 more patches
];
```

**Impact:** This is a workaround for not using proper database migrations. It works but:
- Cannot handle column renames, type changes, or drops
- Runs every startup even when unnecessary (mitigated by flags)
- Bypasses Drizzle Kit's migration tracking
- Makes schema state hard to reason about

---

### 5. Duplicate Password Libraries (LOW)

- **File:** `package.json:61-62`
  ```json
  "bcrypt": "^6.0.0",
  "bcryptjs": "^3.0.3",
  ```

Both `bcrypt` (native) and `bcryptjs` (pure JS) are installed. Only one should be needed. This adds unnecessary bundle size and dependency surface.

---

### 6. Hardcoded GHL Calendar ID (LOW)

Default GoHighLevel calendar ID is hardcoded in multiple places:

- **File:** `shared/schema.ts:73` — Database default
- **File:** `server/routes.ts:2182` — Fallback in GET endpoint
- **File:** `server/routes.ts:2205` — Fallback in PUT endpoint
- **File:** `client/src/components/admin/IntegrationsSection.tsx:52` — Form default

**Impact:** If the GHL account changes, this ID needs updating in 4 places. Should be configurable via admin settings only.

---

### 7. Hardcoded Portuguese Messages in Production Code (LOW)

Twilio notification messages are hardcoded in Portuguese:

- **File:** `server/integrations/twilio.ts:107` — `"🔔 Novo chat em ${config.companyName}"`
- **File:** `server/integrations/twilio.ts:137` — `"⚠️ ${config.companyName}: alerta de tempo de resposta"`

**Impact:** The app appears to support i18n (translations system exists), but these notification messages bypass it entirely.

---

## Performance Concerns

### 1. All Conversation Messages Loaded on Every Chat Request (MEDIUM)

- **File:** `server/routes.ts:1516`
  ```ts
  const existingMessages = await storage.getConversationMessages(conversationId);
  ```

Every chat message loads ALL existing messages in the conversation (up to 50). Combined with AI token processing, this becomes increasingly expensive as conversations grow.

**Fix approach:** Implement pagination or a sliding window of recent messages for the AI context.

---

### 2. No Database Indexes for Common Queries (MEDIUM)

The schema uses Drizzle ORM defaults. Key queries that would benefit from explicit indexes:
- `formLeads` queried by `sessionId`, `conversationId`, `email`, `status`, `classificacao`
- `conversations` queried by `status`, `lastMessageAt`
- `conversationMessages` queried by `conversationId`
- `blogPosts` queried by `slug`, `status`

**Impact:** Query performance will degrade as data grows.

---

### 3. Supabase Admin API Called Synchronously for User Lists (LOW-MEDIUM)

- **File:** `server/routes.ts:3051-3088`

The `/api/users` endpoint makes a synchronous call to Supabase Auth admin API then merges with local DB data. This creates a waterfall dependency.

---

### 4. In-Memory Rate Limit Store Grows Unboundedly (MEDIUM)

- **File:** `server/routes.ts:94`

The `rateLimitStore` Map is never cleaned. Old entries persist in memory even after their window expires.

**Fix approach:** Use `setInterval` to periodically purge expired entries, or use a library like `lru-cache` with TTL.

---

## Dependency Risks

### 1. Both `bcrypt` and `bcryptjs` Installed (LOW)

- **File:** `package.json:61-62`

Redundant dependencies — `bcrypt` is a native addon (requires build tools), `bcryptjs` is pure JS. Pick one.

### 2. Multiple Replit-Specific Plugins (LOW)

- `@replit/vite-plugin-cartographer`
- `@replit/vite-plugin-dev-banner`
- `@replit/vite-plugin-runtime-error-modal`

These are Replit-specific and unnecessary on Vercel or other platforms. They increase build size and add potential attack surface in production if not tree-shaken properly.

### 3. `run-deepseek-cli` Dependency (LOW)

- **File:** `package.json:96`

An unusual dependency — unclear if actively used in the application or was added experimentally.

### 4. `three` and `vanta` 3D Libraries (LOW)

- **File:** `package.json:99,102`

3D animation libraries add significant bundle weight. Verify they are actually used and tree-shaken effectively.

---

## Error Handling Gaps

### 1. Global Error Handler Re-throws Error (MEDIUM)

- **File:** `server/app.ts:62-67`
  ```ts
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;  // <-- re-throws, crashing the process
  });
  ```

The `throw err` after sending the response will cause an unhandled exception, potentially crashing the Node.js process. In production, this should log the error but not re-throw.

### 2. Silent Error Swallowing in Session Check (LOW)

- **File:** `server/auth/supabaseAuth.ts:130-132`
  ```ts
  } catch (error) {
    res.json({ isAdmin: false, email: null, firstName: null, lastName: null });
  }
  ```

Database errors are silently swallowed and treated as "not logged in." This could mask connection issues.

### 3. Generic Error Messages Expose Stack Traces (LOW)

- **File:** `server/routes.ts:3087`
  ```ts
  res.status(500).json({ message: (err as Error).message });
  ```

Multiple endpoints return raw error messages to clients, potentially exposing internal implementation details.

---

## Missing Features / Incomplete Implementations

### 1. No Request Logging System (MEDIUM)

Only basic `console.log` and `console.error` throughout the codebase. No structured logging, log levels, or log aggregation.

- **File:** `server/app.ts:20` — Basic `console.log`
- **218+ `console.log/error/warn/debug`** calls across the codebase

**Impact:** Difficult to debug production issues, monitor performance, or set up alerting.

### 2. No Health Check Endpoint (LOW)

No dedicated `/health` or `/ready` endpoint exists for load balancer or container orchestration health checks. The closest is `/api/cron/supabase-keepalive` which requires authorization.

### 3. No Input Validation on Many Admin Endpoints (MEDIUM)

While some endpoints use Zod schemas (chat messages, form leads), many admin endpoints parse request bodies without validation:

- **File:** `server/routes.ts:2196-2199` — GHL settings save reads `req.body` directly
- Multiple integration save endpoints accept arbitrary body shapes

---

## Hardcoded Values

| Value | Location | Issue |
|-------|----------|-------|
| `'2irhr47AR6K0AQkFqEQl'` | `shared/schema.ts:73`, `server/routes.ts:2182,2205`, `client/.../IntegrationsSection.tsx:52` | GHL Calendar ID hardcoded in 4 places |
| `'http://localhost:5000'` | `server/routes.ts:334`, `server/lib/openrouter.ts:6` | OpenRouter fallback URL |
| `'gpt-4o-mini'` | `server/routes.ts:122` | Default chat model |
| `'gemini-2.0-flash'` | `server/routes.ts:123` | Default Gemini model |
| `'whisper-large-v3-turbo'` | `server/routes.ts:2115,2159` | Hardcoded Groq model |
| `'llama-3.1-8b-instant'` | `server/routes.ts:2144` | Hardcoded test model |
| `'Skale Club'` | `server/routes.ts:1486` | Default company name fallback |
| `50` | `server/routes.ts:1517` | Message limit per conversation |
| `8` / `60_000` | `server/routes.ts:97` | Rate limit defaults |

---

## Overall Risk Assessment

**Risk Level: MEDIUM-HIGH**

**Reasoning:**

| Factor | Rating | Notes |
|--------|--------|-------|
| Security | **Medium** | XSS via `dangerouslySetInnerHTML` is the primary concern. No CSRF protection. SSL validation disabled. No critical auth bypass found. |
| Reliability | **High** | Global error handler re-throws, no automated tests, monolithic routes file increases regression risk |
| Scalability | **Medium** | In-memory rate limiting, no connection pooling optimization, full message history loaded per request |
| Maintainability | **High** | 3,489-line routes.ts, runtime mutable state for API keys, no test coverage, schema patches instead of migrations |
| Operational | **Medium** | No structured logging, no health checks, console.log throughout, difficult to debug in production |

**Priority Fixes:**
1. Sanitize blog content with DOMPurify before `dangerouslySetInnerHTML` (security)
2. Fix global error handler to not re-throw (reliability)
3. Split `server/routes.ts` into domain modules (maintainability)
4. Add basic integration tests for critical flows (reliability)
5. Set up structured logging (operational)

---

*Concerns audit: 2026-03-30*
