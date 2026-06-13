// Sentry initialization for the backend (Express server + Vercel serverless functions).
//
// IMPORTANT: this module must be imported *before* any other module in every
// backend entry point (server/index.ts, api/index.ts, api/xpot.ts) so that
// Sentry can install its instrumentation before Express/pg/http are loaded.
import 'dotenv/config';
import * as Sentry from "@sentry/node";

// The DSN is a publishable ingest key (not a secret). Prefer the env var so it
// can be overridden per environment; fall back to the skaleclub-backend project
// DSN so monitoring works out of the box. Set SENTRY_DSN="" to disable.
const dsn =
  process.env.SENTRY_DSN ??
  "https://f4aa4b81105a399f9755fb8e7dc60fbc@o4511518744248320.ingest.us.sentry.io/4511559561576448";

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? "development",

    // Attach request headers and IP to events for better debugging context.
    sendDefaultPii: true,

    // Fraction of transactions traced. Tune via SENTRY_TRACES_SAMPLE_RATE.
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),

    // Send structured logs (Sentry.logger.*) to Sentry.
    enableLogs: true,
  });
}
