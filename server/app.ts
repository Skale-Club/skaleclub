import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import path from "path";
import { createServer, type Server } from "http";

const isReplit = !!process.env.REPL_ID;

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
    let capturedJsonResponse: Record<string, any> | undefined = undefined;

    const originalResJson = res.json;
    res.json = function (bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };

    res.on("finish", () => {
      const duration = Date.now() - start;
      if (reqPath.startsWith("/api")) {
        let logLine = `${req.method} ${reqPath} ${res.statusCode} in ${duration}ms`;
        if (capturedJsonResponse) {
          logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
        }
        log(logLine);
      }
    });

    next();
  });

  // Setup auth based on environment
  if (isReplit) {
    const { setupAuth, registerAuthRoutes } = await import("./replit_integrations/auth");
    await setupAuth(app);
    registerAuthRoutes(app);
  } else {
    const { setupSupabaseAuth } = await import("./auth/supabaseAuth");
    await setupSupabaseAuth(app);
  }

  const httpServer = createServer(app);
  await registerRoutes(httpServer, app);

  // Error handling middleware
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });

  return { app, httpServer };
}
