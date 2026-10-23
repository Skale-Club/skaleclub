// Run: npx tsx --test shared/links.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { normalizeLinksPageConfig } from "./links.js";

const link = (extra: Record<string, unknown>) =>
  normalizeLinksPageConfig({ links: [{ title: "Game", url: "https://example.com", order: 0, ...extra }] }).links[0];

test("brand colors survive normalization and drop invalid values", () => {
  const normalized = link({ colors: { background: "#121d4a", text: "#fff3d5", accent: "gold" }, iconBare: true });
  assert.deepEqual(normalized.colors, { background: "#121d4a", text: "#fff3d5" });
  assert.equal(normalized.iconBare, true);
});

test("links without brand fields keep the theme look", () => {
  const normalized = link({});
  assert.equal("colors" in normalized, false);
  assert.equal(normalized.iconBare, false);
});
