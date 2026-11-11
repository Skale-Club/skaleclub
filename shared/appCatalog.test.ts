import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { test } from "node:test";
import { APP_CATALOG, FUTURE_APP_SLUGS } from "./appCatalog.js";
import { APP_LANDING_SLUGS, getAppLanding } from "./appLandings.js";
import { downloadableAppSchema } from "./schema/downloads.js";

test("all six published applications share the bilingual landing contract", () => {
  assert.deepEqual(APP_CATALOG.map((app) => app.slug), [...APP_LANDING_SLUGS]);
  assert.equal(APP_CATALOG.length, 6);
  assert.equal(APP_CATALOG.reduce((count, app) => count + app.releases.length, 0), 9);
  for (const app of APP_CATALOG) {
    assert.ok(downloadableAppSchema.safeParse(app).success, app.slug);
    for (const language of ["en", "pt"] as const) {
      const copy = getAppLanding(app.slug, language);
      assert.ok(copy, `${app.slug}/${language}`);
      assert.equal(copy.benefits.length, 3);
      assert.ok(copy.headline.length <= 70, `${app.slug} headline stays short`);
      assert.ok(copy.intro.length <= 200, `${app.slug} intro stays short`);
      assert.ok(copy.seo.description.length <= 200);
    }
    for (const release of app.releases) {
      assert.equal(release.platform, "windows");
      assert.equal(release.isPublished, true);
      assert.match(release.sha256 ?? "", /^[a-f0-9]{64}$/);
      assert.ok(release.downloadUrl.includes(`/v${release.version}/`), "download is version-pinned");
      assert.equal(new URL(release.downloadUrl).hostname, "github.com");
    }
    if (app.slug !== "xtation") assert.ok(existsSync(new URL(`../client/public/apps/${app.slug}/logo.png`, import.meta.url)));
  }
  assert.equal(getAppLanding("unknown-app", "en"), undefined);
  assert.deepEqual([...FUTURE_APP_SLUGS], ["xtudio"]);
  assert.ok(!APP_CATALOG.some((app) => ["xtudio", "xpeed", "xcare", "xpecs"].includes(app.slug)));
});

test("the additive migration contains exactly the reviewed catalog data", () => {
  const sql = readFileSync(new URL("../supabase/migrations/20261111192000_app_landing_pages.sql", import.meta.url), "utf8");
  const json = sql.split("$app_catalog$")[1];
  assert.deepEqual(JSON.parse(json), APP_CATALOG);
  assert.match(sql, /ON CONFLICT \(slug\) DO UPDATE/);
  assert.match(sql, /WHERE downloadable_apps.slug = 'xnote'/);
  assert.match(sql, /AND downloadable_apps.is_published = false/);
  assert.match(sql, /AND downloadable_apps.releases = '\[\]'::jsonb/);
  for (const variant of ["youtube", "youtube-music", "home-assistant"]) {
    assert.ok(existsSync(new URL(`../client/public/apps/xtation/${variant}.svg`, import.meta.url)));
  }
});
