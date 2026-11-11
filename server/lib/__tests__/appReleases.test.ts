import assert from "node:assert/strict";
import { test } from "node:test";
import express from "express";
import type { AddressInfo } from "node:net";
import { APP_CATALOG } from "#shared/appCatalog.js";
import { githubReleaseChannel } from "#shared/appReleaseChannels.js";
import type { DownloadableApp } from "#shared/schema/downloads.js";
import { createAppReleaseResolver } from "../appReleases.js";
import { registerDownloadRoutes } from "../../routes/downloads.js";
import { downloadableAppStore } from "../downloadableApps.js";

const row = (index = 0): DownloadableApp => ({ ...structuredClone(APP_CATALOG[index]), id: "00000000-0000-0000-0000-000000000001", createdAt: new Date(0), updatedAt: new Date(0) });
function metadata(repository: string, version = "1.2.3") {
  const apps = APP_CATALOG.filter((app) => app.releases.some((release) => githubReleaseChannel(app.slug, release)?.repository === repository));
  return { tag_name: `v${version}`, draft: false, prerelease: false, assets: apps.flatMap((app) => app.releases.map((saved) => {
    const channel = githubReleaseChannel(app.slug, saved)!;
    const name = channel.filename(version);
    return { name, state: "uploaded", browser_download_url: `https://github.com/Skale-Club/${repository}/releases/download/v${version}/${name}`, digest: `sha256:${"b".repeat(64)}` };
  })) };
}
const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });

test("all nine slots follow the correct stable asset with coherent version, URL and digest", async () => {
  const calls: string[] = [];
  const resolve = createAppReleaseResolver({ request: (async (url) => {
    const repository = String(url).split("/")[5]; calls.push(repository);
    return response(metadata(repository));
  }) as typeof fetch });
  const resolved = await Promise.all(APP_CATALOG.map((_, index) => resolve(row(index))));
  assert.equal(calls.length, 6, "shared repositories and concurrent slots are deduplicated");
  for (const app of resolved) for (const release of app.releases) {
    assert.equal(release.version, "1.2.3");
    assert.ok(release.downloadUrl.includes("/v1.2.3/"));
    assert.equal(release.sha256, "b".repeat(64));
    assert.equal(release.id, APP_CATALOG.find((saved) => saved.slug === app.slug)!.releases.find((saved) => saved.id === release.id)!.id);
  }
  assert.ok(resolved[4].releases[1].downloadUrl.endsWith("Xdeck-1.2.3.zip"));
  assert.ok(resolved[5].releases[1].downloadUrl.endsWith("youtube-music_1.2.3_x64-setup.exe"));
});

test("cache expires, follows another release and preserves last good data through an outage", async () => {
  let clock = 1; let version = "1.0.0"; let calls = 0; let fail = false;
  const resolve = createAppReleaseResolver({ ttlMs: 10, now: () => clock, request: (async () => {
    calls++; if (fail) throw new Error("offline"); return response(metadata("xnote", version));
  }) as typeof fetch });
  assert.equal((await resolve(row())).releases[0].version, "1.0.0");
  version = "2.0.0";
  assert.equal((await resolve(row())).releases[0].version, "1.0.0");
  assert.equal(calls, 1);
  clock = 12;
  assert.equal((await resolve(row())).releases[0].version, "2.0.0");
  fail = true; clock = 24;
  assert.equal((await resolve(row())).releases[0].version, "2.0.0");
  assert.equal(calls, 3);
});

test("unpublished, pinned and unrelated manual slots never call GitHub", async () => {
  let calls = 0;
  const resolve = createAppReleaseResolver({ request: (async () => { calls++; throw new Error("Must not request"); }) as typeof fetch });
  const app = row();
  for (const candidate of [
    { ...app, isPublished: false },
    { ...app, releases: app.releases.map((release) => ({ ...release, isPublished: false })) },
    { ...app, releases: app.releases.map((release) => ({ ...release, autoUpdate: false })) },
    { ...app, releases: app.releases.map((release) => ({ ...release, downloadUrl: "https://example.com/custom.exe" })) },
  ]) assert.deepEqual(await resolve(candidate), candidate);
  assert.equal(calls, 0);
});

test("drafts, prereleases, missing or unsafe assets and API errors keep the saved fallback", async () => {
  for (const mutate of [
    (value: ReturnType<typeof metadata>) => ({ ...value, draft: true }),
    (value: ReturnType<typeof metadata>) => ({ ...value, prerelease: true }),
    (value: ReturnType<typeof metadata>) => ({ ...value, assets: [] }),
    (value: ReturnType<typeof metadata>) => ({ ...value, assets: [{ ...value.assets[0], browser_download_url: "https://evil.example/file.exe" }] }),
    (value: ReturnType<typeof metadata>) => ({ ...value, assets: [{ ...value.assets[0], state: "open" }] }),
  ]) {
    const resolve = createAppReleaseResolver({ request: (async () => response(mutate(metadata("xnote")))) as typeof fetch });
    assert.deepEqual(await resolve(row()), row());
  }
  const resolve = createAppReleaseResolver({ request: (async () => response({}, 429)) as typeof fetch });
  assert.deepEqual(await resolve(row()), row());
});

test("a new binary without a digest never inherits the old checksum", async () => {
  const data = metadata("xnote"); data.assets[0].digest = "";
  const resolve = createAppReleaseResolver({ request: (async () => response(data)) as typeof fetch });
  const result = await resolve(row());
  assert.equal(result.releases[0].version, "1.2.3");
  assert.equal(result.releases[0].sha256, undefined);
});

test("an incomplete newer release preserves the last complete asset for that slot", async () => {
  let clock = 1; let incomplete = false;
  const resolve = createAppReleaseResolver({ ttlMs: 10, now: () => clock, request: (async () => {
    const data = metadata("xnote", incomplete ? "2.0.0" : "1.0.0");
    if (incomplete) data.assets = [];
    return response(data);
  }) as typeof fetch });
  assert.equal((await resolve(row())).releases[0].version, "1.0.0");
  incomplete = true; clock = 12;
  assert.equal((await resolve(row())).releases[0].version, "1.0.0");
});

test("the public API and the existing download URL use the same resolved release", async () => {
  let saved = row();
  const resolve = createAppReleaseResolver({ request: (async () => response(metadata("xnote"))) as typeof fetch });
  const store: typeof downloadableAppStore = { async list() { return [saved]; }, async get() { return saved; }, async create() { return saved; }, async update() { return saved; } };
  const app = express(); registerDownloadRoutes(app, store, (_req, res) => { res.sendStatus(401); }, resolve);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((done) => server.once("listening", done));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    const publicApp = await (await fetch(`${base}/api/downloadable-apps/xnote`)).json();
    assert.equal(publicApp.releases[0].version, "1.2.3");
    const path = `${base}/api/downloads/xnote/${saved.releases[0].id}`;
    const download = await fetch(path, { redirect: "manual" });
    assert.equal(download.headers.get("location"), publicApp.releases[0].downloadUrl);
    saved = { ...saved, isPublished: false };
    assert.equal((await fetch(path)).status, 404);
  } finally { await new Promise<void>((done) => server.close(() => done())); }
});
