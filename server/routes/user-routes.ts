
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
        await storage.deleteUser(userId);
        res.status(204).send();
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

export default router;
