import type { Express, Request, Response } from "express";
import fs from "fs";
import path from "path";

const isReplit = !!process.env.REPL_ID;

// Register storage routes based on environment
export async function registerStorageRoutes(app: Express, requireAdmin: any) {
  if (isReplit) {
    // Replit: use Object Storage (existing implementation)
    const { ObjectStorageService, registerObjectStorageRoutes } = await import("../replit_integrations/object_storage");
    const objectStorageService = new ObjectStorageService();

    app.post("/api/upload", requireAdmin, async (req: Request, res: Response) => {
      try {
        const uploadURL = await objectStorageService.getObjectEntityUploadURL();
        const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);
        res.json({ uploadURL, objectPath });
      } catch (error) {
        console.error("Upload error:", error);
        res.status(500).json({ error: "Failed to generate upload URL" });
      }
    });

    app.post("/api/upload-local", requireAdmin, async (req: Request, res: Response) => {
      try {
        const { filename, data } = req.body;
        if (!filename || !data) {
          return res.status(400).json({ error: "Missing filename or data" });
        }
        const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
        const timestamp = Date.now();
        const ext = path.extname(safeName) || '.png';
        const finalName = `upload_${timestamp}${ext}`;
        const buffer = Buffer.from(data, 'base64');
        const filePath = path.join(process.cwd(), 'attached_assets', finalName);
        fs.writeFileSync(filePath, buffer);
        res.json({ path: `/attached_assets/${finalName}` });
      } catch (error) {
        console.error("Local upload error:", error);
        res.status(500).json({ error: "Failed to save file" });
      }
    });

    app.post("/api/update-favicon", requireAdmin, async (req: Request, res: Response) => {
      try {
        const { data } = req.body;
        if (!data) {
          return res.status(400).json({ error: "Missing image data" });
        }
        const buffer = Buffer.from(data, 'base64');
        const faviconPath = path.join(process.cwd(), 'client', 'public', 'favicon.png');
        fs.writeFileSync(faviconPath, buffer);
        const distFaviconPath = path.join(process.cwd(), 'dist', 'public', 'favicon.png');
        if (fs.existsSync(path.dirname(distFaviconPath))) {
          fs.writeFileSync(distFaviconPath, buffer);
        }
        res.json({ success: true, message: 'Favicon updated successfully' });
      } catch (error) {
        console.error("Favicon update error:", error);
        res.status(500).json({ error: "Failed to update favicon" });
      }
    });

    registerObjectStorageRoutes(app);
  } else {
    // Vercel: use Supabase Storage
    const { SupabaseStorageService } = await import("./supabaseStorage");
    const storageService = new SupabaseStorageService();

    app.post("/api/upload", requireAdmin, async (_req: Request, res: Response) => {
      try {
        const { uploadURL, objectPath } = await storageService.getUploadURL();
        res.json({ uploadURL, objectPath });
      } catch (error) {
        console.error("Upload error:", error);
        res.status(500).json({ error: "Failed to generate upload URL" });
      }
    });

    app.post("/api/upload-local", requireAdmin, async (req: Request, res: Response) => {
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
    });

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

    // Serve uploaded files from Supabase Storage
    app.get("/storage/:objectPath(*)", async (req: Request, res: Response) => {
      try {
        await storageService.serveFile(req.path, res);
      } catch (error) {
        console.error("Error serving file:", error);
        res.status(404).json({ error: "File not found" });
      }
    });
  }
}
