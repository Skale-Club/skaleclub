// Sentry initialization for the React client.
//
// IMPORTANT: this module must be imported *before* any other module in the
// app entry point (client/src/main.tsx) so Sentry can hook into the runtime
// as early as possible.
import * as Sentry from "@sentry/react";

// The DSN is a publishable ingest key meant to ship to the browser (not a
// secret). Prefer the build-time env var so it can be overridden per
// environment; fall back to the skaleclub-frontend project DSN. Set
// VITE_SENTRY_DSN="" to disable.
const dsn =
  import.meta.env.VITE_SENTRY_DSN ??
  "https://b2ca9be99a78c1a32ee2b7ac39635802@o4511518744248320.ingest.us.sentry.io/4511559561510912";

if (dsn) {
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,

    // Only send events from production builds to avoid noise during local dev.
    enabled: import.meta.env.PROD,

    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],

    // Performance tracing — sample a fraction of transactions in production.
    tracesSampleRate: 0.1,
    // Connect frontend traces to the backend for same-origin / skale.club API calls.
    tracePropagationTargets: [/^\//, /^https:\/\/skale\.club/],

    // Session Replay: record a sample of sessions, and all sessions with errors.
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,

    // Send structured logs (Sentry.logger.*) to Sentry.
    enableLogs: true,
  });
}
