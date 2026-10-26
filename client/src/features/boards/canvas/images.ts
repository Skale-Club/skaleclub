// Board images: uploaded to Supabase Storage through the admin API (a signed
// upload URL, then a direct PUT), stored in the document as a public URL with
// the picture's natural size.
import { apiRequest, HttpError } from '@/lib/queryClient';

export const BOARD_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/avif'] as const;
export const BOARD_IMAGE_ACCEPT = BOARD_IMAGE_TYPES.join(',');
export const BOARD_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

const EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/avif': 'avif',
};

export type BoardImageErrorCode = 'storage_not_configured' | 'unsupported' | 'too_large' | 'failed';

export class BoardImageError extends Error {
  constructor(public code: BoardImageErrorCode, message: string) {
    super(message);
  }
}

export interface UploadedBoardImage {
  url: string;
  naturalW: number;
  naturalH: number;
  alt: string;
}

export function isBoardImageFile(file: File) {
  return (BOARD_IMAGE_TYPES as readonly string[]).includes(file.type);
}

function readNaturalSize(file: File): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ w: img.naturalWidth, h: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      resolve({ w: 0, h: 0 });
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}

function fileName(file: File) {
  const ext = EXT[file.type] ?? 'png';
  const base = (file.name || 'image').replace(/\.[^.]+$/, '').replace(/[^\w.-]+/g, '-').slice(0, 80) || 'image';
  return `${base}.${ext}`;
}

export async function uploadBoardImage(file: File): Promise<UploadedBoardImage> {
  if (!isBoardImageFile(file)) throw new BoardImageError('unsupported', 'Only PNG, JPEG, GIF, WebP and AVIF images are supported');
  if (file.size > BOARD_IMAGE_MAX_BYTES) throw new BoardImageError('too_large', 'Images must be 10 MB or smaller');
  const size = await readNaturalSize(file);
  let signed: { uploadUrl: string; publicUrl: string };
  try {
    signed = await apiRequest('POST', '/api/uploads/board-image/sign', { filename: fileName(file) }).then((r) => r.json());
  } catch (err) {
    if (err instanceof HttpError && err.status === 503) {
      throw new BoardImageError('storage_not_configured', 'Image storage (Supabase) is not configured on this server.');
    }
    throw new BoardImageError('failed', err instanceof Error ? err.message : 'Upload failed');
  }
  const put = await fetch(signed.uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
  if (!put.ok) throw new BoardImageError('failed', `Upload to storage failed (${put.status})`);
  return { url: signed.publicUrl, naturalW: size.w, naturalH: size.h, alt: (file.name || '').replace(/\.[^.]+$/, '') };
}

/** The first supported image in a paste or drop, if any. */
export function firstImageFile(list: DataTransfer | null | undefined): File | null {
  if (!list) return null;
  for (const file of Array.from(list.files ?? [])) if (isBoardImageFile(file)) return file;
  for (const item of Array.from(list.items ?? [])) {
    if (item.kind === 'file') {
      const file = item.getAsFile();
      if (file && isBoardImageFile(file)) return file;
    }
  }
  return null;
}
