# Phase 10: Schema & Upload Foundation — Research

**Researched:** 2026-04-20
**Domain:** Drizzle JSONB schema evolution + Supabase Storage file uploads (Express) + UUID link identity
**Confidence:** HIGH

## Summary

Phase 10 builds the backend foundation for the v1.3 Links Page Upgrade. It has three deliverables: (1) extend `linksPageConfig` JSONB on `company_settings` with a richer per-link shape + a `theme` sub-object, (2) add a new admin-authenticated multipart upload endpoint at `POST /api/uploads/links-page` that pushes files into the existing Supabase `uploads` bucket under a `links-page/` prefix, and (3) guarantee every link in `linksPageConfig.links` has a stable UUID `id`.

The repo already has a working Supabase Storage integration (`server/storage/storageAdapter.ts` + `server/storage/supabaseStorage.ts`) used by VCardsManager avatars, the favicon updater, and the Xpot lead-photo endpoint. That integration uses a **base64-in-JSON body** payload (not multipart), protected by `requireAdmin`, and returns a public URL. The `uploads` bucket is already public and auto-provisioned on first call. The cleanest path for Phase 10 is to **extend this proven pattern** (base64 JSON) into a new `/api/uploads/links-page` route that additionally enforces image MIME types, a 2 MB limit, and writes under a `links-page/{type}/...` prefix — rather than introduce multer/busboy (new dependency, new middleware surface, new failure mode). The existing Express body limit is 50 MB so 2 MB fits comfortably.

For the JSONB shape, the existing pattern is: define TypeScript interfaces + a `z.custom<T>()` escape hatch on the insert schema (see `LinksPageConfig`, `HomepageContent` in `shared/schema/settings.ts`). We should upgrade the existing `LinksPageLink` interface and add a real Zod schema (not just `z.custom`) so invalid per-link shapes are caught server-side on save. Since the change is additive and stored in JSONB, **no SQL migration is needed** — the `$type<LinksPageConfig>()` annotation is TypeScript-only and the database already accepts the new keys. Backward-compat is handled at read time: a tiny `normalizeLinksPageConfig()` helper lazily backfills missing `id`s, `visible`, `clickCount`, `iconType`/`iconValue` defaults, and `theme`, so old rows keep working without a data migration.

**Primary recommendation:** Extend the base64-JSON upload pattern (not multipart). Model `linksPageConfig` with real Zod schemas + a normalization helper applied in `storage.getCompanySettings()`. Skip any SQL migration — JSONB accepts the new keys, and IDs are backfilled lazily on first save.

<user_constraints>
## User Constraints (from CONTEXT.md)

No CONTEXT.md exists for Phase 10 — `/gsd:discuss-phase` was not run. Constraints are inherited from `.planning/PROJECT.md`:

### Locked Decisions (from PROJECT.md constraints)
- **No DB breaking changes:** additive tables/columns only — no modifications to existing tables. Phase 10 satisfies this by using the existing JSONB column (`company_settings.links_page_config`); no DDL.
- **API stability:** all existing `/api/*` signatures unchanged. Phase 10 adds a NEW endpoint (`POST /api/uploads/links-page`) and extends the shape persisted via `PUT /api/company-settings` — both are additive.
- **No test framework:** manual QA only. Nyquist Validation section below explicitly records this.
- **Snapshot immutability (v1.2):** not directly applicable to Phase 10.

### Claude's Discretion
- Upload payload format (base64 JSON vs. multipart) — recommendation in §"Architecture Patterns" below.
- Zod schema shape for extended links config — recommendation below.
- Lazy vs. eager UUID backfill — recommendation below (lazy).
- Whether `theme` is required or optional on save — recommendation: optional with safe defaults.

