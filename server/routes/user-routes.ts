
import { Router } from "express";
import { storage } from "../storage";
import type { IStorage } from "../storage";
import { requireAdmin } from "../middleware/auth";

const router = Router();

// List all users
router.get("/", requireAdmin, async (req, res) => {
    try {
        const allUsers = await storage.getUsers();
        res.json(allUsers);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

// Create a new user (Admin)
router.post("/", requireAdmin, async (req, res) => {
    try {
        const userData = req.body;
        if (userData.email) {
            const existing = await storage.getUserByEmail(userData.email);
            if (existing) {
                return res.status(400).json({ message: "User with this email already exists" });
            }
        }
        const newUser = await storage.createUser(userData);
        res.status(201).json(newUser);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

// Update a user
router.patch("/:id", requireAdmin, async (req, res) => {
    try {
        const userId = req.params.id;
        const updates = req.body;

        // Last Admin Rule: If demoting an admin, check if they are the last one
        if (updates.isAdmin === false) {
            const user = await storage.getUser(userId);
            if (user?.isAdmin) {
                const allUsers = await storage.getUsers();
                const adminCount = allUsers.filter(u => u.isAdmin).length;
                if (adminCount <= 1) {
                    return res.status(400).json({ message: "Cannot remove the last administrator" });
                }
            }
        }

        const updatedUser = await storage.updateUser(userId, updates);
        res.json(updatedUser);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

// Delete a user
router.delete("/:id", requireAdmin, async (req, res) => {
    try {
        const userId = req.params.id;
        
        // Last Admin Rule: Check if the user is an admin and if they are the last one
        const user = await storage.getUser(userId);
        if (user?.isAdmin) {
            const allUsers = await storage.getUsers();
            const adminCount = allUsers.filter(u => u.isAdmin).length;
            if (adminCount <= 1) {
                return res.status(400).json({ message: "Cannot delete the last administrator" });
            }
        }

        await storage.deleteUser(userId);
        res.status(204).send();
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

export default router;
