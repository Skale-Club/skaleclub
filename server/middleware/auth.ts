import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { users } from "#shared/schema.js";
import { eq } from "drizzle-orm";

const isReplit = !!process.env.REPL_ID;

// Admin authentication middleware - environment-aware
export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
    if (isReplit) {
        // Replit Auth: check Passport session + isAdmin in DB
        const user = (req as any).user;
        if (!req.isAuthenticated || !req.isAuthenticated() || !user?.claims?.sub) {
            return res.status(401).json({ message: 'Authentication required' });
        }
        try {
            const { authStorage } = await import("../replit_integrations/auth/storage.js");
            const dbUser = await authStorage.getUser(user.claims.sub);
            if (!dbUser?.isAdmin) {
                return res.status(403).json({ message: 'Admin access required' });
            }
            next();
        } catch (error) {
            return res.status(500).json({ message: 'Failed to verify admin status' });
        }
    } else {
        // Supabase Auth: check express-session
        const sess = req.session as any;
        if (!sess?.userId) {
            return res.status(401).json({ message: 'Authentication required' });
        }
        try {
            const [dbUser] = await db.select().from(users).where(eq(users.id, sess.userId));
            if (!dbUser?.isAdmin) {
                return res.status(403).json({ message: 'Admin access required' });
            }
            next();
        } catch (error) {
            return res.status(500).json({ message: 'Failed to verify admin status' });
        }
    }
}
