import type { Express, Request, Response } from "express";

// Register storage routes using Supabase Storage
export async function registerStorageRoutes(app: Express, requireAdmin: any) {
  const { SupabaseStorageService } = await import("./supabaseStorage.js");
  const storageService = new SupabaseStorageService();

  const handleUpload = async (req: Request, res: Response) => {
    try {
      const { filename, data } = req.body;
      if (!filename || !data) {
        return res.status(400).json({ error: "Missing filename or data" });
      }
      const buffer = Buffer.from(data, 'base64');
      const publicUrl = await storageService.uploadBuffer(buffer, filename);
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
