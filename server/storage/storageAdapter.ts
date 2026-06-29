import type { Express, Request, Response } from "express";
import sharp from "sharp";

// Register storage routes using Supabase Storage
export async function registerStorageRoutes(app: Express, requireAdmin: any) {
  const { SupabaseStorageService } = await import("./supabaseStorage.js");
  const storageService = new SupabaseStorageService();

  // Raster formats we transcode to WebP on upload. SVG (vector) and WebP
  // (already optimal) are left untouched.
  const convertibleToWebp = new Set([
    "png", "jpg", "jpeg", "gif", "avif", "bmp", "tiff", "tif", "heic", "heif",
  ]);

  // Convert a raster image buffer to WebP. Returns the original buffer/name
  // unchanged for non-raster inputs or if conversion fails, so uploads never
  // break because of image processing.
  async function toWebp(
    buffer: Buffer,
    filename: string,
    ext: string,
  ): Promise<{ buffer: Buffer; filename: string; contentType: string } | null> {
    if (!convertibleToWebp.has(ext)) return null;
    try {
      const webp = await sharp(buffer, { animated: ext === "gif" })
        .rotate() // honor EXIF orientation before stripping metadata
        .webp({ quality: 80 })
        .toBuffer();
      return {
        buffer: webp,
        filename: filename.replace(/\.[^.]+$/, "") + ".webp",
        contentType: "image/webp",
      };
    } catch (err) {
      console.warn("WebP conversion failed, uploading original:", err);
      return null;
    }
  }

  const mimeFromExt: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    avif: "image/avif",
  };

  const handleUpload = async (req: Request, res: Response) => {
    try {
      const { filename, data } = req.body;
      if (!filename || !data) {
        return res.status(400).json({ error: "Missing filename or data" });
      }
      const buffer = Buffer.from(data, 'base64');
      const ext = (filename.split('.').pop() || '').toLowerCase();
      const contentType = mimeFromExt[ext] || "application/octet-stream";

      // Transcode raster images to WebP immediately on upload.
      const converted = await toWebp(buffer, filename, ext);
      const publicUrl = converted
        ? await storageService.uploadBuffer(converted.buffer, converted.filename, converted.contentType)
        : await storageService.uploadBuffer(buffer, filename, contentType);
      res.json({ path: publicUrl });
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({ error: "Failed to upload file" });
    }
  };

  app.post("/api/upload", requireAdmin, handleUpload);
  app.post("/api/upload-local", requireAdmin, handleUpload);

  app.post("/api/update-favicon", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { data } = req.body;
      if (!data) {
        return res.status(400).json({ error: "Missing image data" });
      }
      const buffer = Buffer.from(data, 'base64');
      const publicUrl = await storageService.uploadBuffer(buffer, "favicon.png", "image/png");
      res.json({ success: true, message: 'Favicon updated successfully', path: publicUrl });
    } catch (error) {
      console.error("Favicon update error:", error);
      res.status(500).json({ error: "Failed to update favicon" });
    }
  });

  app.get("/storage/:objectPath(*)", async (req: Request, res: Response) => {
    try {
      await storageService.serveFile(req.path, res);
    } catch (error) {
      console.error("Error serving file:", error);
      res.status(404).json({ error: "File not found" });
    }
  });
}
