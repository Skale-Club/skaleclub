// Smart Tags — pure rules shared by the server and the admin UI: allowed
// values, public-code format, public URLs, destination validation, outbound
// UTMs and the status state machine. No I/O here, so it is unit-testable.

export const SMART_TAG_PRODUCT_TYPES = [
  "google_review_sign",
  "business_card",
  "keychain",
  "safety_tag",
  "menu_tag",
  "booking_tag",
  "custom",
] as const;
export type SmartTagProductType = (typeof SMART_TAG_PRODUCT_TYPES)[number];

export const SMART_TAG_PRODUCT_LABELS: Record<SmartTagProductType, string> = {
  google_review_sign: "Google Review sign",
  business_card: "NFC business card",
  keychain: "NFC keychain",
  safety_tag: "Safety tag",
  menu_tag: "Menu tag",
  booking_tag: "Booking tag",
  custom: "Custom",
};

export const SMART_TAG_DESTINATION_TYPES = [
  "google_review",
  "website",
  "booking",
  "vcard",
  "menu",
  "social",
  "custom",
] as const;
export type SmartTagDestinationType = (typeof SMART_TAG_DESTINATION_TYPES)[number];

export const SMART_TAG_DESTINATION_LABELS: Record<SmartTagDestinationType, string> = {
  google_review: "Google Review",
  website: "Website",
  booking: "Booking",
  vcard: "vCard",
  menu: "Menu",
  social: "Social",
  custom: "Custom",
};

export const SMART_TAG_STATUSES = ["inventory", "assigned", "active", "disabled", "retired"] as const;
export type SmartTagStatus = (typeof SMART_TAG_STATUSES)[number];

export const SMART_TAG_BATCH_STATUSES = ["draft", "generated", "ordered", "received", "completed", "cancelled"] as const;
export type SmartTagBatchStatus = (typeof SMART_TAG_BATCH_STATUSES)[number];

export const SMART_TAG_ACCESS_METHODS = ["qr", "nfc"] as const;
export type SmartTagAccessMethod = (typeof SMART_TAG_ACCESS_METHODS)[number];

export const SMART_TAG_EVENT_TYPES = ["redirect", "inventory_scan", "disabled_scan", "misconfigured_scan"] as const;
export type SmartTagEventType = (typeof SMART_TAG_EVENT_TYPES)[number];

/** Upper bound for one batch: keeps generation, CSV and ZIP export bounded. */
export const SMART_TAG_MAX_BATCH_QUANTITY = 1000;

// ─── Public codes ─────────────────────────────────────────────────────────────

/**
 * Crockford Base32: digits + uppercase letters minus I, L, O and U. No O/0 or
 * I/1/L pair can be confused on a printed sign, and 32 symbols divide a byte
 * evenly, so random bytes map to symbols without bias.
 */
export const SMART_TAG_CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const SMART_TAG_CODE_LENGTH = 8;
const CODE_PATTERN = /^[0-9A-HJKMNP-TV-Z]{8,10}$/;

/** Builds a code from random bytes (one symbol per byte, low 5 bits). */
export function encodeTagCode(bytes: ArrayLike<number>, length = SMART_TAG_CODE_LENGTH): string {
  if (bytes.length < length) throw new Error("not enough random bytes for a tag code");
  let code = "";
  for (let i = 0; i < length; i++) code += SMART_TAG_CODE_ALPHABET[bytes[i] & 31];
  return code;
}

/**
 * Normalizes a code typed or scanned by a person: case-insensitive, ignores
 * spaces/hyphens, and reads O as 0 and I/L as 1 (Crockford decoding).
 * Returns null for anything that cannot be a tag code.
 */
export function normalizeTagCode(input: string | null | undefined): string | null {
  if (typeof input !== "string") return null;
  const cleaned = input
    .trim()
    .toUpperCase()
    .replace(/[\s-]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");
  return CODE_PATTERN.test(cleaned) ? cleaned : null;
}

// ─── Public URLs ──────────────────────────────────────────────────────────────

/** V1 decision: every printed QR / programmed NFC URL lives on skale.club. */
export const SMART_TAG_DEFAULT_PUBLIC_BASE_URL = "https://skale.club";

export function buildSmartTagUrls(baseUrl: string, code: string): { qrUrl: string; nfcUrl: string } {
  const base = baseUrl.replace(/\/+$/, "");
  return { qrUrl: `${base}/q/${code}`, nfcUrl: `${base}/n/${code}` };
}

// ─── Destination validation ───────────────────────────────────────────────────

export type DestinationValidation =
  | { ok: true; url: string }
  | { ok: false; error: string };

/**
 * Only https:// destinations (plus http:// outside production). The server
 * redirects but never fetches the URL, so this is about refusing dangerous
 * schemes (javascript:, data:, file:…) and junk, not SSRF.
 */
export function validateDestinationUrl(
  raw: string | null | undefined,
  opts: { allowHttp?: boolean } = {},
): DestinationValidation {
  const value = (raw ?? "").trim();
  if (!value) return { ok: false, error: "Destination URL is required" };
  if (value.length > 2048) return { ok: false, error: "Destination URL is too long" };
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { ok: false, error: "Destination must be a full URL starting with https://" };
  }
  if (url.protocol === "http:" && !opts.allowHttp) {
    return { ok: false, error: "Destination must use https://" };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { ok: false, error: "Destination must use https://" };
  }
  if (!url.hostname || url.username || url.password) {
    return { ok: false, error: "Destination URL is not valid" };
  }
  return { ok: true, url: url.toString() };
}

