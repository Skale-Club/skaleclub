import type { Express } from "express";
import { z } from "zod";
import { and, asc, eq, ne, sql } from "drizzle-orm";
import { db } from "../db.js";
import { authGoogleIdentities, users } from "#shared/schema.js";
import { normalizePhone } from "#shared/signInPhone.js";
import { requireAdmin, sendError } from "./_shared.js";

async function countOtherAdmins(excludeUserId: string): Promise<number> {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.isAdmin, true), ne(users.id, excludeUserId)));
  return rows.length;
}

// A phone typed by an admin: stored in E.164 so it matches the verified phone claim.
const phoneInput = z
  .string()
  .transform((value, ctx) => {
    const normalized = normalizePhone(value);
    if (!normalized) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enter a valid phone number" });
    return normalized as string;
  });

function publicUser(user: typeof users.$inferSelect) {
  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    firstName: user.firstName,
    lastName: user.lastName,
    profileImageUrl: user.profileImageUrl,
    isAdmin: user.isAdmin,
    createdAt: user.createdAt,
    lastSignInAt: user.lastSeenAt,
  };
}

/**
 * Users are plain rows. An admin invites someone by email and/or phone; that
 * person signs in with the phone code or the Google account matching the row
 * (see server/auth/googleLogin.ts). There is no password or auth-provider account.
 */
export function registerUserRoutes(app: Express) {
  app.get("/api/users", requireAdmin, async (_req, res) => {
    try {
      const rows = await db.select().from(users).orderBy(asc(users.createdAt));
      res.json(rows.map(publicUser));
    } catch (err) {
      sendError(res, err, "Failed to fetch users");
    }
  });

  // Update user
  app.patch("/api/users/:id", requireAdmin, async (req, res) => {
    try {
      const updates = z
        .object({
          isAdmin: z.boolean().optional(),
          firstName: z.string().optional(),
          lastName: z.string().optional(),
          profileImageUrl: z.string().optional(),
          // "" clears the phone (allowed only while the user still has an email).
          phone: z.union([phoneInput, z.literal("")]).optional(),
        })
        .parse(req.body);
      const userId = req.params.id;

      const [existingUser] = await db.select().from(users).where(eq(users.id, userId));
      if (!existingUser) return res.status(404).json({ message: "User not found" });

      if (updates.isAdmin === false && existingUser.isAdmin && (await countOtherAdmins(userId)) === 0) {
        return res.status(409).json({ message: "Cannot demote the last remaining admin" });
      }

      const { phone, ...rest } = updates;
      const set: Partial<typeof users.$inferInsert> = { ...rest, updatedAt: new Date() };
      const phoneChanged = phone !== undefined && (phone === "" ? null : phone) !== existingUser.phone;
      if (phone !== undefined) {
        if (phone === "" && !existingUser.email) {
          return res.status(409).json({ message: "A user needs an email or a phone to sign in" });
        }
        set.phone = phone === "" ? null : phone;
      }

      const updated = await db.transaction(async (tx) => {
        if (phoneChanged) {
          // The old number stops signing in: its phone binding goes with it.
          await tx
            .delete(authGoogleIdentities)
            .where(and(eq(authGoogleIdentities.userId, userId), eq(authGoogleIdentities.provider, "phone")));
        }
        const [row] = await tx.update(users).set(set).where(eq(users.id, userId)).returning();
        return row;
      });

      res.json(publicUser(updated));
    } catch (err) {
      sendError(res, err, "Failed to update user");
    }
  });

  // Delete user
  app.delete("/api/users/:id", requireAdmin, async (req, res) => {
    try {
      const userId = req.params.id;

      if ((req.session as any)?.userId === userId) {
        return res.status(409).json({ message: "You cannot delete your own account" });
      }
      const [target] = await db.select().from(users).where(eq(users.id, userId));
      if (target?.isAdmin && (await countOtherAdmins(userId)) === 0) {
        return res.status(409).json({ message: "Cannot delete the last remaining admin" });
      }

      // auth_google_identities rows go with the user (ON DELETE CASCADE).
      await db.delete(users).where(eq(users.id, userId));

      res.json({ success: true, message: "User deleted successfully" });
    } catch (err) {
      sendError(res, err, "Failed to delete user");
    }
  });

  // Invite/create new user: email and/or phone, at least one.
  app.post("/api/users", requireAdmin, async (req, res) => {
    try {
      const body = z
        .object({
          email: z.string().trim().email().optional().or(z.literal("")),
          phone: phoneInput.optional().or(z.literal("")),
          firstName: z.string().optional(),
          lastName: z.string().optional(),
          isAdmin: z.boolean().default(false),
        })
        .refine((value) => Boolean(value.email || value.phone), {
          message: "Enter an email or a phone number",
          path: ["email"],
        })
        .parse(req.body);

      const email = body.email ? body.email.toLowerCase() : null;
      const phone = body.phone || null;

      if (email) {
        const [taken] = await db.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${email}`).limit(1);
        if (taken) return res.status(409).json({ message: "A user with this email already exists" });
      }
      if (phone) {
        const [taken] = await db.select({ id: users.id }).from(users).where(eq(users.phone, phone)).limit(1);
        if (taken) return res.status(409).json({ message: "A user with this phone already exists" });
      }

      const [newUser] = await db
        .insert(users)
        .values({
          email,
          phone,
          firstName: body.firstName || "",
          lastName: body.lastName || "",
          isAdmin: body.isAdmin,
        })
        .returning();

      res.status(201).json(publicUser(newUser));
    } catch (err) {
      sendError(res, err, "Failed to create user");
    }
  });
}
