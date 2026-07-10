import type { Express } from "express";
import crypto from "crypto";
import { storage } from "../storage.js";
import { insertEstimateSchema } from "#shared/schema.js";
import { requireAdmin } from "./_shared.js";
import { z } from "zod";

const thumbnailSchema = z.object({
  thumbnailUrl: z.string().startsWith("data:image/webp;base64,").max(1_000_000),
  thumbnailSignature: z.string().min(1).max(200),
});

function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "estimate";
}

async function buildUniqueEstimateSlug(data: {
  companyName?: string | null;
  contactName?: string | null;
  clientName: string;
}): Promise<string> {
  const source = data.companyName?.trim() || data.contactName?.trim() || data.clientName.trim();
  const base = slugifyName(source);

  // Always append a short random suffix for newly created estimates so slugs
  // aren't trivially guessable from the company/contact name alone (SEC-01
  // defense-in-depth). Existing stored slugs are unaffected — this only
  // changes what's generated going forward.
  for (let i = 0; i < 5; i++) {
    const candidate = `${base}-${crypto.randomBytes(2).toString("hex")}`;
    if (!await storage.getEstimateBySlug(candidate)) return candidate;
  }

  return `${base}-${Date.now()}`;
}

function normalizeCustomSlug(slug: string): string {
  return slug
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "estimate";
}

// Strips access_code + thumbnail fields from an estimate for client consumption
// (D-07, RESEARCH pitfall 1). Used for both the public (no-gate) slug response
// and the post-unlock verify-code response - same shape either way.
function toPublicEstimate(estimate: any) {
  const { accessCode, thumbnailUrl, thumbnailSignature, ...publicEstimate } = estimate;
  return { ...publicEstimate, hasAccessCode: Boolean(accessCode) };
}

// Best-effort client IP extraction (mirrors the pattern already used by the
// /view endpoint below and server/auth/supabaseAuth.ts's login limiter).
function getRequestIp(req: { headers: Record<string, unknown>; ip?: string }): string {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length > 0) return fwd.split(",")[0]!.trim();
  if (Array.isArray(fwd) && fwd.length > 0) return String(fwd[0]);
  return req.ip || "unknown";
}

// Constant-time access-code comparison - guards against timing attacks that
// could leak code length/contents. Mismatched lengths are treated as failure
// without ever calling timingSafeEqual (which throws on differing lengths).
function isValidAccessCode(stored: string, provided: string): boolean {
  const storedBuf = Buffer.from(stored);
  const providedBuf = Buffer.from(provided);
  if (storedBuf.length !== providedBuf.length) return false;
  return crypto.timingSafeEqual(storedBuf, providedBuf);
}

// Per-IP rate limit for verify-code guesses (SEC-01) - mirrors the in-memory
// Map + purge style used in server/auth/supabaseAuth.ts and server/routes/linksPage.ts.
const VERIFY_CODE_WINDOW_MS = 5 * 60_000;
const VERIFY_CODE_MAX_ATTEMPTS = 10;
const VERIFY_CODE_PRUNE_AT_SIZE = 5000;
const verifyCodeAttempts = new Map<string, { count: number; resetAt: number }>();

function pruneVerifyCodeAttempts() {
  const now = Date.now();
  for (const [key, entry] of Array.from(verifyCodeAttempts.entries())) {
    if (now > entry.resetAt) verifyCodeAttempts.delete(key);
  }
}

function isVerifyCodeRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = verifyCodeAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    verifyCodeAttempts.set(ip, { count: 1, resetAt: now + VERIFY_CODE_WINDOW_MS });
    if (verifyCodeAttempts.size > VERIFY_CODE_PRUNE_AT_SIZE) pruneVerifyCodeAttempts();
    return false;
  }
  entry.count += 1;
  return entry.count > VERIFY_CODE_MAX_ATTEMPTS;
}