// ─── Outbound UTMs ────────────────────────────────────────────────────────────

export const SMART_TAG_UTM_SOURCE = "skale-smart-tag";

/**
 * Google Review links get no UTMs by default (Google ignores them and they only
 * lengthen the URL); analytics-capable destinations default to on.
 */
export function defaultUtmEnabled(destinationType: string | null | undefined): boolean {
  return !!destinationType && destinationType !== "google_review";
}

export function slugifyCampaign(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/**
 * Adds utm_* parameters through the URL parser: existing query parameters
 * (including any utm_* the admin set by hand) are preserved, never duplicated.
 */
export function applySmartTagUtm(
  destination: string,
  opts: { method: SmartTagAccessMethod; campaign?: string | null; code: string },
): string {
  let url: URL;
  try {
    url = new URL(destination);
  } catch {
    return destination;
  }
  const params: Record<string, string> = {
    utm_source: SMART_TAG_UTM_SOURCE,
    utm_medium: opts.method,
    utm_content: opts.code,
  };
  const campaign = slugifyCampaign(opts.campaign);
  if (campaign) params.utm_campaign = campaign;
  for (const [key, value] of Object.entries(params)) {
    if (!url.searchParams.has(key)) url.searchParams.set(key, value);
  }
  return url.toString();
}

/** Final redirect target for a tag + access method. */
export function resolveRedirectTarget(
  tag: { destinationUrl: string | null; utmEnabled: boolean; utmCampaign: string | null; publicCode: string },
  method: SmartTagAccessMethod,
): string | null {
  if (!tag.destinationUrl) return null;
  if (!tag.utmEnabled) return tag.destinationUrl;
  return applySmartTagUtm(tag.destinationUrl, { method, campaign: tag.utmCampaign, code: tag.publicCode });
}

// ─── State machine ────────────────────────────────────────────────────────────

export const SMART_TAG_ACTIONS = ["assign", "unassign", "activate", "disable", "retire", "restore"] as const;
export type SmartTagAction = (typeof SMART_TAG_ACTIONS)[number];

export type TransitionResult =
  | { ok: true; status: SmartTagStatus }
  | { ok: false; error: string };

/**
 * Server-enforced lifecycle:
 *   inventory → assigned → active ⇄ disabled
 *   any → retired (terminal; `restore` is the explicit, controlled way back)
 * `assign` on an assigned/active/disabled tag re-assigns without changing status.
 */
export function planTransition(
  tag: { status: string; customerId: string | null; destinationUrl: string | null; destinationType: string | null },
  action: SmartTagAction,
): TransitionResult {
  const status = tag.status as SmartTagStatus;
  switch (action) {
    case "assign":
      if (status === "retired") return { ok: false, error: "A retired tag cannot be assigned" };
      return { ok: true, status: status === "inventory" ? "assigned" : status };
    case "unassign":
      if (status === "retired") return { ok: false, error: "A retired tag cannot be changed" };
      if (status === "inventory") return { ok: false, error: "Tag is not assigned" };
      return { ok: true, status: "inventory" };
    case "activate":
      if (status !== "assigned" && status !== "disabled") {
        return { ok: false, error: status === "active" ? "Tag is already active" : `A tag in ${status} cannot be activated` };
      }
      if (!tag.customerId) return { ok: false, error: "Assign a customer before activating" };
      if (!tag.destinationType) return { ok: false, error: "Choose a destination type before activating" };
      if (!tag.destinationUrl) return { ok: false, error: "Set a destination URL before activating" };
      return { ok: true, status: "active" };
    case "disable":
      if (status !== "active") return { ok: false, error: "Only an active tag can be disabled" };
      return { ok: true, status: "disabled" };
    case "retire":
      if (status === "retired") return { ok: false, error: "Tag is already retired" };
      return { ok: true, status: "retired" };
    case "restore":
      if (status !== "retired") return { ok: false, error: "Only a retired tag can be restored" };
      return { ok: true, status: tag.customerId ? "assigned" : "inventory" };
  }
}

// ─── Manufacturing export ─────────────────────────────────────────────────────

export function csvCell(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? "" : String(value);
  // Neutralise spreadsheet formula injection, then quote when needed.
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function padSerial(serial: number | null | undefined, total: number): string {
  if (!serial) return "";
  return String(serial).padStart(Math.max(3, String(total).length), "0");
}

export const MANUFACTURING_CSV_HEADER = ["batch_code", "serial_number", "public_code", "qr_url", "nfc_url", "qr_asset_filename"];

export function buildManufacturingCsv(
  batch: { batchCode: string; quantity: number },
  tags: ReadonlyArray<{ publicCode: string; serialNumber: number | null }>,
  baseUrl: string,
  assetExtension = "svg",
): string {
  const rows = [MANUFACTURING_CSV_HEADER.join(",")];
  for (const tag of tags) {
    const { qrUrl, nfcUrl } = buildSmartTagUrls(baseUrl, tag.publicCode);
    rows.push([
      batch.batchCode,
      padSerial(tag.serialNumber, batch.quantity),
      tag.publicCode,
      qrUrl,
      nfcUrl,
      `${tag.publicCode}.${assetExtension}`,
    ].map(csvCell).join(","));
  }
  return rows.join("\r\n") + "\r\n";
}
