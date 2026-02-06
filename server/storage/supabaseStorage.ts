import { getSupabaseAdmin } from "../lib/supabase.js";
import { randomUUID } from "crypto";
import type { Response } from "express";

const BUCKET_NAME = "uploads";

export class SupabaseStorageService {
  // Get a presigned upload URL from Supabase Storage
  async getUploadURL(): Promise<{ uploadURL: string; objectPath: string }> {
    const supabase = getSupabaseAdmin();
    const objectId = `uploads/${randomUUID()}`;

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUploadUrl(objectId);

    if (error || !data) {
      throw new Error(`Failed to create upload URL: ${error?.message}`);
    }

    return {
      uploadURL: data.signedUrl,
      objectPath: `/storage/${objectId}`,
    };
  }

  // Upload a file directly from a buffer (for base64 uploads)
  async uploadBuffer(
    buffer: Buffer,
    filename: string,
    contentType?: string
  ): Promise<string> {
    const supabase = getSupabaseAdmin();
    const ext = filename.split(".").pop() || "png";
    const objectId = `uploads/${Date.now()}_${randomUUID()}.${ext}`;

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(objectId, buffer, {
        contentType: contentType || "application/octet-stream",
        upsert: false,
      });

    if (error) {
      throw new Error(`Failed to upload file: ${error.message}`);
    }

    // Return public URL
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(objectId);

    return urlData.publicUrl;
  }

  // Serve a file from Supabase Storage by redirecting to the public URL
  async serveFile(objectPath: string, res: Response): Promise<void> {
    const supabase = getSupabaseAdmin();

    // objectPath comes as /storage/uploads/uuid
    const storagePath = objectPath.replace(/^\/storage\//, "");

    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(storagePath);

    res.redirect(urlData.publicUrl);
  }
}
