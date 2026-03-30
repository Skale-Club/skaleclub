import 'express-async-errors';
import { ZodError } from "zod";
import express, { type Request, Response, NextFunction } from "express";
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

  // Serve attached_assets as static files
  app.use('/attached_assets', express.static(path.join(process.cwd(), 'attached_assets')));

  app.use(
    express.json({
      limit: '50mb',
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );

  app.use(express.urlencoded({ extended: false, limit: '50mb' }));

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
    const message = err.message || "Internal Server Error";

    // Log server errors for debugging
    if (status >= 500) {
      console.error(err);
    }

    res.status(status).json({ message });
  });

  return { app, httpServer };
}
