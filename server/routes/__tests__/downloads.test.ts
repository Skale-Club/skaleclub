import assert from "node:assert/strict";
import { after, test } from "node:test";
import express from "express";
import type { AddressInfo } from "node:net";
import { registerDownloadRoutes } from "../downloads.js";
import { downloadableAppSchema, type DownloadableApp, type DownloadableAppInput } from "#shared/schema/downloads.js";
import { downloadableAppStore } from "../../lib/downloadableApps.js";
import { resolveRoute } from "../../seo/routes.js";
import { injectSeo } from "../../seo/inject.js";
import { collectSitemapUrls } from "../../seo/sitemap.js";
import { getPageSlugsValidationError } from "#shared/pageSlugs.js";
import { isReservedSlug } from "#shared/reservedSlugs.js";
import { APP_CATALOG } from "#shared/appCatalog.js";
import { getAppLanding } from "#shared/appLandings.js";
import { escapeHtml } from "../../seo/head.js";

const input: DownloadableAppInput = {
  slug: "xnote", name: "XNote", tagline: "Notes for your day", description: "A note-taking application.",
  features: ["Quick notes"], isPublished: true,
  releases: [{ id: "windows-x64-1", platform: "windows", architecture: "x64", version: "1.0.0",
    downloadUrl: "https://downloads.example.com/XNote.exe", requirements: "Windows 11", notes: "First release", isPublished: true },
  { id: "linux-draft", platform: "linux", architecture: "x64", version: "2.0.0",
    downloadUrl: "https://downloads.example.com/draft.AppImage", requirements: "", notes: "Private", isPublished: false }],
};
const makeRow = (data = input): DownloadableApp => ({ ...structuredClone(data), id: "00000000-0000-0000-0000-000000000001", createdAt: new Date(), updatedAt: new Date() });
let row = makeRow();
const store: typeof downloadableAppStore = {
  async list() { return [structuredClone(row)]; },
  async get(slug) { return slug === row.slug ? structuredClone(row) : undefined; },
  async create(data) {
    if (data.slug === "duplicate") throw Object.assign(new Error("Duplicate"), { code: "23505" });
    row = makeRow(data); return structuredClone(row);
  },
  async update(id, data) { if (id !== row.id) return undefined; row = makeRow(data); return structuredClone(row); },
};
const app = express();
app.use(express.json());
registerDownloadRoutes(app, store, (req, res, next) => req.get("x-test-admin") === "1" ? next() : void res.status(401).json({ message: "Unauthorized" }), async (row) => row);
const server = app.listen(0, "127.0.0.1");
await new Promise<void>((resolve) => server.once("listening", resolve));
const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
after(() => new Promise<void>((resolve) => server.close(() => resolve())));
const request = (path: string, init?: RequestInit) => fetch(base + path, init);
const write = (data: unknown, method = "POST", path = "/api/admin/downloadable-apps") => request(path, {
  method, headers: { "Content-Type": "application/json", "x-test-admin": "1" }, body: JSON.stringify(data),
});

