import type { Express, Request, Response, RequestHandler } from "express";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { db, pool } from "../db.js";
import { users } from "#shared/schema.js";
import { eq } from "drizzle-orm";
import { registerGoogleLoginRoutes } from "./googleLogin.js";
import { registerAccountLinkRoutes } from "./accountLinks.js";

/**
 * Express session + sign-in routes. Authentication is Google Identity Platform
 * (phone code or Google account), exchanged once for this session at
 * POST /api/auth/identity; the Postgres `users` table stays the only authority on
 * who may do what. Supabase is the database only.
 */
export async function setupAuth(app: Express) {
  // Setup session store: reuses the existing pool (already configured with SSL)
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    pool: pool,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });

  app.use(
    session({
      secret: process.env.SESSION_SECRET!,
      store: sessionStore,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: sessionTtl,
      },
    })
  );

  registerGoogleLoginRoutes(app);
  registerAccountLinkRoutes(app);

  // Retired with Supabase Auth. Existing Express sessions stay valid (same
  // `sessions` table), so the switch logs nobody out.
  app.post("/api/auth/login", (_req: Request, res: Response) => {
    res.status(410).json({ message: "This sign-in method was retired. Use your phone or Google account." });
  });
  app.get("/api/supabase-config", (_req: Request, res: Response) => {
    res.status(410).json({ message: "Gone" });
  });

  // Logout endpoint
  app.post("/api/auth/logout", (req: Request, res: Response) => {
    req.session.destroy((err) => {
      if (err) {
        console.error("Session destroy error:", err);
        return res.status(500).json({ message: "Logout failed" });
      }
      res.clearCookie("connect.sid");
      res.json({ success: true });
    });
  });

  // Session check endpoint
  app.get("/api/admin/session", async (req: Request, res: Response) => {
    const sess = req.session as any;

    if (!sess?.userId) {
      return res.json({ isAdmin: false, email: null, firstName: null, lastName: null });
    }

    try {
      const [dbUser] = await db.select().from(users).where(eq(users.id, sess.userId));
      res.json({
        isAdmin: dbUser?.isAdmin || false,
        email: dbUser?.email || null,
        firstName: dbUser?.firstName || null,
        lastName: dbUser?.lastName || null,
      });
    } catch (error) {
      res.json({ isAdmin: false, email: null, firstName: null, lastName: null });
    }
  });

  // Get current authenticated user
  app.get("/api/auth/user", async (req: Request, res: Response) => {
    const sess = req.session as any;

    if (!sess?.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const [dbUser] = await db.select().from(users).where(eq(users.id, sess.userId));
      if (!dbUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      res.json(dbUser);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Login redirect: the sign-in page is the single entry point.
  app.get("/api/login", (_req: Request, res: Response) => {
    res.redirect("/admin/login");
  });
}

// Middleware: the request carries a signed-in Express session.
export const isAuthenticated: RequestHandler = (req, res, next) => {
  const sess = req.session as any;
  if (!sess?.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
};
