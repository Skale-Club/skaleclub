import type { Express, Request, Response } from "express";
import { z } from "zod";
import { SupabaseStorageService } from "../storage/supabaseStorage.js";
import { requireAdmin } from "./_shared.js";

// Allowlist of image MIME types accepted for links-page uploads.
// Keep in sync with EXT_TO_MIME below.
const ALLOWED_MIME = new Set<string>([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "image/avif",
]);

// Extension -> MIME mapping. The POST body sends a filename (e.g. "logo.png")
// and we derive the MIME from its extension. A spoofed extension (".exe" renamed
// to ".png") would pass this check but the stored object is rendered only via
// <img src> in the public page, which does not execute embedded script. See
// research §"Pitfall 2" for the SVG-specific caveat.
const EXT_TO_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  avif: "image/avif",
};

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB, matches LINKS-06 spec

const ALLOWED_ASSET_TYPES = ["avatar", "background", "linkIcon"] as const;

const uploadBodySchema = z.object({
  filename: z.string().min(1).max(200),
  data: z.string().min(1), // raw base64 OR data URL (handler strips prefix defensively)
  assetType: z.enum(ALLOWED_ASSET_TYPES),
});

const deleteBodySchema = z.object({
  url: z.string().url(),
});

export function registerUploadRoutes(app: Express) {
  const storageService = new SupabaseStorageService();

  app.delete("/api/uploads/links-page", requireAdmin, async (req: Request, res: Response) => {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(503).json({ message: "Storage not configured" });
    }
    let parsed: z.infer<typeof deleteBodySchema>;
    try {
      parsed = deleteBodySchema.parse(req.body);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid payload", errors: err.errors });
      }
      throw err;
    }
    // Guard: only delete URLs that belong to this project's Supabase storage.
    if (!parsed.url.startsWith(process.env.SUPABASE_URL)) {
      return res.status(400).json({ message: "URL does not belong to this project's storage" });
    }
    try {
      await storageService.deleteLinksPageAsset(parsed.url);
      return res.json({ ok: true });
    } catch (err: any) {
      console.error("Links-page delete error:", err);
      return res.status(500).json({ message: err?.message ?? "Delete failed" });
    }
  });

  app.post("/api/uploads/links-page", requireAdmin, async (req: Request, res: Response) => {
    // Pre-flight: Supabase env must be configured. Clearer error than a deep 500.
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(503).json({ message: "Storage not configured" });
    }

    let parsed: z.infer<typeof uploadBodySchema>;
    try {
      parsed = uploadBodySchema.parse(req.body);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid upload payload", errors: err.errors });
      }
      throw err;
    }
    const { filename, data, assetType } = parsed;

    // Defensive data-URL-prefix strip (research §"Pitfall 6"). Clients may send
    // either raw base64 or a full data URL; both work.
    const cleaned = data.startsWith("data:") ? data.replace(/^data:[^;]+;base64,/, "") : data;

    let buffer: Buffer;
    try {
      buffer = Buffer.from(cleaned, "base64");
    } catch {
      return res.status(400).json({ message: "Invalid base64 payload" });
    }
    if (buffer.length === 0) {
      return res.status(400).json({ message: "Empty file payload" });
    }
    if (buffer.length > MAX_BYTES) {
      return res.status(413).json({
        message: `File exceeds 2 MB limit (decoded size: ${buffer.length} bytes, max: ${MAX_BYTES})`,
      });
    }

    const ext = (filename.split(".").pop() || "").toLowerCase();
    const contentType = EXT_TO_MIME[ext];
    if (!contentType || !ALLOWED_MIME.has(contentType)) {
      return res.status(415).json({
        message: `Unsupported file type: .${ext || "(none)"} — allowed: png, jpg, jpeg, gif, webp, svg, avif`,
      });
    }

    try {
      const url = await storageService.uploadLinksPageAsset(buffer, assetType, filename, contentType);
      return res.json({ url });
    } catch (err) {
      console.error("Links-page upload error:", err);
      return res.status(500).json({ message: "Upload failed" });
    }
  });
}