test("catalog only exposes published apps and published releases with free pricing", async () => {
  row = makeRow();
  const response = await request("/api/downloadable-apps");
  assert.equal(response.headers.get("cache-control"), "no-store");
  const [body] = await response.json();
  assert.equal(body.pricing, "free");
  assert.deepEqual(body.releases.map((release: { id: string }) => release.id), ["windows-x64-1"]);
  row.isPublished = false;
  assert.deepEqual(await (await request("/api/downloadable-apps")).json(), []);
  assert.equal((await request("/api/downloadable-apps/xnote")).status, 404);
});
test("download resolves the exact release, and withdrawal disables the stable URL", async () => {
  row = makeRow();
  const path = "/api/downloads/xnote/windows-x64-1";
  const response = await request(path, { redirect: "manual" });
  assert.equal(response.status, 302);
  assert.equal(response.headers.get("location"), input.releases[0].downloadUrl);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal((await request("/api/downloads/xnote/linux-draft")).status, 404);
  row.releases[0].isPublished = false;
  assert.equal((await request(path)).status, 404);
  row = makeRow({ ...input, isPublished: false });
  assert.equal((await request(path)).status, 404);
  row = makeRow();
  row.releases[0].downloadUrl = "javascript:alert(1)";
  assert.equal((await request(path)).status, 404);
});
test("admin reads and both write methods require authentication", async () => {
  for (const method of ["GET", "POST", "PUT"]) {
    const path = "/api/admin/downloadable-apps" + (method === "PUT" ? `/${row.id}` : "");
    assert.equal((await request(path, { method })).status, 401);
  }
});
test("admin can create, update, and unpublish without affecting SaaS", async () => {
  assert.equal((await write(input)).status, 201);
  const admin = await request("/api/admin/downloadable-apps", { headers: { "x-test-admin": "1" } });
  assert.equal((await admin.json())[0].releases.length, 2);
  assert.equal((await write({ ...input, isPublished: false }, "PUT", `/api/admin/downloadable-apps/${row.id}`)).status, 200);
  assert.deepEqual(await (await request("/api/downloadable-apps")).json(), []);
  assert.equal((await write(input, "PUT", "/api/admin/downloadable-apps/bad-id")).status, 400);
  assert.equal((await write(input, "PUT", "/api/admin/downloadable-apps/00000000-0000-0000-0000-000000000002")).status, 404);
  assert.equal((await write({ ...input, slug: "duplicate" })).status, 409);
});
test("validation rejects malformed or unsafe URLs, duplicate release IDs and billing fields", async () => {
  for (const downloadUrl of ["", "not-a-url", "javascript:alert(1)", "http://example.com/file.exe", "https://user:password@example.com/file.exe"]) {
    const data = { ...input, releases: [{ ...input.releases[0], downloadUrl }] };
    assert.equal((await write(data)).status, 400);
  }
  assert.equal((await write({ ...input, releases: [input.releases[0], input.releases[0]] })).status, 400);
  assert.equal((await write({ ...input, price: 19 })).status, 400);
  const defaults = downloadableAppSchema.parse({ slug: "tool", name: "Tool", tagline: "A tool", description: "Description" });
  assert.equal(defaults.isPublished, false);
  assert.deepEqual(defaults.releases, []);
});
test("default production middleware denies unauthenticated admin requests", async () => {
  const guarded = express();
  registerDownloadRoutes(guarded, store);
  const listener = guarded.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => listener.once("listening", resolve));
  const url = `http://127.0.0.1:${(listener.address() as AddressInfo).port}/api/admin/downloadable-apps`;
  try {
    for (const method of ["GET", "POST", "PUT"]) {
      const response = await fetch(url + (method === "PUT" ? `/${row.id}` : ""), { method });
      assert.equal(response.status, 401);
    }
  } finally { await new Promise<void>((resolve) => listener.close(() => resolve())); }
});
test("SEO serves published app landings and keeps drafts and unknown paths out", async () => {
  const original = downloadableAppStore.get;
  downloadableAppStore.get = store.get;
  try {
    row = makeRow();
    const route = await resolveRoute("/downloads/xnote");
    assert.equal(route.status, 200);
    const html = injectSeo('<html lang="en"><head><title>Site</title></head><body></body></html>', "/downloads/xnote", { settings: null, route });
    assert.match(html, /XNote/);
    assert.ok(html.includes(escapeHtml(getAppLanding("xnote", "en")!.seo.description)));
    assert.match(html, /hreflang="pt-BR"/);
    assert.match(html, /BreadcrumbList/);
    assert.equal((await resolveRoute("/br/downloads/xnote")).status, 200);
    assert.equal((await resolveRoute("/downloads/missing")).status, 404);
    assert.equal((await resolveRoute("/downloads/xnote/extra")).status, 404);
    row.isPublished = false;
    assert.equal((await resolveRoute("/downloads/xnote")).status, 404);
    assert.equal((await resolveRoute("/downloads")).status, 200);
  } finally { downloadableAppStore.get = original; }
});
test("all six landing records and nine pinned downloads resolve through the real routes", async () => {
  const original = downloadableAppStore.get;
  downloadableAppStore.get = store.get;
  try {
    for (const application of APP_CATALOG) {
      row = makeRow(application);
      const response = await request(`/api/downloadable-apps/${application.slug}`);
      assert.equal(response.status, 200);
      assert.equal((await response.json()).releases.length, application.releases.length);
      for (const release of application.releases) {
        const download = await request(`/api/downloads/${application.slug}/${release.id}`, { redirect: "manual" });
        assert.equal(download.status, 302);
        assert.equal(download.headers.get("location"), release.downloadUrl);
      }
      for (const language of ["en", "pt"] as const) {
        const path = `${language === "pt" ? "/br" : ""}/downloads/${application.slug}`;
        const route = await resolveRoute(path);
        assert.equal(route.status, 200);
        const html = injectSeo('<html lang="en"><head><title>Site</title></head><body></body></html>', path, { settings: null, route });
        const copy = getAppLanding(application.slug, language)!;
        assert.ok(html.includes(escapeHtml(copy.seo.title)), `${application.slug}/${language} title`);
        assert.ok(html.includes(escapeHtml(copy.seo.description)), `${application.slug}/${language} description`);
        assert.ok(html.includes(`https://skale.club${path}`));
      }
    }
  } finally { downloadableAppStore.get = original; }
});
test("sitemap includes only published application landings", () => {
  const urls = collectSitemapUrls({ pages: [], posts: [], applications: [makeRow(), { ...makeRow(), slug: "private", isPublished: false }] });
  assert.ok(urls.some((url) => url.path === "/downloads"));
  assert.ok(urls.some((url) => url.path === "/downloads/xnote"));
  assert.ok(urls.some((url) => url.path === "/br/downloads/xnote"));
  assert.ok(!urls.some((url) => url.path.includes("private")));
  assert.equal(isReservedSlug("downloads"), true);
  assert.match(getPageSlugsValidationError({ contact: "downloads/xnote" }) ?? "", /reserved/);
});