export function registerEstimatesRoutes(app: Express) {
  // Public slug endpoint registered first to avoid Express matching "slug" as an :id value
  app.get("/api/estimates/slug/:slug", async (req, res) => {
    try {
      const estimate = await storage.getEstimateBySlug(req.params.slug);
      if (!estimate) return res.status(404).json({ message: "Estimate not found" });
      // Gated estimates: enforce the access-code wall server-side (SEC-01). Only
      // minimal, non-confidential metadata needed to render the gate is returned -
      // no services, pricing, notes, or other financial/line-item data.
      if (estimate.accessCode) {
        return res.json({
          id: estimate.id,
          slug: estimate.slug,
          clientName: estimate.clientName,
          companyName: estimate.companyName,
          contactName: estimate.contactName,
          hasAccessCode: true,
        });
      }
      // No gate set - full public estimate, minus access_code/thumbnail fields.
      res.json(toPublicEstimate(estimate));
    } catch (err) {
      res.status(500).json({ message: (err as Error).message });
    }
  });

  app.post("/api/estimates/:id/view", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const ipAddress = (
        (req.headers['x-forwarded-for'] as string) || req.ip || ''
      ).toString() || undefined;
      await storage.recordEstimateView(id, ipAddress);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: (err as Error).message });
    }
  });

  app.post("/api/estimates/:id/verify-code", async (req, res) => {
    try {
      const ip = getRequestIp(req);
      if (isVerifyCodeRateLimited(ip)) {
        return res.status(429).json({ message: "Too many attempts. Please try again later." });
      }
      const id = Number(req.params.id);
      const { code } = req.body as { code?: unknown };
      const estimate = await storage.getEstimate(id);
      if (!estimate) return res.status(404).json({ message: "Estimate not found" });
      // No gate set — treat as unlocked, return the full estimate so the client
      // can render it (same shape as the public slug endpoint).
      if (!estimate.accessCode) return res.json({ success: true, ...toPublicEstimate(estimate) });
      // Constant-time comparison — D-07 (NOT bcrypt — codes must be readable for GHL automation)
      const provided = typeof code === "string" ? code : "";
      if (!isValidAccessCode(estimate.accessCode, provided)) {
        return res.status(401).json({ message: "Incorrect code" });
      }
      // Correct code — unlock and return the full estimate for rendering.
      res.json({ success: true, ...toPublicEstimate(estimate) });
    } catch (err) {
      res.status(500).json({ message: (err as Error).message });
    }
  });

  app.get("/api/estimates", requireAdmin, async (req, res) => {
    try {
      const limit = req.query.limit ? Number(req.query.limit) : undefined;
      const offset = req.query.offset ? Number(req.query.offset) : undefined;
      const search = req.query.search as string | undefined;
      const result = await storage.listEstimates(limit, offset, search);
      res.json(result);
    } catch (err) {
      res.status(500).json({ message: (err as Error).message });
    }
  });

  app.post("/api/estimates", requireAdmin, async (req, res) => {
    try {
      const bodySchema = insertEstimateSchema.omit({ slug: true });
      const parsed = bodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation error", errors: parsed.error.errors });
      }
      const slug = await buildUniqueEstimateSlug(parsed.data);
      const estimate = await storage.createEstimate({ ...parsed.data, slug });
      res.status(201).json(estimate);
    } catch (err) {
      res.status(400).json({ message: (err as Error).message });
    }
  });

  app.put("/api/estimates/:id", requireAdmin, async (req, res) => {
    try {
      const updateSchema = insertEstimateSchema.partial();
      const parsed = updateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation error", errors: parsed.error.errors });
      }
      const existing = await storage.getEstimate(Number(req.params.id));
      if (!existing) return res.status(404).json({ message: "Estimate not found" });
      const updateData = { ...parsed.data };
      if (typeof updateData.slug === "string") {
        const slug = normalizeCustomSlug(updateData.slug);
        const slugOwner = await storage.getEstimateBySlug(slug);
        if (slugOwner && slugOwner.id !== existing.id) {
          return res.status(409).json({ message: "Slug already in use" });
        }
        updateData.slug = slug;
      }
      const estimate = await storage.updateEstimate(Number(req.params.id), updateData);
      res.json(estimate);
    } catch (err) {
      res.status(400).json({ message: (err as Error).message });
    }
  });

  app.put("/api/estimates/:id/thumbnail", requireAdmin, async (req, res) => {
    try {
      const parsed = thumbnailSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation error", errors: parsed.error.errors });
      }
      const existing = await storage.getEstimate(Number(req.params.id));
      if (!existing) return res.status(404).json({ message: "Estimate not found" });
      const estimate = await storage.updateEstimate(Number(req.params.id), parsed.data);
      res.json(estimate);
    } catch (err) {
      res.status(400).json({ message: (err as Error).message });
    }
  });

  app.delete("/api/estimates/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteEstimate(Number(req.params.id));
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ message: (err as Error).message });
    }
  });
}
