export interface DecodedImage {
  width: number;
  height: number;
  data: Uint8ClampedArray;
  /** Object URL of the original file, for the side-by-side preview. */
  url: string;
}

export const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/bmp', 'image/svg+xml', 'image/avif'];
const MAX_SIDE = 4096;
const SVG_SIDE = 2048;

/** Decodes an image file to RGBA pixels (SVGs are rasterised at 2048 px). */
export async function decodeImageFile(file: Blob): Promise<DecodedImage> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    let w = img.naturalWidth || SVG_SIDE;
    let h = img.naturalHeight || SVG_SIDE;
    const isSvg = file.type === 'image/svg+xml';
    const target = isSvg ? SVG_SIDE : Math.min(MAX_SIDE, Math.max(w, h));
    const s = target / Math.max(w, h);
    w = Math.max(1, Math.round(w * s));
    h = Math.max(1, Math.round(h * s));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Canvas is not available');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);
    return { width: w, height: h, data, url };
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err instanceof Error ? err : new Error('Could not read this image');
  }
}
