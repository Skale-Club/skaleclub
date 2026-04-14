import type { Express } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db.js";
import { users } from "#shared/schema.js";
import { requireAdmin } from "./_shared.js";

export function registerUserRoutes(app: Express) {
  // Get all users from Supabase Auth and local DB
  app.get("/api/users", requireAdmin, async (_req, res) => {
    try {
      const { getSupabaseAdmin } = await import("../lib/supabase.js");
      const supabaseAdmin = getSupabaseAdmin();

      const { data: authUsers, error } = await supabaseAdmin.auth.admin.listUsers();

      if (error) {
        console.error("Error fetching users from Supabase:", error);
        return res.status(500).json({ message: "Failed to fetch users from Supabase" });
      }

      const localUsers = await db.select().from(users);
      const localUserMap = new Map(localUsers.map((u) => [u.id, u]));

      const mergedUsers = authUsers.users.map((authUser) => {
        const localUser = localUserMap.get(authUser.id);
        return {
          id: authUser.id,
          email: authUser.email,
          firstName: localUser?.firstName ?? authUser.user_metadata?.first_name ?? "",
          lastName: localUser?.lastName ?? authUser.user_metadata?.last_name ?? "",
          profileImageUrl: localUser?.profileImageUrl ?? authUser.user_metadata?.avatar_url ?? "",
          isAdmin: localUser?.isAdmin || false,
          createdAt: authUser.created_at,
          lastSignInAt: authUser.last_sign_in_at,
          emailConfirmed: authUser.email_confirmed_at != null,
        };
      });

      res.json(mergedUsers);
    } catch (err) {
      console.error("Error in /api/users:", err);
      res.status(500).json({ message: (err as Error).message });
    }
  });

  // Update user
  app.patch("/api/users/:id", requireAdmin, async (req, res) => {
    try {
      const updateSchema = z.object({
        isAdmin: z.boolean().optional(),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        profileImageUrl: z.string().optional(),
      });
      const updates = updateSchema.parse(req.body);
      const userId = req.params.id;

      const [existingUser] = await db.select().from(users).where(eq(users.id, userId));

      let localUser;
      if (existingUser) {
        const [updated] = await db
          .update(users)
          .set({ ...updates, updatedAt: new Date() })
          .where(eq(users.id, userId))
          .returning();
        localUser = updated;
      } else {
        // User exists in Supabase Auth but not in local DB — create local record
        const { getSupabaseAdmin } = await import("../lib/supabase.js");
        const supabase = getSupabaseAdmin();
        const { data: authUser } = await supabase.auth.admin.getUserById(userId);
        const email = authUser?.user?.email ?? undefined;

        const [newUser] = await db
          .insert(users)
          .values({
            id: userId,
            email: email ?? null,
            isAdmin: updates.isAdmin ?? false,
            firstName: updates.firstName ?? "",
            lastName: updates.lastName ?? "",
            profileImageUrl: updates.profileImageUrl ?? "",
          })
          .returning();
        localUser = newUser;
      }

      // Also update Supabase Auth user_metadata so GET /api/users picks up changes
      try {
        const { getSupabaseAdmin } = await import("../lib/supabase.js");
        const supabase = getSupabaseAdmin();

        const metadata: Record<string, unknown> = {};
        if (updates.firstName !== undefined) metadata.first_name = updates.firstName;
        if (updates.lastName !== undefined) metadata.last_name = updates.lastName;
        if (updates.profileImageUrl !== undefined) metadata.avatar_url = updates.profileImageUrl;

        if (Object.keys(metadata).length > 0) {
          await supabase.auth.admin.updateUserById(userId, {
            user_metadata: metadata,
          });
        }
      } catch (metaErr) {
        console.error("[PATCH /api/users/:id] Failed to update Supabase metadata:", metaErr);
        // Non-fatal — local DB was already updated
      }

      res.json({
        id: localUser.id,
        email: localUser.email,
        firstName: localUser.firstName,
        lastName: localUser.lastName,
        profileImageUrl: localUser.profileImageUrl,
        isAdmin: localUser.isAdmin,
        createdAt: localUser.createdAt,
      });
    } catch (err) {
      console.error("[PATCH /api/users/:id] Error:", err);
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: err.errors });
      }
      res.status(500).json({ message: (err as Error).message });
    }
  });

  // Delete user
  app.delete("/api/users/:id", requireAdmin, async (req, res) => {
    try {
      const userId = req.params.id;

      const { getSupabaseAdmin } = await import("../lib/supabase.js");
      const supabaseAdmin = getSupabaseAdmin();
      const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);

      if (error) {
        console.error("Error deleting user from Supabase:", error);
        return res.status(500).json({ message: "Failed to delete user from Supabase" });
      }

      await db.delete(users).where(eq(users.id, userId));

      res.json({ success: true, message: "User deleted successfully" });
    } catch (err) {
      res.status(500).json({ message: (err as Error).message });
    }
  });

  // Invite/create new user
  app.post("/api/users", requireAdmin, async (req, res) => {
    try {
      const { email, firstName, lastName, isAdmin: makeAdmin } = z
        .object({
          email: z.string().email(),
          firstName: z.string().optional(),
          lastName: z.string().optional(),
          isAdmin: z.boolean().default(false),
        })
        .parse(req.body);

      const { getSupabaseAdmin } = await import("../lib/supabase.js");
      const supabaseAdmin = getSupabaseAdmin();

      const { data: authUser, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: {
          first_name: firstName,
          last_name: lastName,
        },
      });

      if (error) {
        console.error("Error creating user in Supabase:", error);
        return res.status(500).json({ message: error.message });
      }

      if (!authUser?.user) {
        return res.status(500).json({ message: "Failed to create user" });
      }

      const [newUser] = await db
        .insert(users)
        .values({
          id: authUser.user.id,
          email,
          firstName: firstName || "",
          lastName: lastName || "",
          isAdmin: makeAdmin,
        })
        .returning();

      res.status(201).json(newUser);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: err.errors });
      }
      res.status(500).json({ message: (err as Error).message });
    }
  });
}