### Deferred Ideas
Per REQUIREMENTS.md "Out of Scope":
- Multiple `/l/:slug` pages
- Pinned / featured link styling
- Inline email capture
- A/B testing / scheduled links
- QR code for the page
- Per-link analytics beyond click count (geo, device, referrer)
- Simple Icons brand library
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LINKS-01 | Extend `linksPageConfig` JSONB with per-link `iconType`/`iconValue`/`visible`/`clickCount` + `theme` sub-object; `links`/`socialLinks` stay backward-compatible | §"Schema Extension Plan" gives the exact new Zod schema + TS interface; lazy-normalize helper in §"Backward Compatibility Strategy" preserves old rows |
| LINKS-02 | File uploads route to Supabase `uploads` bucket under `links-page/{type}/{timestamp}-{hash}.{ext}`; URL returned + persisted | §"Upload Endpoint Design" specifies path builder reusing existing `SupabaseStorageService.uploadBuffer`; public URL returned via `getPublicUrl` |
| LINKS-03 | Every link has a stable UUID `id` assigned at create time | §"UUID Assignment" uses `crypto.randomUUID()` (Node built-in, already used in `server/storage/supabaseStorage.ts`); lazy backfill in storage read, explicit on create in admin write |
| LINKS-06 | `POST /api/uploads/links-page` admin-auth, multipart image, max 2 MB, image MIME types only | §"Upload Endpoint Design" keeps the established base64-JSON convention (consistent with `/api/upload`, `/api/update-favicon`) but enforces stricter MIME+size checks; 50 MB Express limit already accommodates 2 MB |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | ^2.89.0 (installed) | Supabase Storage SDK — `createSignedUploadUrl`, `upload`, `getPublicUrl` | Already the canonical storage integration used by `SupabaseStorageService`, Xpot lead photos, and the favicon updater |
| `drizzle-orm` | ^0.39.3 (installed) | Typed JSONB column with `$type<T>()` annotation | Repo convention — `homepageContent`, `pageSlugs`, existing `linksPageConfig` all use this pattern |
| `zod` | ^3.24.2 (installed) | Runtime validation of the extended `linksPageConfig` shape on save | Every existing route validates req bodies with Zod; matches v1.2 `insertEstimateSchema` convention |
| `node:crypto` | built-in | `randomUUID()` for stable per-link IDs | Node 20 built-in; already used in `supabaseStorage.ts`, `chat.ts`, `ChatWidget.tsx`, `LeadFormModal.tsx` |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `express` `express.json({ limit: '50mb' })` | 4.21.2 (installed, configured in `server/app.ts`) | Accept base64-JSON upload body | Already configured — no change required for a 2 MB payload (even with base64 overhead ~2.7 MB, well under 50 MB) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| base64 JSON upload (chosen) | `multer` multipart | Multer adds a new dependency + new middleware + a separate code path from the existing `uploadFileToServer()` helper. Base64 inflates payload ~33% but the 2 MB cap makes this trivial (≈2.7 MB JSON over the wire). Every existing admin uploader — VCard avatar, favicon, User avatar, shared `utils.ts` — uses base64. Introducing multipart just for `/links-page` creates two patterns where one suffices. **Reject multipart; extend the base64 pattern.** |
| base64 JSON upload (chosen) | Supabase presigned upload URL (client-direct) | `SupabaseStorageService.getUploadURL()` already exists and works, but forces the client to talk to Supabase directly (exposing bucket endpoint in the browser), complicates MIME/size enforcement (must be done at bucket policy level, not at the app edge), and none of the existing admin uploaders use this path today. Presigned URLs are better for very large files; 2 MB doesn't justify the new code path. |
| `z.custom<LinksPageConfig>()` | Real Zod schema (`z.object({...})` with nested `z.array(linkSchema)`) | The existing `z.custom` on `insertCompanySettingsSchema.linksPageConfig` performs no runtime validation — any shape passes. Replacing it with an explicit `linksPageConfigSchema` catches bad shapes at the API edge (matches the v1.2 `insertEstimateSchema` lesson from phase 6). **Upgrade to real Zod schema.** |
| `uuid` npm package | `crypto.randomUUID()` | Both produce RFC 4122 v4 UUIDs. `crypto.randomUUID` is a Node built-in (no dependency) and is already the convention in `supabaseStorage.ts` (line 2: `import { randomUUID } from "crypto"`). **Use built-in.** |

**Installation:**

No new dependencies required. All four stack items are already installed.

**Version verification:**

Already-installed versions confirmed from `package.json`:
- `@supabase/supabase-js`: ^2.89.0 (as of 2026-04, latest stable on npm)
- `drizzle-orm`: ^0.39.3
- `drizzle-zod`: ^0.7.0
- `zod`: ^3.24.2

No version bump needed for this phase.

## Architecture Patterns

### Recommended File Layout

```
shared/schema/settings.ts          # EXTEND: upgrade LinksPageLink / LinksPageConfig interfaces + add linksPageConfigSchema (Zod)
server/routes/company.ts           # EXTEND: PUT /api/company-settings uses the new linksPageConfigSchema; call normalizeLinksPageConfig on save
server/routes/uploads.ts           # NEW FILE: registerUploadsRoutes(app) — POST /api/uploads/links-page handler
server/routes.ts                   # EXTEND: registerUploadsRoutes(app) alongside other registerXxx calls
server/storage/supabaseStorage.ts  # EXTEND: add uploadLinksPageAsset(buffer, assetType, filename, contentType) that prefixes with `links-page/{assetType}/`
server/storage.ts                  # EXTEND: getCompanySettings() applies normalizeLinksPageConfig() to returned row (lazy backfill)
shared/links.ts                    # NEW FILE (optional): normalizeLinksPageConfig() helper + DEFAULT_LINKS_PAGE_THEME — pure function, shared client/server
```

### Pattern 1: JSONB Column with Real Zod Schema

**What:** Replace the escape-hatch `z.custom<LinksPageConfig>()` on the insert schema with an explicit `linksPageConfigSchema` so the server rejects malformed shapes.

**When to use:** Whenever a JSONB column stores a non-trivial shape that the API writes from admin input. Matches the v1.2 `insertEstimateSchema` pattern (see `shared/schema/estimates.ts` line 56).

**Example:**

```typescript
// shared/schema/settings.ts — ADD these schemas BEFORE insertCompanySettingsSchema

export const linksPageThemeSchema = z.object({
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  backgroundColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  backgroundGradient: z.string().optional(), // CSS gradient expression, e.g. "linear-gradient(135deg, #1C53A3, #FFFF01)"
  backgroundImageUrl: z.string().url().or(z.literal('')).optional(),
});

export const linksPageLinkSchema = z.object({
  id: z.string().uuid(), // assigned at create time; lazy-backfilled on read for legacy rows
  title: z.string().min(1).max(200),
  url: z.string().min(1).max(2000),
  order: z.number().int().min(0),
  iconType: z.enum(['lucide', 'upload', 'auto']).default('auto'),
  iconValue: z.string().default(''), // lucide icon name OR uploaded URL
  visible: z.boolean().default(true),
  clickCount: z.number().int().min(0).default(0),
});

export const linksPageSocialSchema = z.object({
  platform: z.string().min(1).max(50),
  url: z.string().min(1).max(2000),
  order: z.number().int().min(0),
});

export const linksPageConfigSchema = z.object({
  avatarUrl: z.string().default(''),
  title: z.string().default(''),
  description: z.string().default(''),
  links: z.array(linksPageLinkSchema).default([]),
  socialLinks: z.array(linksPageSocialSchema).default([]),
  theme: linksPageThemeSchema.default({}),
});

export type LinksPageLink = z.infer<typeof linksPageLinkSchema>;
export type LinksPageSocial = z.infer<typeof linksPageSocialSchema>;
export type LinksPageTheme = z.infer<typeof linksPageThemeSchema>;
export type LinksPageConfig = z.infer<typeof linksPageConfigSchema>;

// Then in insertCompanySettingsSchema, replace:
//   linksPageConfig: z.custom<LinksPageConfig>().optional().nullable(),
// with:
//   linksPageConfig: linksPageConfigSchema.optional().nullable(),
```

