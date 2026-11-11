// Browser-safe download metadata and links; no ORM/database runtime imports.
export const DOWNLOAD_PLATFORMS = ["windows", "macos", "linux", "android", "ios"] as const;
export const DOWNLOAD_ARCHITECTURES = ["x64", "arm64", "universal"] as const;

export function appDownloadPath(slug: string, releaseId: string): string {
  return `/api/downloads/${encodeURIComponent(slug)}/${encodeURIComponent(releaseId)}`;
}
