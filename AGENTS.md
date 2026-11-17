# Repository Guidelines

<!-- journal-protocol:v1 -->
## Journal (mandatory)

This app's history (what it does, how each part was built, decisions and releases) lives in its Notion Journal. It replaces the old GSD/PAUL planning flow; `.planning/` and `.paul/`, if present, are a read-only legacy archive.

- Journal hub: https://app.notion.com/p/411b7a68612181bfb350c5eea4461463
- Journal Entries data source: collection://be21cd00-3b23-4be9-a116-71b8c57ebcdd
- Latest view: view://411b7a68-6121-81ba-a328-000c8106d81d
- Entry prefix: SCLB
- Rules (they win on any conflict): https://app.notion.com/p/411b7a68612181b3ac36f4ce2b2c3850 (skill: `app-journal`)

**Start of session:** fetch the hub and read Identity and Current State; list the latest 20 entries with Notion query-data-sources in `view` mode on the Latest view above (`page_size` 20; view mode has no plan quota) and read only titles and summaries; use `rows` mode with a filter only to narrow down (it has a plan quota); if a read fails, say so and continue from the code, never guess journal content; open only the entries you need; never read the whole database. Cross-check with the code: the code is the fact.

**End of every task that changed code, behavior, infrastructure or a decision:**
1. Create ONE entry in the data source above (one per logical unit of work, not per commit): `Title` = `YYYY-MM-DD — <imperative summary>`, `date:Date:start` (YYYY-MM-DD, with `date:Date:is_datetime` = 0), `Type`, `Area` (JSON array of existing options), `Status`, `Summary` (max 280 characters), `Agent`, `Model`, `Repo / Branch`, `Commits / PR`, `Tests` (what ran, or "Not run"), and `Decision ID` / `Decision Status` when a choice was made.
2. Body headings: Context · What changed · How it was built · Decisions and why · Tests and evidence · Not done / risks · Next.
3. If the app changed, rewrite the affected part of the hub's Current State. Read back what you wrote; never report a write you did not see.
4. Notion unavailable: append the full entry to `docs/journal/PENDING-NOTION.md` and tell the owner.

Journal records are in English. No secrets.
<!-- /journal-protocol -->

<!-- universal-rules:v1 -->
## Universal rules (read first)

