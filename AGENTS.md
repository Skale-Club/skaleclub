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
- `npm run dev` starts the dev server (client + API) at `http://localhost:5000`.
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
