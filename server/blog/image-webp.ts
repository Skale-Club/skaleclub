// =============================================================================
// server/blog/image-webp.ts
//
// SOURCE OF TRUTH: xkedule/server/lib/image-webp.ts — sync changes back.
// Ported here as part of the auto-blog parity work (autoblog-parity SC-09,
// MASTER §8). Unchanged below this header.
// =============================================================================
/** Default quality: measured 2026-08-27, a 1433 KB PNG blog cover became
 *  94 KB at q82 (-93.5%) with no visible difference. */
export const WEBP_QUALITY = 82;

export interface WebpConversionResult {
  buffer: Buffer;
  mime: string;
  extension: string;
}

/**
 * Re-encode `buffer` as WebP at `quality`. On ANY failure — corrupt bytes, an
 * unsupported source format, sharp unavailable, whatever — returns the
 * ORIGINAL buffer paired with the ORIGINAL mime/extension the caller
 * supplied. extension and mime always describe what is actually in the
 * returned buffer, never a hardcoded assumption. Never throws: a failed
 * conversion is a missed optimization, not an outage.
 */
export async function convertToWebp(
  buffer: Buffer,
  originalMime: string,
  originalExtension: string,
  quality: number = WEBP_QUALITY,
): Promise<WebpConversionResult> {
  try {
    const { default: sharp } = await import("sharp");
    const webpBuffer = await sharp(buffer).webp({ quality }).toBuffer();
    return { buffer: webpBuffer, mime: "image/webp", extension: "webp" };
  } catch {
    return { buffer, mime: originalMime, extension: originalExtension };
  }
}

export interface AspectNormaliseResult extends WebpConversionResult {
  /** Present only when the source was outside `tolerance` and got center/
   *  attention-cropped before encoding. Absent when already within
   *  tolerance, or when metadata/crop failed (in which case the original
   *  buffer flows through unmodified to the encode step — see `skipReason`). */
  cropped?: { from: { width: number; height: number }; to: { width: number; height: number } };
  /** Set when the crop step itself threw (bad metadata, corrupt bytes, sharp
   *  unavailable) — the original buffer was still encoded, just uncropped. */
  skipReason?: string;
}

/**
 * Crop `buffer` to `targetWidth`:`targetHeight` (only when its actual aspect
 * ratio is outside `tolerance`), then re-encode as WebP via `convertToWebp`.
 *
 * Used for AI-generated covers where the image model may ignore the
 * requested aspect ratio (server/services/blog-generator.ts's
 * normaliseCoverAspect delegates here). Cropping is the floor, not the
 * mechanism — a model that honours the requested ratio needs no crop at all.
 *
 * Crops the long side away rather than scaling: never invent pixels. Uses
 * `attention` positioning so a centre crop doesn't decapitate the subject of
 * a square portrait shot.
 *
 * Never throws: a failed crop degrades to encoding the original buffer
 * uncropped, same never-throws contract as `convertToWebp`.
 */
export async function normaliseAspectAndConvertToWebp(
  buffer: Buffer,
  originalMime: string,
  targetWidth: number,
  targetHeight: number,
  opts: { tolerance?: number; quality?: number } = {},
): Promise<AspectNormaliseResult> {
  const { tolerance = 0.05, quality = WEBP_QUALITY } = opts;
  let working = buffer;
  let cropped: AspectNormaliseResult["cropped"];
  let skipReason: string | undefined;

  try {
    const { default: sharp } = await import("sharp");
    const image = sharp(buffer);
    const { width, height } = await image.metadata();
    if (width && height) {
      const target = targetWidth / targetHeight;
      const actual = width / height;
      if (Math.abs(actual - target) / target > tolerance) {
        const [cropWidth, cropHeight] = actual > target
          ? [Math.round(height * target), height]
          : [width, Math.round(width / target)];

        working = await image
          .resize({ width: cropWidth, height: cropHeight, fit: "cover", position: "attention" })
          .toBuffer();
        cropped = { from: { width, height }, to: { width: cropWidth, height: cropHeight } };
      }
    }
  } catch (error) {
    skipReason = (error as Error).message;
  }

  const originalExtension = originalMime.split("/")[1] || "png";
  const encoded = await convertToWebp(working, originalMime, originalExtension, quality);
  return { ...encoded, cropped, skipReason };
}
