// Stored timestamps are UTC; keep the process (and Date parsing) on UTC too.
process.env.TZ = "UTC";
import 'dotenv/config';
// Sentry is preloaded via `--require ./dist/instrument.cjs` (production) or
// `--import ./server/instrument.ts` (dev), so it is not imported here.
import "./lib/pg-types.js";
import { createApp, log } from "./app.js";
import { serveStatic } from "./static.js";
import { startCron } from "./cron.js";
import { pool } from "./db.js";
import { scheduleBootstrapTasks } from "./lib/bootstrapTasks.js";

(async () => {
  const { app, httpServer } = await createApp();

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite.js");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Default to 1000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "1000", 10);
  // Development binds loopback only (the dev server talks to the real DB and
  // must not be reachable from the LAN); the container needs 0.0.0.0.
  const host = process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1";
  httpServer.listen(
    {
      port,
      host,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
  startCron();
  scheduleBootstrapTasks();

  // Node exits on an unhandled rejection; log it instead of taking the site
  // down with no line in the log.
  process.on("unhandledRejection", (reason) => {
    console.error("[process] unhandledRejection:", reason);
  });

  // Coolify sends SIGTERM on every redeploy. Stop accepting connections,
  // let in-flight requests finish, drain the pool, then exit.
  const shutdown = (signal: string) => {
    log(`${signal} received, shutting down`);
    httpServer.close(() => {
      pool.end().catch(() => undefined).finally(() => process.exit(0));
    });
    // Keep-alive sockets would otherwise hold close() open until they time out.
    httpServer.closeIdleConnections();
    // Cron timers are unref-free setInterval/setTimeout handles; process.exit
    // below (on close or after the 10s cap) tears them down.
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
})();
