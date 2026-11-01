import "dotenv/config";
import * as Sentry from "@sentry/node";
import { SENTRY_IGNORE_ERRORS, scrubQueryParams } from "./lib/sentry-scrub";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV ?? "development",
  // Production only, like the client in main.tsx. Local .env files can carry a DSN, and a
  // machine with the wrong one has filed its dev errors under another project's issues.
  enabled: !!process.env.SENTRY_DSN && process.env.NODE_ENV === "production",
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  // Most handlers log with console.error and answer 500 without throwing.
  integrations: [Sentry.captureConsoleIntegration({ levels: ["error"] })],
  ignoreErrors: SENTRY_IGNORE_ERRORS,
  beforeSend: scrubQueryParams,
});
