# Repository Guidelines

## Project Structure & Module Organization
- `client/src/` holds the React UI (pages, components, hooks, context, lib).
- `server/` contains the Express API, storage layer, and integrations.
- `shared/` is the source of truth for schemas and API route types.
- `script/` contains build tooling; `dist/` is the production output.

Example layout:
```
client/src/pages/        # Route-level screens (Home, Services, Admin)
server/routes.ts         # API endpoints
shared/schema.ts         # Drizzle tables + Zod schemas
```

## Build, Test, and Development Commands
- `npm run dev` starts the dev server (client + API) at `http://localhost:1000`.
- `npm run build` builds the client and server into `dist/`.
- `npm run start` runs the production server from `dist/`.
- `npm run check` runs TypeScript type checking.
- `npm run db:push` applies schema changes to PostgreSQL via Drizzle Kit.

## Coding Style & Naming Conventions
- Indentation: 2 spaces; keep existing formatting conventions.
- React components use `PascalCase` (e.g., `Admin.tsx`); hooks use `useX`.
- Favor explicit types in shared schemas and storage layer.
- Tailwind CSS classes are used for styling; prefer utility-first patterns.
- No lint/format script is configured; rely on editor defaults and `npm run check`.

## Testing Guidelines
- No automated test runner is configured currently.
- Use `data-testid` attributes for UI elements that need reliable selectors.
- Manually verify critical flows (booking, admin CRUD, availability) before PRs.

## Commit & Pull Request Guidelines
- Git history shows no strict convention; keep commit messages short and imperative.
- PRs should include a brief summary, testing notes (commands or manual steps), and
  screenshots/GIFs for UI changes.
- Link related issues when applicable.

## Security & Configuration
- Required env vars live in `.env` (see `README.md`): `DATABASE_URL`,
  `SESSION_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`.
- Do not commit secrets; use local `.env` files and secret managers for production.

## Reading live site data from a sandboxed session

Agent sessions often run behind an egress proxy that allows very few hosts. When
`skale.club` and `*.supabase.co` are not on the allowlist, `curl` and the web
fetch tools both fail with a proxy `403` on CONNECT. Check what is actually
happening before assuming the network is broken:

```
curl -sS "$HTTPS_PROXY/__agentproxy/status"
```

A `connect_rejected` entry naming the host means the egress policy denied it,
not that the proxy is misconfigured. Do not try to route around it.

Two things still work and are usually enough:

- **The Vercel MCP `web_fetch_vercel_url` tool** performs a plain HTTP GET from
  outside the session proxy, so it reaches the deployed site and any public API
  route on it. `https://skale.club/api/company-settings` returns the full live
  settings row — hero image, homepage content, service cards — which is the
  fastest way to see production data without database credentials.

  This works regardless of where the app is hosted; the tool is not evidence
  about hosting. It fails on URLs it would have to sign (Supabase storage
  objects, for one), so images still cannot be inspected this way.
- **The GitHub MCP server** covers branches, PRs, commits and file contents.

For anything that needs the database itself (writes, tables with no public API),
the session needs `POSTGRES_URL` set as an environment variable, and
`skale.club` plus `*.supabase.co` added to the network policy. The value lives
in the Coolify app's Environment tab (see "Production Deployment" below); the
session's own environment is configured at
https://code.claude.com/docs/en/claude-code-on-the-web. An agent cannot grant
itself either one.

When rendering a page for review without a database, mock the API with
Playwright route interception and seed it from the live JSON above. Say so when
sharing the result: a preview built on placeholder images is not evidence about
what production looks like.

## Where this app actually runs

`SETUP.md` → "Production Deployment" is the authoritative answer, and it is
worth reading before inferring anything from config files in the repo root:

- **Host: Coolify on Hetzner**, as a Docker container built from `Dockerfile`.
  Environment variables live in the Coolify app, split build-time / runtime.
- `.github/workflows/deploy.yml` only pings the Coolify deploy API on a push to
  `main`; Coolify does the build.
- `wrangler.jsonc` is scoped to one Cloudflare Worker that proxies
  `xpot.skale.club`. It does not host the site.
- `vercel.json` is leftover and not part of the current deploy path. Its
  presence has already misled at least one agent into reporting the wrong host.
