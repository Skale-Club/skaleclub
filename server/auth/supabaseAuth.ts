import type { Express, Request, Response, NextFunction, RequestHandler } from "express";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { getSupabaseAdmin } from "../lib/supabase.js";
import { db, pool } from "../db.js";
import { users } from "#shared/models/auth.js";
import { eq } from "drizzle-orm";

export async function setupSupabaseAuth(app: Express) {
  app.set("trust proxy", 1);

  // Setup session store — reuses the existing pool (already configured with SSL)
  const sessionTtl = (parseInt(process.env.SESSION_TTL_DAYS || "7", 10)) * 24 * 60 * 60 * 1000;
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    pool: pool,
    createTableIfMissing: true,
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

  // Login endpoint - validates with Supabase Auth, creates server session
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { accessToken } = req.body;

      if (!accessToken) {
        return res.status(400).json({ message: "Access token required" });
      }

      const supabase = getSupabaseAdmin();
      const { data: { user: supabaseUser }, error } = await supabase.auth.getUser(accessToken);

      if (error || !supabaseUser) {
        return res.status(401).json({ message: "Invalid token" });
      }

      // Find or create user in our database
      const email = supabaseUser.email;
      if (!email) {
        return res.status(400).json({ message: "Email not available from Supabase" });
      }

      let [dbUser] = await db.select().from(users).where(eq(users.email, email));

      if (!dbUser) {
        // Create user record
        [dbUser] = await db
          .insert(users)
          .values({
            id: supabaseUser.id,
            email: email,
            firstName: supabaseUser.user_metadata?.first_name || null,
            lastName: supabaseUser.user_metadata?.last_name || null,
            profileImageUrl: supabaseUser.user_metadata?.avatar_url || null,
            isAdmin: email === process.env.ADMIN_EMAIL,
          })
          .onConflictDoUpdate({
            target: users.id,
            set: {
              email: email,
              updatedAt: new Date(),
            },
          })
          .returning();
      }

      // Store user info in session
      (req.session as any).userId = dbUser.id;
      (req.session as any).email = dbUser.email;
      (req.session as any).isAdmin = dbUser.isAdmin;
      (req.session as any).firstName = dbUser.firstName;
      (req.session as any).lastName = dbUser.lastName;

      res.json({
        isAdmin: dbUser.isAdmin || false,
        email: dbUser.email,
        firstName: dbUser.firstName,
        lastName: dbUser.lastName,
      });
    } catch (error) {
      console.error("Supabase login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
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

  // Session check endpoint (matches the same interface as Replit auth)
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

  // Get current authenticated user (mirrors Replit auth's /api/auth/user)
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

  // Supabase config endpoint for client
  app.get("/api/supabase-config", (_req: Request, res: Response) => {
    res.json({
      url: process.env.SUPABASE_URL || "",
      anonKey: process.env.SUPABASE_ANON_KEY || "",
    });
  });

  // Login redirect - sends user to the Supabase login page
  app.get("/api/login", (_req: Request, res: Response) => {
    res.redirect("/admin/login");
  });

  // Logout via GET (mirrors Replit auth's /api/logout)
  app.get("/api/logout", (req: Request, res: Response) => {
    req.session.destroy((err) => {
      if (err) console.error("Session destroy error:", err);
      res.clearCookie("connect.sid");
      res.redirect("/admin/login");
    });
  });
}

// Middleware to check if user is authenticated via Supabase session
export const isAuthenticatedSupabase: RequestHandler = (req, res, next) => {
  const sess = req.session as any;
  if (!sess?.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
};

// Middleware to check admin status via Supabase session
export async function requireAdminSupabase(req: Request, res: Response, next: NextFunction) {
  const sess = req.session as any;

  if (!sess?.userId) {
    return res.status(401).json({ message: "Authentication required" });
  }

  try {
    const [dbUser] = await db.select().from(users).where(eq(users.id, sess.userId));
    if (!dbUser?.isAdmin) {
      return res.status(403).json({ message: "Admin access required" });
    }
    next();
  } catch (error) {
    return res.status(500).json({ message: "Failed to verify admin status" });
  }
}