**Important:** The existing `LinksPageLink` / `LinksPageSocial` / `LinksPageConfig` **interfaces** (lines 236–255 of `settings.ts`) must be deleted and replaced by the `z.infer` types above — otherwise the two will diverge. `client/src/components/admin/LinksSection.tsx` already imports `LinksPageLink`, `LinksPageSocial`, `LinksPageConfig` from `@shared/schema` via the barrel, so the import surface stays identical.

### Pattern 2: Base64-JSON Upload Endpoint (extend, don't replace)

**What:** A POST endpoint that accepts `{ filename, data: <base64> }` JSON, validates, writes to Supabase, returns `{ url }`.

**When to use:** Admin-facing image uploads ≤ a few MB. Matches `/api/upload`, `/api/upload-local`, `/api/update-favicon` already in this repo.

**Example:**

```typescript
// server/routes/uploads.ts (NEW FILE)
import type { Express, Request, Response } from "express";
import { z } from "zod";
import { SupabaseStorageService } from "../storage/supabaseStorage.js";
import { requireAdmin } from "./_shared.js";

const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "image/avif",
]);
const EXT_TO_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  avif: "image/avif",
};
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED_ASSET_TYPES = ["avatar", "background", "icon"] as const;

const uploadBodySchema = z.object({
  filename: z.string().min(1).max(200),
  data: z.string().min(1), // raw base64 (no data: prefix), matches existing /api/upload convention
  assetType: z.enum(ALLOWED_ASSET_TYPES),
});

export function registerUploadRoutes(app: Express) {
  const storageService = new SupabaseStorageService();

  app.post("/api/uploads/links-page", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { filename, data, assetType } = uploadBodySchema.parse(req.body);

      const buffer = Buffer.from(data, "base64");
      if (buffer.length === 0) {
        return res.status(400).json({ message: "Empty file payload" });
      }
      if (buffer.length > MAX_BYTES) {
        return res.status(413).json({ message: `File exceeds 2 MB limit (${buffer.length} bytes)` });
      }

      const ext = (filename.split(".").pop() || "").toLowerCase();
      const contentType = EXT_TO_MIME[ext];
      if (!contentType || !ALLOWED_MIME.has(contentType)) {
        return res.status(415).json({ message: `Unsupported file type: .${ext}` });
      }

      const url = await storageService.uploadLinksPageAsset(buffer, assetType, filename, contentType);
      res.json({ url });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid upload payload", errors: err.errors });
      }
      console.error("Links-page upload error:", err);
      res.status(500).json({ message: "Upload failed" });
    }
  });
}
```

