import { storage } from "../storage.js";

/**
 * Legacy Gemini generator for the former 3D service artwork. The production
 * cards now use the versioned editorial photos in client/public/service-images;
 * this helper remains only for explicit historical/manual generation.
 */
export const SERVICE_IMAGE_STYLE =
  "Modern minimal 3D isometric illustration. Dark navy background (#0d1320). " +
  "Electric blue accent color (#4f6bff). Soft studio lighting, clean, high detail, " +
  "subtle depth of field. Wide 16:10 aspect ratio. No text, no words, no letters.";

export const SERVICE_IMAGE_SUBJECTS: Record<string, string> = {
  "3d-printing":
    "A 3D printing scene: an FDM printer mid-build with a glowing filament nozzle laying down " +
    "layers, a finished branded keychain and a custom logo piece resting on the print bed, and " +
    "a filament spool beside it.",
};

/** GEMINI_API_KEY / GOOGLE_API_KEY, else the key saved in the admin's Gemini integration. */
export async function resolveGeminiKey(): Promise<string | undefined> {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  if (process.env.GOOGLE_API_KEY) return process.env.GOOGLE_API_KEY;
  try {
    const integration = await storage.getChatIntegration("gemini");
    return integration?.apiKey || undefined;
  } catch {
    return undefined;
  }
}

/** Returns PNG bytes, or null when the model returned no image. Throws on API errors. */
export async function generateServiceImage(subject: string): Promise<Buffer | null> {
  const apiKey = await resolveGeminiKey();
  if (!apiKey) throw new Error("No Gemini API key: set GEMINI_API_KEY or configure the Gemini integration in the admin.");
  const { GoogleGenAI } = await import("@google/genai");
  const ai = new GoogleGenAI({ apiKey });
  const model = process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";
  const response = await ai.models.generateContent({ model, contents: `${subject}\n\n${SERVICE_IMAGE_STYLE}` });
  const parts = (response as { candidates?: { content?: { parts?: { inlineData?: { data?: string } }[] } }[] }).candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    if (part.inlineData?.data) return Buffer.from(part.inlineData.data, "base64");
  }
  return null;
}
