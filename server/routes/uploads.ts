import type { Express, Request, Response } from "express";
import { randomUUID } from "crypto";
import { z } from "zod";
import { getSupabaseAdmin } from "../lib/supabase.js";
import { SupabaseStorageService } from "../storage/supabaseStorage.js";
import { BOARD_IMAGE_MAX_BYTES } from "#shared/boards/canvasDefaults.js";
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

const ALLOWED_VIDEO_EXT = new Set(["mp4", "webm"]);

// Board images (Boards canvas): raster formats only. SVG is left out because a
// board image is any admin's upload shown to anyone with the board link.
export const BOARD_IMAGE_EXT = new Set(["png", "jpg", "jpeg", "gif", "webp", "avif"]);
export const BOARD_IMAGE_BUCKET = "boards";
export const BOARD_IMAGE_MIME_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp", "image/avif"];
let boardBucketReady = false;

export function resetBoardBucketForTests() {
  boardBucketReady = false;
}

// The bucket itself enforces what a signed upload may contain (type and size):
// a signed upload URL cannot be bound to a content type in this client.
export async function ensureBoardBucket(supabase: ReturnType<typeof getSupabaseAdmin> = getSupabaseAdmin()) {
  if (boardBucketReady) return;
  const options = { public: true, allowedMimeTypes: BOARD_IMAGE_MIME_TYPES, fileSizeLimit: BOARD_IMAGE_MAX_BYTES };
  const { data: buckets } = await supabase.storage.listBuckets();
  if (!buckets?.some((b) => b.name === BOARD_IMAGE_BUCKET)) {
    const { error } = await supabase.storage.createBucket(BOARD_IMAGE_BUCKET, options);
    if (error && !error.message.includes("already exists")) throw new Error(`Failed to create bucket: ${error.message}`);
    if (error) await updateBoardBucket(supabase, options);
  } else {
    await updateBoardBucket(supabase, options);
  }
  boardBucketReady = true;
}

async function updateBoardBucket(supabase: ReturnType<typeof getSupabaseAdmin>, options: { public: boolean; allowedMimeTypes: string[]; fileSizeLimit: number }) {
  const { error } = await supabase.storage.updateBucket(BOARD_IMAGE_BUCKET, options);
  if (error) throw new Error(`Failed to update bucket: ${error.message}`);
}

export function registerUploadRoutes(app: Express) {
  const storageService = new SupabaseStorageService();

  // Page hero video — presigned upload URL (client PUTs directly to Supabase).
  app.post("/api/uploads/page-media/sign", requireAdmin, async (req: Request, res: Response) => {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(503).json({ message: "Storage not configured" });
    }
    const parsed = z.object({ filename: z.string().min(1).max(200) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "filename required" });

    const ext = (parsed.data.filename.split(".").pop() || "").toLowerCase();
    if (!ALLOWED_VIDEO_EXT.has(ext)) {
      return res.status(415).json({ message: "Only .mp4 and .webm videos are supported" });
    }
    try {
      const result = await storageService.getSignedUploadUrlForPageMedia(parsed.data.filename);
      return res.json(result);
    } catch (err: any) {
      console.error("[uploads] POST /api/uploads/page-media/sign failed:", err);
      return res.status(500).json({ message: "Failed to create upload URL" });
    }
  });

  // Board image — presigned upload URL, like page-media: the editor PUTs the
  // file straight to Supabase and stores the public URL in the board document.
  app.post("/api/uploads/board-image/sign", requireAdmin, async (req: Request, res: Response) => {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(503).json({ message: "Storage not configured", code: "storage_not_configured" });
    }
    const parsed = z.object({ filename: z.string().min(1).max(200) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "filename required" });

    const ext = (parsed.data.filename.split(".").pop() || "").toLowerCase();
    if (!BOARD_IMAGE_EXT.has(ext)) {
      return res.status(415).json({ message: "Only PNG, JPEG, GIF, WebP and AVIF images are supported" });
    }
    try {
      await ensureBoardBucket();
      const supabase = getSupabaseAdmin();
      const objectId = `images/${Date.now()}-${randomUUID()}.${ext}`;
      const { data, error } = await supabase.storage.from(BOARD_IMAGE_BUCKET).createSignedUploadUrl(objectId);
      if (error || !data) throw new Error(error?.message ?? "no signed URL");
      const { data: urlData } = supabase.storage.from(BOARD_IMAGE_BUCKET).getPublicUrl(objectId);
      return res.json({ uploadUrl: data.signedUrl, publicUrl: urlData.publicUrl });
    } catch (err: any) {
      console.error("[uploads] POST /api/uploads/board-image/sign failed:", err);
      return res.status(500).json({ message: "Failed to create upload URL" });
    }
  });

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
      return res.status(500).json({ message: "Delete failed" });
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
