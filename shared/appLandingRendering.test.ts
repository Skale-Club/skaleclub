import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppLanding } from "../client/src/components/downloads/AppLanding.js";
import { APP_CATALOG } from "@shared/appCatalog";
import { getAppLanding } from "@shared/appLandings";
import { publicDownloadableApp, type DownloadableApp } from "@shared/schema/downloads";

// The repository's JSX setting is `preserve`; tsx's test transform uses the
// classic JSX runtime, while Vite supplies the production automatic runtime.
Object.assign(globalThis, { React });

const asRow = (input: (typeof APP_CATALOG)[number]): DownloadableApp => ({
  ...input, id: `preview-${input.slug}`, createdAt: new Date(0), updatedAt: new Date(0),
});

test("one shared component renders each app in both languages with its real downloads", () => {
  for (const input of APP_CATALOG) {
    for (const language of ["en", "pt"] as const) {
      const app = publicDownloadableApp(asRow(input));
      const html = renderToStaticMarkup(React.createElement(AppLanding, { app, language }));
      assert.equal((html.match(/<h1\b/g) ?? []).length, 1);
      assert.equal((html.match(/data-testid="app-landing-release"/g) ?? []).length, input.releases.length);
      assert.ok(html.includes(getAppLanding(input.slug, language)!.headline));
      for (const release of input.releases) assert.ok(html.includes(`/api/downloads/${input.slug}/${release.id}`));
      assert.ok(html.includes(language === "pt" ? "/br/downloads" : "/downloads"));
      assert.ok(!html.includes("SHA-256"), "technical release metadata stays out of the simple page");
      assert.ok(!html.includes("Frequently asked"));
    }
  }
});

test("the shared template also supports future apps and withdrawn downloads", () => {
  const input = { ...APP_CATALOG[0], slug: "future-tool", name: "Future Tool", tagline: "A useful tool", releases: [] };
  const app = publicDownloadableApp(asRow(input));
  const html = renderToStaticMarkup(React.createElement(AppLanding, { app, language: "en" }));
  assert.ok(html.includes("Future Tool"));
  assert.ok(html.includes('data-testid="app-landing-no-releases"'));
  assert.ok(!html.includes('data-testid="app-landing-download"'));
  const hidden = publicDownloadableApp(asRow({ ...APP_CATALOG[0], releases: APP_CATALOG[0].releases.map((release) => ({ ...release, isPublished: false })) }));
  assert.ok(!renderToStaticMarkup(React.createElement(AppLanding, { app: hidden, language: "en" })).includes("/api/downloads/xnote/"));
});

test("future Android entries use their platform and keep long catalog copy concise", () => {
  const input = { ...APP_CATALOG[0], slug: "mobile-tool", name: "Mobile Tool", tagline: "A useful mobile tool for everyday tasks. ".repeat(6), description: "A detailed description of the tool. ".repeat(200), features: ["A long useful feature. ".repeat(12)], releases: [{ ...APP_CATALOG[0].releases[0], platform: "android" as const }] };
  const app = publicDownloadableApp(asRow(input));
  const html = renderToStaticMarkup(React.createElement(AppLanding, { app, language: "en" }));
  assert.ok(html.includes("Android app"));
  assert.ok(!html.includes("Windows"));
  const headline = html.match(/<h1[^>]*>(.*?)<\/h1>/)?.[1] ?? "";
  assert.ok(headline.length > 0 && headline.length <= 70);
  assert.ok(!html.includes(input.description));
  assert.ok(html.length < 15000, "catalog text cannot expand the simple layout indefinitely");
});