```typescript
// server/storage/supabaseStorage.ts — ADD this method on SupabaseStorageService

async uploadLinksPageAsset(
  buffer: Buffer,
  assetType: "avatar" | "background" | "icon",
  filename: string,
  contentType: string,
): Promise<string> {
  await ensureBucket();
  const supabase = getSupabaseAdmin();
  const ext = (filename.split(".").pop() || "png").toLowerCase();
  const objectId = `links-page/${assetType}/${Date.now()}_${randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(objectId, buffer, { contentType, upsert: false });

  if (error) throw new Error(`Failed to upload links-page asset: ${error.message}`);

  const { data: urlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(objectId);
  return urlData.publicUrl;
}
```

### Pattern 3: Lazy UUID Backfill on Read

**What:** Existing rows in `company_settings.links_page_config` have `links: [{ title, url, order }]` without `id`. Rather than a data migration, normalize at read time: whenever storage returns the settings row, rewrite any link that lacks `id`/`visible`/`iconType` with defaults. On the next admin save, the normalized (now-UUID-stamped) shape is persisted — effectively a lazy migration.

**When to use:** JSONB columns with additive keys and small row counts (here, one row — `company_settings` is a singleton).

**Example:**

```typescript
// shared/links.ts (NEW FILE — pure, no deps on drizzle/supabase)
import { randomUUID } from "crypto";
import type { LinksPageConfig, LinksPageLink } from "./schema.js";

export const DEFAULT_LINKS_PAGE_THEME = {
  primaryColor: "#1C53A3",
  backgroundColor: "#0f1014",
  backgroundGradient: "",
  backgroundImageUrl: "",
};

export function normalizeLinksPageConfig(raw: Partial<LinksPageConfig> | null | undefined): LinksPageConfig {
  const src = raw ?? {};
  const links = (src.links ?? []).map((l, i): LinksPageLink => ({
    id: (l as any).id ?? randomUUID(),
    title: l.title ?? "",
    url: l.url ?? "",
    order: typeof l.order === "number" ? l.order : i,
    iconType: (l as any).iconType ?? "auto",
    iconValue: (l as any).iconValue ?? "",
    visible: (l as any).visible ?? true,
    clickCount: (l as any).clickCount ?? 0,
  }));
  return {
    avatarUrl: src.avatarUrl ?? "",
    title: src.title ?? "",
    description: src.description ?? "",
    links,
    socialLinks: src.socialLinks ?? [],
    theme: { ...DEFAULT_LINKS_PAGE_THEME, ...(src.theme ?? {}) },
  };
}
```

```typescript
// server/storage.ts — MODIFY getCompanySettings
async getCompanySettings(): Promise<CompanySettings> {
  const [settings] = await db.select().from(companySettings);
  if (settings) {
    return {
      ...settings,
      linksPageConfig: normalizeLinksPageConfig(settings.linksPageConfig),
    };
  }
  const [newSettings] = await db.insert(companySettings).values({}).returning();
  return {
    ...newSettings,
    linksPageConfig: normalizeLinksPageConfig(newSettings.linksPageConfig),
  };
}
```

This guarantees every downstream consumer (`LinksSection.tsx`, public `Links.tsx`, Phase 11 click endpoint) sees UUIDs, booleans, and numeric `clickCount`s even on pre-migration rows. Phase 11's click endpoint can then safely assume `id` exists.

### Anti-Patterns to Avoid

- **Adding a new upload endpoint with multipart when base64 works:** You'd split the admin upload pattern into two incompatible code paths. VCardsManager, CompanySettingsSection, UsersSection all consume `uploadFileToServer()` from `client/src/components/admin/shared/utils.ts`; that helper is base64-JSON. Extend it with a second signature that accepts an `assetType` param, don't introduce a parallel multipart path.
- **Writing an SQL migration for a JSONB shape change:** The DB doesn't care about nested shape. `npm run db:push` generates no diff for this change (the column is still `jsonb`). Any temptation to write `0035_links_page_config.sql` is wrong — the column already exists.
- **Eager data migration script for UUID backfill:** Wastes a deploy step and a tsx script. There's one row. Normalize at read time, persist on first save.
- **Validating only filename extension, not MIME:** Extension checks are trivially spoofed. Current `/api/upload` trusts the extension. For the new endpoint, validate extension AND only accept an explicit MIME allowlist derived from extension — the upload helper passes filename + raw base64, so we infer MIME from extension, but a malicious client could rename `.exe` to `.png`. Acceptable tradeoff for this phase (image rendering via `<img>` won't execute script; SVG is the only real risk — see "Common Pitfalls" §2).
- **Storing full URLs in JSONB and also in a CDN cache:** `getPublicUrl` returns a stable absolute URL that already includes `/storage/v1/object/public/uploads/links-page/...`. Don't add a second layer of caching. Use `getImageUrl()` from `client/src/components/admin/shared/utils.ts` for render-time transforms (width, quality).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| UUID generation | Custom `Math.random`-based ID | `crypto.randomUUID()` | RFC 4122 compliance, collision-resistant, already used in `supabaseStorage.ts`; zero deps |
| Supabase bucket client / signing | Direct REST calls to Supabase | `getSupabaseAdmin()` from `server/lib/supabase.ts` | Singleton pattern already handles `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` env var validation, autoRefresh config |
| Public URL construction | Hand-build `${SUPABASE_URL}/storage/v1/object/public/...` | `supabase.storage.from(BUCKET_NAME).getPublicUrl(path)` | Future-proof if Supabase changes the URL scheme; handles special chars |
| Image CDN transforms | Manual `?w=200` string concat | `getImageUrl(url, { width, quality })` from `client/src/components/admin/shared/utils.ts` | Already handles Supabase `/object/public/` → `/render/image/public/` rewrite |
| Base64 encode/decode | `atob`/`btoa` | `Buffer.from(data, 'base64')` on server, `FileReader.readAsDataURL` on client | Existing `uploadFileToServer()` already does this correctly |
| Admin auth | Session-check in every route | `requireAdmin` from `server/routes/_shared.ts` | Centralized, already verifies `session.userId` AND `users.isAdmin` |
| JSONB shape validation | Custom type guards | `z.object({...})` + `z.infer<>` | Gives compile-time types AND runtime validation; matches v1.2 `estimateServiceItemSchema` |

**Key insight:** Every primitive needed by Phase 10 — UUID generation, Supabase upload, public URL, admin auth, bucket provisioning, base64 handling, image transforms, Zod validation — already exists in this codebase. This phase is 95% wiring and schema extension, 5% new code (one new route file, one new storage method, one shared helper).

## Runtime State Inventory

> This is an additive-schema/greenfield-endpoint phase, not a rename/refactor. The inventory is included for safety but most categories are N/A.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | One row in `company_settings` has `links_page_config` with the OLD link shape (`{title, url, order}` — no `id`, no `visible`, no `iconType`). | Lazy normalize on read (Pattern 3) — no migration script. First admin save persists the UUID-stamped shape. |
| Live service config | None — Supabase `uploads` bucket already exists as public (auto-created by `SupabaseStorageService.ensureBucket()`, `{ public: true }`). No Supabase dashboard policy edits required. | None. |
| OS-registered state | None — no scheduled tasks, no systemd units, no pm2 processes reference links-page config. Verified by grep: no matches for `links-page` in `scripts/`, no cron entries in `server/routes/company.ts` beyond `supabase-keepalive`. | None. |
| Secrets / env vars | `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` already required and validated in `server/lib/supabase.ts::getSupabaseAdmin()`. Phase 10 reuses these — no new env vars. | None. |
| Build artifacts / installed packages | No new dependencies. No compiled artifacts carry old schema (TS types regenerate on build). | None — normal `npm run build` after the change. |

**Canonical question — "what runtime systems still have the old string cached after code is updated?":** Only the one `company_settings` row with legacy link shape. Covered by lazy-normalize on read.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All | ✓ | 20.19.27 (per `@types/node` devDep) — provides `crypto.randomUUID` | — |
| `@supabase/supabase-js` | Upload endpoint, bucket ops | ✓ | ^2.89.0 | — |
| Supabase project (`SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`) | Upload endpoint | ✓ (assumed — already used by other routes in dev and prod) | — | If missing at runtime: route returns 500 via `getSupabaseAdmin()` throw. Already the pattern in Xpot routes (see `leads.ts:311` which pre-checks and returns 503 "Storage not configured"). Consider replicating that 503 guard in the new upload endpoint for clearer errors in misconfigured environments. |
| Supabase `uploads` bucket | Upload endpoint | ✓ (auto-provisioned `{ public: true }` by `SupabaseStorageService.ensureBucket()`) | — | Auto-created on first upload attempt. No manual setup. |
| Express `json` body parser at 50 MB | Accepting base64 payload up to ~2.7 MB | ✓ | configured in `server/app.ts:32` | — |
| PostgreSQL (`DATABASE_URL`) | `company_settings` table | ✓ | — | — |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None.

**Recommendation:** Replicate the Xpot pattern and add a pre-flight check in the new upload handler:
```typescript
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  return res.status(503).json({ message: "Storage not configured" });
}
```
This produces a clearer error than a 500 from `getSupabaseAdmin()` throwing deep in the stack.

## Common Pitfalls

### Pitfall 1: `z.custom<LinksPageConfig>()` silently accepts garbage

**What goes wrong:** The current insert schema uses `z.custom<LinksPageConfig>().optional().nullable()` which performs **no runtime validation** — it trusts the TypeScript annotation. A client could send `linksPageConfig: { links: "not an array" }` and Drizzle would happily persist it, corrupting the row.

**Why it happens:** `z.custom<T>()` is an escape hatch that only runs if you pass a validator callback. Without one, it returns `true` for any value.

**How to avoid:** Replace with a real `linksPageConfigSchema` (Pattern 1). This is the v1.2 Phase 6 lesson — the estimates team switched from `z.custom` to explicit schemas for exactly this reason (see `shared/schema/estimates.ts::insertEstimateSchema`, noted in STATE.md D-decision for Phase 06).

**Warning signs:** Drizzle errors on SELECT ("cannot read property X of undefined") from malformed JSONB; TypeScript types don't match runtime reality.

### Pitfall 2: SVG uploads can execute JavaScript

**What goes wrong:** An attacker uploads an SVG containing `<script>` tags or `onclick=` handlers. When the public `/links` page renders it via `<img src="...">` the SVG is inert — but if any admin tool ever embeds it inline with `<svg>...</svg>` or uses `dangerouslySetInnerHTML`, it runs.

**Why it happens:** SVG is XML, not a raster format. Browsers execute embedded script when SVG is treated as a document (`<object>`, `<iframe>`, direct navigation to the URL, inline embed).

**How to avoid:**
1. Store uploaded SVGs and render them **only via `<img src>`**, which treats SVG as an image and blocks script execution in modern browsers.
2. Set `Content-Security-Policy` restricted on the storage origin (Supabase already serves with `Content-Type: image/svg+xml` — the browser's same-origin policy prevents script execution cross-origin).
3. **Do NOT** set `content-type: image/svg+xml` AND render inline with `innerHTML`. Never.
4. Accept the risk for v1.3 — `/links` page renders only via `<img>`. Add a comment to the Zod schema noting the assumption.

**Warning signs:** A future PR adds inline SVG rendering to `LinksSection` or `Links.tsx` — that's when this pitfall lands.

### Pitfall 3: Base64 size inflation exhausts Express body limit

**What goes wrong:** A user uploads a legitimate 4 MB image. Base64 encoding inflates it to ~5.4 MB. If the 2 MB cap is checked **after** parsing, Express happily parses 5.4 MB and the server wastes memory.

**Why it happens:** The cap is on decoded bytes; the wire payload is base64.

**How to avoid:** The check in the handler (`buffer.length > MAX_BYTES`) is on decoded bytes, which is correct. The Express `json({ limit: '50mb' })` already bounds the wire payload — a malicious client cannot OOM the server by sending a multi-GB base64 string. **No action needed**, but document this: the 2 MB cap is on the decoded image; the base64 wire payload is ~2.7 MB worst case, far below the 50 MB Express limit.

### Pitfall 4: Non-idempotent object path on retry

**What goes wrong:** Client uploads, network hiccups mid-response, client retries. Two objects now exist in Supabase under different paths — orphaned storage, wasted quota.

**Why it happens:** Path is `${Date.now()}_${randomUUID()}.${ext}`. Each retry generates a new path.

**How to avoid:** Accept the tradeoff — idempotent uploads require content-hashing the buffer before upload, which is cheap for 2 MB (`crypto.createHash('sha256').update(buffer).digest('hex')`). Matches the requirement spec: `links-page/{type}/{timestamp}-{hash}.{ext}`. **Use a hash in the path** instead of UUID:

```typescript
const hash = createHash("sha256").update(buffer).digest("hex").slice(0, 12);
const objectId = `links-page/${assetType}/${Date.now()}-${hash}.${ext}`;
```

This gives deterministic paths for identical files (content-addressed) and also fixes a real user issue: uploading the same avatar twice creates two storage objects. With `upsert: false` and a content hash, the second upload would fail — we could either flip to `upsert: true` (allow overwrite) or catch the "already exists" error and return the existing URL. **Recommendation: hash + `upsert: true`.**

**Warning signs:** Supabase bucket fills up with duplicate `1745123456789_<uuid>.png` entries; admins complain that avatar changes don't "stick" in preview (CDN cache of old URL).

### Pitfall 5: Settings-row cache invalidation on config shape change

**What goes wrong:** `GET /api/company-settings` has `Cache-Control: s-maxage=300` (5 minutes). After an admin saves a new link with a UUID, a CDN-cached response from before the save is served to the public page — the click endpoint (Phase 11) gets called with a UUID that doesn't exist in the cached version.

**Why it happens:** Existing CDN cache on `/api/company-settings`, no cache-bust on write.

**How to avoid:** The admin-side `LinksSection.tsx` already does `queryClient.invalidateQueries({ queryKey: ['/api/company-settings'] })` after save (line 55) — this invalidates the *React Query* cache. The CDN cache is unaffected.

Options:
1. Accept the 5-minute window: admin-created links take up to 5 minutes to appear on public `/links`. This is the **current behavior today** (any config change has this lag). Acceptable for Phase 10.
2. Invalidate CDN on save: requires adding `revalidate` hooks (Vercel) — out of scope for Phase 10.

**Recommendation:** Accept the 5-minute propagation window for v1.3. Document it in SUMMARY.

**Warning signs:** "I added a link and it's not showing up" reports from admin QA — instruct to wait 5 min or hard-reload.

### Pitfall 6: `data` field confusion — data URL vs. raw base64

**What goes wrong:** Some endpoints accept `data:image/png;base64,ABC...` (full data URL), others accept just `ABC...`. Mixing them produces corrupted files.

**Why it happens:** Historical inconsistency. The existing `/api/upload` handler in `storageAdapter.ts::handleUpload` does `Buffer.from(data, 'base64')` — expects raw base64. The Xpot lead-photo endpoint does `imageData.replace(/^data:image\/\w+;base64,/, "")` — accepts both. The client helper `uploadFileToServer()` already strips the data URL prefix via `result.split(',')[1]`.

**How to avoid:** Follow the `/api/upload` convention — body is `{ filename, data }` where `data` is **raw base64 without prefix**. Document this in the new handler. If a client sends a data URL, either reject with 400 or apply the same strip pattern as Xpot. **Recommendation: strip defensively** (low cost, prevents a class of bugs):

```typescript
const cleaned = data.startsWith("data:") ? data.replace(/^data:[^;]+;base64,/, "") : data;
const buffer = Buffer.from(cleaned, "base64");
```

**Warning signs:** Uploaded files open as corrupt; first few bytes of the stored object are `data:image/pn...` instead of the PNG magic bytes.

## Code Examples

Verified patterns from this codebase:

### Existing base64-JSON upload (template to follow)

```typescript
// server/storage/storageAdapter.ts (existing, lines 18–36)
const handleUpload = async (req: Request, res: Response) => {
  try {
    const { filename, data } = req.body;
    if (!filename || !data) {
      return res.status(400).json({ error: "Missing filename or data" });
    }
    const buffer = Buffer.from(data, 'base64');
    const ext = (filename.split('.').pop() || '').toLowerCase();
    const contentType = mimeFromExt[ext] || "application/octet-stream";
    const publicUrl = await storageService.uploadBuffer(buffer, filename, contentType);
    res.json({ path: publicUrl });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ error: "Failed to upload file" });
  }
};

