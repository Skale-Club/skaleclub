
import { Router } from "express";
import { storage } from "../storage";
import type { IStorage } from "../storage";

const router = Router();

// Public Registration Endpoint
router.post("/register", async (req, res) => {
    try {
        const userData = req.body;
        // Basic validation
        if (!userData.email) {
            return res.status(400).json({ message: "Email is required" });
        }

        const existing = await storage.getUserByEmail(userData.email);
        if (existing) {
            return res.status(400).json({ message: "User with this email already exists" });
        }

        // Default to non-admin for public registration
        const newUser = await storage.createUser({
            ...userData,
            isAdmin: false,
        });
        res.status(201).json(newUser);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

export default router;
