export function ensureArray<T>(value: T[] | string | null | undefined): T[] {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // ignore parse errors and return empty array
    }
  }
  return [];
}

/**
 * Normalize a Supabase storage URL to use the render/image/public endpoint.
 * This serves the image inline (fixes downloads for old uploads with wrong MIME)
 * and allows image transformations (width, quality) via query params.
 */
export function getImageUrl(
  url: string | null | undefined,
  opts?: { width?: number; quality?: number }
): string {
  if (!url) return '';
  const rendered = url.includes('/object/public/')
    ? url.replace('/object/public/', '/render/image/public/')
    : url;
  if (!opts?.width && !opts?.quality) return rendered;
  const params = new URLSearchParams();
  if (opts.width) params.set('width', String(opts.width));
  if (opts.quality) params.set('quality', String(opts.quality));
  return `${rendered}?${params.toString()}`;
}

export function getOriginalImageUrl(url: string | null | undefined): string {
  if (!url) return '';
  return url.includes('/render/image/public/')
    ? url.replace('/render/image/public/', '/object/public/')
    : url;
}

export async function uploadFileToServer(file: File): Promise<string> {
  const base64Data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const res = await fetch('/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ filename: file.name, data: base64Data }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Upload failed');
  }

  const { path } = await res.json();
  return path;
}
