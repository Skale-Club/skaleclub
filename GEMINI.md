# GEMINI.md

## Project Overview

This is a full-stack service booking platform for a cleaning company called "Skleanings". It allows customers to browse services, book appointments, and manage their bookings. The application includes an admin dashboard for managing services, bookings, and company settings. It also integrates with GoHighLevel CRM.

The project is built with a modern tech stack:

*   **Frontend:** React, TypeScript, Vite, Tailwind CSS, shadcn/ui
*   **Backend:** Node.js, Express, TypeScript, Drizzle ORM
*   **Database:** PostgreSQL

The project is structured as a monorepo with a `client` directory for the frontend, a `server` directory for the backend, and a `shared` directory for code that is used by both the client and the server.

## Building and Running

### Prerequisites

*   Node.js 18+
*   PostgreSQL database

### Environment Variables

Create a `.env` file in the root of the project with the following variables:

```env
DATABASE_URL=postgresql://user:password@host:port/database
SESSION_SECRET=your-session-secret
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD_HASH=bcrypt-hashed-password
```

### Key Commands

| Command | Description |
|---|---|
| `npm install` | Installs all dependencies. |
| `npm run dev` | Starts the development server for both the client and the server. |
| `npm run build` | Builds the frontend and backend for production. |
| `npm run start` | Starts the production server. |
| `npm run check` | Runs the TypeScript compiler to check for type errors. |
| `npm run db:push` | Pushes database schema changes to the database. |

## Development Conventions

*   **Code Style:** The project uses Prettier for code formatting. It is recommended to set up your editor to format on save.
*   **Testing:** There are no tests in this project. It is recommended to add tests to ensure the quality of the code.
*   **Commits:** There is no commit message convention in this project. It is recommended to use a convention such as Conventional Commits.