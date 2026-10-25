// Admin-only routes that accept large base64 bodies: the image endpoints
// (/api/upload, /api/upload-local, /api/uploads/*, /api/update-favicon),
// presentation/estimate media, and whiteboard scenes (which embed pasted
// images). server/app.ts parses these with the 25 MB limit, after requireAdmin.
export const LARGE_BODY_RE =
  /^\/api\/(upload(s|-local)?(\/|$)|update-favicon(\/|$)|presentations\/(transcribe|upload-image)|presentations\/[^/]+\/thumbnail|estimates\/[^/]+\/thumbnail|whiteboards\/[0-9a-f-]{36}$)/;

export const LARGE_BODY_LIMIT = "25mb";
