import 'express-async-errors';
import * as Sentry from "@sentry/node";
import { ZodError } from "zod";
import express, { type Request, Response, NextFunction } from "express";
import helmet from "helmet";
import { registerRoutes } from "./routes.js";
import path from "path";
import { createServer, type Server } from "http";

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function createApp(): Promise<{ app: express.Express; httpServer: Server }> {
  const app = express();

  app.use(helmet({
    contentSecurityPolicy: false, // managed per-route via meta tags in the SPA
    crossOriginEmbedderPolicy: false, // needed for embedded iframes (maps, etc.)
  }));

  // Serve attached_assets as static files
  app.use('/attached_assets', express.static(path.join(process.cwd(), 'attached_assets')));

  // Body-size limits. A small default protects public/unauthenticated
  // endpoints (forms, chat, attribution) from memory-pressure DoS. A handful
  // of admin-only routes legitimately carry larger base64 payloads (image
  // uploads, slide/proposal thumbnails, audio for transcription) and get an
  // explicit higher cap. Keep the rawBody capture on both for webhook/raw use.
  const captureRawBody = (req: Request, _res: Response, buf: Buffer) => {
    req.rawBody = buf;
  };
  const jsonDefault = express.json({ limit: '1mb', verify: captureRawBody });
  const jsonLarge = express.json({ limit: '25mb', verify: captureRawBody });

  // Admin-only routes that accept large base64 bodies.
  const LARGE_BODY_RE =
    /^\/api\/(uploads(\/|$)|presentations\/(transcribe|upload-image)|presentations\/[^/]+\/thumbnail|estimates\/[^/]+\/thumbnail)/;

  app.use((req, res, next) => {
    if (LARGE_BODY_RE.test(req.path)) return jsonLarge(req, res, next);
    return jsonDefault(req, res, next);
  });

  app.use(express.urlencoded({ extended: false, limit: '1mb' }));

  // Logging middleware
  app.use((req, res, next) => {
    const start = Date.now();
    const reqPath = req.path;

    res.on("finish", () => {
      const duration = Date.now() - start;
      if (reqPath.startsWith("/api")) {
        log(`${req.method} ${reqPath} ${res.statusCode} in ${duration}ms`);
      }
    });

    next();
  });

  const { setupSupabaseAuth } = await import("./auth/supabaseAuth.js");
  await setupSupabaseAuth(app);

  const httpServer = createServer(app);
  await registerRoutes(httpServer, app);

  // Sentry error handler (must come before custom error middleware)
  Sentry.setupExpressErrorHandler(app);

  // Error handling middleware
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    // Safety: if response already started, delegate to Express default handler
    if (res.headersSent) {
      return _next(err);
    }

    // Zod validation errors → 400 with field-level details
    if (err instanceof ZodError) {
      return res.status(400).json({
        message: "Validation failed",
        errors: err.flatten().fieldErrors,
      });
    }

    // All other errors → use status + message
    const status = err.status || err.statusCode || 500;

    // Log server errors for debugging
    if (status >= 500) {
      console.error(err);
    }

    // Do not leak internal error details on 5xx (info disclosure). Client-facing
    // 4xx messages are intentional and safe to surface.
    const message =
      status >= 500 ? "Internal Server Error" : err.message || "Request failed";

    res.status(status).json({ message });
  });

  return { app, httpServer };
}