app.post("/api/upload", requireAdmin, handleUpload);
```

### Existing Supabase upload helper (reuse / extend)

```typescript
// server/storage/supabaseStorage.ts (existing, lines 48–75)
async uploadBuffer(buffer: Buffer, filename: string, contentType?: string): Promise<string> {
  await ensureBucket();
  const supabase = getSupabaseAdmin();
  const ext = filename.split(".").pop() || "png";
  const objectId = `${Date.now()}_${randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(objectId, buffer, {
      contentType: contentType || "application/octet-stream",
      upsert: false,
    });

  if (error) throw new Error(`Failed to upload file: ${error.message}`);

  const { data: urlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(objectId);
  return urlData.publicUrl;
}
```

### Existing client upload helper (reused by new UI in Phase 12)

```typescript
// client/src/components/admin/shared/utils.ts (existing, lines 41–66) — DO NOT modify in Phase 10
export async function uploadFileToServer(file: File): Promise<string> {
  const base64Data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]); // strips "data:image/png;base64,"
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
```

**Note for Phase 12 (not this phase):** A sibling helper `uploadLinksPageAsset(file, assetType)` should be added to `utils.ts` that calls `/api/uploads/links-page` with `{ filename, data, assetType }`. Phase 10 does NOT need to modify client code — it only exposes the endpoint.

### Existing Xpot lead photo — similar scoped-prefix upload (alternative template)

```typescript
// server/routes/xpot/leads.ts (existing, lines 308–341) — path prefix + per-user scoping
const base64 = imageData.replace(/^data:image\/\w+;base64,/, "");
const buffer = Buffer.from(base64, "base64");
const ext = imageData.match(/^data:image\/(\w+);/)?.[1] || "jpg";
const filename = `lead_${leadId}_${Date.now()}.${ext}`;
const path = `photos/${actor!.rep.id}/${filename}`;

const { error } = await supabase.storage.from("uploads").upload(path, buffer, {
  contentType: `image/${ext}`,
  upsert: false,
});
```

This pattern — prefixed path (`photos/...`, analogously `links-page/...`), `upsert: false`, content type from extension — is exactly what Phase 10 needs.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `z.custom<T>()` for JSONB shapes | Explicit `z.object({...})` with `z.infer<>` | v1.2 / Phase 06 | Runtime validation catches malformed client requests before DB write. `insertEstimateSchema` is the repo's current exemplar. |
| Manual `interface` + separate Zod shape | Single `z.infer<typeof schema>` source of truth | v1.2 / Phase 06 | Eliminates drift between TS types and runtime validators; matches `EstimateServiceItem` pattern. |
| Presigned-URL uploads (via `use-upload.ts` + `objectStorage`) | Base64-JSON POST via `/api/upload` + `SupabaseStorageService.uploadBuffer` | Gradual — `use-upload.ts` is Replit-era scaffolding; all current admin uploads use the base64 path | Keeps upload logic on the server where MIME/size/auth enforcement lives. `use-upload.ts` and `ObjectUploader` component still exist but are no longer the convention. |
| Data migration script per JSONB shape change | Lazy normalize on read + persist on first save | v1.3 / Phase 10 (new) | No deploy-time script; rollback is trivial. Appropriate because `company_settings` is a singleton. |

**Deprecated/outdated:**
- `server/replit_integrations/object_storage/routes.ts` (`/api/uploads/request-url`) — still wired but not the convention. Phase 10 should NOT add to this file. If any client code still uses it, leave it alone.
- `client/src/hooks/use-upload.ts` — corresponding unused hook. Do not extend.

## Open Questions

1. **Should the upload endpoint enforce MIME from the buffer's magic bytes, not just the extension?**
   - What we know: extension + `EXT_TO_MIME` map is sufficient for normal cases; no one in the current codebase verifies magic bytes.
   - What's unclear: is the admin surface trusted enough to skip magic-byte validation? (Yes — admin auth is session + `isAdmin` flag, real humans behind login.)
   - Recommendation: **Skip magic-byte check for v1.3.** If adversarial admin uploads ever become a concern, add `file-type` npm package in a future phase.

2. **Should hidden links (`visible: false`) still be included in the payload returned by `GET /api/company-settings`?**
   - What we know: Phase 14 (public render) will filter `visible=false` at the client. The current `GET /api/company-settings` is cached at CDN with 5-minute TTL.
   - What's unclear: do we want public visitors to see the list of hidden links in the JSON body (harmless — just titles/URLs, not secrets) or should we filter server-side?
   - Recommendation: **Return all links including hidden ones.** Admin needs the same endpoint to populate the editor. Public filtering happens in `Links.tsx`. If leaking hidden titles ever matters, split into admin and public endpoints — deferred.

3. **Should `theme` defaults be hard-coded in `normalizeLinksPageConfig` or read from brand tokens?**
   - What we know: CLAUDE.md specifies brand colors — Primary Blue `#1C53A3`, Brand Yellow `#FFFF01`. The Links page currently uses a dark background (`bg-[#0f1014]` in `Links.tsx`).
   - What's unclear: whether theme defaults should be "current visual state of `/links`" (dark) or brand tokens (blue).
   - Recommendation: **Use current visual state as default** (`primaryColor: '#1C53A3'`, `backgroundColor: '#0f1014'`) so the `/links` page is visually unchanged when a legacy row is normalized. Admins can customize via Phase 13 theme editor.

4. **Should the UUID be assigned client-side or server-side for new links?**
   - What we know: The `LinksSection.tsx::addLink` helper today builds a plain object with no `id`. Phase 12 will rewrite this UI.
   - What's unclear: whether Phase 10 (backend-only) should require the client to send a UUID, or accept link objects without `id` and stamp one server-side.
   - Recommendation: **Stamp server-side in the `linksPageConfigSchema` parse.** Make `id` optional in the incoming schema and default to `randomUUID()` via a Zod transform. This keeps Phase 12 UI simpler (no need to generate UUIDs client-side) and prevents client-forgeable IDs. Example:
     ```typescript
     export const linksPageLinkSchema = z.object({
       id: z.string().uuid().optional().transform(v => v ?? randomUUID()),
       // ... rest
     });
     ```

## Validation Architecture

> `workflow.nyquist_validation` is `true` in `.planning/config.json`. However, the project has **no automated test framework** (documented in PROJECT.md "Out of Scope" and CLAUDE.md — "No test framework: manual QA only"). Validation therefore relies on TypeScript strict check + curl smoke tests + manual QA. This section documents that reality.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | **None installed.** Manual QA + `tsc` + shell smoke tests are the only automated guards. |
| Config file | none — see Wave 0 |
| Quick run command | `npx tsc --noEmit` (TypeScript strict check — this is the repo's de facto "test suite") |
| Full suite command | `npx tsc --noEmit && npm run build` (compile both halves of the stack) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LINKS-01 | Extended `LinksPageConfig` shape compiles; `PUT /api/company-settings` accepts new shape and rejects invalid | unit (compile) + smoke (curl) | `npx tsc --noEmit` — compiles; `curl -X PUT /api/company-settings ...` returns 200 for valid, 400 for invalid | ✅ (tsc); smoke covered manually |
| LINKS-01 | Legacy row without `id`/`visible` is normalized on read | smoke | `curl /api/company-settings` — inspect returned `linksPageConfig.links[*].id` is a UUID | ✅ (curl-based; manual) |
| LINKS-02 | Upload returns a `https://<supabase>.co/.../links-page/{assetType}/...` URL | smoke | `curl -X POST /api/uploads/links-page -d '{"filename":"a.png","data":"<base64>","assetType":"avatar"}'` → 200, body contains `/storage/v1/object/public/uploads/links-page/avatar/` | manual |
| LINKS-02 | Uploaded URL is publicly retrievable (no auth) | smoke | `curl -I <returned url>` → 200 with `content-type: image/png` | manual |
| LINKS-03 | Newly created link (admin PUT with no `id`) gets a UUID | smoke | `curl -X PUT /api/company-settings -d '{"linksPageConfig":{"links":[{"title":"X","url":"https://x"}]}}'` then GET → link has UUID `id` | manual |
| LINKS-06 | Admin auth required | smoke | `curl -X POST /api/uploads/links-page` (no cookie) → 401 | manual |
| LINKS-06 | Oversized rejected | smoke | POST with 3 MB base64 payload → 413 | manual |
| LINKS-06 | Non-image rejected | smoke | POST with `filename: "x.exe"` → 415 | manual |
| LINKS-06 | Missing env vars surface clearly | unit (optional) | Temporarily unset `SUPABASE_URL`, POST → 503 "Storage not configured" | manual |

### Sampling Rate

- **Per task commit:** `npx tsc --noEmit` (strict mode) — blocks commit if types break.
- **Per wave merge:** `npx tsc --noEmit && npm run build` — full compile. Plus one curl smoke against `npm run dev` to verify `POST /api/uploads/links-page` round-trip.
- **Phase gate:** manual QA checklist in `/gsd:verify-work`:
  1. Admin logs in → opens Links section → saves (no UI change yet) → GET `/api/company-settings` shows UUIDs on links.
  2. Admin uploads a 100 KB PNG via curl with session cookie → receives URL → URL opens the image in browser.
  3. Admin uploads an `.exe` → receives 415.
  4. Admin uploads a 3 MB image → receives 413.
  5. Unauthenticated POST → 401.

### Wave 0 Gaps

- [ ] **No test framework installed** — documented constraint; not a gap to fix in Phase 10. Install is OUT OF SCOPE for v1.3 (per PROJECT.md "Out of Scope" and CLAUDE.md).
- [ ] **Smoke-test script convenience** — optional: add `scripts/smoke-links-upload.ts` that runs a local POST against `/api/uploads/links-page` to make manual QA repeatable. Low priority; can defer.
- [ ] Ensure `npm run check` (which runs `tsc` per `package.json`) passes before Phase 10 merge — this is the canonical "test command" for this repo.

*(No implementation-side Wave 0 gaps: schema files, route registration, storage class, and admin middleware all exist and compile today.)*

## Sources

### Primary (HIGH confidence)
- `shared/schema/settings.ts` (lines 73–82, 144, 236–255) — current `LinksPageConfig` shape and insert schema
- `shared/schema/estimates.ts` (lines 25–62) — exemplar pattern for Zod-validated JSONB with `z.infer<>` types (v1.2 standard)
- `server/storage/storageAdapter.ts` (full file) — canonical admin upload route pattern using base64 JSON
- `server/storage/supabaseStorage.ts` (full file) — Supabase bucket lifecycle, `uploadBuffer`, `getPublicUrl`
- `server/routes/_shared.ts` — `requireAdmin` middleware signature
- `server/routes/company.ts` (lines 63–96) — PUT `/api/company-settings` validation pattern
- `server/app.ts` (lines 31–40) — Express body-parser limit of 50 MB
- `server/lib/supabase.ts` — `getSupabaseAdmin()` singleton and env-var contract
- `server/routes/xpot/leads.ts` (lines 308–341) — alternative upload template with path prefix scoping
- `client/src/components/admin/shared/utils.ts` (lines 41–66) — client `uploadFileToServer` helper (base64 convention)
- `client/src/components/admin/VCardsManager.tsx` (lines 362–411) — admin UI upload UX reference (spinner + toast)
- `client/src/components/admin/LinksSection.tsx` — current Phase-10 consumer (will be redesigned in Phase 12)
- `client/src/pages/Links.tsx` — current public render target
- `package.json` — verified dependency versions (Supabase 2.89, Drizzle 0.39.3, Zod 3.24.2, no multer/busboy installed)
- `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/STATE.md`, `CLAUDE.md` — milestone constraints and decision log
- `.planning/milestones/v1.2-phases/06-db-schema-storage-layer/06-02-PLAN.md` — v1.2 Drizzle push pattern (not needed here; confirms no migration required for JSONB shape changes)

### Secondary (MEDIUM confidence)
- `server/replit_integrations/object_storage/routes.ts` + `client/src/hooks/use-upload.ts` — deprecated alternate upload path (presigned URLs); NOT the repo convention, documented to avoid accidentally extending

### Tertiary (LOW confidence)
- None — all findings verified against in-repo source.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all deps already installed, versions verified from `package.json`
- Architecture: HIGH — patterns directly copied from existing working code (storageAdapter, supabaseStorage, xpot/leads)
- Pitfalls: HIGH for items 1,2,3,6 (grounded in existing code); MEDIUM for item 4 (content-addressed path is a recommendation, not current practice); MEDIUM for item 5 (CDN cache behavior is documented Vercel default, not tested specifically for this endpoint)
- Validation architecture: HIGH — absence of test framework is documented in PROJECT.md and CLAUDE.md; `tsc` is the repo's de facto guard

**Research date:** 2026-04-20
**Valid until:** 2026-05-20 (stable stack, no rapid deps churn)