Before working, read the owner's universal agent rules: `$HOME/Dev/skaleclub-apps/agents/RULES.md`
(GitHub: https://github.com/Skale-Club/skaleclub-apps/blob/main/agents/RULES.md).
They cover model routing (the session model plans and validates, cheaper models execute), machine awareness (Surface = light mode, `machine-check.ps1`), delivery estimates with no silent stalls, and the database, login, git and language decisions. Keep it light: they help, never block.
This file adds only what is specific to this repository.
<!-- /universal-rules -->

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
- `npm test` runs the unit and route tests (`server/**/*.test.ts`, `shared/**/*.test.ts`)
  with Node's test runner; no database is needed.
- `npm run test:e2e` builds the client and drives it in Chromium (`e2e/*.e2e.ts`).
  The whiteboard suite runs the real routes against an in-memory table.
- `npm run test:pg` runs the `*.pg.test.ts` suites against the Postgres in
  `DATABASE_URL`; they drop and recreate their tables, so point it at a disposable
  database only. `npm test` skips them. CI runs both, plus the e2e suite in
  Chromium, Firefox and WebKit (`E2E_BROWSERS=chromium,firefox,webkit`).
- Use `data-testid` attributes for UI elements that need reliable selectors.
- Manually verify critical flows (booking, admin CRUD, availability) before PRs.

## Blog Feature Image Guidelines
- Every published post must have a feature image. Before completion, verify that
  the published-post count matches the count of non-empty feature-image URLs.
- Deliver covers as 1200 x 675 WebP files (16:9). Keep the focal subject and all
  meaningful objects inside the central 84% of the canvas, leaving at least an
  8% visual safe area on every edge so card crops never feel cramped.
- Blog-card covers intentionally render with 12 px of internal space between the
  image and the card frame on both the homepage and `/blog`. Do not remove or
  reduce this inset without explicit visual approval.
- Adjacent posts must be visibly distinct. Do not repeat the same person,
  location, camera angle, composition, or visual metaphor across the three-card
  homepage row. Change at least one major dimension (subject, perspective, scene,
  or medium) while preserving the shared brand palette.
- Prefer specific editorial concepts tied to each article. Avoid generic AI
  imagery such as holograms, floating chat bubbles, glossy 3D icons, neon
  circuitry, fake UI text, and interchangeable corporate scenes.
- Review the final result in the real homepage cards and on `/blog`, at desktop
  and mobile widths. Asset previews alone are not acceptance evidence: confirm
  the images load, the safe area survives `object-cover`, and no focal element is
  pressed against or clipped by a card edge.

## Commit & Pull Request Guidelines
- Git history shows no strict convention; keep commit messages short and imperative.
- PRs should include a brief summary, testing notes (commands or manual steps), and
  screenshots/GIFs for UI changes.
- Link related issues when applicable.

## Security & Configuration
- Required env vars live in `.env` (see `README.md`): `DATABASE_URL`,
  `SESSION_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
  (admin sign-in is Google Identity Platform: phone code or Google, invite-only; see
  `GOOGLE_AUTH_*` / `FIREBASE_*` in `.env.example`; there is no local password hash).
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
- `.github/workflows/deploy.yml` runs after the CI workflow succeeds on `main`,
  pings the Coolify deploy API, waits for the deployment and checks
  `/api/health` and `/api/version`; Coolify does the build.
- `vercel.json`, `api/`, `wrangler.jsonc` and `cloudflare/` were removed after
  the Vercel wind-down; the container is the only deploy target.

## Server-rendered pages

**Initial Shell / Server-Rendered Pages**: public pages are rendered by React on the server and hydrated, never served as an empty shell. `server/seo/shell.ts` (`buildShell`) builds every HTML response and is the ONE function both render paths call (`server/static.ts` in production, `server/vite.ts` in development). It injects the per-page head (`server/seo/inject.ts`), then fills the body:
- **Real render**: `client/src/entry-server.tsx` (`renderPage`) prefetches the route's API queries through this server's own HTTP API, renders `<App>` with `prerenderToNodeStream` and returns the HTML plus the dehydrated React Query cache. `server/ssr-react.ts` loads it (dev: `vite.ssrLoadModule`; prod: `dist/server/entry-server.js`, built by `script/build.ts`), inlines the cache as `__REACT_QUERY_STATE__` (and, for Portuguese, `__SSR_TRANSLATIONS__` and `__SSR_PAGE_INFO__`), and `client/src/main.tsx` hydrates with `hydrateRoot`. `ENABLE_REACT_SSR=false` switches it off.
- **Text fallback** (`server/seo/content/*`): only when the render is empty (`hasMainContent`: an h1/h2 inside `<main>` or 500 characters), throws, or exceeds 3 s. It is an ordinary in-flow block ahead of `#root`, never a fixed overlay.
- Invariants: the `#initial-loader` and the fallback/React output are mutually exclusive (the server strips the loader whenever it injects content); nothing may hide the app indefinitely (`INITIAL_SHELL_TIMEOUT_MS`, `client/src/lib/initial-shell.ts`); admin routes keep the loader and get no body; unknown URLs are real 404s with `noindex` (`server/seo/routes.ts`). Public HTML is sent with `s-maxage=60, stale-while-revalidate=60`, 404s with `s-maxage=0`.
- Rules for client code: nothing may read `window`/`document`/`localStorage` while rendering (use an effect), because the first client render must equal the server HTML. Use `useRawPathname()` instead of wouter's `usePathname()`. **Adding a public route to `App.tsx` means adding it to `specsForRoute` in `entry-server.tsx` (its queries), to `preloadRouteForPath` in `App.tsx`, and to `server/seo/routes.ts`.** The query keys in `specsForRoute` must equal the components' `useQuery` keys exactly.

