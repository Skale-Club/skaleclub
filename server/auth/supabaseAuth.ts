import type { Express, Request, Response, NextFunction, RequestHandler } from "express";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { getSupabaseAdmin } from "../lib/supabase.js";
import { db, pool } from "../db.js";
import { users } from "#shared/schema.js";
import { eq } from "drizzle-orm";
import { verifyTurnstileToken, getClientIp } from "../lib/turnstile.js";

const loginAttempts = new Map<string, { count: number; resetAt: number }>();
function isLoginRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + 15 * 60_000 });
    return false;
  }
  entry.count += 1;
  return entry.count > 10; // 10 attempts per 15 minutes
}

export async function setupSupabaseAuth(app: Express) {
  app.set("trust proxy", 1);

  // Setup session store — reuses the existing pool (already configured with SSL)
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

  // Login endpoint - validates with Supabase Auth, creates server session.
  // Cloudflare Turnstile is required for password-based sign-ins; OAuth flows
  // (Google, etc.) skip the captcha because the provider handles bot detection.
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const ip = getClientIp(req) ?? 'unknown';
      if (isLoginRateLimited(ip)) {
        return res.status(429).json({ message: "Too many login attempts. Try again later." });
      }

      const { accessToken, captchaToken } = req.body;

      if (!accessToken) {
        return res.status(400).json({ message: "Access token required" });
      }

      const supabase = getSupabaseAdmin();
      const { data: { user: supabaseUser }, error } = await supabase.auth.getUser(accessToken);

      if (error || !supabaseUser) {
        return res.status(401).json({ message: "Invalid token" });
      }

      // Verify Turnstile for password sign-ins (skip for OAuth).
      const provider = supabaseUser.app_metadata?.provider;
      const isPasswordAuth = provider === "email";
      if (isPasswordAuth) {
        const verification = await verifyTurnstileToken(captchaToken, getClientIp(req));
        if (!verification.success) {
          return res.status(403).json({
            message: "Captcha verification failed. Please refresh and try again.",
            errorCodes: verification.errorCodes,
          });
        }
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

  // Supabase config endpoint for client
  app.get("/api/supabase-config", (_req: Request, res: Response) => {
    res.json({
      url: process.env.SUPABASE_URL || "",
      anonKey: process.env.SUPABASE_ANON_KEY || "",
      turnstileSiteKey: process.env.CLOUDFLARE_TURNSTILE_SITE_KEY || "",
    });
  });

  // Login redirect - sends user to the Supabase login page
  app.get("/api/login", (_req: Request, res: Response) => {
    res.redirect("/admin/login");
  });

  // Logout via GET
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
